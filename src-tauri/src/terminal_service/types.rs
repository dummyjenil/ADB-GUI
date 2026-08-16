use serde::{Deserialize, Serialize};
use tokio::process::Child;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShellCommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    pub timed_out: bool,
}

// Session state structure to hold PTY master descriptor and cancellation tokens
pub struct InteractiveSession {
    pub master_fd: i32,
    pub child: Child,
}
