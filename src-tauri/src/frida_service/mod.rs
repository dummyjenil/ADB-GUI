pub mod types;

use std::collections::HashMap;
use std::process::Command;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex;
pub use types::*;

// Manage active frida child process sessions
#[derive(Clone, Default)]
pub struct FridaState {
    pub active_processes: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
}

impl FridaState {
    pub fn new() -> Self {
        Self {
            active_processes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// Get host frida CLI version if available
fn get_host_frida_version() -> Option<String> {
    let output = Command::new("frida").arg("--version").output().ok()?;
    if output.status.success() {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !version.is_empty() {
            return Some(version);
        }
    }
    None
}

// Check root access on the target device
fn check_device_root(serial: &str) -> bool {
    if let Ok(output) = Command::new("adb")
        .args(["-s", serial, "shell", "su -c id"])
        .output()
    {
        if output.status.success() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            if out_str.contains("uid=0(root)") {
                return true;
            }
        }
    }
    false
}

// Check if frida server is running on the device
#[tauri::command]
pub async fn check_frida_server_status(
    serial: String,
) -> std::result::Result<FridaServerStatus, String> {
    let host_ver = get_host_frida_version();
    let has_root = check_device_root(&serial);

    // Get device ABI architecture
    let abi_output = Command::new("adb")
        .args(["-s", &serial, "shell", "getprop", "ro.product.cpu.abi"])
        .output()
        .map_err(|e| format!("ADB error: {}", e))?;
    let device_abi = String::from_utf8_lossy(&abi_output.stdout).trim().to_string();

    // Check running processes on device
    let ps_output = Command::new("adb")
        .args(["-s", &serial, "shell", "ps -A || ps"])
        .output()
        .map_err(|e| format!("ADB process check error: {}", e))?;

    let ps_str = String::from_utf8_lossy(&ps_output.stdout);
    let mut is_running = false;
    let mut pid: Option<u32> = None;

    for line in ps_str.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.contains("frida-server") || line_lower.contains("frida_server") {
            is_running = true;
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                if let Ok(p) = parts[1].parse::<u32>() {
                    pid = Some(p);
                }
            }
            break;
        }
    }

    Ok(FridaServerStatus {
        is_running,
        pid,
        binary_path: "/data/local/tmp/frida-server".to_string(),
        device_abi: if device_abi.is_empty() { "arm64-v8a".to_string() } else { device_abi },
        has_root,
        host_frida_version: host_ver,
    })
}

// Start frida-server on device using root permissions
#[tauri::command]
pub async fn start_frida_server(
    serial: String,
    binary_path: Option<String>,
) -> std::result::Result<String, String> {
    let path = binary_path.unwrap_or_else(|| "/data/local/tmp/frida-server".to_string());

    // 1. Chmod permissions
    let chmod_cmd = format!("chmod 755 {}", path);
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "su", "-c", &chmod_cmd])
        .output();

    // 2. Launch daemonized in background
    let run_cmd = format!("{} -D &", path);
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "su", "-c", &run_cmd])
        .output()
        .map_err(|e| format!("Failed to launch frida-server: {}", e))?;

    if !output.status.success() {
        let err_str = String::from_utf8_lossy(&output.stderr);
        if !err_str.is_empty() {
            return Err(format!("Frida server start failed: {}", err_str));
        }
    }

    // Short sleep and verify
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    let status = check_frida_server_status(serial).await?;
    if status.is_running {
        Ok("Frida server is running in background".to_string())
    } else {
        Ok("Frida start command dispatched. Please check status.".to_string())
    }
}

// Stop frida-server on device
#[tauri::command]
pub async fn stop_frida_server(serial: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args([
            "-s",
            &serial,
            "shell",
            "su",
            "-c",
            "pkill -f frida-server || killall frida-server",
        ])
        .output()
        .map_err(|e| format!("Failed to stop frida-server: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if output.status.success() || stdout.is_empty() {
        Ok("Frida server stopped".to_string())
    } else {
        Err(format!("Error stopping frida-server: {}", stderr))
    }
}

// Push local frida-server binary to /data/local/tmp/
#[tauri::command]
pub async fn push_frida_server_binary(
    serial: String,
    local_file_path: String,
) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "push", &local_file_path, "/data/local/tmp/frida-server"])
        .output()
        .map_err(|e| format!("Failed to push binary: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ADB push failed: {}", err));
    }

    // Chmod 755
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "chmod 755 /data/local/tmp/frida-server"])
        .output();

    Ok("frida-server binary deployed to /data/local/tmp/frida-server".to_string())
}

// List running applications and processes on the device
#[tauri::command]
pub async fn list_frida_processes(
    serial: String,
) -> std::result::Result<Vec<FridaProcessInfo>, String> {
    // 1. Get running packages via adb shell ps -A -o PID,NAME,CMDLINE or ps
    let ps_output = Command::new("adb")
        .args(["-s", &serial, "shell", "ps -A -o PID,NAME,ARGS || ps -A || ps"])
        .output()
        .map_err(|e| format!("Failed to list processes: {}", e))?;

    let ps_str = String::from_utf8_lossy(&ps_output.stdout);

    // Get current frontmost focused window/app
    let focus_output = Command::new("adb")
        .args([
            "-s",
            &serial,
            "shell",
            "dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'",
        ])
        .output()
        .ok();
    let focus_str = focus_output
        .as_ref()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    let mut list = Vec::new();
    let mut seen_pids = std::collections::HashSet::new();

    for line in ps_str.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 {
            continue;
        }

        // Try to parse PID and Name
        if let Ok(pid) = parts[1].parse::<u32>() {
            if seen_pids.contains(&pid) {
                continue;
            }
            seen_pids.insert(pid);

            let proc_name = parts.last().unwrap_or(&"unknown").to_string();
            if proc_name.starts_with('[') && proc_name.ends_with(']') {
                continue; // Skip kernel threads
            }

            let is_front = !focus_str.is_empty() && focus_str.contains(&proc_name);

            list.push(FridaProcessInfo {
                pid,
                name: proc_name.clone(),
                identifier: proc_name,
                is_running: true,
                is_frontmost: is_front,
            });
        }
    }

    // Sort: frontmost first, then alphabetical
    list.sort_by(|a, b| {
        if a.is_frontmost != b.is_frontmost {
            b.is_frontmost.cmp(&a.is_frontmost)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(list)
}

// Run Frida script session with live stream to frontend
fn strip_ansi_codes(s: &str) -> String {
    let mut clean = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if let Some(&'[') = chars.peek() {
                chars.next();
                while let Some(&next_c) = chars.peek() {
                    chars.next();
                    if next_c.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
        } else {
            clean.push(c);
        }
    }
    clean
}

// Run Frida script session with live stream to frontend
#[tauri::command]
pub async fn run_frida_script(
    app: AppHandle,
    state: tauri::State<'_, FridaState>,
    serial: String,
    target: String,
    script_code: String,
    is_spawn: bool,
    session_id: String,
) -> std::result::Result<FridaExecutionResult, String> {
    // Write script to a temporary file
    let temp_dir = std::env::temp_dir();
    let script_file_path = temp_dir.join(format!("frida_script_{}.js", session_id));
    std::fs::write(&script_file_path, &script_code)
        .map_err(|e| format!("Failed to create temporary script file: {}", e))?;

    let script_path_str = script_file_path.to_string_lossy().to_string();

    let mut cmd = TokioCommand::new("frida");
    cmd.args(["-D", &serial, "-l", &script_path_str, "-q"]);

    if is_spawn {
        cmd.args(["-f", &target]);
    } else {
        // If target is purely digits, treat as PID, otherwise as name
        if target.chars().all(|c| c.is_ascii_digit()) {
            cmd.args(["-p", &target]);
        } else {
            cmd.args(["-n", &target]);
        }
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to launch 'frida' CLI. Ensure frida-tools is installed on your host system: {}",
            e
        )
    })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Store active process
    {
        let mut active_map = state.active_processes.lock().await;
        active_map.insert(session_id.clone(), child);
    }

    let event_name = format!("frida-log-event-{}", session_id);
    let app_clone = app.clone();
    let session_id_clone = session_id.clone();

    // Async Stdout Streamer
    if let Some(stdout) = stdout {
        let app_h = app_clone.clone();
        let ev_name = event_name.clone();
        let s_id = session_id_clone.clone();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(raw_line)) = reader.next_line().await {
                let line = strip_ansi_codes(&raw_line);
                if line.trim().is_empty() {
                    continue;
                }
                let ts = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let level = if line.contains("[!]") || line.to_lowercase().contains("error") {
                    "error"
                } else if line.contains("[*]") {
                    "info"
                } else if line.contains("[+]") {
                    "status"
                } else {
                    "log"
                };

                let payload = FridaLogPayload {
                    session_id: s_id.clone(),
                    level: level.to_string(),
                    message: line,
                    timestamp: ts,
                };
                let _ = app_h.emit(&ev_name, payload);
            }
        });
    }

    // Async Stderr Streamer
    if let Some(stderr) = stderr {
        let app_h = app.clone();
        let ev_name = event_name.clone();
        let s_id = session_id.clone();

        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(raw_line)) = reader.next_line().await {
                let line = strip_ansi_codes(&raw_line);
                if line.trim().is_empty() {
                    continue;
                }
                let ts = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let payload = FridaLogPayload {
                    session_id: s_id.clone(),
                    level: "error".to_string(),
                    message: line,
                    timestamp: ts,
                };
                let _ = app_h.emit(&ev_name, payload);
            }
        });
    }

    Ok(FridaExecutionResult {
        session_id,
        success: true,
        message: "Frida script injected successfully and streaming output".to_string(),
    })
}

// Stop running Frida session
#[tauri::command]
pub async fn stop_frida_script(
    state: tauri::State<'_, FridaState>,
    session_id: String,
) -> std::result::Result<String, String> {
    let mut active_map = state.active_processes.lock().await;
    if let Some(mut child) = active_map.remove(&session_id) {
        let _ = child.kill().await;
        Ok(format!("Session {} terminated", session_id))
    } else {
        Ok("Session not found or already stopped".to_string())
    }
}
