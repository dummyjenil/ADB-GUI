use super::types::DeviceDetails;
use super::utils::{exec_adb_shell, fetch_all_props, format_seconds, get_self_phone_number};

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
