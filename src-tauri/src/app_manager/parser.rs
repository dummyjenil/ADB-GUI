use std::collections::HashSet;
use super::types::{PackageDetails, PackageInfo};
use super::utils::{extract_component_name, format_app_name};

pub fn parse_package_list(
    raw_list: &str,
    user_pkgs: &HashSet<String>,
    disabled_pkgs: &HashSet<String>,
    running_pkgs: &HashSet<String>,
    filter: &str,
) -> Vec<PackageInfo> {
    let mut result = Vec::new();

    for line in raw_list.lines() {
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

        let matches = match filter {
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

    result
}

pub fn parse_dumpsys_package(package_name: &str, dump: &str, appops: &str) -> PackageDetails {
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
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(package_name)) {
                if let Some(comp) = extract_component_name(trimmed, package_name) {
                    activities.push(comp);
                }
            }
        } else if current_section == "services" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(package_name)) {
                if let Some(comp) = extract_component_name(trimmed, package_name) {
                    services.push(comp);
                }
            }
        } else if current_section == "receivers" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(package_name)) {
                if let Some(comp) = extract_component_name(trimmed, package_name) {
                    receivers.push(comp);
                }
            }
        } else if current_section == "providers" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(package_name)) {
                if let Some(comp) = extract_component_name(trimmed, package_name) {
                    providers.push(comp);
                }
            }
        }
    }

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
        name: format_app_name(package_name),
        package_name: package_name.to_string(),
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

    PackageDetails {
        info,
        permissions,
        app_ops: app_ops_list,
        activities,
        services,
        receivers,
        providers,
        raw_dump: dump.to_string(),
    }
}
