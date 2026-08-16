use adb_client::server::ADBServer;
use std::process::Command;
use super::types::{DeviceInfo, PairResult};

pub fn get_device_model(serial: &str) -> Option<String> {
    let output = Command::new("adb")
        .args(["-s", serial, "shell", "getprop", "ro.product.model"])
        .output()
        .ok()?;

    if output.status.success() {
        let model = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !model.is_empty() {
            return Some(model);
        }
    }
    None
}

// Helper to get connected devices via ADB server TCP 127.0.0.1:5037
#[tauri::command]
pub async fn list_devices() -> std::result::Result<Vec<DeviceInfo>, String> {
    let mut server = ADBServer::default();

    let devices = match server.devices() {
        Ok(devs) => devs,
        Err(_) => {
            let _ = Command::new("adb").arg("start-server").output();
            server.devices().map_err(|e| format!("Error listing devices: {}", e))?
        }
    };

    let mut result = Vec::new();
    for d in devices {
        let serial = d.identifier.clone();
        let conn_type = if serial.contains(':') || serial.contains('.') {
            "wifi".to_string()
        } else {
            "usb".to_string()
        };

        let state_str = format!("{:?}", d.state);
        let state_lower = state_str.to_lowercase();

        // If device is offline, auto-cleanup stale wifi sockets and skip listing
        if state_lower.contains("offline") {
            if conn_type == "wifi" {
                let _ = Command::new("adb").args(["disconnect", &serial]).output();
            }
            continue;
        }

        let model = if state_lower.contains("unauthorized") {
            "Unauthorized Device (Check Phone)".to_string()
        } else if state_lower.contains("device") {
            get_device_model(&serial).unwrap_or_else(|| "Android Device".to_string())
        } else {
            "Android Device".to_string()
        };

        result.push(DeviceInfo {
            serial,
            state: state_str,
            model,
            connection_type: conn_type,
        });
    }

    Ok(result)
}

// Direct connect to device IP:Port
#[tauri::command]
pub async fn connect_device(ip_port: String) -> std::result::Result<PairResult, String> {
    let output = Command::new("adb")
        .args(["connect", &ip_port])
        .output()
        .map_err(|e| format!("Failed to connect to device: {}", e))?;

    let out = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if out.contains("connected to") || out.contains("already connected") {
        Ok(PairResult {
            success: true,
            message: format!("Connected to {}", ip_port),
        })
    } else {
        Ok(PairResult {
            success: false,
            message: out,
        })
    }
}

// Disconnect device
#[tauri::command]
pub async fn disconnect_device(target: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["disconnect", &target])
        .output()
        .map_err(|e| format!("Failed to disconnect: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
