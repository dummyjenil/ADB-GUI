use std::process::Command;
use super::input::send_text_input;

// Cross-Device Clipboard: Push text to phone clipboard
#[tauri::command]
pub async fn set_device_clipboard(serial: String, text: String) -> std::result::Result<String, String> {
    // 1. Try cmd clipboard set
    let cmd_out = Command::new("adb")
        .args(["-s", &serial, "shell", "cmd", "clipboard", "set", &text])
        .output();

    if let Ok(out) = cmd_out {
        if out.status.success() {
            let stderr_str = String::from_utf8_lossy(&out.stderr);
            if !stderr_str.contains("SecurityException") && !stderr_str.contains("Permission Denial") {
                return Ok("Clipboard pushed to device successfully".to_string());
            }
        }
    }

    // 2. Try service call clipboard (Android IPC)
    let service_out = Command::new("adb")
        .args(["-s", &serial, "shell", "service", "call", "clipboard", "2", "i32", "1", "i32", "0", "s16", &text])
        .output();

    if let Ok(out) = service_out {
        if out.status.success() {
            let out_str = String::from_utf8_lossy(&out.stdout);
            if out_str.contains("Result: Parcel") {
                return Ok("Clipboard updated via system service".to_string());
            }
        }
    }

    // 3. Fallback to direct input text
    send_text_input(serial, text).await
}

// Cross-Device Clipboard: Pull text from phone clipboard
#[tauri::command]
pub async fn get_device_clipboard(serial: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "cmd", "clipboard", "get"])
        .output()
        .map_err(|e| format!("Failed to run clipboard read: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if !stdout.is_empty() && !stdout.starts_with("SecurityException") && !stdout.starts_with("Error:") && !stdout.contains("No shell command") {
        Ok(stdout)
    } else {
        Err("Android 10+ security restricts background clipboard reading over raw ADB. Use 'Push to Device' or focus an input field on device.".to_string())
    }
}
