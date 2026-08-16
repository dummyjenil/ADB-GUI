use std::process::Command;
use super::utils::run_adb_shell;

#[tauri::command]
pub async fn install_apks(serial: String, file_paths: Vec<String>, update: bool) -> Result<String, String> {
    if file_paths.is_empty() {
        return Err("No APK files specified".to_string());
    }

    if file_paths.len() == 1 {
        let mut args = vec!["-s", &serial, "install"];
        if update {
            args.push("-r");
        }
        args.push(&file_paths[0]);

        let output = Command::new("adb")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to run adb install: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if stdout.contains("Success") || output.status.success() {
            Ok(format!("Successfully installed {}", file_paths[0]))
        } else {
            Err(if !stderr.is_empty() { stderr } else { stdout })
        }
    } else {
        let mut args = vec!["-s", &serial, "install-multiple"];
        if update {
            args.push("-r");
        }
        for path in &file_paths {
            args.push(path);
        }

        let output = Command::new("adb")
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to run adb install-multiple: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

        if stdout.contains("Success") || output.status.success() {
            Ok(format!("Successfully installed {} APKs", file_paths.len()))
        } else {
            Err(if !stderr.is_empty() { stderr } else { stdout })
        }
    }
}

#[tauri::command]
pub async fn uninstall_package(serial: String, package_name: String, user_only: bool) -> Result<String, String> {
    let mut args = vec!["pm", "uninstall"];
    if user_only {
        args.push("--user");
        args.push("0");
    }
    args.push(&package_name);

    run_adb_shell(&serial, &args)
}

#[tauri::command]
pub async fn disable_package(serial: String, package_name: String) -> Result<String, String> {
    run_adb_shell(&serial, &["pm", "disable-user", "--user", "0", &package_name])
}

#[tauri::command]
pub async fn enable_package(serial: String, package_name: String) -> Result<String, String> {
    run_adb_shell(&serial, &["pm", "enable", &package_name])
}

#[tauri::command]
pub async fn clear_app_data(serial: String, package_name: String) -> Result<String, String> {
    let res = run_adb_shell(&serial, &["pm", "clear", &package_name]);

    let is_failed = match &res {
        Ok(out) => !out.contains("Success") || out.contains("SecurityException") || out.contains("Exception"),
        Err(_) => true,
    };

    if is_failed {
        // Fallback 1: Try with --user 0
        if let Ok(out) = run_adb_shell(&serial, &["pm", "clear", "--user", "0", &package_name]) {
            if out.contains("Success") {
                return Ok(out);
            }
        }

        // Fallback 2: Try via su (root) if device is rooted
        if let Ok(out) = run_adb_shell(&serial, &["su", "-c", &format!("pm clear {}", package_name)]) {
            if out.contains("Success") {
                return Ok(out);
            }
        }

        // Handle SecurityException with detailed solution
        if let Ok(out) = &res {
            if out.contains("SecurityException") {
                return Err(format!(
                    "SecurityException: ADB Shell permission denied to clear data for '{}'.\n\nPossible Fixes:\n1. Xiaomi / MIUI / HyperOS: Enable 'USB debugging (Security settings)' in Developer Options.\n2. Protected / Work Profile App: Ensure app is not active Device Admin / Work profile restricted.\n3. Root / SU: Device requires root access to clear this package's user data.",
                    package_name
                ));
            }
        }
    }

    res
}

#[tauri::command]
pub async fn clear_app_cache(serial: String, package_name: String) -> Result<String, String> {
    let _ = run_adb_shell(&serial, &["pm", "trim-caches", "1000G"]);
    let cache_dir = format!("/sdcard/Android/data/{}/cache", package_name);
    let _ = run_adb_shell(&serial, &["rm", "-rf", &cache_dir]);
    Ok(format!("Cache cleared for {}", package_name))
}

#[tauri::command]
pub async fn force_stop_app(serial: String, package_name: String) -> Result<String, String> {
    run_adb_shell(&serial, &["am", "force-stop", &package_name])
}

#[tauri::command]
pub async fn launch_app(serial: String, package_name: String) -> Result<String, String> {
    let res = run_adb_shell(&serial, &["monkey", "-p", &package_name, "-c", "android.intent.category.LAUNCHER", "1"]);
    match res {
        Ok(out) => Ok(format!("Launched {}: {}", package_name, out)),
        Err(e) => Err(format!("Failed to launch {}: {}", package_name, e)),
    }
}
