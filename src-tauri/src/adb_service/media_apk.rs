use std::process::Command;

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
