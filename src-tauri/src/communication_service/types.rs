use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CallLogItem {
    pub id: String,
    pub number: String,
    pub name: String,
    pub date: String,
    pub duration: String,
    pub call_type: String, // "incoming", "outgoing", "missed", "voicemail", "rejected", "blocked"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SmsItem {
    pub id: String,
    pub address: String,
    pub body: String,
    pub date: String,
    pub msg_type: String, // "inbox", "sent", "draft", "outbox"
    pub read: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContactItem {
    pub id: String,
    pub name: String,
    pub number: String,
}
