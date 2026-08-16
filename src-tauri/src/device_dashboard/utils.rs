use std::collections::HashMap;
use std::process::Command;

/// Helper function to parse all getprop output into a HashMap
pub fn fetch_all_props(serial: &str) -> HashMap<String, String> {
    let mut props = HashMap::new();
    let output = Command::new("adb")
        .args(["-s", serial, "shell", "getprop"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                if let Some(colon_idx) = line.find("]: [") {
                    let key_part = &line[..colon_idx];
                    let val_part = &line[colon_idx + 4..];
                    let key = key_part.trim_start_matches('[').to_string();
                    let val = val_part.trim_end_matches(']').to_string();
                    props.insert(key, val);
                }
            }
        }
    }
    props
}

/// Helper function to run an adb shell command and get trimmed output string
pub fn exec_adb_shell(serial: &str, cmd: &[&str]) -> String {
    let mut args = vec!["-s", serial, "shell"];
    args.extend_from_slice(cmd);
    match Command::new("adb").args(&args).output() {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).trim().to_string(),
        _ => "Unknown".to_string(),
    }
}

/// Helper to parse ASCII/numeric string from Android service call parcel dump
pub fn parse_parcel_string(raw: &str) -> String {
    let mut result = String::new();
    for line in raw.lines() {
        if let Some(quote_start) = line.find('\'') {
            if let Some(quote_end) = line.rfind('\'') {
                if quote_end > quote_start {
                    let slice = &line[quote_start + 1..quote_end];
                    for ch in slice.chars() {
                        if ch.is_ascii_digit() || ch == '+' {
                            result.push(ch);
                        }
                    }
                }
            }
        }
    }
    result.trim().to_string()
}

/// Helper to extract self phone number via iphonesubinfo service call or fallback
pub fn get_self_phone_number(serial: &str) -> String {
    // 1. Try service call iphonesubinfo transaction codes (19, 18, 15, 13)
    for code in &["19", "18", "15", "13"] {
        let output = exec_adb_shell(serial, &["service", "call", "iphonesubinfo", code]);
        if output.contains("Result: Parcel") {
            let extracted = parse_parcel_string(&output);
            if !extracted.is_empty() && extracted.chars().any(|c| c.is_ascii_digit()) && extracted.len() >= 6 {
                return extracted;
            }
        }
    }

    // 2. Try with com.android.shell caller identity parameter
    let output = exec_adb_shell(serial, &["service", "call", "iphonesubinfo", "19", "s16", "com.android.shell"]);
    if output.contains("Result: Parcel") {
        let extracted = parse_parcel_string(&output);
        if !extracted.is_empty() && extracted.chars().any(|c| c.is_ascii_digit()) && extracted.len() >= 6 {
            return extracted;
        }
    }

    // 3. Fallback: try querying call log phone_account_address
    let call_query = exec_adb_shell(
        serial,
        &["content", "query", "--uri", "content://call_log/calls", "--projection", "phone_account_address", "--limit", "1"],
    );
    if let Some(idx) = call_query.find("phone_account_address=") {
        let val = &call_query[idx + 22..];
        let num = val.split_whitespace().next().unwrap_or("").trim_matches(',').trim();
        if !num.is_empty() && num != "NULL" && num != "null" && num.len() >= 6 {
            return num.to_string();
        }
    }

    "Not Available / Hidden by Carrier".to_string()
}

/// Format seconds into readable uptime format (e.g. "2d 14h 32m")
pub fn format_seconds(seconds: u64) -> String {
    let days = seconds / 86400;
    let hours = (seconds % 86400) / 3600;
    let minutes = (seconds % 3600) / 60;
    if days > 0 {
        format!("{}d {}h {}m", days, hours, minutes)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes)
    } else {
        format!("{}m", minutes)
    }
}
