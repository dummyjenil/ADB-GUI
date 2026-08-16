use super::types::IntentExtra;
use super::utils::run_adb_shell;

#[tauri::command]
pub async fn execute_intent(
    serial: String,
    intent_type: Option<String>,
    package_name: Option<String>,
    activity_name: Option<String>,
    action: Option<String>,
    data_uri: Option<String>,
    category: Option<String>,
    extras: Option<Vec<IntentExtra>>,
    flags: Option<String>,
) -> Result<String, String> {
    let itype = intent_type.unwrap_or_else(|| "start".to_string());
    let mut args: Vec<String> = vec!["am".to_string(), itype];

    if let (Some(pkg), Some(act)) = (&package_name, &activity_name) {
        if !pkg.trim().is_empty() && !act.trim().is_empty() {
            let component = if act.contains('/') {
                act.trim().to_string()
            } else if act.starts_with('.') {
                format!("{}{}", pkg.trim(), act.trim())
            } else {
                format!("{}/{}", pkg.trim(), act.trim())
            };
            args.push("-n".to_string());
            args.push(component);
        } else if !pkg.trim().is_empty() {
            args.push("-p".to_string());
            args.push(pkg.trim().to_string());
        }
    } else if let Some(pkg) = &package_name {
        if !pkg.trim().is_empty() {
            args.push("-p".to_string());
            args.push(pkg.trim().to_string());
        }
    }

    if let Some(act) = &action {
        if !act.trim().is_empty() {
            args.push("-a".to_string());
            args.push(act.trim().to_string());
        }
    }

    if let Some(data) = &data_uri {
        if !data.trim().is_empty() {
            args.push("-d".to_string());
            args.push(data.trim().to_string());
        }
    }

    if let Some(cat) = &category {
        if !cat.trim().is_empty() {
            args.push("-c".to_string());
            args.push(cat.trim().to_string());
        }
    }

    let empty_extras = Vec::new();
    let actual_extras = extras.as_ref().unwrap_or(&empty_extras);
    for extra in actual_extras {
        if extra.key.trim().is_empty() {
            continue;
        }
        let flag = match extra.extra_type.as_str() {
            "int" => "--ei",
            "bool" => "--ez",
            "long" => "--el",
            "float" => "--ef",
            _ => "--es",
        };
        args.push(flag.to_string());
        args.push(extra.key.trim().to_string());
        args.push(extra.value.trim().to_string());
    }

    if let Some(flg) = &flags {
        if !flg.trim().is_empty() {
            args.push("-f".to_string());
            args.push(flg.trim().to_string());
        }
    }

    let str_args: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_adb_shell(&serial, &str_args)
}
