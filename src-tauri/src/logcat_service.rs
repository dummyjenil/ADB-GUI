use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock, RwLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogcatEntry {
    pub id: String,
    pub timestamp: String,
    pub pid: u32,
    pub tid: u32,
    pub priority: String,
    pub tag: String,
    pub message: String,
    pub package_name: Option<String>,
    pub raw: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogcatFilterConfig {
    pub buffers: Vec<String>,
    pub min_priority: String,
    pub pid: Option<u32>,
    pub package_name: Option<String>,
    pub tag: Option<String>,
    pub search: Option<String>,
    pub is_regex: Option<bool>,
    pub clear_history: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageProcessInfo {
    pub pid: u32,
    pub package_name: String,
    pub user: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamBatchEvent {
    pub session_id: String,
    pub entries: Vec<LogcatEntry>,
}

static ACTIVE_LOGCAT_SESSIONS: OnceLock<Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>> = OnceLock::new();
static GLOBAL_LOG_ID_COUNTER: AtomicU64 = AtomicU64::new(1);

fn get_logcat_sessions() -> &'static Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>> {
    ACTIVE_LOGCAT_SESSIONS.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn escape_shell_single_quotes(val: &str) -> String {
    val.replace("'", "'\\''")
}

async fn fetch_process_pid_map(serial: Option<&str>) -> Result<HashMap<u32, String>, String> {
    let mut cmd = Command::new("adb");
    if let Some(s) = serial {
        if !s.trim().is_empty() {
            cmd.arg("-s").arg(s);
        }
    }
    cmd.arg("shell").arg("ps").arg("-A").arg("-o").arg("PID,NAME,USER");

    let output = cmd.output().await.map_err(|e| format!("Failed to exec ps: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut pid_map = HashMap::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            if let Ok(pid) = parts[0].parse::<u32>() {
                let name = parts[1].to_string();
                pid_map.insert(pid, name);
            }
        }
    }
    Ok(pid_map)
}

fn parse_threadtime_line(line: &str, pid_to_package: &HashMap<u32, String>) -> Option<LogcatEntry> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with("--------- beginning of") {
        return None;
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() < 6 {
        return None;
    }

    let timestamp = format!("{} {}", parts[0], parts[1]);
    let pid: u32 = parts[2].parse().ok()?;
    let tid: u32 = parts[3].parse().ok()?;
    let priority = parts[4].to_string();

    if !["V", "D", "I", "W", "E", "F", "A"].contains(&priority.as_str()) {
        return None;
    }

    let remaining = parts[5..].join(" ");
    let (tag, message) = if let Some(colon_idx) = remaining.find(':') {
        let t = remaining[..colon_idx].trim().to_string();
        let m = remaining[colon_idx + 1..].trim().to_string();
        (t, m)
    } else {
        ("System".to_string(), remaining)
    };

    let pkg_name = pid_to_package.get(&pid).cloned();
    let seq = GLOBAL_LOG_ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    let id = format!("log-{}-{}", seq, pid);

    Some(LogcatEntry {
        id,
        timestamp,
        pid,
        tid,
        priority,
        tag,
        message,
        package_name: pkg_name,
        raw: trimmed.to_string(),
    })
}

#[tauri::command]
pub async fn start_logcat_stream(
    app_handle: AppHandle,
    serial: Option<String>,
    session_id: String,
    filter: LogcatFilterConfig,
) -> Result<bool, String> {
    let _ = stop_logcat_stream(session_id.clone()).await;

    // Resolve target PID directly in Rust if package_name is provided
    let mut target_pid = filter.pid;
    if target_pid.is_none() {
        if let Some(ref pkg) = filter.package_name {
            if !pkg.trim().is_empty() && pkg != "all" {
                if let Ok(map) = fetch_process_pid_map(serial.as_deref()).await {
                    for (pid_val, pkg_val) in &map {
                        if pkg_val == pkg {
                            target_pid = Some(*pid_val);
                            break;
                        }
                    }
                }
            }
        }
    }

    let priority_spec = match filter.min_priority.as_str() {
        "V" => "*:V",
        "D" => "*:D",
        "I" => "*:I",
        "W" => "*:W",
        "E" => "*:E",
        "F" => "*:F",
        _ => "*:V",
    };

    let mut shell_pipeline = format!("logcat -v threadtime");

    // Pass -T 1 to tell Android logcat to ONLY stream future live logs (suppressing old past buffer dump)
    if filter.clear_history.unwrap_or(false) {
        shell_pipeline.push_str(" -T 1");
    }

    if !filter.buffers.is_empty() && !filter.buffers.contains(&"all".to_string()) {
        for b in &filter.buffers {
            shell_pipeline.push_str(&format!(" -b {}", b));
        }
    }

    if let Some(pid) = target_pid {
        shell_pipeline.push_str(&format!(" --pid={}", pid));
    }

    shell_pipeline.push_str(&format!(" {}", priority_spec));

    // Pipe grep for package name if PID is not resolved or as extra guarantee
    if target_pid.is_none() {
        if let Some(ref pkg) = filter.package_name {
            if !pkg.trim().is_empty() && pkg != "all" {
                let escaped_pkg = escape_shell_single_quotes(pkg.trim());
                shell_pipeline.push_str(&format!(" | grep -i '{}'", escaped_pkg));
            }
        }
    }

    // Pipe grep for tag
    if let Some(ref tag) = filter.tag {
        if !tag.trim().is_empty() {
            let escaped_tag = escape_shell_single_quotes(tag.trim());
            shell_pipeline.push_str(&format!(" | grep -i '{}'", escaped_tag));
        }
    }

    // Pipe grep for search query
    if let Some(ref search) = filter.search {
        if !search.trim().is_empty() {
            let escaped_search = escape_shell_single_quotes(search.trim());
            if filter.is_regex.unwrap_or(false) {
                shell_pipeline.push_str(&format!(" | grep -E '{}'", escaped_search));
            } else {
                shell_pipeline.push_str(&format!(" | grep -i '{}'", escaped_search));
            }
        }
    }

    let mut cmd = Command::new("adb");
    if let Some(ref s) = serial {
        if !s.trim().is_empty() {
            cmd.arg("-s").arg(s);
        }
    }

    cmd.arg("shell").arg(shell_pipeline);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::null());

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn adb logcat: {}", e))?;
    let stdout = child.stdout.take().ok_or("Failed to capture adb logcat stdout")?;

    let child_arc = Arc::new(Mutex::new(child));
    get_logcat_sessions().lock().await.insert(session_id.clone(), child_arc);

    let session_id_clone = session_id.clone();
    let serial_clone = serial.clone();

    let pid_map_shared = Arc::new(RwLock::new(HashMap::<u32, String>::new()));
    let pid_map_bg = pid_map_shared.clone();
    let serial_bg = serial_clone.clone();

    tokio::spawn(async move {
        loop {
            if let Ok(map) = fetch_process_pid_map(serial_bg.as_deref()).await {
                if let Ok(mut writer) = pid_map_bg.write() {
                    *writer = map;
                }
            }
            tokio::time::sleep(Duration::from_secs(10)).await;
        }
    });

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut batch: Vec<LogcatEntry> = Vec::new();
        let mut last_flush = tokio::time::Instant::now();

        while let Ok(Some(line)) = reader.next_line().await {
            let map_guard = pid_map_shared.read().ok();
            let empty_map = HashMap::new();
            let map_ref = map_guard.as_deref().unwrap_or(&empty_map);

            if let Some(entry) = parse_threadtime_line(&line, map_ref) {
                batch.push(entry);
            }

            if batch.len() >= 150 || last_flush.elapsed() >= Duration::from_millis(100) {
                if !batch.is_empty() {
                    let event_payload = StreamBatchEvent {
                        session_id: session_id_clone.clone(),
                        entries: batch.clone(),
                    };
                    let _ = app_handle.emit("logcat-batch-stream", event_payload);
                    batch.clear();
                }
                last_flush = tokio::time::Instant::now();
            }
        }

        if !batch.is_empty() {
            let event_payload = StreamBatchEvent {
                session_id: session_id_clone,
                entries: batch,
            };
            let _ = app_handle.emit("logcat-batch-stream", event_payload);
        }
    });

    Ok(true)
}

#[tauri::command]
pub async fn stop_logcat_stream(session_id: String) -> Result<bool, String> {
    let mut sessions = get_logcat_sessions().lock().await;
    if let Some(child_arc) = sessions.remove(&session_id) {
        let mut child = child_arc.lock().await;
        let _ = child.kill().await;
    }
    Ok(true)
}

#[tauri::command]
pub async fn clear_logcat_buffer(serial: Option<String>) -> Result<bool, String> {
    let mut cmd = Command::new("adb");
    if let Some(s) = serial {
        if !s.trim().is_empty() {
            cmd.arg("-s").arg(s);
        }
    }
    cmd.arg("logcat").arg("-c");
    let output = cmd.output().await.map_err(|e| format!("Failed to clear logcat: {}", e))?;
    Ok(output.status.success())
}

#[tauri::command]
pub async fn get_device_processes(serial: Option<String>) -> Result<Vec<PackageProcessInfo>, String> {
    let mut cmd = Command::new("adb");
    if let Some(s) = serial {
        if !s.trim().is_empty() {
            cmd.arg("-s").arg(s);
        }
    }
    cmd.arg("shell").arg("ps").arg("-A").arg("-o").arg("PID,NAME,USER");

    let output = cmd.output().await.map_err(|e| format!("Failed to list processes: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout);

    let mut result = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            if let Ok(pid) = parts[0].parse::<u32>() {
                let package_name = parts[1].to_string();
                let user = parts[2].to_string();
                result.push(PackageProcessInfo {
                    pid,
                    package_name,
                    user,
                });
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn export_logcat_file(
    logs: Vec<LogcatEntry>,
    format_type: String,
    file_path: String,
) -> Result<bool, String> {
    let mut file = File::create(&file_path).map_err(|e| format!("Failed to create export file: {}", e))?;

    match format_type.as_str() {
        "json" => {
            let json_content = serde_json::to_string_pretty(&logs).map_err(|e| format!("Failed to serialize logs: {}", e))?;
            file.write_all(json_content.as_bytes()).map_err(|e| format!("Write failed: {}", e))?;
        }
        "csv" => {
            let mut csv_content = String::from("Timestamp,Priority,PID,TID,Tag,Package,Message\n");
            for log in logs {
                let pkg = log.package_name.unwrap_or_default();
                let escaped_msg = log.message.replace('"', "\"\"");
                csv_content.push_str(&format!(
                    "\"{}\",\"{}\",{},{},\"{}\",\"{}\",\"{}\"\n",
                    log.timestamp, log.priority, log.pid, log.tid, log.tag, pkg, escaped_msg
                ));
            }
            file.write_all(csv_content.as_bytes()).map_err(|e| format!("Write failed: {}", e))?;
        }
        _ => {
            let mut txt_content = String::new();
            for log in logs {
                txt_content.push_str(&format!("{}\n", log.raw));
            }
            file.write_all(txt_content.as_bytes()).map_err(|e| format!("Write failed: {}", e))?;
        }
    }

    Ok(true)
}
