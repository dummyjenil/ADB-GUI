#[tauri::command]
pub async fn pick_multiple_apk_files() -> Result<Vec<String>, String> {
    let files = rfd::AsyncFileDialog::new()
        .add_filter("APK Package", &["apk"])
        .set_title("Select APK Files to Install")
        .pick_files()
        .await;

    Ok(files
        .unwrap_or_default()
        .into_iter()
        .map(|f| f.path().to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub async fn pick_save_directory() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Destination Folder")
        .pick_folder()
        .await;

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}
