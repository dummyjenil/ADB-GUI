use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShellCommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub timed_out: bool,
}

// Global thread-safe map for active interactive shell master PTY descriptors
static INTERACTIVE_MASTER_MAP: OnceLock<Arc<Mutex<HashMap<String, i32>>>> = OnceLock::new();
// Global thread-safe map for active interactive child processes
static INTERACTIVE_CHILD_MAP: OnceLock<Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>> = OnceLock::new();
// Global map for single background process executions by exec_id
static SINGLE_EXEC_CHILD_MAP: OnceLock<Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>> = OnceLock::new();

fn get_master_map() -> &'static Arc<Mutex<HashMap<String, i32>>> {
    INTERACTIVE_MASTER_MAP.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn get_child_map() -> &'static Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>> {
    INTERACTIVE_CHILD_MAP.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn get_exec_map() -> &'static Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>> {
    SINGLE_EXEC_CHILD_MAP.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

// Robust quote-aware and whitespace-safe string tokenizer
fn parse_cmd_str(input: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;
    let mut escaped = false;

    for ch in input.chars() {
        if escaped {
            current.push(ch);
            escaped = false;
            continue;
        }

        match ch {
            '\\' if !in_single_quote => {
                escaped = true;
            }
            '\'' if !in_double_quote => {
                in_single_quote = !in_single_quote;
            }
            '"' if !in_single_quote => {
                in_double_quote = !in_double_quote;
            }
            c if c.is_whitespace() && !in_single_quote && !in_double_quote => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            _ => {
                current.push(ch);
            }
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

// -----------------------------------------------------------------------------
// ORGANIC INTERACTIVE ADB SHELL PTY SESSION SERVICE
// -----------------------------------------------------------------------------

#[tauri::command]
pub async fn start_interactive_shell(
    app_handle: AppHandle,
    serial: Option<String>,
    session_id: String,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<bool, String> {
    // Close any existing session with this session_id first
    let _ = close_interactive_shell(session_id.clone()).await;

    #[cfg(unix)]
    {
        use std::os::unix::io::FromRawFd;

        let mut master: libc::c_int = 0;
        let mut slave: libc::c_int = 0;
        unsafe {
            if libc::openpty(
                &mut master,
                &mut slave,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            ) < 0
            {
                return Err("Failed to create pseudo-terminal (openpty)".to_string());
            }
        }

        if let (Some(c), Some(r)) = (cols, rows) {
            let ws = libc::winsize {
                ws_row: r,
                ws_col: c,
                ws_xpixel: 0,
                ws_ypixel: 0,
            };
            unsafe {
                libc::ioctl(master, libc::TIOCSWINSZ, &ws);
            }
        }

        let slave_in = unsafe { std::fs::File::from_raw_fd(libc::dup(slave)) };
        let slave_out = unsafe { std::fs::File::from_raw_fd(libc::dup(slave)) };
        let slave_err = unsafe { std::fs::File::from_raw_fd(slave) };

        let mut args = Vec::new();
        if let Some(s) = &serial {
            if !s.is_empty() {
                args.push("-s".to_string());
                args.push(s.clone());
            }
        }
        args.push("shell".to_string());

        let mut cmd = Command::new("adb");
        cmd.args(&args);
        cmd.stdin(Stdio::from(slave_in));
        cmd.stdout(Stdio::from(slave_out));
        cmd.stderr(Stdio::from(slave_err));

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                unsafe { libc::close(master) };
                return Err(format!("Failed to spawn adb shell PTY: {}", e));
            }
        };

        // Store master FD in map
        {
            let master_map = get_master_map();
            let mut map = master_map.lock().await;
            map.insert(session_id.clone(), master);
        }

        let child_arc = Arc::new(Mutex::new(child));
        {
            let child_map = get_child_map();
            let mut map = child_map.lock().await;
            map.insert(session_id.clone(), Arc::clone(&child_arc));
        }

        let event_name = format!("terminal-output-{}", session_id);
        let app_handle_out = app_handle.clone();

        // Spawn blocking task to read from master PTY FD continuously
        tokio::task::spawn_blocking(move || {
            let mut buffer = [0u8; 4096];
            loop {
                let n = unsafe {
                    libc::read(
                        master,
                        buffer.as_mut_ptr() as *mut libc::c_void,
                        buffer.len(),
                    )
                };
                if n <= 0 {
                    break;
                }
                let text = String::from_utf8_lossy(&buffer[..n as usize]).to_string();
                let _ = app_handle_out.emit(&event_name, text);
            }
        });

        Ok(true)
    }

    #[cfg(not(unix))]
    {
        let _ = (app_handle, serial, session_id, cols, rows);
        Err("PTY terminal is currently supported on Unix platforms".to_string())
    }
}

#[tauri::command]
pub async fn write_terminal_input(session_id: String, input: String) -> Result<bool, String> {
    #[cfg(unix)]
    {
        let master_map = get_master_map();
        let map = master_map.lock().await;

        if let Some(&master) = map.get(&session_id) {
            let bytes = input.as_bytes();
            let res = unsafe {
                libc::write(
                    master,
                    bytes.as_ptr() as *const libc::c_void,
                    bytes.len(),
                )
            };
            if res >= 0 {
                Ok(true)
            } else {
                Err("Failed to write to master PTY".to_string())
            }
        } else {
            Err(format!("No active terminal session for ID: {}", session_id))
        }
    }

    #[cfg(not(unix))]
    {
        let _ = (session_id, input);
        Ok(false)
    }
}

#[tauri::command]
pub async fn resize_terminal_session(
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    #[cfg(unix)]
    {
        let master_map = get_master_map();
        let map = master_map.lock().await;

        if let Some(&master) = map.get(&session_id) {
            let ws = libc::winsize {
                ws_row: rows,
                ws_col: cols,
                ws_xpixel: 0,
                ws_ypixel: 0,
            };
            unsafe {
                libc::ioctl(master, libc::TIOCSWINSZ, &ws);
            }
            Ok(true)
        } else {
            Ok(false)
        }
    }

    #[cfg(not(unix))]
    {
        let _ = (session_id, cols, rows);
        Ok(false)
    }
}

#[tauri::command]
pub async fn close_interactive_shell(session_id: String) -> Result<bool, String> {
    #[cfg(unix)]
    {
        let master_map = get_master_map();
        let mut map = master_map.lock().await;
        if let Some(master) = map.remove(&session_id) {
            unsafe { libc::close(master); }
        }
    }

    // Kill child process if running and reap zombie process
    let child_map = get_child_map();
    let mut map = child_map.lock().await;
    if let Some(child_arc) = map.remove(&session_id) {
        let mut child = child_arc.lock().await;
        let _ = child.kill().await;
        let _ = child.wait().await;
        Ok(true)
    } else {
        Ok(false)
    }
}

// Single non-interactive command execution helper
#[tauri::command]
pub async fn execute_terminal_command(
    serial: Option<String>,
    command: String,
    timeout_secs: Option<u64>,
    exec_id: Option<String>,
) -> std::result::Result<ShellCommandResult, String> {
    let start_time = std::time::Instant::now();
    let trimmed = command.trim();

    if trimmed.is_empty() {
        return Err("Command cannot be empty".to_string());
    }

    let mut base_args = Vec::new();
    if let Some(s) = &serial {
        if !s.is_empty() {
            base_args.push("-s".to_string());
            base_args.push(s.clone());
        }
    }

    let parsed_tokens = parse_cmd_str(trimmed);

    let (program, final_args) = if trimmed.starts_with("adb shell ") {
        let raw_cmd = trimmed.trim_start_matches("adb shell ").trim();
        base_args.push("shell".to_string());
        base_args.push(raw_cmd.to_string());
        ("adb", base_args)
    } else if trimmed.starts_with("adb ") {
        for t in parsed_tokens.into_iter().skip(1) {
            base_args.push(t);
        }
        ("adb", base_args)
    } else {
        base_args.push("shell".to_string());
        base_args.push(trimmed.to_string());
        ("adb", base_args)
    };

    let mut cmd = Command::new(program);
    cmd.args(&final_args);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();

    let child_arc = Arc::new(Mutex::new(child));
    if let Some(ref id) = exec_id {
        let exec_map = get_exec_map();
        let mut map = exec_map.lock().await;
        map.insert(id.clone(), Arc::clone(&child_arc));
    }

    let stdout_fut = async {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stdout_pipe {
            let _ = pipe.read_to_end(&mut buf).await;
        }
        buf
    };

    let stderr_fut = async {
        let mut buf = Vec::new();
        if let Some(mut pipe) = stderr_pipe {
            let _ = pipe.read_to_end(&mut buf).await;
        }
        buf
    };

    let child_wait_fut = async {
        let mut child_guard = child_arc.lock().await;
        child_guard.wait().await
    };

    let execution_future = async {
        let (out_bytes, err_bytes, status_res) = tokio::join!(stdout_fut, stderr_fut, child_wait_fut);
        (out_bytes, err_bytes, status_res)
    };

    let timeout_duration = timeout_secs
        .filter(|&t| t > 0)
        .map(Duration::from_secs);

    let result = if let Some(dur) = timeout_duration {
        match tokio::time::timeout(dur, execution_future).await {
            Ok((out_bytes, err_bytes, status_res)) => {
                let duration_ms = start_time.elapsed().as_millis() as u64;
                let status = status_res.map_err(|e| format!("Wait error: {}", e))?;
                Ok(ShellCommandResult {
                    exit_code: status.code().unwrap_or(-1),
                    stdout: String::from_utf8_lossy(&out_bytes).to_string(),
                    stderr: String::from_utf8_lossy(&err_bytes).to_string(),
                    duration_ms,
                    timed_out: false,
                })
            }
            Err(_) => {
                let mut child_guard = child_arc.lock().await;
                let _ = child_guard.kill().await;
                let _ = child_guard.wait().await;
                let duration_ms = start_time.elapsed().as_millis() as u64;
                Ok(ShellCommandResult {
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: format!("Command timed out after {} seconds", dur.as_secs()),
                    duration_ms,
                    timed_out: true,
                })
            }
        }
    } else {
        let (out_bytes, err_bytes, status_res) = execution_future.await;
        let duration_ms = start_time.elapsed().as_millis() as u64;
        let status = status_res.map_err(|e| format!("Wait error: {}", e))?;
        Ok(ShellCommandResult {
            exit_code: status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&out_bytes).to_string(),
            stderr: String::from_utf8_lossy(&err_bytes).to_string(),
            duration_ms,
            timed_out: false,
        })
    };

    if let Some(ref id) = exec_id {
        let exec_map = get_exec_map();
        let mut map = exec_map.lock().await;
        map.remove(id);
    }

    result
}

#[tauri::command]
pub async fn kill_terminal_command(exec_id: String) -> std::result::Result<bool, String> {
    let exec_map = get_exec_map();
    let mut map = exec_map.lock().await;
    if let Some(child_arc) = map.remove(&exec_id) {
        let mut child = child_arc.lock().await;
        let _ = child.kill().await;
        let _ = child.wait().await;
        Ok(true)
    } else {
        Ok(false)
    }
}

// Helper function to strip ANSI escape codes and control characters from shell output
fn strip_ansi_and_controls(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\x1b' {
            if let Some(&'[') = chars.peek() {
                chars.next();
                while let Some(&c) = chars.peek() {
                    chars.next();
                    if c >= '@' && c <= '~' {
                        break;
                    }
                }
            }
        } else if ch == '\r' || ch == '\x07' || ch == '\x08' {
            continue;
        } else {
            out.push(ch);
        }
    }
    out
}

#[tauri::command]
pub async fn get_shell_autocompletions(
    serial: Option<String>,
    input: String,
) -> Result<Vec<String>, String> {
    #[cfg(unix)]
    {
        use std::os::unix::io::FromRawFd;

        let mut master: libc::c_int = 0;
        let mut slave: libc::c_int = 0;
        unsafe {
            if libc::openpty(
                &mut master,
                &mut slave,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            ) < 0
            {
                return Err("Failed to create pseudo-terminal (openpty)".to_string());
            }
        }

        let slave_in = unsafe { std::fs::File::from_raw_fd(libc::dup(slave)) };
        let slave_out = unsafe { std::fs::File::from_raw_fd(libc::dup(slave)) };
        let slave_err = unsafe { std::fs::File::from_raw_fd(slave) };

        let mut args = Vec::new();
        if let Some(s) = &serial {
            if !s.is_empty() {
                args.push("-s".to_string());
                args.push(s.clone());
            }
        }
        args.push("shell".to_string());

        let mut cmd = Command::new("adb");
        cmd.args(&args);
        cmd.stdin(Stdio::from(slave_in));
        cmd.stdout(Stdio::from(slave_out));
        cmd.stderr(Stdio::from(slave_err));

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                unsafe { libc::close(master) };
                return Err(format!("Failed to spawn adb shell for autocomplete: {}", e));
            }
        };

        // Set master to non-blocking mode
        unsafe {
            let flags = libc::fcntl(master, libc::F_GETFL, 0);
            libc::fcntl(master, libc::F_SETFL, flags | libc::O_NONBLOCK);
        }

        // Short sleep for prompt initialization
        tokio::time::sleep(Duration::from_millis(120)).await;

        // Drain initial prompt output
        let mut tmp_buf = [0u8; 1024];
        loop {
            let n = unsafe {
                libc::read(
                    master,
                    tmp_buf.as_mut_ptr() as *mut libc::c_void,
                    tmp_buf.len(),
                )
            };
            if n <= 0 {
                break;
            }
        }

        // Write user input + TAB character
        let payload = format!("{}\t", input);
        let bytes = payload.as_bytes();
        unsafe {
            libc::write(
                master,
                bytes.as_ptr() as *const libc::c_void,
                bytes.len(),
            );
        }

        // Read autocomplete response with timeout loop matching prototype/demo.py
        let start = std::time::Instant::now();
        let timeout = Duration::from_millis(220);
        let mut raw_buf = Vec::new();

        loop {
            let n = unsafe {
                libc::read(
                    master,
                    tmp_buf.as_mut_ptr() as *mut libc::c_void,
                    tmp_buf.len(),
                )
            };
            if n > 0 {
                raw_buf.extend_from_slice(&tmp_buf[..n as usize]);
            } else {
                if start.elapsed() >= timeout {
                    break;
                }
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        }

        // Clean up process & master FD
        let _ = child.kill().await;
        let _ = child.wait().await;
        unsafe { libc::close(master) };

        let raw_str = String::from_utf8_lossy(&raw_buf).to_string();
        let cleaned = strip_ansi_and_controls(&raw_str);

        let input_trimmed = input.trim().to_lowercase();
        let input_tokens: Vec<&str> = input.trim().split_whitespace().collect();
        let last_token = input_tokens.last().copied().unwrap_or("").to_lowercase();

        let mut suggestions = Vec::new();
        for line in cleaned.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.contains('$') || trimmed.contains('#') {
                continue;
            }
            for part in trimmed.split_whitespace() {
                let item = part.to_string();
                let item_lower = item.to_lowercase();

                // Exclude matches with current full input, current last token, or prompt commands
                if item_lower == input_trimmed
                    || item_lower == last_token
                    || item == "adb"
                    || item == "shell"
                {
                    continue;
                }

                if !suggestions.contains(&item) {
                    suggestions.push(item);
                }
            }
        }

        Ok(suggestions)
    }

    #[cfg(not(unix))]
    {
        let _ = (serial, input);
        Ok(Vec::new())
    }
}


