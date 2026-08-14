use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageInfo {
    pub name: String,
    pub package_name: String,
    pub version_name: String,
    pub version_code: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub app_type: String, // "user" or "system"
    pub status: String,   // "enabled", "disabled", "running"
    pub uid: Option<String>,
    pub apk_path: String,
    pub is_debuggable: bool,
    pub first_install_time: String,
    pub last_update_time: String,
    pub has_apk: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageDetails {
    pub info: PackageInfo,
    pub permissions: Vec<String>,
    pub app_ops: Vec<String>,
    pub activities: Vec<String>,
    pub services: Vec<String>,
    pub receivers: Vec<String>,
    pub providers: Vec<String>,
    pub raw_dump: String,
}

// Helper to execute adb shell command
fn run_adb_shell(serial: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["-s", serial, "shell"];
    cmd_args.extend_from_slice(args);

    let output = Command::new("adb")
        .args(&cmd_args)
        .output()
        .map_err(|e| format!("Failed to run ADB command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() || !stdout.is_empty() {
        Ok(stdout)
    } else {
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

// Helper to format bytes to MB/KB
#[allow(dead_code)]
fn format_size(bytes: u64) -> String {
    if bytes == 0 {
        return "Unknown".to_string();
    }
    let kb = bytes as f64 / 1024.0;
    let mb = kb / 1024.0;
    if mb >= 1.0 {
        format!("{:.1} MB", mb)
    } else {
        format!("{:.0} KB", kb)
    }
}

// Format friendly label from package name
fn format_app_name(pkg: &str) -> String {
    let parts: Vec<&str> = pkg.split('.').collect();
    if let Some(last) = parts.last() {
        let name = last.replace('_', " ");
        let mut c = name.chars();
        match c.next() {
            None => pkg.to_string(),
            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        }
    } else {
        pkg.to_string()
    }
}

// Extract clean component name like "com.package/.ActivityName"
fn extract_component_name(line: &str, pkg_name: &str) -> Option<String> {
    for part in line.split_whitespace() {
        if part.contains(pkg_name) && part.contains('/') {
            let clean = part.trim_matches(|c| c == '{' || c == '}' || c == '"' || c == '\'');
            return Some(clean.to_string());
        }
    }
    None
}


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

    let mut result = Vec::new();

    for line in raw_list.lines() {
        // line format: package:/data/app/.../base.apk=com.example.app uid:10123
        let line = line.trim();
        if !line.starts_with("package:") {
            continue;
        }
        let content = &line[8..];
        
        let (path_and_pkg, uid_str) = match content.split_once(" uid:") {
            Some((p, u)) => (p, Some(u.trim().to_string())),
            None => (content, None),
        };

        let (apk_path, pkg_name) = match path_and_pkg.rfind('=') {
            Some(idx) => (&path_and_pkg[..idx], &path_and_pkg[idx + 1..]),
            None => ("", path_and_pkg),
        };

        let pkg_name = pkg_name.trim().to_string();
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

        let has_apk = !apk_path.is_empty() && apk_path.ends_with(".apk");

        let info = PackageInfo {
            name: format_app_name(&pkg_name),
            package_name: pkg_name,
            version_name: "1.0".to_string(),
            version_code: "1".to_string(),
            size_bytes: 0,
            size_formatted: "N/A".to_string(),
            app_type,
            status,
            uid: uid_str,
            apk_path: apk_path.to_string(),
            is_debuggable: false,
            first_install_time: "".to_string(),
            last_update_time: "".to_string(),
            has_apk,
        };

        // Filter checks
        let matches = match filter.as_str() {
            "user" => is_user,
            "system" => !is_user,
            "disabled" => is_disabled,
            "enabled" => !is_disabled,
            "running" => is_running,
            "with_apk" => has_apk,
            "without_apk" => !has_apk,
            _ => true,
        };

        if matches {
            result.push(info);
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_package_details(serial: String, package_name: String) -> Result<PackageDetails, String> {
    let dump = run_adb_shell(&serial, &["dumpsys", "package", &package_name]).unwrap_or_default();
    let appops = run_adb_shell(&serial, &["cmd", "appops", "get", &package_name]).unwrap_or_default();

    let mut permissions = Vec::new();
    let mut activities = Vec::new();
    let mut services = Vec::new();
    let mut receivers = Vec::new();
    let mut providers = Vec::new();
    let mut is_debuggable = false;
    let mut first_install_time = String::new();
    let mut last_update_time = String::new();
    let mut version_name = String::new();
    let mut version_code = String::new();
    let mut uid = None;
    let mut apk_path = String::new();

    let mut current_section = "";

    for line in dump.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("versionName=") {
            version_name = trimmed.trim_start_matches("versionName=").to_string();
        } else if trimmed.starts_with("versionCode=") {
            version_code = trimmed.trim_start_matches("versionCode=").to_string();
        } else if trimmed.starts_with("userId=") || trimmed.starts_with("appId=") {
            if uid.is_none() {
                uid = Some(trimmed.to_string());
            }
        } else if trimmed.starts_with("codePath=") {
            apk_path = trimmed.trim_start_matches("codePath=").to_string();
        } else if trimmed.starts_with("firstInstallTime=") {
            first_install_time = trimmed.trim_start_matches("firstInstallTime=").to_string();
        } else if trimmed.starts_with("lastUpdateTime=") {
            last_update_time = trimmed.trim_start_matches("lastUpdateTime=").to_string();
        } else if trimmed.contains("DEBUGGABLE") {
            is_debuggable = true;
        }

        // Track sections
        let lower = trimmed.to_lowercase();
        if lower.starts_with("requested permissions:") || lower.starts_with("declared permissions:") {
            current_section = "permissions";
        } else if lower.starts_with("activity resolver table:") || lower == "activities:" {
            current_section = "activities";
        } else if lower.starts_with("service resolver table:") || lower == "services:" {
            current_section = "services";
        } else if lower.starts_with("receiver resolver table:") || lower == "receivers:" {
            current_section = "receivers";
        } else if lower.starts_with("provider resolver table:") || lower.starts_with("registered contentproviders:") || lower == "providers:" {
            current_section = "providers";
        } else if trimmed.starts_with("Key Set Manager:") || trimmed.starts_with("Packages:") || trimmed.starts_with("Shared users:") {
            current_section = "";
        }

        let prefix_match = format!("{}/", package_name);

        if current_section == "permissions" {
            if (trimmed.contains("android.permission.") || trimmed.contains('.')) && !trimmed.contains(':') {
                permissions.push(trimmed.to_string());
            }
        } else if current_section == "activities" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(&package_name)) {
                if let Some(comp) = extract_component_name(trimmed, &package_name) {
                    activities.push(comp);
                }
            }
        } else if current_section == "services" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(&package_name)) {
                if let Some(comp) = extract_component_name(trimmed, &package_name) {
                    services.push(comp);
                }
            }
        } else if current_section == "receivers" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(&package_name)) {
                if let Some(comp) = extract_component_name(trimmed, &package_name) {
                    receivers.push(comp);
                }
            }
        } else if current_section == "providers" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(&package_name)) {
                if let Some(comp) = extract_component_name(trimmed, &package_name) {
                    providers.push(comp);
                }
            }
        }
    }

    // Deduplicate lists
    let clean_dedup = |vec: Vec<String>| -> Vec<String> {
        let mut set = HashSet::new();
        let mut out = Vec::new();
        for item in vec {
            if set.insert(item.clone()) {
                out.push(item);
            }
        }
        out
    };

    let permissions = clean_dedup(permissions);
    let activities = clean_dedup(activities);
    let services = clean_dedup(services);
    let receivers = clean_dedup(receivers);
    let providers = clean_dedup(providers);

    let app_ops_list: Vec<String> = appops.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect();

    let info = PackageInfo {
        name: format_app_name(&package_name),
        package_name: package_name.clone(),
        version_name: if version_name.is_empty() { "1.0".to_string() } else { version_name },
        version_code: if version_code.is_empty() { "1".to_string() } else { version_code },
        size_bytes: 0,
        size_formatted: "N/A".to_string(),
        app_type: "System/User".to_string(),
        status: "Enabled".to_string(),
        uid,
        apk_path,
        is_debuggable,
        first_install_time,
        last_update_time,
        has_apk: true,
    };

    Ok(PackageDetails {
        info,
        permissions,
        app_ops: app_ops_list,
        activities,
        services,
        receivers,
        providers,
        raw_dump: dump,
    })
}

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
    let mut shell_args: Vec<String> = vec!["pm".to_string()];
    for part in clean_cmd.split_whitespace() {
        shell_args.push(part.to_string());
    }

    if let Some(extra_args) = args {
        for a in extra_args {
            for sub in a.split_whitespace() {
                shell_args.push(sub.to_string());
            }
        }
    }

    let slice_args: Vec<&str> = shell_args.iter().map(|s| s.as_str()).collect();
    let res = run_adb_shell(&serial, &slice_args)?;
    if res.trim().is_empty() {
        Ok("PM Command completed successfully (no text output returned from device).".to_string())
    } else {
        Ok(res)
    }
}

#[tauri::command]
pub async fn pick_multiple_apk_files() -> Result<Vec<String>, String> {
    let files = rfd::AsyncFileDialog::new()
        .add_filter("APK Package", &["apk"])
        .set_title("Select APK Files to Install")
        .pick_files()
        .await;

    Ok(files
        .unwrap_or_default()
        .into_iter()
        .map(|f| f.path().to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub async fn pick_save_directory() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Destination Folder")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimePermissionInfo {
    pub permission: String,
    pub granted: bool,
    pub flags: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppOpInfo {
    pub op: String,
    pub mode: String,
    pub raw: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedPermissions {
    pub runtime_permissions: Vec<RuntimePermissionInfo>,
    pub requested_permissions: Vec<String>,
    pub app_ops: Vec<AppOpInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IntentExtra {
    pub key: String,
    pub value: String,
    pub extra_type: String,
}

#[tauri::command]
pub async fn get_detailed_permissions(serial: String, package_name: String) -> Result<DetailedPermissions, String> {
    let dump = run_adb_shell(&serial, &["dumpsys", "package", &package_name]).unwrap_or_default();
    let appops = run_adb_shell(&serial, &["cmd", "appops", "get", &package_name]).unwrap_or_default();

    let mut runtime_permissions = Vec::new();
    let mut requested_permissions = Vec::new();
    let mut current_section = "";

    for line in dump.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();

        if lower.starts_with("requested permissions:") {
            current_section = "requested";
            continue;
        } else if lower.starts_with("runtime permissions:") {
            current_section = "runtime";
            continue;
        } else if trimmed.starts_with("User 0:") || trimmed.starts_with("Queries:") || trimmed.starts_with("Packages:") || trimmed.starts_with("Flags:") {
            current_section = "";
        }

        if current_section == "requested" {
            if (trimmed.contains("android.permission.") || trimmed.contains('.')) && !trimmed.contains(':') {
                requested_permissions.push(trimmed.to_string());
            }
        } else if current_section == "runtime" {
            if trimmed.contains(':') && (trimmed.contains("granted=") || trimmed.contains("android.permission.")) {
                if let Some((perm_part, rest)) = trimmed.split_once(':') {
                    let perm = perm_part.trim().to_string();
                    let granted = rest.contains("granted=true");
                    let flags = match rest.find("flags=[") {
                        Some(idx) => rest[idx..].trim().to_string(),
                        None => "".to_string(),
                    };
                    runtime_permissions.push(RuntimePermissionInfo {
                        permission: perm,
                        granted,
                        flags,
                    });
                }
            }
        }
    }

    // Deduplicate requested permissions
    let mut req_set = HashSet::new();
    let mut clean_requested = Vec::new();
    for p in requested_permissions {
        if req_set.insert(p.clone()) {
            clean_requested.push(p);
        }
    }

    // Parse AppOps
    let mut app_ops = Vec::new();
    for line in appops.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("No AppOps") {
            continue;
        }

        // Example line: "Uid mode: CAMERA: allow; time=+1d2h ago" or "CAMERA: allow"
        let clean_line = if let Some(stripped) = trimmed.strip_prefix("Uid mode:") {
            stripped.trim()
        } else {
            trimmed
        };

        if let Some((op_part, rest_part)) = clean_line.split_once(':') {
            let op = op_part.trim().to_string();
            let rest = rest_part.trim();
            let mode = if rest.starts_with("allow") {
                "allow".to_string()
            } else if rest.starts_with("ignore") {
                "ignore".to_string()
            } else if rest.starts_with("deny") {
                "deny".to_string()
            } else if rest.starts_with("default") {
                "default".to_string()
            } else {
                rest.split_whitespace().next().unwrap_or("unknown").to_string()
            };

            app_ops.push(AppOpInfo {
                op,
                mode,
                raw: trimmed.to_string(),
            });
        } else {
            app_ops.push(AppOpInfo {
                op: trimmed.to_string(),
                mode: "unknown".to_string(),
                raw: trimmed.to_string(),
            });
        }
    }

    Ok(DetailedPermissions {
        runtime_permissions,
        requested_permissions: clean_requested,
        app_ops,
    })
}

#[tauri::command]
pub async fn grant_app_permission(serial: String, package_name: String, permission: String) -> Result<String, String> {
    run_adb_shell(&serial, &["pm", "grant", &package_name, &permission])
}

#[tauri::command]
pub async fn revoke_app_permission(serial: String, package_name: String, permission: String) -> Result<String, String> {
    run_adb_shell(&serial, &["pm", "revoke", &package_name, &permission])
}

#[tauri::command]
pub async fn set_app_op_mode(serial: String, package_name: String, op: String, mode: String) -> Result<String, String> {
    run_adb_shell(&serial, &["cmd", "appops", "set", &package_name, &op, &mode])
}

#[tauri::command]
pub async fn execute_intent(
    serial: String,
    intent_type: Option<String>,
    package_name: Option<String>,
    activity_name: Option<String>,
    action: Option<String>,
    data_uri: Option<String>,
    category: Option<String>,
    extras: Option<Vec<IntentExtra>>,
    flags: Option<String>,
) -> Result<String, String> {
    let itype = intent_type.unwrap_or_else(|| "start".to_string());
    let mut args: Vec<String> = vec!["am".to_string(), itype];

    if let (Some(pkg), Some(act)) = (&package_name, &activity_name) {
        if !pkg.trim().is_empty() && !act.trim().is_empty() {
            let component = if act.contains('/') {
                act.trim().to_string()
            } else if act.starts_with('.') {
                format!("{}{}", pkg.trim(), act.trim())
            } else {
                format!("{}/{}", pkg.trim(), act.trim())
            };
            args.push("-n".to_string());
            args.push(component);
        } else if !pkg.trim().is_empty() {
            args.push("-p".to_string());
            args.push(pkg.trim().to_string());
        }
    } else if let Some(pkg) = &package_name {
        if !pkg.trim().is_empty() {
            args.push("-p".to_string());
            args.push(pkg.trim().to_string());
        }
    }

    if let Some(act) = &action {
        if !act.trim().is_empty() {
            args.push("-a".to_string());
            args.push(act.trim().to_string());
        }
    }

    if let Some(data) = &data_uri {
        if !data.trim().is_empty() {
            args.push("-d".to_string());
            args.push(data.trim().to_string());
        }
    }

    if let Some(cat) = &category {
        if !cat.trim().is_empty() {
            args.push("-c".to_string());
            args.push(cat.trim().to_string());
        }
    }

    let empty_extras = Vec::new();
    let actual_extras = extras.as_ref().unwrap_or(&empty_extras);
    for extra in actual_extras {
        if extra.key.trim().is_empty() {
            continue;
        }
        let flag = match extra.extra_type.as_str() {
            "int" => "--ei",
            "bool" => "--ez",
            "long" => "--el",
            "float" => "--ef",
            _ => "--es",
        };
        args.push(flag.to_string());
        args.push(extra.key.trim().to_string());
        args.push(extra.value.trim().to_string());
    }

    if let Some(flg) = &flags {
        if !flg.trim().is_empty() {
            args.push("-f".to_string());
            args.push(flg.trim().to_string());
        }
    }

    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_adb_shell(&serial, &str_args)
}

