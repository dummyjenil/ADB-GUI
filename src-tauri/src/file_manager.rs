use std::process::Command;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceFile {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub permissions: String,
    pub owner: String,
    pub group: String,
    pub modified: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoragePartition {
    pub filesystem: String,
    pub size: String,
    pub used: String,
    pub available: String,
    pub use_percent: String,
    pub mounted_on: String,
}

fn create_adb_command(args: &[&str]) -> Command {
    let mut cmd = Command::new("adb");
    cmd.args(args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[tauri::command]
pub async fn list_device_files(serial: String, path: String) -> Result<Vec<DeviceFile>, String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let mut target_path = if path.trim().is_empty() {
        "/sdcard".to_string()
    } else {
        path.trim().to_string()
    };

    // Ensure directory path ends with '/' so `ls -la /sdcard/` lists directory contents rather than the symlink file info itself
    if !target_path.ends_with('/') {
        target_path.push('/');
    }

    let escaped_path = escape_shell_arg(&target_path);
    let output = create_adb_command(&["-s", &serial, "shell", &format!("ls -la {}", escaped_path)])
        .output()
        .map_err(|e| format!("Failed to execute adb ls: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        let stdout_msg = String::from_utf8_lossy(&output.stdout);
        return Err(if !err_msg.trim().is_empty() {
            err_msg.trim().to_string()
        } else if !stdout_msg.trim().is_empty() {
            stdout_msg.trim().to_string()
        } else {
            "Permission denied or directory missing".to_string()
        });
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut files: Vec<DeviceFile> = Vec::new();

    for line in stdout_str.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() || line_trimmed.starts_with("total ") {
            continue;
        }

        // Parse ls -la output lines e.g.:
        // drwxrwx--- 6 root everybody 20480 2026-08-08 16:24 Download
        // -rw-rw---- 1 root everybody    25 2026-08-02 02:39 .dev
        let parts: Vec<&str> = line_trimmed.split_whitespace().collect();
        if parts.len() < 7 {
            continue;
        }

        let perms = parts[0].to_string();
        let is_dir = perms.starts_with('d') || perms.starts_with('l');

        // Extract fields accounting for optional hardlink count
        let mut idx = 1;
        if parts[idx].parse::<u64>().is_ok() && parts.len() >= 8 {
            idx += 1;
        }

        let owner = parts.get(idx).unwrap_or(&"root").to_string();
        let group = parts.get(idx + 1).unwrap_or(&"root").to_string();
        let size_str = parts.get(idx + 2).unwrap_or(&"0");
        let size = size_str.parse::<u64>().unwrap_or(0);

        let date_part = parts.get(idx + 3).unwrap_or(&"");
        let time_part = parts.get(idx + 4).unwrap_or(&"");
        let modified = format!("{} {}", date_part, time_part).trim().to_string();

        let name_start_idx = idx + 5;
        if name_start_idx >= parts.len() {
            continue;
        }

        let raw_name = parts[name_start_idx..].join(" ");
        // Handle symlinks e.g. "sdcard -> /storage/emulated/0"
        let name = if let Some(sym_idx) = raw_name.find(" -> ") {
            raw_name[..sym_idx].to_string()
        } else {
            raw_name
        };

        if name == "." || name == ".." {
            continue;
        }

        let full_path = format!("{}{}", target_path, name);

        files.push(DeviceFile {
            name,
            path: full_path,
            is_dir,
            size,
            permissions: perms,
            owner,
            group,
            modified,
        });
    }

    // Sort directories first, then alphabetically
    files.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else {
            b.is_dir.cmp(&a.is_dir)
        }
    });

    Ok(files)
}

use tauri::Emitter;

fn escape_shell_arg(arg: &str) -> String {
    format!("\"{}\"", arg.replace('\\', "\\\\").replace('"', "\\\""))
}

fn parse_adb_progress(line: &str) -> Option<u32> {
    if let Some(start) = line.find('[') {
        if let Some(end) = line[start..].find('%') {
            let percent_str = &line[start + 1..start + end].trim();
            if let Ok(num) = percent_str.parse::<u32>() {
                return Some(num.min(100));
            }
        }
    }
    if let Some(idx) = line.find('%') {
        let prefix = &line[..idx];
        let num_str = prefix.split_whitespace().last().unwrap_or("");
        if let Ok(num) = num_str.parse::<u32>() {
            return Some(num.min(100));
        }
    }
    None
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdbFileProgressPayload {
    pub serial: String,
    pub path: String,
    pub percent: u32,
}

#[tauri::command]
pub async fn create_device_directory(serial: String, path: String) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let escaped = escape_shell_arg(&path);
    let output = create_adb_command(&["-s", &serial, "shell", &format!("mkdir -p {}", escaped)])
        .output()
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_device_file_or_dir(serial: String, path: String) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let escaped = escape_shell_arg(&path);
    let output = create_adb_command(&["-s", &serial, "shell", &format!("rm -rf {}", escaped)])
        .output()
        .map_err(|e| format!("Failed to delete: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn rename_or_move_device_file(
    serial: String,
    src_path: String,
    dest_path: String,
) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let esc_src = escape_shell_arg(&src_path);
    let esc_dest = escape_shell_arg(&dest_path);
    let output = create_adb_command(&["-s", &serial, "shell", &format!("mv {} {}", esc_src, esc_dest)])
        .output()
        .map_err(|e| format!("Failed to move/rename: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn copy_device_file(
    serial: String,
    src_path: String,
    dest_path: String,
) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let esc_src = escape_shell_arg(&src_path);
    let esc_dest = escape_shell_arg(&dest_path);
    let output = create_adb_command(&["-s", &serial, "shell", &format!("cp -r {} {}", esc_src, esc_dest)])
        .output()
        .map_err(|e| format!("Failed to copy: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn change_device_file_permissions(
    serial: String,
    path: String,
    mode: String,
) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let escaped = escape_shell_arg(&path);
    let output = create_adb_command(&["-s", &serial, "shell", &format!("chmod {} {}", mode, escaped)])
        .output()
        .map_err(|e| format!("Failed to chmod: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn pull_device_file(
    app_handle: tauri::AppHandle,
    serial: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let mut cmd = tokio::process::Command::new("adb");
    cmd.args(&["-s", &serial, "pull", &remote_path, &local_path]);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| format!("ADB pull spawn failed: {}", e))?;
    let stderr = child.stderr.take();
    let stdout = child.stdout.take();

    let app_handle_c = app_handle.clone();
    let serial_c = serial.clone();
    let remote_c = remote_path.clone();

    let stderr_task = tokio::spawn(async move {
        if let Some(stream) = stderr {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stream).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Some(percent) = parse_adb_progress(&line) {
                    let _ = app_handle_c.emit(
                        "adb-file-progress",
                        AdbFileProgressPayload {
                            serial: serial_c.clone(),
                            path: remote_c.clone(),
                            percent,
                        },
                    );
                }
            }
        }
    });

    let app_handle_c2 = app_handle.clone();
    let serial_c2 = serial.clone();
    let remote_c2 = remote_path.clone();

    let stdout_task = tokio::spawn(async move {
        if let Some(stream) = stdout {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stream).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Some(percent) = parse_adb_progress(&line) {
                    let _ = app_handle_c2.emit(
                        "adb-file-progress",
                        AdbFileProgressPayload {
                            serial: serial_c2.clone(),
                            path: remote_c2.clone(),
                            percent,
                        },
                    );
                }
            }
        }
    });

    let status = child.wait().await.map_err(|e| format!("ADB pull failed: {}", e))?;
    let _ = stderr_task.await;
    let _ = stdout_task.await;

    if !status.success() {
        return Err(format!("ADB pull failed with status {}", status));
    }

    let _ = app_handle.emit(
        "adb-file-progress",
        AdbFileProgressPayload {
            serial,
            path: remote_path,
            percent: 100,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn push_device_file(
    app_handle: tauri::AppHandle,
    serial: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let mut cmd = tokio::process::Command::new("adb");
    cmd.args(&["-s", &serial, "push", &local_path, &remote_path]);
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn().map_err(|e| format!("ADB push spawn failed: {}", e))?;
    let stderr = child.stderr.take();
    let stdout = child.stdout.take();

    let app_handle_c = app_handle.clone();
    let serial_c = serial.clone();
    let remote_c = remote_path.clone();

    let stderr_task = tokio::spawn(async move {
        if let Some(stream) = stderr {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stream).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Some(percent) = parse_adb_progress(&line) {
                    let _ = app_handle_c.emit(
                        "adb-file-progress",
                        AdbFileProgressPayload {
                            serial: serial_c.clone(),
                            path: remote_c.clone(),
                            percent,
                        },
                    );
                }
            }
        }
    });

    let app_handle_c2 = app_handle.clone();
    let serial_c2 = serial.clone();
    let remote_c2 = remote_path.clone();

    let stdout_task = tokio::spawn(async move {
        if let Some(stream) = stdout {
            use tokio::io::AsyncBufReadExt;
            let mut reader = tokio::io::BufReader::new(stream).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Some(percent) = parse_adb_progress(&line) {
                    let _ = app_handle_c2.emit(
                        "adb-file-progress",
                        AdbFileProgressPayload {
                            serial: serial_c2.clone(),
                            path: remote_c2.clone(),
                            percent,
                        },
                    );
                }
            }
        }
    });

    let status = child.wait().await.map_err(|e| format!("ADB push failed: {}", e))?;
    let _ = stderr_task.await;
    let _ = stdout_task.await;

    if !status.success() {
        return Err(format!("ADB push failed with status {}", status));
    }

    let _ = app_handle.emit(
        "adb-file-progress",
        AdbFileProgressPayload {
            serial,
            path: remote_path,
            percent: 100,
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn get_device_storage_info(serial: String) -> Result<Vec<StoragePartition>, String> {
    if serial.trim().is_empty() {
        return Err("No active device selected".to_string());
    }

    let output = create_adb_command(&["-s", &serial, "shell", "df", "-h"])
        .output()
        .map_err(|e| format!("Failed to execute df -h: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let mut partitions: Vec<StoragePartition> = Vec::new();

    for line in stdout_str.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 6 {
            partitions.push(StoragePartition {
                filesystem: parts[0].to_string(),
                size: parts[1].to_string(),
                used: parts[2].to_string(),
                available: parts[3].to_string(),
                use_percent: parts[4].to_string(),
                mounted_on: parts[5].to_string(),
            });
        }
    }

    Ok(partitions)
}
