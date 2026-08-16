use super::types::SmsItem;
use super::utils::{format_timestamp, parse_content_query_rows, run_adb_shell, run_adb_shell_single};

/// Fetch SMS messages via content provider
#[tauri::command]
pub async fn get_sms_list(serial: String) -> Result<Vec<SmsItem>, String> {
    // Attempt granting permission to shell
    let _ = run_adb_shell(&serial, &["pm", "grant", "com.android.shell", "android.permission.READ_SMS"]);

    let raw = run_adb_shell_single(
        &serial,
        "content query --uri content://sms",
    );

    let raw_text = match raw {
        Ok(t) if !t.trim().is_empty() => t,
        _ => {
            run_adb_shell_single(
                &serial,
                "content query --uri content://sms --projection _id:address:body:date:type:read",
            ).map_err(|e| {
                if e.contains("SecurityException") || e.contains("Permission Denial") {
                    "Access to SMS is restricted by Android security. Grant permission with: adb shell pm grant com.android.shell android.permission.READ_SMS".to_string()
                } else {
                    e
                }
            })?
        }
    };

    if raw_text.contains("SecurityException") || raw_text.contains("Permission Denial") {
        return Err("Access to SMS is restricted by Android security. Grant permission with: adb shell pm grant com.android.shell android.permission.READ_SMS".to_string());
    }

    let parsed_rows = parse_content_query_rows(&raw_text);
    let mut list = Vec::new();

    for row in parsed_rows {
        let id = row.get("_id").cloned().unwrap_or_default();

        let address = row.get("address").map(|s| s.as_str()).unwrap_or("");
        let address_clean = if address == "NULL" || address == "null" { "" } else { address };

        let body = row.get("body").map(|s| s.as_str()).unwrap_or("");
        let body_clean = if body == "NULL" || body == "null" { "" } else { body };

        let date_str = row.get("date").map(|s| s.as_str()).unwrap_or("");
        let date = if let Ok(ts) = date_str.parse::<i64>() {
            let secs = if ts > 1_000_000_000_000 { ts / 1000 } else { ts };
            format_timestamp(secs)
        } else if !date_str.is_empty() && date_str != "NULL" {
            date_str.to_string()
        } else {
            "Recent".to_string()
        };

        let type_str = row.get("type").map(|s| s.as_str()).unwrap_or("1");
        let msg_type = match type_str {
            "1" => "inbox".to_string(),
            "2" => "sent".to_string(),
            "3" => "draft".to_string(),
            "4" => "outbox".to_string(),
            _ => "inbox".to_string(),
        };

        let read = row.get("read").map(|s| s == "1").unwrap_or(true);

        if !id.is_empty() || !address_clean.is_empty() || !body_clean.is_empty() {
            list.push(SmsItem {
                id,
                address: if address_clean.is_empty() { "Unknown Sender".to_string() } else { address_clean.to_string() },
                body: if body_clean.is_empty() { "[Empty Message]".to_string() } else { body_clean.to_string() },
                date,
                msg_type,
                read,
            });
        }
    }

    Ok(list)
}

/// Send SMS message directly to target number via cellular isms service or sendto intent
#[tauri::command]
pub async fn send_sms(serial: String, number: String, body: String) -> Result<String, String> {
    let clean_number = number.trim().replace(' ', "");

    // 1. Try sending directly via cellular isms service (direct background cellular dispatch)
    let isms_res = run_adb_shell(
        &serial,
        &[
            "service",
            "call",
            "isms",
            "5",
            "s16",
            "com.android.mms",
            "s16",
            &clean_number,
            "s16",
            "null",
            "s16",
            &body,
            "s16",
            "null",
            "s16",
            "null",
        ],
    );

    if let Ok(ref res) = isms_res {
        if res.contains("Result: Parcel") {
            return Ok(format!("SMS dispatched directly to cellular network for {}", clean_number));
        }
    }

    // 2. Try isms code 7 (newer Android)
    let isms_res2 = run_adb_shell(
        &serial,
        &[
            "service",
            "call",
            "isms",
            "7",
            "s16",
            "com.android.mms",
            "s16",
            &clean_number,
            "s16",
            "null",
            "s16",
            &body,
            "s16",
            "null",
            "s16",
            "null",
        ],
    );

    if let Ok(ref res2) = isms_res2 {
        if res2.contains("Result: Parcel") {
            return Ok(format!("SMS dispatched directly to cellular network for {}", clean_number));
        }
    }

    // 3. Fallback to sending via messaging intent
    let uri = format!("smsto:{}", clean_number);
    let out = run_adb_shell(
        &serial,
        &[
            "am",
            "start",
            "-a",
            "android.intent.action.SENDTO",
            "-d",
            &uri,
            "--es",
            "sms_body",
            &body,
            "--ez",
            "exit_on_sent",
            "true",
        ],
    )?;
    Ok(format!("Sent SMS to {}: {}", clean_number, out))
}

/// Open native SMS Composer UI on phone pre-filled with recipient number and message
#[tauri::command]
pub async fn open_sms_composer(serial: String, number: String, body: String) -> Result<String, String> {
    let clean_number = number.trim().replace(' ', "");
    let uri = format!("smsto:{}", clean_number);
    let mut args = vec![
        "am",
        "start",
        "-a",
        "android.intent.action.SENDTO",
        "-d",
        &uri,
    ];
    let body_trimmed = body.trim();
    if !body_trimmed.is_empty() {
        args.push("--es");
        args.push("sms_body");
        args.push(body_trimmed);
    }

    let out = run_adb_shell(&serial, &args)?;
    Ok(format!("Opened SMS Composer for {}: {}", clean_number, out))
}
