use std::collections::{HashMap, HashSet};
use super::types::{PackageDetails, PackageInfo};
use super::utils::{extract_component_name, format_app_name};

pub fn parse_package_list(
    raw_list: &str,
    user_pkgs: &HashSet<String>,
    disabled_pkgs: &HashSet<String>,
    running_pkgs: &HashSet<String>,
    filter: &str,
    labels: &HashMap<String, String>,
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

        let app_label = labels
            .get(&pkg_name)
            .cloned()
            .unwrap_or_else(|| format_app_name(&pkg_name));

        let info = PackageInfo {
            name: app_label,
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

pub fn parse_dumpsys_package(
    package_name: &str,
    dump: &str,
    appops: &str,
    real_name: Option<String>,
) -> PackageDetails {
    let mut permissions = Vec::new();
    let mut activities = Vec::new();
    let mut services = Vec::new();
    let mut receivers = Vec::new();
    let mut providers = Vec::new();

    let mut version_name = String::new();
    let mut version_code = String::new();
    let mut apk_path = String::new();
    let mut uid = None;
    let mut is_debuggable = false;
    let mut first_install_time = String::new();
    let mut last_update_time = String::new();

    let mut current_section = "";
    let prefix_match = format!(" {}.", package_name);

    for line in dump.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("versionName=") {
            version_name = trimmed[12..].to_string();
        } else if trimmed.starts_with("versionCode=") {
            if let Some(code) = trimmed[12..].split_whitespace().next() {
                version_code = code.to_string();
            }
        } else if trimmed.starts_with("codePath=") {
            apk_path = trimmed[9..].to_string();
        } else if trimmed.starts_with("userId=") {
            if let Some(u) = trimmed[7..].split_whitespace().next() {
                uid = Some(u.to_string());
            }
        } else if trimmed.starts_with("pkgFlags=[") {
            if trimmed.contains("DEBUGGABLE") {
                is_debuggable = true;
            }
        } else if trimmed.starts_with("firstInstallTime=") {
            first_install_time = trimmed[17..].to_string();
        } else if trimmed.starts_with("lastUpdateTime=") {
            last_update_time = trimmed[15..].to_string();
        }

        // Section tracking
        if trimmed.starts_with("requested permissions:") || trimmed.starts_with("install permissions:") || trimmed.starts_with("runtime permissions:") {
            current_section = "permissions";
            continue;
        } else if trimmed.starts_with("Activity Resolver Table:") {
            current_section = "activities";
            continue;
        } else if trimmed.starts_with("Receiver Resolver Table:") {
            current_section = "receivers";
            continue;
        } else if trimmed.starts_with("Service Resolver Table:") {
            current_section = "services";
            continue;
        } else if trimmed.starts_with("Provider Resolver Table:") {
            current_section = "providers";
            continue;
        } else if trimmed.starts_with("Packages:") || (trimmed.ends_with(':') && !trimmed.contains('.')) {
            current_section = "";
        }

        // Parse section contents
        if current_section == "permissions" {
            if trimmed.starts_with("android.permission.") || trimmed.starts_with("com.") || trimmed.starts_with("org.") {
                if let Some(perm) = trimmed.split(':').next() {
                    permissions.push(perm.trim().to_string());
                }
            }
        } else if current_section == "activities" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(package_name)) {
                if let Some(comp) = extract_component_name(trimmed, package_name) {
                    activities.push(comp);
                }
            }
        } else if current_section == "receivers" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(package_name)) {
                if let Some(comp) = extract_component_name(trimmed, package_name) {
                    receivers.push(comp);
                }
            }
        } else if current_section == "services" {
            if trimmed.contains(&prefix_match) || (trimmed.contains('/') && trimmed.contains(package_name)) {
                if let Some(comp) = extract_component_name(trimmed, package_name) {
                    services.push(comp);
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

    let display_name = real_name.unwrap_or_else(|| package_name.to_string());

    let info = PackageInfo {
        name: display_name,
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
