use std::collections::HashSet;
use super::types::{AppOpInfo, DetailedPermissions, RuntimePermissionInfo};
use super::utils::run_adb_shell;

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
