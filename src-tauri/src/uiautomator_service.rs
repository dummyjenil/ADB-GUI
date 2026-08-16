use serde::{Deserialize, Serialize};
use std::process::Command;
use std::fs;
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct UiDumpResult {
    pub success: bool,
    pub screenshot_path: String,
    pub data_url: Option<String>,
    pub xml_content: String,
    pub error: Option<String>,
    pub display_width: Option<u32>,
    pub display_height: Option<u32>,
}

fn to_base64(bytes: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        out.push(CHARSET[(b0 >> 2) as usize] as char);
        out.push(CHARSET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARSET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARSET[(b2 & 0x3f) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

fn get_temp_dir() -> std::path::PathBuf {
    let mut dir = env::temp_dir();
    dir.push("adb_gui_cache");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Dumps active device screen image and XML hierarchy via uiautomator
#[tauri::command]
pub async fn dump_ui_hierarchy(serial: String) -> Result<UiDumpResult, String> {
    let ts = chrono_now();
    let temp_img_path = get_temp_dir().join(format!("dump_{}_{}.png", serial.replace(':', "_"), ts));

    // 1. Check if device screen is active / awake
    let power_check = Command::new("adb")
        .args(["-s", &serial, "shell", "dumpsys", "power"])
        .output();

    if let Ok(ref p_out) = power_check {
        let p_str = String::from_utf8_lossy(&p_out.stdout);
        if p_str.contains("mWakefulness=Asleep") || p_str.contains("Display Power: state=OFF") {
            return Ok(UiDumpResult {
                success: false,
                screenshot_path: String::new(),
                data_url: None,
                xml_content: String::new(),
                error: Some("Phone screen is turned OFF or asleep. Please turn on and unlock your phone before inspecting UI.".to_string()),
                display_width: None,
                display_height: None,
            });
        }
    }

    // Query physical / override display dimensions
    let mut disp_w = None;
    let mut disp_h = None;
    if let Ok(wm_out) = Command::new("adb").args(["-s", &serial, "shell", "wm", "size"]).output() {
        let wm_str = String::from_utf8_lossy(&wm_out.stdout);
        for line in wm_str.lines() {
            if line.contains("Override size:") || line.contains("Physical size:") {
                if let Some(dim) = line.split(':').nth(1) {
                    let parts: Vec<&str> = dim.trim().split('x').collect();
                    if parts.len() == 2 {
                        if let (Ok(w), Ok(h)) = (parts[0].trim().parse::<u32>(), parts[1].trim().parse::<u32>()) {
                            disp_w = Some(w);
                            disp_h = Some(h);
                        }
                    }
                }
            }
        }
    }

    // 2. Capture screen image
    let cap_output = Command::new("adb")
        .args(["-s", &serial, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| format!("Failed to execute screencap: {}", e))?;

    if !cap_output.status.success() || cap_output.stdout.is_empty() {
        let err_msg = String::from_utf8_lossy(&cap_output.stderr);
        return Ok(UiDumpResult {
            success: false,
            screenshot_path: String::new(),
            data_url: None,
            xml_content: String::new(),
            error: Some(format!("Screen capture failed: {}. Ensure device screen is ON and not displaying DRM-protected content.", if err_msg.is_empty() { "No image output" } else { &err_msg })),
            display_width: disp_w,
            display_height: disp_h,
        });
    }

    let _ = fs::write(&temp_img_path, &cap_output.stdout);
    let data_url_str = format!("data:image/png;base64,{}", to_base64(&cap_output.stdout));

    // 3. Run uiautomator dump /sdcard/window_dump.xml
    let dump_cmd = Command::new("adb")
        .args(["-s", &serial, "shell", "uiautomator", "dump", "/sdcard/window_dump.xml"])
        .output()
        .map_err(|e| format!("Failed to dump UI hierarchy: {}", e))?;

    let dump_msg = String::from_utf8_lossy(&dump_cmd.stdout);
    if !dump_cmd.status.success() && !dump_msg.contains("UI hierchary dumped to") && !dump_msg.contains("UI hierarchy dumped to") {
        let err_msg = String::from_utf8_lossy(&dump_cmd.stderr);
        return Ok(UiDumpResult {
            success: false,
            screenshot_path: temp_img_path.to_string_lossy().to_string(),
            data_url: Some(data_url_str),
            xml_content: String::new(),
            error: Some(format!("uiautomator dump failed: {}. Phone might be in sleep or UI transition.", if err_msg.is_empty() { dump_msg.to_string() } else { err_msg.to_string() })),
            display_width: disp_w,
            display_height: disp_h,
        });
    }

    // 4. Cat XML file from device
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
            screenshot_path: temp_img_path.to_string_lossy().to_string(),
            data_url: Some(data_url_str),
            xml_content: String::new(),
            error: Some("Retrieved XML hierarchy was empty. Ensure phone screen is unlocked.".to_string()),
            display_width: disp_w,
            display_height: disp_h,
        });
    }

    Ok(UiDumpResult {
        success: true,
        screenshot_path: temp_img_path.to_string_lossy().to_string(),
        data_url: Some(data_url_str),
        xml_content: xml_str,
        error: None,
        display_width: disp_w,
        display_height: disp_h,
    })
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", since_the_epoch.as_secs())
}

