use serde::{Deserialize, Serialize};
use std::process::Command;
use std::fs;
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct UiDumpResult {
    pub success: bool,
    pub screenshot_path: String,
    pub xml_content: String,
    pub error: Option<String>,
}

fn get_temp_dir() -> std::path::PathBuf {
    let mut dir = env::temp_dir();
    dir.push("adb_gui_cache");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Dumps active device screen image to disk file and XML hierarchy via uiautomator
#[tauri::command]
pub async fn dump_ui_hierarchy(serial: String) -> Result<UiDumpResult, String> {
    let ts = chrono_now();
    let temp_img_path = get_temp_dir().join(format!("dump_{}_{}.png", serial.replace(':', "_"), ts));

    // 1. Capture screen image directly to disk
    let cap_output = Command::new("adb")
        .args(["-s", &serial, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| format!("Failed to execute screencap: {}", e))?;

    let img_path_str = if cap_output.status.success() && !cap_output.stdout.is_empty() {
        let _ = fs::write(&temp_img_path, &cap_output.stdout);
        temp_img_path.to_string_lossy().to_string()
    } else {
        String::new()
    };

    // 2. Run uiautomator dump /sdcard/window_dump.xml
    let dump_cmd = Command::new("adb")
        .args(["-s", &serial, "shell", "uiautomator", "dump", "/sdcard/window_dump.xml"])
        .output()
        .map_err(|e| format!("Failed to dump UI hierarchy: {}", e))?;

    let dump_msg = String::from_utf8_lossy(&dump_cmd.stdout);
    if !dump_cmd.status.success() && !dump_msg.contains("UI hierchary dumped to") {
        let err_msg = String::from_utf8_lossy(&dump_cmd.stderr);
        return Ok(UiDumpResult {
            success: false,
            screenshot_path: img_path_str,
            xml_content: String::new(),
            error: Some(format!("uiautomator dump failed: {}", if err_msg.is_empty() { dump_msg } else { err_msg })),
        });
    }

    // 3. Cat XML file from device
    let cat_output = Command::new("adb")
        .args(["-s", &serial, "exec-out", "cat", "/sdcard/window_dump.xml"])
        .output()
        .map_err(|e| format!("Failed to read hierarchy XML: {}", e))?;

    // Cleanup device file
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "rm", "-f", "/sdcard/window_dump.xml"])
        .output();

    let xml_str = String::from_utf8_lossy(&cat_output.stdout).to_string();

    if xml_str.trim().is_empty() {
        return Ok(UiDumpResult {
            success: false,
            screenshot_path: img_path_str,
            xml_content: String::new(),
            error: Some("Retrieved XML hierarchy was empty".to_string()),
        });
    }

    Ok(UiDumpResult {
        success: true,
        screenshot_path: img_path_str,
        xml_content: xml_str,
        error: None,
    })
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", since_the_epoch.as_secs())
}
