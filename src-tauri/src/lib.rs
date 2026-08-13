pub mod adb_service;
pub mod device_dashboard;
pub mod app_manager;
pub mod terminal_service;

use adb_service::*;
use device_dashboard::*;
use app_manager::*;
use terminal_service::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AdbState::new())
        .invoke_handler(tauri::generate_handler![
            list_devices,
            pair_with_code,
            connect_device,
            disconnect_device,
            start_qr_pair_listener,
            stop_qr_pair_listener,
            send_keyevent,
            send_text_input,
            set_device_clipboard,
            get_device_clipboard,
            install_apk,
            pick_apk_file,
            get_device_full_details,
            get_device_health,
            list_packages,
            get_package_details,
            install_apks,
            uninstall_package,
            disable_package,
            enable_package,
            clear_app_data,
            clear_app_cache,
            force_stop_app,
            launch_app,
            get_apk_path,
            extract_apk,
            backup_app_data,
            execute_pm_command,
            pick_multiple_apk_files,
            pick_save_directory,
            get_detailed_permissions,
            grant_app_permission,
            revoke_app_permission,
            set_app_op_mode,
            execute_intent,
            execute_terminal_command,
            kill_terminal_command,
            start_interactive_shell,
            write_terminal_input,
            resize_terminal_session,
            close_interactive_shell,
            get_shell_autocompletions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


