use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotificationItem {
    pub id: String,
    pub package_name: String,
    pub app_name: String,
    pub title: String,
    pub text: String,
    pub sub_text: String,
    pub post_time: String,
    pub channel_id: String,
    pub is_clearable: bool,
}

/// Fetches active device notifications by parsing `dumpsys notification`
#[tauri::command]
pub async fn get_device_notifications(serial: String) -> Result<Vec<NotificationItem>, String> {
    let output = Command::new("adb")
        .args(["-s", &serial, "shell", "dumpsys", "notification", "--noredact"])
        .output();

    let stdout = match output {
        Ok(ref out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        _ => {
            let fallback_output = Command::new("adb")
                .args(["-s", &serial, "shell", "dumpsys", "notification"])
                .output()
                .map_err(|e| format!("Failed to run dumpsys notification: {}", e))?;

            if !fallback_output.status.success() {
                return Err(String::from_utf8_lossy(&fallback_output.stderr).to_string());
            }
            String::from_utf8_lossy(&fallback_output.stdout).to_string()
        }
    };

    let items = parse_dumpsys_notifications(&stdout);
    Ok(items)
}

fn parse_dumpsys_notifications(raw: &str) -> Vec<NotificationItem> {
    let mut results = Vec::new();
    let lines: Vec<&str> = raw.lines().collect();

    let mut current_pkg = String::new();
    let mut current_id = String::new();
    let mut current_title = String::new();
    let mut current_text = String::new();
    let mut current_big_text = String::new();
    let mut current_sub_text = String::new();
    let mut current_channel = String::new();
    let mut current_post_time = String::new();
    let mut current_ticker = String::new();
    let mut current_is_clearable = true;
    let mut is_record = false;

    for line in lines {
        let trimmed = line.trim();

        if trimmed.starts_with("NotificationRecord(") || trimmed.starts_with("NotificationRecord {") {
            let has_content = !current_title.is_empty() || !current_text.is_empty() || !current_big_text.is_empty() || !current_ticker.is_empty();
            if is_record && !current_pkg.is_empty() && has_content {
                let final_title = if !current_title.is_empty() {
                    current_title.clone()
                } else {
                    current_ticker.clone()
                };

                let final_text = if !current_big_text.is_empty() && current_big_text.len() >= current_text.len() {
                    current_big_text.clone()
                } else if !current_text.is_empty() {
                    current_text.clone()
                } else if !current_ticker.is_empty() && current_ticker != final_title {
                    current_ticker.clone()
                } else {
                    String::new()
                };

                results.push(build_notification_item(
                    &current_id,
                    &current_pkg,
                    &final_title,
                    &final_text,
                    &current_sub_text,
                    &current_channel,
                    &current_post_time,
                    current_is_clearable,
                ));
            }

            // Reset fields for new record
            is_record = true;
            current_pkg = String::new();
            current_id = String::new();
            current_title = String::new();
            current_text = String::new();
            current_big_text = String::new();
            current_sub_text = String::new();
            current_channel = String::new();
            current_post_time = String::new();
            current_ticker = String::new();
            current_is_clearable = true;

            if let Some(pkg_idx) = trimmed.find("pkg=") {
                let rest = &trimmed[pkg_idx + 4..];
                current_pkg = rest.split_whitespace().next().unwrap_or("").to_string();
            }
            if let Some(id_idx) = trimmed.find("id=") {
                let rest = &trimmed[id_idx + 3..];
                current_id = rest.split_whitespace().next().unwrap_or("").to_string();
            }
            if trimmed.contains("flags=") {
                current_is_clearable = check_is_clearable(trimmed);
            }
            continue;
        }

        if !is_record {
            continue;
        }

        if trimmed.contains("FLAG_ONGOING_EVENT") || trimmed.contains("FLAG_NO_CLEAR") || trimmed.contains("FLAG_FOREGROUND_SERVICE") || trimmed.contains("ongoing=true") || trimmed.contains("isClearable=false") {
            current_is_clearable = false;
        } else if trimmed.contains("flags=") {
            if !check_is_clearable(trimmed) {
                current_is_clearable = false;
            }
        }

        if trimmed.starts_with("pkg=") && current_pkg.is_empty() {
            current_pkg = trimmed.trim_start_matches("pkg=").split_whitespace().next().unwrap_or("").to_string();
        } else if trimmed.contains("android.title.big=") || trimmed.contains("android.title=") {
            let val = extract_raw_field(trimmed);
            if !val.is_empty() {
                current_title = val;
            }
        } else if trimmed.contains("android.bigText=") {
            let val = extract_raw_field(trimmed);
            if !val.is_empty() {
                current_big_text = val;
            }
        } else if trimmed.contains("android.text=") {
            let val = extract_raw_field(trimmed);
            if !val.is_empty() {
                current_text = val;
            }
        } else if trimmed.contains("android.subText=") || trimmed.contains("android.summaryText=") {
            let val = extract_raw_field(trimmed);
            if !val.is_empty() {
                current_sub_text = val;
            }
        } else if trimmed.contains("tickerText=") {
            let val = extract_raw_field(trimmed);
            if !val.is_empty() {
                current_ticker = val;
            }
        } else if trimmed.contains("mChannel=") || trimmed.contains("channelId=") {
            if let Some(idx) = trimmed.find("channelId=") {
                current_channel = trimmed[idx + 10..].split_whitespace().next().unwrap_or("").to_string();
            } else if let Some(idx) = trimmed.find("mChannel=") {
                current_channel = trimmed[idx + 9..].split_whitespace().next().unwrap_or("").to_string();
            }
        } else if trimmed.starts_with("postTime=") {
            current_post_time = trimmed.trim_start_matches("postTime=").to_string();
        }
    }

    let has_content = !current_title.is_empty() || !current_text.is_empty() || !current_big_text.is_empty() || !current_ticker.is_empty();
    if is_record && !current_pkg.is_empty() && has_content {
        let final_title = if !current_title.is_empty() {
            current_title.clone()
        } else {
            current_ticker.clone()
        };

        let final_text = if !current_big_text.is_empty() && current_big_text.len() >= current_text.len() {
            current_big_text.clone()
        } else if !current_text.is_empty() {
            current_text.clone()
        } else if !current_ticker.is_empty() && current_ticker != final_title {
            current_ticker.clone()
        } else {
            String::new()
        };

        results.push(build_notification_item(
            &current_id,
            &current_pkg,
            &final_title,
            &final_text,
            &current_sub_text,
            &current_channel,
            &current_post_time,
            current_is_clearable,
        ));
    }

    // Deduplicate exact duplicate items
    let mut unique_items: Vec<NotificationItem> = Vec::new();
    for item in results {
        if !unique_items.iter().any(|u| u.package_name == item.package_name && u.title == item.title && u.text == item.text) {
            unique_items.push(item);
        }
    }

    unique_items
}

fn check_is_clearable(line: &str) -> bool {
    if line.contains("FLAG_ONGOING_EVENT") || line.contains("FLAG_NO_CLEAR") || line.contains("FLAG_FOREGROUND_SERVICE") || line.contains("ongoing=true") || line.contains("isClearable=false") {
        return false;
    }
    if let Some(idx) = line.find("flags=") {
        let f_part = &line[idx + 6..].split_whitespace().next().unwrap_or("");
        let hex_val = f_part.trim_start_matches("0x").trim_matches(',');
        if let Ok(num) = u32::from_str_radix(hex_val, 16) {
            // FLAG_ONGOING_EVENT (0x2) | FLAG_NO_CLEAR (0x20) | FLAG_FOREGROUND_SERVICE (0x40)
            if (num & 0x62) != 0 {
                return false;
            }
        }
    }
    true
}

/// Dynamic field extraction distinguishing type descriptors (`android.title=String`) from actual values
fn extract_raw_field(line: &str) -> String {
    if let Some(eq_idx) = line.find('=') {
        let mut val = line[eq_idx + 1..].trim();

        if val.is_empty() || val == "null" || val.starts_with("null") {
            return String::new();
        }

        // If line is literally a data type descriptor with no value (e.g. `android.title=String` or `android.text=String`)
        if val == "String" || val == "CharSequence" || val == "String[]" || val == "CharSequence[]" {
            return String::new();
        }

        // Unwrap `String ( ... )` or `CharSequence ( ... )` values from dumpsys
        if (val.starts_with("String (") || val.starts_with("CharSequence (")) && val.ends_with(')') {
            if let Some(paren_idx) = val.find('(') {
                val = val[paren_idx + 1..val.len() - 1].trim();
            }
        } else if (val.starts_with("String(") || val.starts_with("CharSequence(")) && val.ends_with(')') {
            if let Some(paren_idx) = val.find('(') {
                val = val[paren_idx + 1..val.len() - 1].trim();
            }
        }

        let cleaned = val.trim_matches('"').trim_matches('\'').trim();

        if cleaned == "String" || cleaned == "null" || cleaned == "CharSequence" {
            return String::new();
        }

        return cleaned.to_string();
    }
    String::new()
}

/// Pure dynamic app name resolution without hardcoding
fn build_notification_item(
    id: &str,
    pkg: &str,
    title: &str,
    text: &str,
    sub: &str,
    channel: &str,
    post_time: &str,
    is_clearable: bool,
) -> NotificationItem {
    let raw_name = pkg.split('.').last().unwrap_or(pkg);
    let app_name = if raw_name.is_empty() {
        pkg.to_string()
    } else {
        let mut chars = raw_name.chars();
        match chars.next() {
            None => pkg.to_string(),
            Some(f) => f.to_uppercase().collect::<String>() + chars.as_str(),
        }
    };

    NotificationItem {
        id: if id.is_empty() { "0".to_string() } else { id.to_string() },
        package_name: pkg.to_string(),
        app_name,
        title: title.to_string(),
        text: text.to_string(),
        sub_text: sub.to_string(),
        post_time: if post_time.is_empty() { "Just now".to_string() } else { post_time.to_string() },
        channel_id: channel.to_string(),
        is_clearable,
    }
}

/// Dismiss / cancel or snooze a notification on the device
#[tauri::command]
pub async fn dismiss_notification(serial: String, package_name: String, id: String) -> Result<String, String> {
    // 1. Try cancel by package and id
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "cmd", "notification", "cancel", &package_name, &id])
        .output();

    // 2. Try snooze if cancel isn't supported on device
    let key = format!("0|{}|{}|null|1000", package_name, id);
    let _ = Command::new("adb")
        .args(["-s", &serial, "shell", "cmd", "notification", "snooze", "--for", "86400000", &key])
        .output();

    Ok("Dismiss/Snooze signal sent to device".to_string())
}

/// Post a dynamic custom notification directly onto the device notification drawer
#[tauri::command]
pub async fn post_custom_notification(
    serial: String,
    title: String,
    message: String,
    sub_text: Option<String>,
    click_uri: Option<String>,
    is_ongoing: Option<bool>,
    is_unique_tag: Option<bool>,
    priority: Option<String>,
    channel_id: Option<String>,
) -> Result<String, String> {
    let title_clean = if title.trim().is_empty() { "ADB Studio" } else { title.trim() };
    let msg_clean = if message.trim().is_empty() { "Notification from ADB GUI Studio" } else { message.trim() };

    let mut args: Vec<String> = vec![
        "-s".to_string(),
        serial.clone(),
        "shell".to_string(),
        "cmd".to_string(),
        "notification".to_string(),
        "post".to_string(),
        "-S".to_string(),
        "bigtext".to_string(),
        "-t".to_string(),
        title_clean.to_string(),
    ];

    // Subtext / summary
    if let Some(ref sub) = sub_text {
        let clean = sub.trim();
        if !clean.is_empty() {
            args.push("-s".to_string());
            args.push(clean.to_string());
        }
    }

    // Channel ID
    if let Some(ref chan) = channel_id {
        let clean = chan.trim();
        if !clean.is_empty() {
            args.push("-c".to_string());
            args.push(clean.to_string());
        }
    }

    // Priority / Importance
    if let Some(ref prio) = priority {
        match prio.to_lowercase().as_str() {
            "high" | "urgent" | "max" => {
                args.push("-p".to_string());
                args.push("1".to_string());
            }
            "low" | "min" => {
                args.push("-p".to_string());
                args.push("-1".to_string());
            }
            _ => {}
        }
    }

    // Ongoing / Sticky notification flag
    if is_ongoing.unwrap_or(false) {
        args.push("--ongoing".to_string());
    }

    // Click action URL / intent
    if let Some(ref uri) = click_uri {
        let clean = uri.trim();
        if !clean.is_empty() {
            args.push("-d".to_string());
            args.push(clean.to_string());
        }
    }

    // Tag (unique timestamped vs fixed)
    let tag = if is_unique_tag.unwrap_or(false) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        format!("ADB_GUI_{}", now)
    } else {
        "ADB_GUI_CUSTOM".to_string()
    };
    args.push(tag);
    args.push(msg_clean.to_string());

    let output = Command::new("adb")
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to post notification: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() || stdout.contains("posting:") {
        Ok(format!("Notification posted to device: \"{}\"", title_clean))
    } else {
        // If advanced flags caused error on older Android, fallback to basic notification
        let fallback_output = Command::new("adb")
            .args([
                "-s",
                &serial,
                "shell",
                "cmd",
                "notification",
                "post",
                "-S",
                "bigtext",
                "-t",
                title_clean,
                "ADB_GUI_CUSTOM",
                msg_clean,
            ])
            .output();

        if let Ok(f_out) = fallback_output {
            if f_out.status.success() {
                return Ok(format!("Notification posted (standard mode): \"{}\"", title_clean));
            }
        }

        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}


