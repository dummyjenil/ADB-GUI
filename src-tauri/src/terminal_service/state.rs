use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use tokio::process::Child;
use tokio::sync::Mutex;
use super::types::InteractiveSession;

// Global thread-safe map for active interactive sessions
static INTERACTIVE_SESSIONS: OnceLock<Arc<Mutex<HashMap<String, Arc<Mutex<InteractiveSession>>>>>> = OnceLock::new();
// Global map for single background process executions by exec_id
static SINGLE_EXEC_CHILD_MAP: OnceLock<Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>>> = OnceLock::new();

pub fn get_interactive_sessions() -> &'static Arc<Mutex<HashMap<String, Arc<Mutex<InteractiveSession>>>>> {
    INTERACTIVE_SESSIONS.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

pub fn get_exec_map() -> &'static Arc<Mutex<HashMap<String, Arc<Mutex<Child>>>>> {
    SINGLE_EXEC_CHILD_MAP.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}
