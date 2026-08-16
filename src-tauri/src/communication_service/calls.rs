use super::types::CallLogItem;
use super::utils::{format_timestamp, parse_content_query_rows, run_adb_shell, run_adb_shell_single};

/// Fetch device call logs via content provider query
#[tauri::command]
pub async fn get_call_logs(serial: String) -> Result<Vec<CallLogItem>, String> {
    // Attempt granting permission to shell if needed
    let _ = run_adb_shell(&serial, &["pm", "grant", "com.android.shell", "android.permission.READ_CALL_LOG"]);

    // Try standard base query first without brittle projection
    let raw = run_adb_shell_single(
        &serial,
        "content query --uri content://call_log/calls",
    );

    let raw_text = match raw {
        Ok(t) if !t.trim().is_empty() => t,
        _ => {
            // Fallback with projection if full dump returned empty
            run_adb_shell_single(
                &serial,
                "content query --uri content://call_log/calls --projection _id:number:name:date:duration:type",
            ).map_err(|e| {
                if e.contains("SecurityException") || e.contains("Permission Denial") {
                    "Access to Call Logs is restricted by Android security. Grant permission with: adb shell pm grant com.android.shell android.permission.READ_CALL_LOG".to_string()
                } else {
                    e
                }
            })?
        }
    };

    if raw_text.contains("SecurityException") || raw_text.contains("Permission Denial") {
        return Err("Access to Call Logs is restricted by Android security. Grant permission with: adb shell pm grant com.android.shell android.permission.READ_CALL_LOG".to_string());
    }

    let parsed_rows = parse_content_query_rows(&raw_text);
    let mut list = Vec::new();

    for row in parsed_rows {
        let id = row.get("_id").cloned().unwrap_or_default();

        let number = row.get("number")
            .or_else(|| row.get("formatted_number"))
            .or_else(|| row.get("normalized_number"))
            .or_else(|| row.get("matched_number"))
            .map(|s| s.as_str())
            .unwrap_or("");
        let number_clean = if number == "NULL" || number == "null" { "" } else { number };

        let name = row.get("name")
            .or_else(|| row.get("cnip_name"))
            .map(|s| s.as_str())
            .unwrap_or("");
        let name_clean = if name == "NULL" || name == "null" { "" } else { name };

        let date_str = row.get("date").map(|s| s.as_str()).unwrap_or("");
        let date = if let Ok(ts) = date_str.parse::<i64>() {
            let secs = if ts > 1_000_000_000_000 { ts / 1000 } else { ts };
            format_timestamp(secs)
        } else if !date_str.is_empty() && date_str != "NULL" {
            date_str.to_string()
        } else {
            "Recently".to_string()
        };

        let dur_str = row.get("duration").map(|s| s.as_str()).unwrap_or("0");
        let duration = if let Ok(dur) = dur_str.parse::<u64>() {
            let mins = dur / 60;
            let rem_secs = dur % 60;
            if mins > 0 {
                format!("{}m {}s", mins, rem_secs)
            } else {
                format!("{}s", rem_secs)
            }
        } else {
            format!("{}s", dur_str)
        };

        let type_str = row.get("type").map(|s| s.as_str()).unwrap_or("1");
        let call_type = match type_str {
            "1" => "incoming".to_string(),
            "2" => "outgoing".to_string(),
            "3" => "missed".to_string(),
            "4" => "voicemail".to_string(),
            "5" => "rejected".to_string(),
            "6" => "blocked".to_string(),
            _ => "incoming".to_string(),
        };

        if !id.is_empty() || !number_clean.is_empty() || !name_clean.is_empty() {
            list.push(CallLogItem {
                id,
                number: if number_clean.is_empty() { "Unknown / Private".to_string() } else { number_clean.to_string() },
                name: if name_clean.is_empty() { "Unknown Contact".to_string() } else { name_clean.to_string() },
                date,
                duration,
                call_type,
            });
        }
    }

    Ok(list)
}

/// Trigger outgoing call on device
#[tauri::command]
pub async fn trigger_call(serial: String, number: String) -> Result<String, String> {
    let clean_number = number.trim().replace(' ', "");
    let uri = format!("tel:{}", clean_number);
    let out = run_adb_shell(
        &serial,
        &["am", "start", "-a", "android.intent.action.CALL", "-d", &uri],
    )?;
    Ok(format!("Calling {}: {}", clean_number, out))
}

/// End ongoing active phone call
#[tauri::command]
pub async fn end_call(serial: String) -> Result<String, String> {
    // 1. Try telecom end-call
    let _ = run_adb_shell(&serial, &["telecom", "end-call"]);

    // 2. Try KEYCODE_ENDCALL (keycode 6)
    let _ = run_adb_shell(&serial, &["input", "keyevent", "6"]);

    // 3. Try service call phone (endCall IPC)
    let _ = run_adb_shell(&serial, &["service", "call", "phone", "5"]);

    Ok("Call termination command dispatched to device".to_string())
}
