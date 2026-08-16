use super::types::DeviceHealth;
use super::utils::{exec_adb_shell, format_seconds};

#[tauri::command]
pub async fn get_device_health(serial: String) -> std::result::Result<DeviceHealth, String> {
    // 1. Battery info via `dumpsys battery`
    let battery_out = exec_adb_shell(&serial, &["dumpsys", "battery"]);
    let mut battery_level: u32 = 80;
    let mut battery_temp: f32 = 30.0;
    let mut battery_status = "Connected".to_string();

    for line in battery_out.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("level:") {
            if let Ok(val) = trimmed.trim_start_matches("level:").trim().parse::<u32>() {
                battery_level = val;
            }
        } else if trimmed.starts_with("temperature:") {
            if let Ok(val) = trimmed.trim_start_matches("temperature:").trim().parse::<f32>() {
                battery_temp = val / 10.0; // dumpsys battery gives temp in tenths of deg C (e.g. 315 -> 31.5 C)
            }
        } else if trimmed.starts_with("status:") {
            let st = trimmed.trim_start_matches("status:").trim();
            battery_status = match st {
                "2" => "Charging",
                "3" => "Discharging",
                "4" => "Not Charging",
                "5" => "Full",
                _ => "Connected",
            }
            .to_string();
        }
    }

    // 2. RAM info via `/proc/meminfo`
    let mem_out = exec_adb_shell(&serial, &["cat", "/proc/meminfo"]);
    let mut mem_total_kb: u64 = 0;
    let mut mem_avail_kb: u64 = 0;

    for line in mem_out.lines() {
        if line.starts_with("MemTotal:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                mem_total_kb = parts[1].parse().unwrap_or(0);
            }
        } else if line.starts_with("MemAvailable:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 2 {
                mem_avail_kb = parts[1].parse().unwrap_or(0);
            }
        }
    }

    let ram_total_mb = mem_total_kb / 1024;
    let ram_used_mb = if mem_total_kb > mem_avail_kb {
        (mem_total_kb - mem_avail_kb) / 1024
    } else {
        0
    };
    let ram_usage_percent = if mem_total_kb > 0 {
        ((mem_total_kb - mem_avail_kb) as f32 / mem_total_kb as f32) * 100.0
    } else {
        45.0
    };

    // 3. Storage info via `df -k /data`
    let df_out = exec_adb_shell(&serial, &["df", "-k", "/data"]);
    let mut storage_total_gb: f32 = 64.0;
    let mut storage_used_gb: f32 = 32.0;
    let mut storage_usage_percent: f32 = 50.0;

    for line in df_out.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            if let (Ok(total_k), Ok(used_k)) = (parts[1].parse::<f64>(), parts[2].parse::<f64>()) {
                storage_total_gb = (total_k / (1024.0 * 1024.0)) as f32;
                storage_used_gb = (used_k / (1024.0 * 1024.0)) as f32;
                if storage_total_gb > 0.0 {
                    storage_usage_percent = (storage_used_gb / storage_total_gb) * 100.0;
                }
                break;
            }
        }
    }

    // 4. CPU usage estimate via `top -n 1 -b` or proc stat
    let top_out = exec_adb_shell(&serial, &["top", "-n", "1", "-b"]);
    let mut cpu_usage_percent: f32 = 12.0;

    for line in top_out.lines() {
        if line.contains("CPU") || line.contains("User") || line.contains("idle") {
            let lower = line.to_lowercase();
            if let Some(idx) = lower.find("%idle") {
                let prefix = &line[..idx];
                if let Some(last_word) = prefix.split_whitespace().last() {
                    let clean_num = last_word.trim_end_matches('%');
                    if let Ok(idle_val) = clean_num.parse::<f32>() {
                        if idle_val <= 100.0 {
                            cpu_usage_percent = 100.0 - idle_val;
                        } else {
                            // Multi-core scaling e.g. 800% max
                            cpu_usage_percent = ((800.0 - idle_val) / 8.0).clamp(1.0, 100.0);
                        }
                    }
                }
            } else if lower.contains("user") {
                for token in line.split_whitespace() {
                    if token.ends_with("%user") || token.ends_with("%") {
                        if let Ok(val) = token.trim_end_matches("%user").trim_end_matches('%').parse::<f32>() {
                            cpu_usage_percent = val.clamp(1.0, 100.0);
                            break;
                        }
                    }
                }
            }
        }
    }

    // 5. Network type
    let net_prop = exec_adb_shell(&serial, &["getprop", "gsm.network.type"]);
    let network_type = if serial.contains(':') {
        "Wi-Fi (ADB)".to_string()
    } else if !net_prop.is_empty() && net_prop != "Unknown" {
        format!("Mobile ({})", net_prop)
    } else {
        "Wi-Fi".to_string()
    };

    // 6. Uptime formatted
    let uptime_str = exec_adb_shell(&serial, &["cat", "/proc/uptime"]);
    let uptime_formatted = if let Some(first_num) = uptime_str.split_whitespace().next() {
        if let Ok(secs) = first_num.parse::<f64>() {
            format_seconds(secs as u64)
        } else {
            "Active".to_string()
        }
    } else {
        "Active".to_string()
    };

    Ok(DeviceHealth {
        battery_level,
        battery_temp,
        battery_status,
        ram_total_mb,
        ram_used_mb,
        ram_usage_percent,
        storage_total_gb,
        storage_used_gb,
        storage_usage_percent,
        cpu_usage_percent,
        network_type,
        adb_status: "Connected".to_string(),
        uptime_formatted,
    })
}
