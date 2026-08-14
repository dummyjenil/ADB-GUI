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

/// Fetch device call logs via content provider query
#[tauri::command]
pub async fn get_call_logs(serial: String) -> Result<Vec<CallLogItem>, String> {
    let raw = run_adb_shell(
        &serial,
        &[
            "content",
            "query",
            "--uri",
            "content://call_log/calls",
            "--projection",
            "_id:number:name:date:duration:type",
            "--sort",
            "date DESC",
        ],
    )?;

    let mut list = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("Row:") {
            continue;
        }

        let mut id = String::new();
        let mut number = String::new();
        let mut name = String::new();
        let mut date = String::new();
        let mut duration = String::new();
        let mut call_type = "unknown".to_string();

        let content = if let Some(idx) = trimmed.find(' ') {
            &trimmed[idx + 1..]
        } else {
            trimmed
        };

        for part in content.split(',') {
            let part = part.trim();
            if let Some(eq_idx) = part.find('=') {
                let key = part[..eq_idx].trim();
                let val = part[eq_idx + 1..].trim();

                match key {
                    "_id" => id = val.to_string(),
                    "number" => number = if val == "NULL" || val == "null" { "".to_string() } else { val.to_string() },
                    "name" => name = if val == "NULL" || val == "null" { "".to_string() } else { val.to_string() },
                    "date" => {
                        if let Ok(ts) = val.parse::<i64>() {
                            let secs = ts / 1000;
                            date = format_timestamp(secs);
                        } else {
                            date = val.to_string();
                        }
                    }
                    "duration" => {
                        if let Ok(dur) = val.parse::<u64>() {
                            let mins = dur / 60;
                            let rem_secs = dur % 60;
                            duration = format!("{}m {}s", mins, rem_secs);
                        } else {
                            duration = format!("{}s", val);
                        }
                    }
                    "type" => {
                        call_type = match val {
                            "1" => "incoming".to_string(),
                            "2" => "outgoing".to_string(),
                            "3" => "missed".to_string(),
                            "4" => "voicemail".to_string(),
                            "5" => "rejected".to_string(),
                            "6" => "blocked".to_string(),
                            _ => "unknown".to_string(),
                        };
                    }
                    _ => {}
                }
            }
        }

        if !id.is_empty() || !number.is_empty() {
            list.push(CallLogItem {
                id,
                number: if number.is_empty() { "Unknown / Private".to_string() } else { number },
                name: if name.is_empty() { "Unknown Contact".to_string() } else { name },
                date: if date.is_empty() { "Recently".to_string() } else { date },
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
    let res = run_adb_shell(&serial, &["telecom", "end-call"]);
    if res.is_ok() {
        return Ok("Call ended successfully".to_string());
    }
    run_adb_shell(&serial, &["input", "keyevent", "6"])?;
    Ok("Sent ENDCALL keyevent".to_string())
}

/// Fetch SMS messages via content provider
#[tauri::command]
pub async fn get_sms_list(serial: String) -> Result<Vec<SmsItem>, String> {
    let raw = run_adb_shell(
        &serial,
        &[
            "content",
            "query",
            "--uri",
            "content://sms",
            "--projection",
            "_id:address:body:date:type:read",
            "--sort",
            "date DESC",
        ],
    )?;

    let mut list = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("Row:") {
            continue;
        }

        let mut id = String::new();
        let mut address = String::new();
        let mut body = String::new();
        let mut date = String::new();
        let mut msg_type = "inbox".to_string();
        let mut read = true;

        let content = if let Some(idx) = trimmed.find(' ') {
            &trimmed[idx + 1..]
        } else {
            trimmed
        };

        for part in content.split(',') {
            let part = part.trim();
            if let Some(eq_idx) = part.find('=') {
                let key = part[..eq_idx].trim();
                let val = part[eq_idx + 1..].trim();

                match key {
                    "_id" => id = val.to_string(),
                    "address" => address = if val == "NULL" || val == "null" { "".to_string() } else { val.to_string() },
                    "body" => body = if val == "NULL" || val == "null" { "".to_string() } else { val.to_string() },
                    "date" => {
                        if let Ok(ts) = val.parse::<i64>() {
                            let secs = ts / 1000;
                            date = format_timestamp(secs);
                        } else {
                            date = val.to_string();
                        }
                    }
                    "type" => {
                        msg_type = match val {
                            "1" => "inbox".to_string(),
                            "2" => "sent".to_string(),
                            "3" => "draft".to_string(),
                            "4" => "outbox".to_string(),
                            _ => "inbox".to_string(),
                        };
                    }
                    "read" => {
                        read = val == "1";
                    }
                    _ => {}
                }
            }
        }

        if !id.is_empty() || !address.is_empty() || !body.is_empty() {
            list.push(SmsItem {
                id,
                address: if address.is_empty() { "Unknown Sender".to_string() } else { address },
                body: if body.is_empty() { "[Empty Message]".to_string() } else { body },
                date: if date.is_empty() { "Recent".to_string() } else { date },
                msg_type,
                read,
            });
        }
    }

    Ok(list)
}

/// Send SMS message to target number
#[tauri::command]
pub async fn send_sms(serial: String, number: String, body: String) -> Result<String, String> {
    let clean_number = number.trim().replace(' ', "");
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

/// Fetch contacts from contacts provider
#[tauri::command]
pub async fn get_contacts_list(serial: String) -> Result<Vec<ContactItem>, String> {
    let raw = run_adb_shell(
        &serial,
        &[
            "content",
            "query",
            "--uri",
            "content://contacts/phones/",
            "--projection",
            "_id:display_name:number",
            "--sort",
            "display_name ASC",
        ],
    )?;

    let mut list = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("Row:") {
            continue;
        }

        let mut id = String::new();
        let mut name = String::new();
        let mut number = String::new();

        let content = if let Some(idx) = trimmed.find(' ') {
            &trimmed[idx + 1..]
        } else {
            trimmed
        };

        for part in content.split(',') {
            let part = part.trim();
            if let Some(eq_idx) = part.find('=') {
                let key = part[..eq_idx].trim();
                let val = part[eq_idx + 1..].trim();

                match key {
                    "_id" => id = val.to_string(),
                    "display_name" => name = if val == "NULL" || val == "null" { "".to_string() } else { val.to_string() },
                    "number" => number = if val == "NULL" || val == "null" { "".to_string() } else { val.to_string() },
                    _ => {}
                }
            }
        }

        if !name.is_empty() || !number.is_empty() {
            list.push(ContactItem {
                id,
                name: if name.is_empty() { "Unknown".to_string() } else { name },
                number: if number.is_empty() { "No Number".to_string() } else { number },
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
