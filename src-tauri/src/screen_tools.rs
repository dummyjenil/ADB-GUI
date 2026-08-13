use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;
use std::fs;
use std::env;

static RECORDING_ACTIVE: Mutex<bool> = Mutex::new(false);

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenshotResult {
    pub success: bool,
    pub file_path: String,
    pub timestamp: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScreenRecordResult {
    pub success: bool,
    pub file_path: String,
    pub timestamp: String,
    pub error: Option<String>,
}

fn get_temp_dir() -> std::path::PathBuf {
    let mut dir = env::temp_dir();
    dir.push("adb_gui_cache");
    let _ = fs::create_dir_all(&dir);
    dir
}

/// Takes a screenshot of the connected Android device using `exec-out screencap -p` and saves directly to disk
#[tauri::command]
pub async fn take_screenshot(serial: String) -> Result<ScreenshotResult, String> {
    let ts = chrono_now();
    let temp_file = get_temp_dir().join(format!("screenshot_{}_{}.png", serial.replace(':', "_"), ts));

    let output = Command::new("adb")
        .args(["-s", &serial, "exec-out", "screencap", "-p"])
        .output()
        .map_err(|e| format!("Failed to execute screencap: {}", e))?;

    if !output.status.success() || output.stdout.is_empty() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Ok(ScreenshotResult {
            success: false,
            file_path: String::new(),
            timestamp: ts,
            error: Some(if err_msg.is_empty() { "Failed to capture screenshot".to_string() } else { err_msg.to_string() }),
        });
    }

    // Save PNG bytes directly to temp disk file (Zero Base64 memory overhead)
    fs::write(&temp_file, &output.stdout)
        .map_err(|e| format!("Failed to write screenshot to temp disk file: {}", e))?;

    Ok(ScreenshotResult {
        success: true,
        file_path: temp_file.to_string_lossy().to_string(),
        timestamp: ts,
        error: None,
    })
}

/// Starts screen recording on the connected device via `adb shell screenrecord /sdcard/adb_gui_record.mp4`
#[tauri::command]
pub async fn start_screen_recording(
    serial: String,
    bit_rate: Option<u32>,
    time_limit: Option<u32>,
) -> Result<String, String> {
    let mut lock = RECORDING_ACTIVE.lock().unwrap();
    if *lock {
        return Err("Screen recording is already in progress".to_string());
    }

    // Clean old recording file on device first
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "rm", "-f", "/sdcard/adb_gui_record.mp4"])
        .output();

    let mut args = vec!["-s".to_string(), serial, "shell".to_string(), "screenrecord".to_string()];

    if let Some(br) = bit_rate {
        args.push("--bit-rate".to_string());
        args.push(br.to_string());
    }

    if let Some(tl) = time_limit {
        args.push("--time-limit".to_string());
        args.push(tl.to_string());
    }

    args.push("/sdcard/adb_gui_record.mp4".to_string());

    let child = Command::new("adb")
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to start screenrecord process: {}", e))?;

    *lock = true;
    std::mem::forget(child); // Let background process run on device

    Ok("Recording started successfully".to_string())
}

/// Stops screen recording by sending SIGINT to screenrecord, pulls MP4 file to local temp disk, and returns file path
#[tauri::command]
pub async fn stop_screen_recording(serial: String) -> Result<ScreenRecordResult, String> {
    {
        let mut lock = RECORDING_ACTIVE.lock().unwrap();
        *lock = false;
    }

    // Send SIGINT to screenrecord process on device so it writes MP4 header cleanly
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "pkill", "-INT", "screenrecord"])
        .output();

    // Give screenrecord 1.5 seconds to finalize writing MP4 container
    tokio::time::sleep(Duration::from_millis(1500)).await;

    let ts = chrono_now();
    let temp_file = get_temp_dir().join(format!("recording_{}_{}.mp4", serial.replace(':', "_"), ts));

    // Pull recording directly to local disk file (Zero Base64 memory overhead)
    let pull_output = Command::new("adb")
        .args(["-s", &serial, "pull", "/sdcard/adb_gui_record.mp4", &temp_file.to_string_lossy()])
        .output()
        .map_err(|e| format!("Failed to pull video file from device: {}", e))?;

    // Cleanup device file
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "rm", "-f", "/sdcard/adb_gui_record.mp4"])
        .output();

    if !pull_output.status.success() || !temp_file.exists() || fs::metadata(&temp_file).map(|m| m.len()).unwrap_or(0) == 0 {
        return Ok(ScreenRecordResult {
            success: false,
            file_path: String::new(),
            timestamp: ts,
            error: Some("Recorded video file was empty or failed to pull".to_string()),
        });
    }

    Ok(ScreenRecordResult {
        success: true,
        file_path: temp_file.to_string_lossy().to_string(),
        timestamp: ts,
        error: None,
    })
}

/// Copies temp file from cache directory to user selected target location using native save dialog
#[tauri::command]
pub async fn save_media_file(
    temp_file_path: String,
    default_filename: String,
) -> Result<String, String> {
    use rfd::AsyncFileDialog;

    let source = std::path::Path::new(&temp_file_path);
    if !source.exists() {
        return Err("Source temporary file does not exist".to_string());
    }

    let file = AsyncFileDialog::new()
        .set_file_name(&default_filename)
        .save_file()
        .await;

    if let Some(handle) = file {
        fs::copy(source, handle.path()).map_err(|e| format!("Failed to save file: {}", e))?;
        Ok(handle.path().to_string_lossy().to_string())
    } else {
        Err("Save cancelled by user".to_string())
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}", since_the_epoch.as_secs())
}
