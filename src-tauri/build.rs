use std::path::Path;
use std::process::Command;

fn main() {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
    let resource_path = Path::new(&manifest_dir).join("resources").join("droid-agent");

    if !resource_path.exists() {
        let script = Path::new(&manifest_dir).join("../native-agent/build_and_deploy.sh");
        if script.exists() {
            println!("cargo:warning=Building native-agent for Android ARM64...");
            let _ = Command::new("bash").arg(script).status();
        }
    }

    tauri_build::build();
}
