pub mod types;
pub mod device;
pub mod pairing;
pub mod input;
pub mod clipboard;
pub mod media_apk;

// Re-export types and State
pub use types::*;

// Re-export device commands
pub use device::{connect_device, disconnect_device, get_device_model, list_devices};

// Re-export pairing & discovery commands
pub use pairing::{
    discover_wireless_services, format_target, pair_with_code, pick_best_ip,
    start_qr_pair_listener, stop_qr_pair_listener,
};

// Re-export input & gesture commands
pub use input::{
    adjust_volume, expand_notifications, send_keyevent, send_swipe, send_text_input,
    set_device_orientation,
};

// Re-export clipboard commands
pub use clipboard::{get_device_clipboard, set_device_clipboard};

// Re-export media and APK commands
pub use media_apk::{install_apk, open_url_on_device, pick_apk_file, pick_multiple_files};
