pub mod types;
pub mod utils;
pub mod parser;
pub mod packages;
pub mod lifecycle;
pub mod permissions;
pub mod intent;
pub mod dialogs;

// Re-export types
pub use types::*;

// Re-export utility helpers
pub use utils::*;

// Re-export parser functions
pub use parser::*;

// Re-export all Tauri command functions
pub use packages::{
    backup_app_data, execute_pm_command, extract_apk, get_apk_path, get_package_details,
    list_packages,
};

pub use lifecycle::{
    clear_app_cache, clear_app_data, disable_package, enable_package, force_stop_app,
    install_apks, launch_app, uninstall_package,
};

pub use permissions::{
    get_detailed_permissions, grant_app_permission, revoke_app_permission, set_app_op_mode,
};

pub use intent::execute_intent;

pub use dialogs::{pick_multiple_apk_files, pick_save_directory};
