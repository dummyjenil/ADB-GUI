pub mod adb_service;
pub mod device_dashboard;
pub mod app_manager;
pub mod terminal_service;
pub mod file_manager;
pub mod logcat_service;
pub mod port_forward_service;
pub mod screen_tools;
pub mod uiautomator_service;
pub mod notification_service;
pub mod communication_service;

use adb_service::*;
use device_dashboard::*;
use app_manager::*;
use terminal_service::*;
use file_manager::*;
use logcat_service::*;
use port_forward_service::*;
use screen_tools::*;
use uiautomator_service::*;
use notification_service::*;
use communication_service::*;

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
            discover_wireless_services,
            start_qr_pair_listener,
            stop_qr_pair_listener,
            send_keyevent,
            send_text_input,
            set_device_clipboard,
            get_device_clipboard,
            open_url_on_device,
            set_device_orientation,
            adjust_volume,
            send_swipe,
            expand_notifications,
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
            pick_multiple_files,
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
            get_shell_autocompletions,
            list_device_files,
            create_device_directory,
            delete_device_file_or_dir,
            rename_or_move_device_file,
            copy_device_file,
            change_device_file_permissions,
            pull_device_file,
            push_device_file,
            get_device_storage_info,
            start_logcat_stream,
            stop_logcat_stream,
            clear_logcat_buffer,
            get_device_processes,
            export_logcat_file,
            list_port_forwards,
            list_port_reverses,
            add_port_forward,
            add_port_reverse,
            remove_port_forward,
            remove_port_reverse,
            clear_all_port_forwards,
            clear_all_port_reverses,
            test_tcp_port_connection,
            take_screenshot,
            start_screen_recording,
            stop_screen_recording,
            save_media_file,
            dump_ui_hierarchy,
            get_device_notifications,
            get_call_logs,
            trigger_call,
            end_call,
            get_sms_list,
            send_sms,
            get_contacts_list
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}



