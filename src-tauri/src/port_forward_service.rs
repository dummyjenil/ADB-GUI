use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpStream};
use std::process::Command;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortMapping {
    pub serial: String,
    pub local: String,  // Host spec (e.g. tcp:6100)
    pub remote: String, // Device spec (e.g. tcp:7100)
    pub mode: String,   // "forward" or "reverse"
}

// List active port forwards via `adb forward --list`
#[tauri::command]
pub async fn list_port_forwards(serial: Option<String>) -> Result<Vec<PortMapping>, String> {
    let mut cmd = Command::new("adb");
    if let Some(ref s) = serial {
        if !s.is_empty() {
            cmd.args(["-s", s]);
        }
    }
    cmd.args(["forward", "--list"]);

    let output = cmd.output().map_err(|e| format!("Failed to list port forwards: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut mappings = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let dev_serial = parts[0].to_string();
            let local_spec = parts[1].to_string();
            let remote_spec = parts[2].to_string();

            if let Some(ref s) = serial {
                if !s.is_empty() && &dev_serial != s {
                    continue;
                }
            }

            mappings.push(PortMapping {
                serial: dev_serial,
                local: local_spec,
                remote: remote_spec,
                mode: "forward".to_string(),
            });
        }
    }

    Ok(mappings)
}

// List active port reverses via `adb reverse --list`
#[tauri::command]
pub async fn list_port_reverses(serial: Option<String>) -> Result<Vec<PortMapping>, String> {
    let mut cmd = Command::new("adb");
    if let Some(ref s) = serial {
        if !s.is_empty() {
            cmd.args(["-s", s]);
        }
    }
    cmd.args(["reverse", "--list"]);

    let output = cmd.output().map_err(|e| format!("Failed to list port reverses: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut mappings = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let dev_serial = parts[0].to_string();
            // adb reverse --list format: <serial> <remote_spec> <local_spec>
            let remote_spec = parts[1].to_string();
            let local_spec = parts[2].to_string();

            if let Some(ref s) = serial {
                if !s.is_empty() && &dev_serial != s {
                    continue;
                }
            }

            mappings.push(PortMapping {
                serial: dev_serial,
                local: local_spec,
                remote: remote_spec,
                mode: "reverse".to_string(),
            });
        }
    }

    Ok(mappings)
}

// Add ADB port forward: adb -s <serial> forward <local> <remote>
#[tauri::command]
pub async fn add_port_forward(
    serial: String,
    local_spec: String,
    remote_spec: String,
) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "forward", &local_spec, &remote_spec])
        .output()
        .map_err(|e| format!("Failed to execute adb forward: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(if stdout.is_empty() {
            format!("Forwarded {} -> {}", local_spec, remote_spec)
        } else {
            stdout
        })
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

// Add ADB port reverse: adb -s <serial> reverse <remote> <local>
#[tauri::command]
pub async fn add_port_reverse(
    serial: String,
    remote_spec: String,
    local_spec: String,
) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "reverse", &remote_spec, &local_spec])
        .output()
        .map_err(|e| format!("Failed to execute adb reverse: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(if stdout.is_empty() {
            format!("Reversed {} -> {}", remote_spec, local_spec)
        } else {
            stdout
        })
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

// Remove specific ADB port forward: adb -s <serial> forward --remove <local>
#[tauri::command]
pub async fn remove_port_forward(serial: String, local_spec: String) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "forward", "--remove", &local_spec])
        .output()
        .map_err(|e| format!("Failed to remove port forward: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(format!("Removed forward {}", local_spec))
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

// Remove specific ADB port reverse: adb -s <serial> reverse --remove <remote>
#[tauri::command]
pub async fn remove_port_reverse(serial: String, remote_spec: String) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "reverse", "--remove", &remote_spec])
        .output()
        .map_err(|e| format!("Failed to remove port reverse: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(format!("Removed reverse {}", remote_spec))
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

// Remove all ADB port forwards: adb -s <serial> forward --remove-all
#[tauri::command]
pub async fn clear_all_port_forwards(serial: String) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "forward", "--remove-all"])
        .output()
        .map_err(|e| format!("Failed to clear all port forwards: {}", e))?;

    if output.status.success() {
        Ok("Cleared all port forwards".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

// Remove all ADB port reverses: adb -s <serial> reverse --remove-all
#[tauri::command]
pub async fn clear_all_port_reverses(serial: String) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "reverse", "--remove-all"])
        .output()
        .map_err(|e| format!("Failed to clear all port reverses: {}", e))?;

    if output.status.success() {
        Ok("Cleared all port reverses".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

// Test TCP port connectivity on 127.0.0.1:<port>
#[tauri::command]
pub async fn test_tcp_port_connection(host: String, port: u16) -> Result<bool, String> {
    let host_ip = if host.is_empty() { "127.0.0.1" } else { &host };
    let addr_str = format!("{}:{}", host_ip, port);
    let addr: SocketAddr = addr_str
        .parse()
        .map_err(|e| format!("Invalid socket address {}: {}", addr_str, e))?;

    let is_connected = tokio::task::spawn_blocking(move || {
        TcpStream::connect_timeout(&addr, Duration::from_millis(1500)).is_ok()
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    Ok(is_connected)
}
