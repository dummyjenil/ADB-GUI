use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceInfo {
    pub serial: String,
    pub state: String,
    pub model: String,
    pub connection_type: String, // "usb" or "wifi"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PairResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredService {
    pub service_type: String, // "pairing" or "connect"
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub full_address: String,
}

pub struct AdbState {
    pub active_device: Mutex<Option<String>>,
    pub is_qr_listening: Arc<AtomicBool>,
}

impl AdbState {
    pub fn new() -> Self {
        Self {
            active_device: Mutex::new(None),
            is_qr_listening: Arc::new(AtomicBool::new(false)),
        }
    }
}
