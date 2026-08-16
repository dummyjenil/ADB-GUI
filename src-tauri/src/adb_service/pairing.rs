use mdns_sd::{ScopedIp, ServiceDaemon, ServiceEvent};
use std::collections::HashSet;
use std::process::Command;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use super::types::{AdbState, DiscoveredService, PairResult};

pub fn pick_best_ip(addresses: &HashSet<ScopedIp>) -> Option<ScopedIp> {
    for addr in addresses {
        if addr.is_ipv4() {
            return Some(addr.clone());
        }
    }
    addresses.iter().next().cloned()
}

pub fn format_target(ip: &ScopedIp, port: u16) -> String {
    if ip.is_ipv4() {
        format!("{}:{}", ip, port)
    } else {
        format!("[{}]:{}", ip, port)
    }
}

// Pair device with IP:Port and 6-digit pair code
#[tauri::command]
pub async fn pair_with_code(ip_port: String, code: String) -> std::result::Result<PairResult, String> {
    let output = Command::new("adb")
        .args(["pair", &ip_port, &code])
        .output()
        .map_err(|e| format!("Failed to run adb pair: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if stdout.contains("Successfully paired") || output.status.success() {
        let parts: Vec<&str> = ip_port.split(':').collect();
        let host_ip = parts[0].trim_matches('[').trim_matches(']');

        // Try to discover connect port over mDNS for host_ip
        let mut connect_success = false;
        let mut connected_target = String::new();

        if let Ok(mdns) = ServiceDaemon::new() {
            if let Ok(receiver) = mdns.browse("_adb-tls-connect._tcp.local.") {
                let start = std::time::Instant::now();
                while start.elapsed() < std::time::Duration::from_secs(3) {
                    if let Ok(event) = receiver.recv_timeout(std::time::Duration::from_millis(300)) {
                        if let ServiceEvent::ServiceResolved(info) = event {
                            for addr in info.get_addresses() {
                                let addr_str = addr.to_string();
                                if addr_str == host_ip || format!("[{}]", addr_str) == parts[0] {
                                    let c_target = format_target(addr, info.get_port());
                                    let conn_res = Command::new("adb").args(["connect", &c_target]).output();
                                    if let Ok(out) = conn_res {
                                        let out_str = String::from_utf8_lossy(&out.stdout).to_string();
                                        if out_str.contains("connected to") || out_str.contains("already connected") {
                                            connect_success = true;
                                            connected_target = c_target;
                                            break;
                                        }
                                    }
                                }
                            }
                            if connect_success {
                                break;
                            }
                        }
                    }
                }
            }
        }

        let message = if connect_success {
            format!("Successfully paired and connected to {}!", connected_target)
        } else {
            format!(
                "Successfully paired with {}! Check main Wireless Debugging screen on phone for the Connect Port and use 'Direct IP' tab.",
                ip_port
            )
        };

        Ok(PairResult {
            success: true,
            message,
        })
    } else {
        Ok(PairResult {
            success: false,
            message: if !stderr.is_empty() { stderr } else { stdout },
        })
    }
}

// Start mDNS QR pairing listener in background
#[tauri::command]
pub async fn start_qr_pair_listener(
    app_handle: AppHandle,
    state: State<'_, AdbState>,
    pin: String,
) -> std::result::Result<String, String> {
    state.is_qr_listening.store(true, Ordering::SeqCst);
    let listening_flag = Arc::clone(&state.is_qr_listening);

    tokio::spawn(async move {
        let _ = app_handle.emit("qr-pairing-status", "Scanning network for Android pairing & connect requests...");

        if let Ok(mdns) = ServiceDaemon::new() {
            let pair_recv = mdns.browse("_adb-tls-pairing._tcp.local.");
            let connect_recv = mdns.browse("_adb-tls-connect._tcp.local.");

            if let (Ok(pair_rx), Ok(connect_rx)) = (pair_recv, connect_recv) {
                let mut paired = false;
                let mut target_ip_addr: Option<ScopedIp> = None;
                let mut connect_port: Option<u16> = None;
                let mut connected = false;

                while listening_flag.load(Ordering::SeqCst) && !connected {
                    // Check for pairing service if not yet paired
                    if !paired {
                        if let Ok(event) = pair_rx.recv_timeout(std::time::Duration::from_millis(200)) {
                            if let ServiceEvent::ServiceResolved(info) = event {
                                if let Some(ip_addr) = pick_best_ip(info.get_addresses()) {
                                    let pairing_port = info.get_port();
                                    let target = format_target(&ip_addr, pairing_port);

                                    let _ = app_handle.emit(
                                        "qr-pairing-status",
                                        format!("Found pairing service at {}. Pairing...", target),
                                    );

                                    let res = Command::new("adb").args(["pair", &target, &pin]).output();
                                    if let Ok(out) = res {
                                        let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                                        if stdout.contains("Successfully paired") {
                                            paired = true;
                                            target_ip_addr = Some(ip_addr.clone());
                                            let _ = app_handle.emit(
                                                "qr-pairing-status",
                                                format!("Paired with {}! Waiting for connect service broadcast...", ip_addr),
                                            );
                                        } else {
                                            let err = String::from_utf8_lossy(&out.stderr).to_string();
                                            let _ = app_handle.emit(
                                                "qr-pairing-status",
                                                format!("Pairing failed: {}", if err.is_empty() { stdout } else { err }),
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Check for connect service broadcast
                    if let Ok(event) = connect_rx.recv_timeout(std::time::Duration::from_millis(200)) {
                        if let ServiceEvent::ServiceResolved(info) = event {
                            if let Some(ip_addr) = pick_best_ip(info.get_addresses()) {
                                if target_ip_addr.is_none() || target_ip_addr.as_ref() == Some(&ip_addr) {
                                    if target_ip_addr.is_none() {
                                        target_ip_addr = Some(ip_addr);
                                    }
                                    connect_port = Some(info.get_port());
                                }
                            }
                        }
                    }

                    // Attempt auto-connect if paired and connect_port is available
                    if paired {
                        if let (Some(ref ip_addr), Some(c_port)) = (&target_ip_addr, connect_port) {
                            let connect_target = format_target(ip_addr, c_port);
                            let _ = app_handle.emit(
                                "qr-pairing-status",
                                format!("Attempting auto-connect to {}...", connect_target),
                            );

                            for _attempt in 1..=3 {
                                let conn_res = Command::new("adb").args(["connect", &connect_target]).output();
                                if let Ok(out) = conn_res {
                                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                                    let combined = format!("{} {}", stdout, stderr);

                                    if combined.contains("connected to") || combined.contains("already connected") {
                                        connected = true;
                                        let _ = app_handle.emit(
                                            "qr-pairing-status",
                                            format!("Device successfully paired and connected to {}!", connect_target),
                                        );
                                        listening_flag.store(false, Ordering::SeqCst);
                                        break;
                                    }
                                }
                                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                            }
                        }
                    }
                }
            }
        }
        let _ = app_handle.emit("qr-pairing-status", "QR Discovery listener stopped.");
    });

    Ok("QR listener started".to_string())
}

// Stop mDNS QR pairing listener
#[tauri::command]
pub async fn stop_qr_pair_listener(state: State<'_, AdbState>) -> std::result::Result<String, String> {
    state.is_qr_listening.store(false, Ordering::SeqCst);
    Ok("QR listener stop requested".to_string())
}

// Discover mDNS services for pairing and connect
#[tauri::command]
pub async fn discover_wireless_services() -> std::result::Result<Vec<DiscoveredService>, String> {
    tokio::task::spawn_blocking(|| {
        let mut discovered = Vec::new();
        if let Ok(mdns) = ServiceDaemon::new() {
            let pair_recv = mdns.browse("_adb-tls-pairing._tcp.local.");
            let connect_recv = mdns.browse("_adb-tls-connect._tcp.local.");

            let start = std::time::Instant::now();
            while start.elapsed() < std::time::Duration::from_millis(1500) {
                if let Ok(ref pair_rx) = pair_recv {
                    while let Ok(event) = pair_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                        if let ServiceEvent::ServiceResolved(info) = event {
                            if let Some(ip_addr) = pick_best_ip(info.get_addresses()) {
                                let port = info.get_port();
                                let ip_str = ip_addr.to_string();
                                let full = format_target(&ip_addr, port);
                                if !discovered.iter().any(|d: &DiscoveredService| d.full_address == full && d.service_type == "pairing") {
                                    discovered.push(DiscoveredService {
                                        service_type: "pairing".to_string(),
                                        name: info.get_fullname().to_string(),
                                        ip: ip_str,
                                        port,
                                        full_address: full,
                                    });
                                }
                            }
                        }
                    }
                }

                if let Ok(ref connect_rx) = connect_recv {
                    while let Ok(event) = connect_rx.recv_timeout(std::time::Duration::from_millis(50)) {
                        if let ServiceEvent::ServiceResolved(info) = event {
                            if let Some(ip_addr) = pick_best_ip(info.get_addresses()) {
                                let port = info.get_port();
                                let ip_str = ip_addr.to_string();
                                let full = format_target(&ip_addr, port);
                                if !discovered.iter().any(|d: &DiscoveredService| d.full_address == full && d.service_type == "connect") {
                                    discovered.push(DiscoveredService {
                                        service_type: "connect".to_string(),
                                        name: info.get_fullname().to_string(),
                                        ip: ip_str,
                                        port,
                                        full_address: full,
                                    });
                                }
                            }
                        }
                    }
                }
            }
            let _ = mdns.shutdown();
        }
        Ok(discovered)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
