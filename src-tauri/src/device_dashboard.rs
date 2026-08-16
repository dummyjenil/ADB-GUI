use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceDetails {
    pub serial: String,
    pub hardware_serial: String,
    pub adb_target: String,
    pub model: String,
    pub manufacturer: String,
    pub brand: String,
    pub device_name: String,
    pub android_version: String,
    pub sdk_level: String,
    pub build_id: String,
    pub build_fingerprint: String,
    pub security_patch: String,
    pub bootloader_state: String,
    pub build_type: String,
    pub cpu_abi: String,
    pub supported_abis: String,
    pub architecture: String,
    pub kernel_version: String,
    pub hostname: String,
    pub device_uptime: String,
    pub usb_state: String,
    pub adb_state: String,
    pub usb_debugging: String,
    pub wifi_debugging: String,
    pub root_availability: String,
    pub selinux_status: String,
    pub network_operator: String,
    pub sim_operator: String,
    pub sim_state: String,
    pub is_roaming: String,
    pub sim_country: String,
    pub operator_numeric: String,
    pub multisim_config: String,
    pub phone_number: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceHealth {
    pub battery_level: u32,
    pub battery_temp: f32,
    pub battery_status: String,
    pub ram_total_mb: u64,
    pub ram_used_mb: u64,
    pub ram_usage_percent: f32,
    pub storage_total_gb: f32,
    pub storage_used_gb: f32,
    pub storage_usage_percent: f32,
    pub cpu_usage_percent: f32,
    pub network_type: String,
    pub adb_status: String,
    pub uptime_formatted: String,
}

/// Helper function to parse all getprop output into a HashMap
fn fetch_all_props(serial: &str) -> HashMap<String, String> {
    let mut props = HashMap::new();
    let output = Command::new("adb")
        .args(["-s", serial, "shell", "getprop"])
        .output();

    if let Ok(out) = output {
        if out.status.success() {
            let text = String::from_utf8_lossy(&out.stdout);
            for line in text.lines() {
                // Lines look like: [key]: [value]
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
fn exec_adb_shell(serial: &str, cmd: &[&str]) -> String {
    let mut args = vec!["-s", serial, "shell"];
    args.extend_from_slice(cmd);
    match Command::new("adb").args(&args).output() {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).trim().to_string(),
        _ => "Unknown".to_string(),
    }
}

/// Helper to parse ASCII/numeric string from Android service call parcel dump
fn parse_parcel_string(raw: &str) -> String {
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
fn get_self_phone_number(serial: &str) -> String {
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
fn format_seconds(seconds: u64) -> String {
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

#[tauri::command]
pub async fn get_device_full_details(serial: String) -> std::result::Result<DeviceDetails, String> {
    let props = fetch_all_props(&serial);

    let get_prop = |key: &str, fallback: &str| -> String {
        props.get(key).cloned().unwrap_or_else(|| fallback.to_string())
    };

    let model = get_prop("ro.product.model", "Android Device");
    let manufacturer = get_prop("ro.product.manufacturer", "Unknown");
    let brand = get_prop("ro.product.brand", "Unknown");
    let device_name = {
        let name = get_prop("ro.product.device", "");
        if name.is_empty() {
            get_prop("ro.product.name", "Unknown")
        } else {
            name
        }
    };
    let android_version = get_prop("ro.build.version.release", "Unknown");
    let sdk_level = get_prop("ro.build.version.sdk", "Unknown");
    let build_id = get_prop("ro.build.id", "Unknown");
    let build_fingerprint = get_prop("ro.build.fingerprint", "Unknown");
    let security_patch = get_prop("ro.build.version.security_patch", "Unknown");

    // Bootloader state
    let bootloader = get_prop("ro.bootloader", "");
    let locked = get_prop("ro.boot.flash.locked", "");
    let bootloader_state = if !locked.is_empty() {
        if locked == "1" { "Locked".to_string() } else { "Unlocked".to_string() }
    } else if !bootloader.is_empty() {
        bootloader
    } else {
        "Locked".to_string()
    };

    let build_type = get_prop("ro.build.type", "user");
    let cpu_abi = get_prop("ro.product.cpu.abi", "Unknown");
    let supported_abis = get_prop("ro.product.cpu.abilist", &cpu_abi);

    // Architecture & Kernel
    let arch_out = exec_adb_shell(&serial, &["uname", "-m"]);
    let architecture = if !arch_out.is_empty() && arch_out != "Unknown" {
        arch_out
    } else {
        cpu_abi.clone()
    };

    let kernel_out = exec_adb_shell(&serial, &["uname", "-r"]);
    let kernel_version = if !kernel_out.is_empty() && kernel_out != "Unknown" {
        kernel_out
    } else {
        "Unknown Kernel".to_string()
    };

    // Hostname
    let hostname = {
        let h = get_prop("net.hostname", "");
        if h.is_empty() || h == "Unknown" || h == "localhost" {
            let h_shell = exec_adb_shell(&serial, &["hostname"]);
            if h_shell.is_empty() || h_shell == "Unknown" || h_shell == "localhost" {
                format!("android-{}", serial.chars().filter(|c| c.is_alphanumeric()).take(8).collect::<String>())
            } else {
                h_shell
            }
        } else {
            h
        }
    };

    // Device uptime
    let uptime_str = exec_adb_shell(&serial, &["cat", "/proc/uptime"]);
    let device_uptime = if let Some(first_num) = uptime_str.split_whitespace().next() {
        if let Ok(secs) = first_num.parse::<f64>() {
            format_seconds(secs as u64)
        } else {
            "Unknown".to_string()
        }
    } else {
        "Unknown".to_string()
    };

    // USB & ADB & Debugging states
    let usb_state = get_prop("sys.usb.state", &get_prop("sys.usb.config", "Connected"));
    let adb_state = get_prop("init.svc.adbd", "running");
    let usb_debugging = if get_prop("persist.sys.usb.config", "").contains("adb") || adb_state == "running" {
        "Enabled".to_string()
    } else {
        "Disabled".to_string()
    };

    let wifi_dbg_port = get_prop("service.adb.tcp.port", "");
    let wifi_debugging = if !wifi_dbg_port.is_empty() && wifi_dbg_port != "-1" && wifi_dbg_port != "0" {
        format!("Enabled (Port {})", wifi_dbg_port)
    } else if serial.contains(':') {
        "Enabled (Active Wi-Fi ADB)".to_string()
    } else {
        "Disabled / Inactive".to_string()
    };

    // Root availability
    let root_check = exec_adb_shell(&serial, &["which", "su"]);
    let root_availability = if !root_check.is_empty() && !root_check.contains("not found") && root_check != "Unknown" {
        "Rooted (su available)".to_string()
    } else {
        "Not Rooted".to_string()
    };

    // SELinux status
    let selinux_out = exec_adb_shell(&serial, &["getenforce"]);
    let selinux_status = if selinux_out.is_empty() || selinux_out == "Unknown" {
        get_prop("ro.boot.selinux", "Enforcing")
    } else {
        selinux_out
    };

    let hardware_serial = {
        let s = get_prop("ro.serialno", "");
        if s.is_empty() || s == "Unknown" {
            let s2 = get_prop("ro.boot.serialno", "");
            if s2.is_empty() || s2 == "Unknown" {
                if !serial.contains(':') {
                    serial.clone()
                } else {
                    "Unknown / Protected by OEM".to_string()
                }
            } else {
                s2
            }
        } else {
            s
        }
    };

    // Cellular & SIM Telephony Info
    let raw_net_op = get_prop("gsm.operator.alpha", "");
    let network_operator = if !raw_net_op.is_empty() {
        raw_net_op.trim_end_matches(',').trim().to_string()
    } else {
        get_prop("gsm.sim.operator.alpha", "No Network / Wi-Fi Only")
    };

    let sim_operator = {
        let op = get_prop("gsm.sim.operator.alpha", "");
        if !op.is_empty() {
            op.trim_end_matches(',').trim().to_string()
        } else {
            "Not Available".to_string()
        }
    };

    let sim_state_raw = get_prop("gsm.sim.state", "");
    let sim_state = if !sim_state_raw.is_empty() {
        let parts: Vec<&str> = sim_state_raw.split(',').collect();
        let formatted: Vec<String> = parts.iter().enumerate().map(|(idx, s)| {
            let status = match s.trim() {
                "LOADED" | "READY" => "Ready (Active)",
                "ABSENT" | "NOT_READY" => "Absent / Empty",
                "PIN_REQUIRED" => "PIN Locked",
                "PUK_REQUIRED" => "PUK Locked",
                "NETWORK_LOCKED" => "Network Locked",
                other => other,
            };
            format!("Slot {}: {}", idx + 1, status)
        }).collect();
        formatted.join(" • ")
    } else {
        "No SIM detected".to_string()
    };

    let roaming_raw = get_prop("gsm.operator.isroaming", "false");
    let is_roaming = if roaming_raw.contains("true") {
        "Roaming Active".to_string()
    } else {
        "Home Network (No Roaming)".to_string()
    };

    let sim_country = {
        let c = get_prop("gsm.operator.iso-country", &get_prop("gsm.sim.operator.iso-country", ""));
        let cleaned = c.trim_end_matches(',').trim().to_uppercase();
        if cleaned.is_empty() { "Unknown".to_string() } else { cleaned }
    };

    let operator_numeric = {
        let n = get_prop("gsm.operator.numeric", &get_prop("gsm.sim.operator.numeric", ""));
        let cleaned = n.trim_end_matches(',').trim();
        if cleaned.is_empty() { "N/A".to_string() } else { cleaned.to_string() }
    };

    let slots_count = get_prop("ro.telephony.sim_slots.count", "1");
    let multi_config = get_prop("persist.radio.multisim.config", &get_prop("ro.vendor.oplus.radio.multisim.config", ""));
    let multisim_config = if multi_config == "dsds" || slots_count == "2" {
        format!("Dual SIM (DSDS) • {} Slots", slots_count)
    } else if !multi_config.is_empty() {
        format!("{} • {} Slots", multi_config.to_uppercase(), slots_count)
    } else {
        format!("Single SIM • {} Slot", slots_count)
    };

    let phone_number = get_self_phone_number(&serial);

    Ok(DeviceDetails {
        adb_target: serial.clone(),
        hardware_serial,
        serial,
        model,
        manufacturer,
        brand,
        device_name,
        android_version,
        sdk_level,
        build_id,
        build_fingerprint,
        security_patch,
        bootloader_state,
        build_type,
        cpu_abi,
        supported_abis,
        architecture,
        kernel_version,
        hostname,
        device_uptime,
        usb_state,
        adb_state,
        usb_debugging,
        wifi_debugging,
        root_availability,
        selinux_status,
        network_operator,
        sim_operator,
        sim_state,
        is_roaming,
        sim_country,
        operator_numeric,
        multisim_config,
        phone_number,
    })
}

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
            // e.g. "800%cpu 12%user 0%nice 8%sys 780%idle" or "%cpu 15%"
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
                // Try parsing user %
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
