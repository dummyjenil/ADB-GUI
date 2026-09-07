use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::Deserialize;
use tauri::Manager;

#[derive(Debug, Deserialize)]
struct DroidAgentApp {
    pub package: String,
    pub name: String,
}

pub fn locate_droid_agent_binary(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
    // 1. Try Tauri resource directory
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let p1 = resource_dir.join("resources").join("droid-agent");
        if p1.exists() {
            return Some(p1);
        }
        let p2 = resource_dir.join("droid-agent");
        if p2.exists() {
            return Some(p2);
        }
    }

    // 2. Try current working directory relative paths
    let cwd_candidates = [
        "resources/droid-agent",
        "src-tauri/resources/droid-agent",
        "../src-tauri/resources/droid-agent",
    ];
    for rel in &cwd_candidates {
        let p = Path::new(rel);
        if p.exists() {
            return Some(p.to_path_buf());
        }
    }

    // 3. Try next to current executable
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let p1 = exe_dir.join("resources").join("droid-agent");
            if p1.exists() {
                return Some(p1);
            }
            let p2 = exe_dir.join("droid-agent");
            if p2.exists() {
                return Some(p2);
            }
        }
    }

    None
}

pub fn ensure_droid_agent(app_handle: &tauri::AppHandle, serial: &str) -> bool {
    // Check if binary already exists and is executable in /data/local/tmp
    let check = Command::new("adb")
        .args(["-s", serial, "shell", "[ -x /data/local/tmp/droid-agent ] && echo OK"])
        .output();

    if let Ok(out) = check {
        let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if stdout == "OK" {
            return true;
        }
    }

    // Not on device or not executable, locate local binary and push
    let local_bin = match locate_droid_agent_binary(app_handle) {
        Some(p) => p,
        None => return false,
    };

    let local_str = local_bin.to_string_lossy().to_string();
    let push_res = Command::new("adb")
        .args(["-s", serial, "push", &local_str, "/data/local/tmp/droid-agent"])
        .output();

    if let Ok(p_out) = push_res {
        if p_out.status.success() {
            let _ = Command::new("adb")
                .args(["-s", serial, "shell", "chmod 755 /data/local/tmp/droid-agent"])
                .output();
            return true;
        }
    }

    false
}

pub fn fetch_real_app_names(
    app_handle: &tauri::AppHandle,
    serial: &str,
    only_user: bool,
) -> HashMap<String, String> {
    let mut map = HashMap::new();

    if !ensure_droid_agent(app_handle, serial) {
        return map;
    }

    let mut args = vec!["-s", serial, "shell", "/data/local/tmp/droid-agent", "--json"];
    if only_user {
        args.push("--user");
    }

    let output = match Command::new("adb").args(&args).output() {
        Ok(o) => o,
        Err(_) => return map,
    };

    if !output.status.success() {
        return map;
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if let Ok(apps) = serde_json::from_str::<Vec<DroidAgentApp>>(&stdout) {
        for app in apps {
            if !app.name.is_empty() {
                map.insert(app.package, app.name);
            }
        }
    }

    map
}
