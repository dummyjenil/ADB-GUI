use std::process::Command;

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

// Set device screen orientation
#[tauri::command]
pub async fn set_device_orientation(serial: String, orientation: String) -> std::result::Result<String, String> {
    let check_cmd_result = |out: std::io::Result<std::process::Output>| -> std::result::Result<(), String> {
        match out {
            Ok(o) => {
                let stderr = String::from_utf8_lossy(&o.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if !o.status.success() || stderr.contains("SecurityException") || stdout.contains("SecurityException") || stderr.contains("Permission denial") {
                    let err = if !stderr.is_empty() { stderr } else { stdout };
                    return Err(format!("Device rejected orientation: {}", err));
                }
                Ok(())
            }
            Err(e) => Err(format!("ADB execution failed: {}", e)),
        }
    };

    match orientation.as_str() {
        "auto" => {
            let res = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "1"])
                .output();
            check_cmd_result(res)?;
            Ok("Auto-rotation enabled".to_string())
        }
        "portrait" => {
            let res1 = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"])
                .output();
            check_cmd_result(res1)?;
            let res2 = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "user_rotation", "0"])
                .output();
            check_cmd_result(res2)?;
            Ok("Set orientation to Portrait".to_string())
        }
        "landscape" => {
            let res1 = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"])
                .output();
            check_cmd_result(res1)?;
            let res2 = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "user_rotation", "1"])
                .output();
            check_cmd_result(res2)?;
            Ok("Set orientation to Landscape".to_string())
        }
        "reverse_landscape" => {
            let res1 = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "accelerometer_rotation", "0"])
                .output();
            check_cmd_result(res1)?;
            let res2 = Command::new("adb")
                .args(["-s", &serial, "shell", "settings", "put", "system", "user_rotation", "3"])
                .output();
            check_cmd_result(res2)?;
            Ok("Set orientation to Reverse Landscape".to_string())
        }
        _ => Err("Invalid orientation mode specified".to_string()),
    }
}

// Volume controller helper
#[tauri::command]
pub async fn adjust_volume(serial: String, stream_type: String, direction: String) -> std::result::Result<String, String> {
    let stream_id = match stream_type.as_str() {
        "call" => "0",
        "ring" => "2",
        "music" => "3",
        "alarm" => "4",
        "notification" => "5",
        _ => "3",
    };

    let adj_arg = match direction.as_str() {
        "up" | "raise" => "raise",
        "down" | "lower" => "lower",
        "mute" => "mute",
        "unmute" => "unmute",
        _ => "raise",
    };

    // 1. Try cmd media_session volume --stream <id> --set 0 for mute, or --adj <raise|lower>
    let mut media_args = vec!["-s", &serial, "shell", "cmd", "media_session", "volume", "--stream", stream_id];
    if direction == "mute" {
        media_args.extend_from_slice(&["--set", "0"]);
    } else {
        media_args.extend_from_slice(&["--adj", adj_arg, "--show"]);
    }

    let output1 = Command::new("adb")
        .args(&media_args)
        .output();

    if let Ok(out) = output1 {
        if out.status.success() {
            let stderr_str = String::from_utf8_lossy(&out.stderr);
            if !stderr_str.contains("Error") && !stderr_str.contains("SecurityException") {
                return Ok(format!("Adjusted {} volume: {}", stream_type, direction));
            }
        }
    }

    // 2. Try media volume --stream <id> --adj <adj>
    let output2 = Command::new("adb")
        .args(["-s", &serial, "shell", "media", "volume", "--stream", stream_id, "--adj", adj_arg])
        .output();

    if let Ok(out) = output2 {
        if out.status.success() {
            return Ok(format!("Adjusted {} volume: {}", stream_type, direction));
        }
    }

    // 3. Fallback to keyevent for mute / volume
    if direction == "mute" || direction == "unmute" {
        let key_out = Command::new("adb")
            .args(["-s", &serial, "shell", "input", "keyevent", "164"]) // KEYCODE_VOLUME_MUTE
            .output();
        if let Ok(k_out) = key_out {
            if k_out.status.success() {
                return Ok("Toggled device mute state".to_string());
            }
        }
    } else {
        let keycode = if direction == "up" || direction == "raise" { "24" } else { "25" };
        let key_out = Command::new("adb")
            .args(["-s", &serial, "shell", "input", "keyevent", keycode])
            .output();
        if let Ok(k_out) = key_out {
            if k_out.status.success() {
                return Ok(format!("Triggered volume key {}", direction));
            }
        }
    }

    Err(format!("Failed to adjust {} volume on device", stream_type))
}

// Send swipe gesture
#[tauri::command]
pub async fn send_swipe(
    serial: String,
    x1: i32,
    y1: i32,
    x2: i32,
    y2: i32,
    duration_ms: Option<i32>,
) -> std::result::Result<String, String> {
    let dur_str = duration_ms.unwrap_or(300).to_string();
    let output = Command::new("adb")
        .args([
            "-s",
            &serial,
            "shell",
            "input",
            "swipe",
            &x1.to_string(),
            &y1.to_string(),
            &x2.to_string(),
            &y2.to_string(),
            &dur_str,
        ])
        .output()
        .map_err(|e| format!("Failed to send swipe: {}", e))?;

    if output.status.success() {
        Ok("Swipe gesture sent".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

// Expand status bar notification shade
#[tauri::command]
pub async fn expand_notifications(serial: String) -> std::result::Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "cmd", "statusbar", "expand-notifications"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            return Ok("Notification shade expanded".to_string());
        }
    }

    // Fallback for older Android versions
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "service", "call", "statusbar", "1"])
        .output();

    Ok("Triggered notification shade expand".to_string())
}
