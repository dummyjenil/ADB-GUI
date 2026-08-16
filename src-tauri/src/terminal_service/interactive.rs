use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;
use tokio::sync::Mutex;

use super::state::get_interactive_sessions;
use super::types::InteractiveSession;

#[tauri::command]
pub async fn start_interactive_shell(
    app_handle: AppHandle,
    serial: Option<String>,
    session_id: String,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<bool, String> {
    // Close any existing session with this session_id first to prevent leaks
    let _ = close_interactive_shell(session_id.clone()).await;

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

        let slave_in = unsafe { std::fs::File::from_raw_fd(slave) };
        let slave_out = match slave_in.try_clone() {
            Ok(f) => f,
            Err(e) => {
                unsafe { libc::close(master) };
                return Err(format!("Failed to clone PTY slave FD: {}", e));
            }
        };
        let slave_err = match slave_in.try_clone() {
            Ok(f) => f,
            Err(e) => {
                unsafe { libc::close(master) };
                return Err(format!("Failed to clone PTY slave FD for stderr: {}", e));
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

        let child = match cmd.spawn() {
            Ok(c) => c,
            Err(e) => {
                unsafe { libc::close(master) };
                return Err(format!("Failed to spawn adb shell PTY: {}", e));
            }
        };

        let session = Arc::new(Mutex::new(InteractiveSession {
            master_fd: master,
            child,
        }));

        {
            let sessions_map = get_interactive_sessions();
            let mut map = sessions_map.lock().await;
            map.insert(session_id.clone(), Arc::clone(&session));
        }

        let event_name = format!("terminal-output-{}", session_id);
        let app_handle_out = app_handle.clone();
        let session_id_clone = session_id.clone();

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
                if app_handle_out.emit(&event_name, text).is_err() {
                    break;
                }
            }

            // Notify frontend if process finished/closed
            let close_event = format!("terminal-closed-{}", session_id_clone);
            let _ = app_handle_out.emit(&close_event, true);
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
        let sessions_map = get_interactive_sessions();
        let map = sessions_map.lock().await;

        if let Some(session_arc) = map.get(&session_id) {
            let session = session_arc.lock().await;
            let master = session.master_fd;
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
        let sessions_map = get_interactive_sessions();
        let map = sessions_map.lock().await;

        if let Some(session_arc) = map.get(&session_id) {
            let session = session_arc.lock().await;
            let master = session.master_fd;
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
    let sessions_map = get_interactive_sessions();
    let mut map = sessions_map.lock().await;

    if let Some(session_arc) = map.remove(&session_id) {
        let mut session = session_arc.lock().await;

        #[cfg(unix)]
        {
            if session.master_fd >= 0 {
                unsafe { libc::close(session.master_fd); }
                session.master_fd = -1;
            }
        }

        let _ = session.child.kill().await;
        let _ = session.child.wait().await;
        Ok(true)
    } else {
        Ok(false)
    }
}
