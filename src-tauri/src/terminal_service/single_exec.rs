use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::sync::Mutex;

use super::state::get_exec_map;
use super::types::ShellCommandResult;

// Quote-aware string tokenizer for command parsing
pub fn parse_cmd_str(input: &str) -> Vec<String> {
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
        let raw_cmd = trimmed["adb shell ".len()..].trim();
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
