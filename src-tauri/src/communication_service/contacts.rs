use super::types::ContactItem;
use super::utils::{parse_content_query_rows, run_adb_shell, run_adb_shell_single};

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
