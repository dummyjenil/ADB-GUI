mod axml;
mod arsc;
mod zip_reader;

use std::env;
use std::io::{BufRead, BufReader};
use std::process::Command;
use std::sync::mpsc::channel;
use std::thread;

use axml::parse_manifest;
use arsc::ArscParser;
use zip_reader::ApkZipReader;

pub fn extract_apk_label(apk_path: &str) -> Option<String> {
    let mut zip = match ApkZipReader::open(apk_path) {
        Ok(z) => z,
        Err(_) => return None,
    };

    let manifest_bytes = match zip.extract_file("AndroidManifest.xml") {
        Ok(Some(b)) => b,
        _ => return None,
    };

    let manifest = match parse_manifest(&manifest_bytes) {
        Some(m) => m,
        None => return None,
    };

    // 1. Direct String in Manifest
    if let Some(lbl) = manifest.app_label_str {
        if !lbl.is_empty() {
            return Some(lbl);
        }
    }
    if let Some(lbl) = manifest.launcher_label_str {
        if !lbl.is_empty() {
            return Some(lbl);
        }
    }

    // 2. Resource ID lookup in resources.arsc
    let target_ref = manifest.launcher_label_ref.or(manifest.app_label_ref);
    if let Some(res_id) = target_ref {
        if let Ok(Some(arsc_bytes)) = zip.extract_file("resources.arsc") {
            if let Some(arsc) = ArscParser::parse(&arsc_bytes) {
                if let Some(lbl) = arsc.resolve_string(res_id) {
                    if !lbl.is_empty() {
                        return Some(lbl);
                    }
                }
                // Fallback from launcher ref to app ref
                if let (Some(l_ref), Some(a_ref)) = (manifest.launcher_label_ref, manifest.app_label_ref) {
                    if l_ref != a_ref {
                        if let Some(lbl) = arsc.resolve_string(a_ref) {
                            if !lbl.is_empty() {
                                return Some(lbl);
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

struct AppEntry {
    package: String,
    apk_path: String,
    uid: Option<String>,
    real_name: String,
}

#[derive(Clone, Copy, PartialEq)]
enum AppFilter {
    User,
    System,
    All,
}

fn get_installed_packages(filter: AppFilter) -> Vec<(String, String, Option<String>)> {
    let mut cmd = Command::new("pm");
    cmd.arg("list").arg("packages").arg("-f").arg("-U");
    match filter {
        AppFilter::User => {
            cmd.arg("-3");
        }
        AppFilter::System => {
            cmd.arg("-s");
        }
        AppFilter::All => {}
    }

    let output = match cmd.output() {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    let reader = BufReader::new(&output.stdout[..]);
    let mut list = Vec::new();

    for line in reader.lines().flatten() {
        let line = line.trim();
        if !line.starts_with("package:") {
            continue;
        }
        let content = &line[8..];

        let (path_pkg, uid) = match content.split_once(" uid:") {
            Some((p, u)) => (p, Some(u.trim().to_string())),
            None => (content, None),
        };

        if let Some((apk, pkg)) = path_pkg.rsplit_once('=') {
            if !apk.is_empty() && !pkg.is_empty() {
                list.push((pkg.trim().to_string(), apk.trim().to_string(), uid));
            }
        }
    }

    list
}

use std::io::Write;

fn dump_all_apps_parallel(
    filter: AppFilter,
    json_output: bool,
    stream_output: bool,
    search_query: Option<&str>,
) {
    let packages = get_installed_packages(filter);
    let total = packages.len();
    if total == 0 {
        if json_output {
            println!("[]");
        }
        return;
    }

    let num_threads = 8;
    let (tx, rx) = channel();
    let chunk_size = (total + num_threads - 1) / num_threads;

    for chunk in packages.chunks(chunk_size) {
        let chunk = chunk.to_vec();
        let tx = tx.clone();
        thread::spawn(move || {
            for (pkg, apk, uid) in chunk {
                let name = extract_apk_label(&apk).unwrap_or_else(|| pkg.clone());
                let _ = tx.send(AppEntry {
                    package: pkg,
                    apk_path: apk,
                    uid,
                    real_name: name,
                });
            }
        });
    }
    drop(tx);

    let mut results = Vec::with_capacity(total);
    for entry in rx {
        if let Some(q) = search_query {
            let q_lower = q.to_lowercase();
            let name_match = entry.real_name.to_lowercase().contains(&q_lower);
            let pkg_match = entry.package.to_lowercase().contains(&q_lower);
            if !name_match && !pkg_match {
                continue;
            }
        }

        if stream_output {
            let safe_name = entry.real_name.replace('\\', "\\\\").replace('"', "\\\"");
            let safe_pkg = entry.package.replace('\\', "\\\\").replace('"', "\\\"");
            let safe_apk = entry.apk_path.replace('\\', "\\\\").replace('"', "\\\"");
            let uid_str = entry.uid.as_deref().unwrap_or("");
            println!(
                "{{\"package\":\"{}\",\"name\":\"{}\",\"apk\":\"{}\",\"uid\":\"{}\"}}",
                safe_pkg, safe_name, safe_apk, uid_str
            );
            let _ = std::io::stdout().flush();
        } else {
            results.push(entry);
        }
    }

    if stream_output {
        return;
    }

    if json_output {
        print!("[");
        for (i, app) in results.iter().enumerate() {
            if i > 0 {
                print!(",");
            }
            let safe_name = app.real_name.replace('\\', "\\\\").replace('"', "\\\"");
            let safe_pkg = app.package.replace('\\', "\\\\").replace('"', "\\\"");
            let safe_apk = app.apk_path.replace('\\', "\\\\").replace('"', "\\\"");
            let uid_str = app.uid.as_deref().unwrap_or("");
            print!(
                "{{\"package\":\"{}\",\"name\":\"{}\",\"apk\":\"{}\",\"uid\":\"{}\"}}",
                safe_pkg, safe_name, safe_apk, uid_str
            );
        }
        println!("]");
    } else {
        for app in &results {
            println!("{} = {}", app.package, app.real_name);
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: droid-agent [OPTIONS] | <apk_path1> [apk_path2 ...]");
        eprintln!("Options:");
        eprintln!("  --all           Extract labels for all installed packages");
        eprintln!("  --user          Extract labels for 3rd-party user apps (default)");
        eprintln!("  --system        Extract labels for system apps");
        eprintln!("  --json          Output results as JSON");
        eprintln!("  --stream        Output results as real-time NDJSON stream");
        eprintln!("  --search <Q>    Search installed apps by real name or package");
        eprintln!("  --version       Print version");
        return;
    }

    if args[1] == "--version" || args[1] == "-v" {
        println!("droid-agent v0.1.0 (arm64-v8a standalone)");
        return;
    }

    let is_stream = args.iter().any(|a| a == "--stream" || a == "--ndjson");
    let is_json = args.iter().any(|a| a == "--json") || is_stream;
    let is_all = args.iter().any(|a| a == "--all");
    let is_system = args.iter().any(|a| a == "--system");
    let is_user = args.iter().any(|a| a == "--user");
    let search_idx = args.iter().position(|a| a == "--search");
    let search_query = search_idx.and_then(|idx| args.get(idx + 1)).map(|s| s.as_str());

    let direct_apks: Vec<&str> = args[1..]
        .iter()
        .filter(|a| !a.starts_with('-'))
        .filter(|a| search_query.map_or(true, |sq| *a != sq))
        .map(|s| s.as_str())
        .collect();

    if direct_apks.is_empty() || is_all || is_user || is_system || is_stream || search_query.is_some() {
        let filter = if is_all {
            AppFilter::All
        } else if is_system {
            AppFilter::System
        } else {
            AppFilter::User
        };

        dump_all_apps_parallel(filter, is_json, is_stream, search_query);
        return;
    }

    // Direct APK path argument(s)
    for apk_path in direct_apks {
        let name = extract_apk_label(apk_path).unwrap_or_else(|| "[UNKNOWN]".to_string());
        println!("{} = {}", apk_path, name);
    }
}
