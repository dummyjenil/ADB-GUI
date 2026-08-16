use std::collections::HashSet;
use std::path::Path;
use std::process::Command;
use super::parser::{parse_dumpsys_package, parse_package_list};
use super::types::{PackageDetails, PackageInfo};
use super::utils::run_adb_shell;

#[tauri::command]
pub async fn list_packages(serial: String, filter: String) -> Result<Vec<PackageInfo>, String> {
    // 1. Get package paths (-f) and UIDs (-U)
    let pm_args = vec!["pm", "list", "packages", "-f", "-u", "-U"];
    let raw_list = run_adb_shell(&serial, &pm_args).unwrap_or_default();

    // 2. Get list of third-party user apps (-3)
    let user_pkgs_raw = run_adb_shell(&serial, &["pm", "list", "packages", "-3"]).unwrap_or_default();
    let user_pkgs: HashSet<String> = user_pkgs_raw
        .lines()
        .filter_map(|l| l.strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .collect();

    // 3. Get list of disabled apps (-d)
    let disabled_pkgs_raw = run_adb_shell(&serial, &["pm", "list", "packages", "-d"]).unwrap_or_default();
    let disabled_pkgs: HashSet<String> = disabled_pkgs_raw
        .lines()
        .filter_map(|l| l.strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .collect();

    // 4. Get list of running processes
    let ps_raw = run_adb_shell(&serial, &["ps", "-A", "-o", "NAME"]).unwrap_or_default();
    let running_pkgs: HashSet<String> = ps_raw.lines().map(|l| l.trim().to_string()).collect();

    Ok(parse_package_list(
        &raw_list,
        &user_pkgs,
        &disabled_pkgs,
        &running_pkgs,
        &filter,
    ))
}

#[tauri::command]
pub async fn get_package_details(serial: String, package_name: String) -> Result<PackageDetails, String> {
    let dump = run_adb_shell(&serial, &["dumpsys", "package", &package_name]).unwrap_or_default();
    let appops = run_adb_shell(&serial, &["cmd", "appops", "get", &package_name]).unwrap_or_default();

    Ok(parse_dumpsys_package(&package_name, &dump, &appops))
}

#[tauri::command]
pub async fn get_apk_path(serial: String, package_name: String) -> Result<Vec<String>, String> {
    let raw = run_adb_shell(&serial, &["pm", "path", &package_name])?;
    let paths: Vec<String> = raw
        .lines()
        .filter_map(|l| l.strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .collect();
    if paths.is_empty() {
        Err("No APK path found for package".to_string())
    } else {
        Ok(paths)
    }
}

#[tauri::command]
pub async fn extract_apk(serial: String, package_name: String, target_dir: String) -> Result<String, String> {
    let paths = get_apk_path(serial.clone(), package_name.clone()).await?;
    let remote_apk = &paths[0];

    let dest_filename = format!("{}.apk", package_name);
    let dest_path = Path::new(&target_dir).join(dest_filename);
    let dest_str = dest_path.to_string_lossy().to_string();

    let output = Command::new("adb")
        .args(["-s", &serial, "pull", remote_apk, &dest_str])
        .output()
        .map_err(|e| format!("Failed to pull APK: {}", e))?;

    if output.status.success() {
        Ok(format!("Extracted APK to {}", dest_str))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn backup_app_data(serial: String, package_name: String, save_path: String) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "backup", "-f", &save_path, "-apk", &package_name])
        .output()
        .map_err(|e| format!("Failed to initiate backup: {}", e))?;

    if output.status.success() {
        Ok(format!("Backup process initiated for {}. Check device prompt to confirm.", package_name))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
pub async fn execute_pm_command(serial: String, command: String, args: Option<Vec<String>>) -> Result<String, String> {
    let mut clean_cmd = command.trim().to_string();
    if clean_cmd.starts_with("pm ") {
        clean_cmd = clean_cmd[3..].trim().to_string();
    }
    let mut shell_cmd = format!("pm {}", clean_cmd);

    if let Some(extra_args) = args {
        for a in extra_args {
            if !a.trim().is_empty() {
                shell_cmd.push(' ');
                shell_cmd.push_str(a.trim());
            }
        }
    }

    let output = Command::new("adb")
        .args(["-s", &serial, "shell", &shell_cmd])
        .output()
        .map_err(|e| format!("Failed to run PM command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    let combined = if !stdout.is_empty() && !stderr.is_empty() {
        format!("{}\n\n[stderr]:\n{}", stdout, stderr)
    } else if !stdout.is_empty() {
        stdout
    } else if !stderr.is_empty() {
        stderr
    } else {
        "PM Command completed successfully (no text output returned from device).".to_string()
    };

    Ok(combined)
}
