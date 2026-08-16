#[cfg(unix)]
use std::process::Stdio;
#[cfg(unix)]
use std::time::Duration;
#[cfg(unix)]
use tokio::process::Command;

// Helper function to strip ANSI escape codes and control characters from shell output
pub fn strip_ansi_and_controls(input: &str) -> String {
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

        let mut master: libc::c_int = -1;
        let mut slave: libc::c_int = -1;
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

        let slave_in = unsafe { std::fs::File::from_raw_fd(slave) };
        let slave_out = match slave_in.try_clone() {
            Ok(f) => f,
            Err(e) => {
                unsafe { libc::close(master) };
                return Err(format!("Failed to clone slave PTY: {}", e));
            }
        };
        let slave_err = match slave_in.try_clone() {
            Ok(f) => f,
            Err(e) => {
                unsafe { libc::close(master) };
                return Err(format!("Failed to clone slave PTY for stderr: {}", e));
            }
        };

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
