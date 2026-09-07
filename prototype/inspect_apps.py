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
    out = run_adb(["shell", "pm", "path", package_name], device_id)
    paths = []
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("package:"):
            paths.append(line.replace("package:", ""))
    return paths

def inspect_installed_apps(device_id=None, limit=10):
    packages = list_user_packages(device_id)
    single_apk_apps = []
    split_apk_apps = []
    
    print(f"Analyzing {len(packages)} apps...")
    for pkg in packages[:30]:
        apks = get_package_apks(pkg, device_id)
        if len(apks) > 1:
            split_apk_apps.append((pkg, len(apks)))
        else:
            single_apk_apps.append((pkg, len(apks)))
            
    print(f"\n--- Split APK Apps (Total sample: {len(split_apk_apps)}) ---")
    for pkg, count in split_apk_apps[:5]:
        print(f"  • {pkg}: {count} splits")
        
    print(f"\n--- Single APK Apps (Total sample: {len(single_apk_apps)}) ---")
    for pkg, count in single_apk_apps[:5]:
        print(f"  • {pkg}: {count} apk")

    return single_apk_apps, split_apk_apps

if __name__ == "__main__":
    devices = get_connected_devices()
    if not devices:
        print("No devices found")
        sys.exit(1)
    inspect_installed_apps(devices[0])
