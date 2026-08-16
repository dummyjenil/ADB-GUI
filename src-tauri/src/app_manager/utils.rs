use std::process::Command;

// Helper to execute adb shell command
pub fn run_adb_shell(serial: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd_args = vec!["-s", serial, "shell"];
    cmd_args.extend_from_slice(args);

    let output = Command::new("adb")
        .args(&cmd_args)
        .output()
        .map_err(|e| format!("Failed to run ADB command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() || !stdout.is_empty() {
        Ok(stdout)
    } else {
        Err(if !stderr.is_empty() { stderr } else { stdout })
    }
}

// Helper to format bytes to MB/KB
#[allow(dead_code)]
pub fn format_size(bytes: u64) -> String {
    if bytes == 0 {
        return "Unknown".to_string();
    }
    let kb = bytes as f64 / 1024.0;
    let mb = kb / 1024.0;
    if mb >= 1.0 {
        format!("{:.1} MB", mb)
    } else {
        format!("{:.0} KB", kb)
    }
}

// Format friendly label from package name
pub fn format_app_name(pkg: &str) -> String {
    let parts: Vec<&str> = pkg.split('.').collect();
    if let Some(last) = parts.last() {
        let name = last.replace('_', " ");
        let mut c = name.chars();
        match c.next() {
            None => pkg.to_string(),
            Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
        }
    } else {
        pkg.to_string()
    }
}

// Extract clean component name like "com.package/.ActivityName"
pub fn extract_component_name(line: &str, pkg_name: &str) -> Option<String> {
    for part in line.split_whitespace() {
        if part.contains(pkg_name) && part.contains('/') {
            let clean = part.trim_matches(|c| c == '{' || c == '}' || c == '"' || c == '\'');
            return Some(clean.to_string());
        }
    }
    None
}
