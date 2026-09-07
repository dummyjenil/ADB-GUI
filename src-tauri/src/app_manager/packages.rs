use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Command, Stdio};
use tauri::Emitter;
use super::droid_agent::{ensure_droid_agent, fetch_single_package_name, DroidAgentItem};
use super::parser::{parse_dumpsys_package, parse_package_list};
use super::types::{PackageDetails, PackageInfo};
use super::utils::run_adb_shell;

#[tauri::command]
pub async fn list_packages(app: tauri::AppHandle, serial: String, filter: String) -> Result<Vec<PackageInfo>, String> {
    let _is_only_user = filter == "user";

    // 1. Ensure droid-agent is ready on device
    if !ensure_droid_agent(&app, &serial) {
        let pm_args = vec!["pm", "list", "packages", "-f", "-U"];
        let raw_list = run_adb_shell(&serial, &pm_args).unwrap_or_default();
        return Ok(parse_package_list(
            &raw_list,
            &HashSet::new(),
            &HashSet::new(),
            &HashSet::new(),
            &filter,
            &std::collections::HashMap::new(),
        ));
    }

    // 2. Fetch metadata sets
    let user_pkgs_raw = run_adb_shell(&serial, &["pm", "list", "packages", "-3"]).unwrap_or_default();
    let user_pkgs: HashSet<String> = user_pkgs_raw
        .lines()
        .filter_map(|l| l.strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .collect();

    let disabled_pkgs_raw = run_adb_shell(&serial, &["pm", "list", "packages", "-d"]).unwrap_or_default();
    let disabled_pkgs: HashSet<String> = disabled_pkgs_raw
        .lines()
        .filter_map(|l| l.strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .collect();

    let ps_raw = run_adb_shell(&serial, &["ps", "-A", "-o", "NAME"]).unwrap_or_default();
    let running_pkgs: HashSet<String> = ps_raw.lines().map(|l| l.trim().to_string()).collect();

    // 3. Spawn child streaming droid-agent
    let flag = match filter.as_str() {
        "system" => "--system",
        "all" => "--all",
        _ => "--user",
    };

    let mut child = match Command::new("adb")
        .args(["-s", &serial, "shell", "/data/local/tmp/droid-agent", flag, "--stream"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to spawn streaming agent: {}", e)),
    };

    let stdout = child.stdout.take().ok_or("Failed to capture agent stdout")?;
    let reader = BufReader::new(stdout);

    let mut all_results = Vec::new();
    let mut batch = Vec::new();
    let mut last_emit = std::time::Instant::now();

    for line in reader.lines().flatten() {
        let line = line.trim();
        if line.is_empty() || !line.starts_with('{') {
            continue;
        }

        if let Ok(item) = serde_json::from_str::<DroidAgentItem>(line) {
            let pkg_name = item.package.trim().to_string();
            if pkg_name.is_empty() {
                continue;
            }

            let is_user = user_pkgs.contains(&pkg_name);
            let app_type = if is_user { "User".to_string() } else { "System".to_string() };

            let is_disabled = disabled_pkgs.contains(&pkg_name);
            let is_running = running_pkgs.contains(&pkg_name);
            let status = if is_disabled {
                "Disabled".to_string()
            } else if is_running {
                "Running".to_string()
            } else {
                "Enabled".to_string()
            };

            let has_apk = !item.apk.is_empty() && item.apk.ends_with(".apk");

            let info = PackageInfo {
                name: if item.name.is_empty() { pkg_name.clone() } else { item.name },
                package_name: pkg_name,
                version_name: "1.0".to_string(),
                version_code: "1".to_string(),
                size_bytes: 0,
                size_formatted: "N/A".to_string(),
                app_type,
                status,
                uid: item.uid,
                apk_path: item.apk,
                is_debuggable: false,
                first_install_time: "".to_string(),
                last_update_time: "".to_string(),
                has_apk,
            };

            batch.push(info.clone());
            all_results.push(info);

            if batch.len() >= 2 || last_emit.elapsed().as_millis() >= 100 {
                let _ = app.emit("app-manager:package-batch", &batch);
                batch.clear();
                last_emit = std::time::Instant::now();
            }
        }
    }

    let _ = child.wait();

    if !batch.is_empty() {
        let _ = app.emit("app-manager:package-batch", &batch);
    }
    let _ = app.emit("app-manager:discovery-complete", all_results.len());

    Ok(all_results)
}

#[tauri::command]
pub async fn get_package_details(
    app: tauri::AppHandle,
    serial: String,
    package_name: String,
) -> Result<PackageDetails, String> {
    let dump = run_adb_shell(&serial, &["dumpsys", "package", &package_name]).unwrap_or_default();
    let appops = run_adb_shell(&serial, &["cmd", "appops", "get", &package_name]).unwrap_or_default();
    let real_name = fetch_single_package_name(&app, &serial, &package_name);

    Ok(parse_dumpsys_package(&package_name, &dump, &appops, real_name))
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
