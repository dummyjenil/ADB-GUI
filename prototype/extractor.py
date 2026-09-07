import subprocess
import os
import sys
import zipfile
import shutil
from pathlib import Path

def run_adb(args, device_id=None):
    cmd = ["adb"]
    if device_id:
        cmd.extend(["-s", device_id])
    cmd.extend(args)
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"ADB command failed: {' '.join(cmd)}\nError: {res.stderr.strip()}")
    return res.stdout.strip()

def get_connected_devices():
    out = run_adb(["devices"])
    lines = out.splitlines()[1:]
    devices = []
    for line in lines:
        parts = line.strip().split()
        if len(parts) >= 2 and parts[1] == "device":
            devices.append(parts[0])
    return devices

def list_user_packages(device_id=None):
    out = run_adb(["shell", "pm", "list", "packages", "-3"], device_id)
    packages = []
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("package:"):
            packages.append(line.replace("package:", ""))
    return sorted(packages)

def get_package_apks(package_name, device_id=None):
    """
    Returns list of remote APK paths for a package on the device.
    """
    out = run_adb(["shell", "pm", "path", package_name], device_id)
    paths = []
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("package:"):
            paths.append(line.replace("package:", ""))
    return paths

def extract_app(package_name, output_dir="./extracted", output_format="both", device_id=None):
    """
    output_format: 'apk', 'apks', or 'both'
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    remote_paths = get_package_apks(package_name, device_id)
    if not remote_paths:
        raise ValueError(f"No APK paths found for package: {package_name}")
    
    print(f"\n📦 Package: {package_name}")
    print(f"🔍 Remote APK paths found ({len(remote_paths)}):")
    for p in remote_paths:
        print(f"   - {p}")
    
    is_split = len(remote_paths) > 1
    temp_pull_dir = output_path / f"temp_{package_name}"
    if temp_pull_dir.exists():
        shutil.rmtree(temp_pull_dir)
    temp_pull_dir.mkdir(parents=True)
    
    pulled_files = []
    try:
        print("⬇️  Pulling APKs from device...")
        for remote_apk in remote_paths:
            apk_filename = os.path.basename(remote_apk)
            local_dest = temp_pull_dir / apk_filename
            run_adb(["pull", remote_apk, str(local_dest)], device_id)
            pulled_files.append(local_dest)
            print(f"   ✓ Pulled {apk_filename} ({local_dest.stat().st_size} bytes)")
            
        # 1. Handle APK extraction
        if output_format in ("apk", "both"):
            if not is_split:
                target_apk = output_path / f"{package_name}.apk"
                shutil.copy2(pulled_files[0], target_apk)
                print(f"✅ Standalone APK exported: {target_apk} ({target_apk.stat().st_size} bytes)")
            else:
                # When it's a split apk, base.apk can be exported as base APK
                base_apks = [f for f in pulled_files if f.name == "base.apk"]
                if base_apks:
                    target_apk = output_path / f"{package_name}_base.apk"
                    shutil.copy2(base_apks[0], target_apk)
                    print(f"⚠️ App is split! Base APK exported as: {target_apk}")
                else:
                    target_apk = output_path / f"{package_name}_part0.apk"
                    shutil.copy2(pulled_files[0], target_apk)
                    print(f"⚠️ App is split! Primary APK exported as: {target_apk}")

        # 2. Handle APKS extraction
        if output_format in ("apks", "both"):
            target_apks = output_path / f"{package_name}.apks"
            print(f"📦 Packaging into APKS archive: {target_apks} ...")
            with zipfile.ZipFile(target_apks, "w", zipfile.ZIP_DEFLATED) as zipf:
                for file_path in pulled_files:
                    zipf.write(file_path, arcname=file_path.name)
            print(f"✅ APKS archive generated: {target_apks} ({target_apks.stat().st_size} bytes)")

    finally:
        if temp_pull_dir.exists():
            shutil.rmtree(temp_pull_dir)

if __name__ == "__main__":
    devices = get_connected_devices()
    print(f"📱 Connected devices: {devices}")
    if not devices:
        print("❌ No ADB devices connected.")
        sys.exit(1)
        
    device = devices[0]
    packages = list_user_packages(device)
    print(f"Found {len(packages)} third-party user apps.")
    print("Sample packages:", packages[:10])
    
    if packages:
        # Pick one package to test
        test_pkg = packages[0]
        # Let's also search for split apk vs single apk among user packages
        print(f"\nTesting extraction for: {test_pkg}")
        extract_app(test_pkg, output_dir="./extracted", output_format="both", device_id=device)
