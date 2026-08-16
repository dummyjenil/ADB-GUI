use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageInfo {
    pub name: String,
    pub package_name: String,
    pub version_name: String,
    pub version_code: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub app_type: String, // "User" or "System"
    pub status: String,   // "Enabled", "Disabled", "Running"
    pub uid: Option<String>,
    pub apk_path: String,
    pub is_debuggable: bool,
    pub first_install_time: String,
    pub last_update_time: String,
    pub has_apk: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PackageDetails {
    pub info: PackageInfo,
    pub permissions: Vec<String>,
    pub app_ops: Vec<String>,
    pub activities: Vec<String>,
    pub services: Vec<String>,
    pub receivers: Vec<String>,
    pub providers: Vec<String>,
    pub raw_dump: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuntimePermissionInfo {
    pub permission: String,
    pub granted: bool,
    pub flags: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppOpInfo {
    pub op: String,
    pub mode: String,
    pub raw: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedPermissions {
    pub runtime_permissions: Vec<RuntimePermissionInfo>,
    pub requested_permissions: Vec<String>,
    pub app_ops: Vec<AppOpInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IntentExtra {
    pub key: String,
    pub value: String,
    pub extra_type: String,
}
