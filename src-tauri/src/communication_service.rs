use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallLogItem {
    pub id: String,
    pub number: String,
    pub name: String,
    pub date: String,
    pub duration: String,
    pub call_type: String, // "incoming", "outgoing", "missed", "voicemail", "rejected", "blocked"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SmsItem {
    pub id: String,
    pub address: String,
    pub body: String,
    pub date: String,
    pub msg_type: String, // "inbox", "sent", "draft", "outbox"
    pub read: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContactItem {
    pub id: String,
    pub name: String,
    pub number: String,
}

fn run_adb_shell(serial: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["-s", serial, "shell"];
    cmd_args.extend_from_slice(args);

    let output = Command::new("adb")
        .args(&cmd_args)
        .output()
        .map_err(|e| format!("Failed to run adb command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() || !stdout.is_empty() {
        Ok(stdout)
    } else {
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

fn run_adb_shell_single(serial: &str, shell_cmd: &str) -> Result<String, String> {
    let output = Command::new("adb")
        .args(["-s", serial, "shell", shell_cmd])
        .output()
        .map_err(|e| format!("Failed to run adb command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() || !stdout.is_empty() {
        Ok(stdout)
    } else {
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

fn parse_content_query_rows(raw: &str) -> Vec<std::collections::HashMap<String, String>> {
    let mut rows = Vec::new();
    let mut current_row_text = String::new();

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("Row:") {
            if !current_row_text.is_empty() {
                rows.push(parse_single_content_row(&current_row_text));
                current_row_text.clear();
            }
            if let Some(idx) = trimmed.find(' ') {
                current_row_text.push_str(&trimmed[idx + 1..]);
            } else {
                current_row_text.push_str(trimmed);
            }
        } else if !current_row_text.is_empty() {
            current_row_text.push(' ');
            current_row_text.push_str(trimmed);
        }
    }

    if !current_row_text.is_empty() {
        rows.push(parse_single_content_row(&current_row_text));
    }

    rows
}

fn parse_single_content_row(row_str: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    let chars: Vec<char> = row_str.chars().collect();
    let len = chars.len();
    let mut i = 0;

    let mut current_key = String::new();
    let mut current_val = String::new();
    let mut in_key = true;

    while i < len {
        if in_key {
            if chars[i] == '=' {
                in_key = false;
                i += 1;
                continue;
            }
            if chars[i] == ' ' || chars[i] == ',' {
                if !current_key.is_empty() {
                    current_key.push(chars[i]);
                }
            } else {
                current_key.push(chars[i]);
            }
            i += 1;
        } else {
            let is_next_key = if chars[i] == ',' {
                let mut j = i + 1;
                while j < len && (chars[j] == ' ' || chars[j] == '\t') {
                    j += 1;
                }
                let key_start = j;
                while j < len && (chars[j].is_alphanumeric() || chars[j] == '_' || chars[j] == '.' || chars[j] == '-') {
                    j += 1;
                }
                j > key_start && j < len && chars[j] == '='
            } else {
                false
            };

            if is_next_key {
                let clean_key = current_key.trim().to_string();
                let clean_val = current_val.trim().to_string();
                if !clean_key.is_empty() {
                    map.insert(clean_key, clean_val);
                }
                current_key.clear();
                current_val.clear();
                in_key = true;
                i += 1;
                while i < len && (chars[i] == ' ' || chars[i] == '\t') {
                    i += 1;
                }
            } else {
                current_val.push(chars[i]);
                i += 1;
            }
        }
    }

    let clean_key = current_key.trim().to_string();
    let clean_val = current_val.trim().to_string();
    if !clean_key.is_empty() {
        map.insert(clean_key, clean_val);
    }

    map
}

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

/// Fetch contacts from contacts provider
#[tauri::command]
pub async fn get_contacts_list(serial: String) -> Result<Vec<ContactItem>, String> {
    // Attempt granting permission to shell
    let _ = run_adb_shell(&serial, &["pm", "grant", "com.android.shell", "android.permission.READ_CONTACTS"]);

    // Try primary URI
    let mut raw = run_adb_shell_single(
        &serial,
        "content query --uri content://com.android.contacts/data/phones",
    );

    if raw.is_err() || raw.as_ref().map(|r| r.trim().is_empty()).unwrap_or(true) {
        raw = run_adb_shell_single(
            &serial,
            "content query --uri content://contacts/phones/",
        );
    }

    let raw_text = match raw {
        Ok(t) => t,
        Err(e) => {
            if e.contains("SecurityException") || e.contains("Permission Denial") {
                return Err("Access to Contacts is restricted by Android security. Grant permission with: adb shell pm grant com.android.shell android.permission.READ_CONTACTS".to_string());
            }
            return Err(e);
        }
    };

    if raw_text.contains("SecurityException") || raw_text.contains("Permission Denial") {
        return Err("Access to Contacts is restricted by Android security. Grant permission with: adb shell pm grant com.android.shell android.permission.READ_CONTACTS".to_string());
    }

    let parsed_rows = parse_content_query_rows(&raw_text);
    let mut list = Vec::new();

    for row in parsed_rows {
        let id = row.get("_id")
            .or_else(|| row.get("contact_id"))
            .or_else(|| row.get("raw_contact_id"))
            .cloned()
            .unwrap_or_default();

        let name = row.get("display_name")
            .or_else(|| row.get("display_name_alt"))
            .map(|s| s.as_str())
            .unwrap_or("");
        let name_clean = if name == "NULL" || name == "null" { "" } else { name };

        let number = row.get("data1")
            .or_else(|| row.get("number"))
            .or_else(|| row.get("data4"))
            .map(|s| s.as_str())
            .unwrap_or("");
        let number_clean = if number == "NULL" || number == "null" { "" } else { number };

        if !name_clean.is_empty() || !number_clean.is_empty() {
            list.push(ContactItem {
                id,
                name: if name_clean.is_empty() { "Unknown".to_string() } else { name_clean.to_string() },
                number: if number_clean.is_empty() { "No Number".to_string() } else { number_clean.to_string() },
            });
        }
    }

    Ok(list)
}

fn format_timestamp(secs: i64) -> String {
    if secs <= 0 {
        return "Unknown".to_string();
    }
    let days_since_epoch = secs / 86400;
    let time_of_day = secs % 86400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;

    let mut year = 1970;
    let mut d = days_since_epoch;
    while d >= 365 {
        let leap = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) { 1 } else { 0 };
        if d >= 365 + leap {
            d -= 365 + leap;
            year += 1;
        } else {
            break;
        }
    }
    format!("{}-{:02} {:02}:{:02}:{:02}", year, d + 1, hours, minutes, seconds)
}

