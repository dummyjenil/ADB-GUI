use adb_client::server::ADBServer;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub serial: String,
    pub state: String,
    pub model: String,
    pub connection_type: String, // "usb" or "wifi"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PairResult {
    pub success: bool,
    pub message: String,
}

pub struct AdbState {
    pub active_device: Mutex<Option<String>>,
    pub is_qr_listening: Arc<AtomicBool>,
}

impl AdbState {
    pub fn new() -> Self {
        Self {
            active_device: Mutex::new(None),
            is_qr_listening: Arc::new(AtomicBool::new(false)),
        }
    }
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

        let model = get_device_model(&serial).unwrap_or_else(|| "Android Device".to_string());

        result.push(DeviceInfo {
            serial,
            state: format!("{:?}", d.state),
            model,
            connection_type: conn_type,
        });
    }

    Ok(result)
}

fn get_device_model(serial: &str) -> Option<String> {
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

use mdns_sd::ScopedIp;
use std::collections::HashSet;

fn pick_best_ip(addresses: &HashSet<ScopedIp>) -> Option<ScopedIp> {
    for addr in addresses {
        if addr.is_ipv4() {
            return Some(addr.clone());
        }
    }
    addresses.iter().next().cloned()
}

fn format_target(ip: &ScopedIp, port: u16) -> String {
    if ip.is_ipv4() {
        format!("{}:{}", ip, port)
    } else {
        format!("[{}]:{}", ip, port)
    }
}

// Pair device with IP:Port and 6-digit pair code
#[tauri::command]
pub async fn pair_with_code(ip_port: String, code: String) -> std::result::Result<PairResult, String> {
    let output = Command::new("adb")
        .args(["pair", &ip_port, &code])
        .output()
        .map_err(|e| format!("Failed to run adb pair: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.contains("Successfully paired") || output.status.success() {
        let parts: Vec<&str> = ip_port.split(':').collect();
        let host_ip = parts[0].trim_matches('[').trim_matches(']');

        // Try to discover connect port over mDNS for host_ip
        let mut connect_success = false;
        let mut connected_target = String::new();

        use mdns_sd::{ServiceDaemon, ServiceEvent};
        if let Ok(mdns) = ServiceDaemon::new() {
            if let Ok(receiver) = mdns.browse("_adb-tls-connect._tcp.local.") {
                let start = std::time::Instant::now();
                while start.elapsed() < std::time::Duration::from_secs(3) {
                    if let Ok(event) = receiver.recv_timeout(std::time::Duration::from_millis(300)) {
                        if let ServiceEvent::ServiceResolved(info) = event {
                            for addr in info.get_addresses() {
                                let addr_str = addr.to_string();
                                if addr_str == host_ip || format!("[{}]", addr_str) == parts[0] {
                                    let c_target = format_target(addr, info.get_port());
                                    let conn_res = Command::new("adb").args(["connect", &c_target]).output();
                                    if let Ok(out) = conn_res {
                                        let out_str = String::from_utf8_lossy(&out.stdout).to_string();
                                        if out_str.contains("connected to") || out_str.contains("already connected") {
                                            connect_success = true;
                                            connected_target = c_target;
                                            break;
                                        }
                                    }
                                }
                            }
                            if connect_success {
                                break;
                            }
                        }
                    }
                }
            }
        }

        let message = if connect_success {
            format!("Successfully paired and connected to {}!", connected_target)
        } else {
            format!(
                "Successfully paired with {}! Check main Wireless Debugging screen on phone for the Connect Port and use 'Direct IP' tab.",
                ip_port
            )
        };

        Ok(PairResult {
            success: true,
            message,
        })
    } else {
        Ok(PairResult {
            success: false,
            message: if !stderr.is_empty() { stderr } else { stdout },
        })
    }
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

// Start mDNS QR pairing listener in background
#[tauri::command]
pub async fn start_qr_pair_listener(
    app_handle: AppHandle,
    state: State<'_, AdbState>,
    pin: String,
) -> std::result::Result<String, String> {
    state.is_qr_listening.store(true, Ordering::SeqCst);
    let listening_flag = Arc::clone(&state.is_qr_listening);

    tokio::spawn(async move {
        let _ = app_handle.emit("qr-pairing-status", "Scanning network for Android pairing & connect requests...");

        use mdns_sd::{ServiceDaemon, ServiceEvent};
        if let Ok(mdns) = ServiceDaemon::new() {
            let pair_recv = mdns.browse("_adb-tls-pairing._tcp.local.");
            let connect_recv = mdns.browse("_adb-tls-connect._tcp.local.");

            if let (Ok(pair_rx), Ok(connect_rx)) = (pair_recv, connect_recv) {
                let mut paired = false;
                let mut target_ip_addr: Option<ScopedIp> = None;
                let mut connect_port: Option<u16> = None;
                let mut connected = false;

                while listening_flag.load(Ordering::SeqCst) && !connected {
                    // Check for pairing service if not yet paired
                    if !paired {
                        if let Ok(event) = pair_rx.recv_timeout(std::time::Duration::from_millis(200)) {
                            if let ServiceEvent::ServiceResolved(info) = event {
                                if let Some(ip_addr) = pick_best_ip(info.get_addresses()) {
                                    let pairing_port = info.get_port();
                                    let target = format_target(&ip_addr, pairing_port);

                                    let _ = app_handle.emit(
                                        "qr-pairing-status",
                                        format!("Found pairing service at {}. Pairing...", target),
                                    );

                                    let res = Command::new("adb").args(["pair", &target, &pin]).output();
                                    if let Ok(out) = res {
                                        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                                        if stdout.contains("Successfully paired") {
                                            paired = true;
                                            target_ip_addr = Some(ip_addr.clone());
                                            let _ = app_handle.emit(
                                                "qr-pairing-status",
                                                format!("Paired with {}! Waiting for connect service broadcast...", ip_addr),
                                            );
                                        } else {
                                            let err = String::from_utf8_lossy(&out.stderr).to_string();
                                            let _ = app_handle.emit(
                                                "qr-pairing-status",
                                                format!("Pairing failed: {}", if err.is_empty() { stdout } else { err }),
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Check for connect service broadcast
                    if let Ok(event) = connect_rx.recv_timeout(std::time::Duration::from_millis(200)) {
                        if let ServiceEvent::ServiceResolved(info) = event {
                            if let Some(ip_addr) = pick_best_ip(info.get_addresses()) {
                                if target_ip_addr.is_none() || target_ip_addr.as_ref() == Some(&ip_addr) {
                                    if target_ip_addr.is_none() {
                                        target_ip_addr = Some(ip_addr);
                                    }
                                    connect_port = Some(info.get_port());
                                }
                            }
                        }
                    }

                    // Attempt auto-connect if paired and connect_port is available
                    if paired {
                        if let (Some(ref ip_addr), Some(c_port)) = (&target_ip_addr, connect_port) {
                            let connect_target = format_target(ip_addr, c_port);
                            let _ = app_handle.emit(
                                "qr-pairing-status",
                                format!("Attempting auto-connect to {}...", connect_target),
                            );

                            for _attempt in 1..=3 {
                                let conn_res = Command::new("adb").args(["connect", &connect_target]).output();
                                if let Ok(out) = conn_res {
                                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                                    let combined = format!("{} {}", stdout, stderr);

                                    if combined.contains("connected to") || combined.contains("already connected") {
                                        connected = true;
                                        let _ = app_handle.emit(
                                            "qr-pairing-status",
                                            format!("Device successfully paired and connected to {}!", connect_target),
                                        );
                                        listening_flag.store(false, Ordering::SeqCst);
                                        break;
                                    }
                                }
                                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            }
                        }
                    }
                }
            }
        }
        let _ = app_handle.emit("qr-pairing-status", "QR Discovery listener stopped.");
    });

    Ok("QR listener started".to_string())
}

// Stop mDNS QR pairing listener
#[tauri::command]
pub async fn stop_qr_pair_listener(state: State<'_, AdbState>) -> std::result::Result<String, String> {
    state.is_qr_listening.store(false, Ordering::SeqCst);
    Ok("QR listener stop requested".to_string())
}

// Send Keyevent to target device
#[tauri::command]
pub async fn send_keyevent(serial: String, keycode: i32) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "input", "keyevent", &keycode.to_string()])
        .output()
        .map_err(|e| format!("Failed to send keyevent: {}", e))?;

    if output.status.success() {
        Ok(format!("Sent keycode {}", keycode))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

// Send text input to Android focused field
#[tauri::command]
pub async fn send_text_input(serial: String, text: String) -> std::result::Result<String, String> {
    let formatted_text = text.replace(' ', "%s");
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "input", "text", &formatted_text])
        .output()
        .map_err(|e| format!("Failed to send text: {}", e))?;

    if output.status.success() {
        Ok("Text sent successfully".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

// Cross-Device Clipboard: Push text to phone clipboard
#[tauri::command]
pub async fn set_device_clipboard(serial: String, text: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "cmd", "clipboard", "set", &text])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            return Ok("Clipboard pushed to phone".to_string());
        }
    }

    send_text_input(serial, text).await
}

// Cross-Device Clipboard: Pull text from phone clipboard
#[tauri::command]
pub async fn get_device_clipboard(serial: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "cmd", "clipboard", "get"])
        .output()
        .map_err(|e| format!("Failed to get clipboard: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if !text.is_empty() {
        Ok(text)
    } else {
        Ok("No text on device clipboard or permission restricted".to_string())
    }
}

// Install APK on target device
#[tauri::command]
pub async fn install_apk(serial: String, file_path: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "install", "-r", &file_path])
        .output()
        .map_err(|e| format!("Failed to run adb install: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.contains("Success") || output.status.success() {
        Ok(format!("Successfully installed: {}", file_path))
    } else {
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

// Native OS File Dialog to pick .apk file from File Manager
#[tauri::command]
pub async fn pick_apk_file() -> std::result::Result<Option<String>, String> {
    let file = rfd::AsyncFileDialog::new()
        .add_filter("APK Package", &["apk"])
        .set_title("Select APK File to Install")
        .pick_file()
        .await;

    Ok(file.map(|f| f.path().to_string_lossy().to_string()))
}

// Native OS File Dialog to pick multiple files of any type
#[tauri::command]
pub async fn pick_multiple_files() -> std::result::Result<Option<Vec<String>>, String> {
    let files = rfd::AsyncFileDialog::new()
        .set_title("Select Files to Upload")
        .pick_files()
        .await;

    Ok(files.map(|list| {
        list.into_iter()
            .map(|f| f.path().to_string_lossy().to_string())
            .collect()
    }))
}

// Open URL / Deep Link on Device
#[tauri::command]
pub async fn open_url_on_device(serial: String, url: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", &url])
        .output()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() || !stdout.is_empty() {
        Ok(format!("URL launched: {}", url))
    } else {
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

// Set device screen orientation
#[tauri::command]
pub async fn set_device_orientation(serial: String, orientation: String) -> std::result::Result<String, String> {
    match orientation.as_str() {
        "auto" => {
            let _ = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "1"])
                .output();
            Ok("Auto-rotation enabled".to_string())
        }
        "portrait" => {
            let _ = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"])
                .output();
            let _ = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "user_rotation", "0"])
                .output();
            Ok("Set orientation to Portrait".to_string())
        }
        "landscape" => {
            let _ = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"])
                .output();
            let _ = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "user_rotation", "1"])
                .output();
            Ok("Set orientation to Landscape".to_string())
        }
        "reverse_landscape" => {
            let _ = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"])
                .output();
            let _ = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "user_rotation", "3"])
                .output();
            Ok("Set orientation to Reverse Landscape".to_string())
        }
        _ => Err("Invalid orientation mode".to_string()),
    }
}

// Volume controller helper
#[tauri::command]
pub async fn adjust_volume(serial: String, stream_type: String, direction: String) -> std::result::Result<String, String> {
    // direction can be "raise", "lower", "same", "mute", "unmute"
    // stream_type: "STREAM_MUSIC" (3), "STREAM_RING" (2), "STREAM_ALARM" (4), "STREAM_VOICE_CALL" (0)
    let stream_id = match stream_type.as_str() {
        "call" => "0",
        "ring" => "2",
        "music" => "3",
        "alarm" => "4",
        "notification" => "5",
        _ => "3",
    };

    let dir_val = match direction.as_str() {
        "up" | "raise" => "1",
        "down" | "lower" => "-1",
        "mute" => "-100",
        "unmute" => "100",
        _ => "1",
    };

    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "media", "volume", "--stream", stream_id, "--set", dir_val])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            return Ok(format!("Volume adjusted for stream {}", stream_type));
        }
    }

    // Fallback to standard keyevent if media volume command fails or older Android
    let keycode = if direction == "up" || direction == "raise" { "24" } else { "25" };
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "input", "keyevent", keycode])
        .output();

    Ok(format!("Triggered volume key {}", direction))
}
