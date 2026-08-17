use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FridaServerStatus {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub binary_path: String,
    pub device_abi: String,
    pub has_root: bool,
    pub host_frida_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FridaProcessInfo {
    pub pid: u32,
    pub name: String,
    pub identifier: String,
    pub is_running: bool,
    pub is_frontmost: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FridaExecutionResult {
    pub session_id: String,
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FridaLogPayload {
    pub session_id: String,
    pub level: String, // "info" | "log" | "warn" | "error" | "status"
    pub message: String,
    pub timestamp: u64,
}
