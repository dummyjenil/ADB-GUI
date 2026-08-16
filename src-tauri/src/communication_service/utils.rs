use std::collections::HashMap;
use std::process::Command;

pub fn run_adb_shell(serial: &str, args: &[&str]) -> Result<String, String> {
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

pub fn run_adb_shell_single(serial: &str, shell_cmd: &str) -> Result<String, String> {
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

pub fn parse_content_query_rows(raw: &str) -> Vec<HashMap<String, String>> {
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

pub fn parse_single_content_row(row_str: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
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

pub fn format_timestamp(secs: i64) -> String {
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
