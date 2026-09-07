#!/usr/bin/env python3
"""
ADB APK & APKS Extractor Prototype
===================================
Supports:
1. Detecting connected ADB devices
2. Listing apps with split APK detection
3. Extracting standalone APK (.apk)
4. Extracting Split App Bundle (.apks)
5. Installing .apks bundles back to device via `adb install-multiple`
"""

import subprocess
import os
import sys
import zipfile
import shutil
import tempfile
import argparse
from pathlib import Path


class ADBManager:
    def __init__(self, device_id=None):
        self.device_id = device_id
        if not self.device_id:
            devices = self.get_connected_devices()
            if not devices:
                raise RuntimeError("No ADB devices connected. Please connect a device with USB/Wireless debugging enabled.")
            self.device_id = devices[0]

    def run_adb(self, args):
        cmd = ["adb", "-s", self.device_id] + args
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"ADB command failed: {' '.join(cmd)}\nError: {res.stderr.strip()}")
        return res.stdout.strip()

    @staticmethod
    def get_connected_devices():
        res = subprocess.run(["adb", "devices"], capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError("ADB is not installed or not in PATH.")
        lines = res.stdout.strip().splitlines()[1:]
        devices = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 2 and parts[1] == "device":
                devices.append(parts[0])
        return devices

    def list_packages(self, user_only=True, filter_query=""):
        args = ["shell", "pm", "list", "packages"]
        if user_only:
            args.append("-3")
        out = self.run_adb(args)
        packages = []
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("package:"):
                pkg = line.replace("package:", "")
                if not filter_query or filter_query.lower() in pkg.lower():
                    packages.append(pkg)
        return sorted(packages)

    def get_package_apk_paths(self, package_name):
        out = self.run_adb(["shell", "pm", "path", package_name])
        paths = []
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("package:"):
                paths.append(line.replace("package:", ""))
        return paths

    def get_package_info(self, package_name):
        paths = self.get_package_apk_paths(package_name)
        if not paths:
            return None
        return {
            "package": package_name,
            "is_split": len(paths) > 1,
            "split_count": len(paths),
            "paths": paths
        }

    def extract(self, package_name, output_dir="./extracted", mode="both"):
        """
        mode:
          - 'apk'  : extracts standalone .apk (or base.apk if split)
          - 'apks' : extracts complete .apks (zip of all splits)
          - 'both' : extracts both .apk and .apks
        """
        out_dir = Path(output_dir).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        paths = self.get_package_apk_paths(package_name)
        if not paths:
            raise ValueError(f"Package '{package_name}' not found on device {self.device_id}")

        is_split = len(paths) > 1
        print(f"\n==========================================")
        print(f"📦 Extracting: {package_name}")
        print(f"📱 Type: {'🧩 Split APK (' + str(len(paths)) + ' splits)' if is_split else '📦 Single Standalone APK'}")
        print(f"==========================================")

        with tempfile.TemporaryDirectory(prefix="adb_extract_") as temp_dir:
            temp_path = Path(temp_dir)
            pulled_files = []

            print("\n[1/3] ⬇️ Pulling APK components from device...")
            for idx, remote_apk in enumerate(paths, 1):
                filename = os.path.basename(remote_apk)
                local_file = temp_path / filename
                # If duplicate names occur, ensure uniqueness
                if local_file.exists():
                    local_file = temp_path / f"part_{idx}_{filename}"

                self.run_adb(["pull", remote_apk, str(local_file)])
                file_size_mb = local_file.stat().st_size / (1024 * 1024)
                print(f"  [{idx}/{len(paths)}] ✓ {filename} ({file_size_mb:.2f} MB)")
                pulled_files.append(local_file)

            created_files = []

            # Generate .apk
            if mode in ("apk", "both"):
                print("\n[2/3] 🔨 Generating APK...")
                if not is_split:
                    target_apk = out_dir / f"{package_name}.apk"
                    shutil.copy2(pulled_files[0], target_apk)
                    print(f"  ✅ Standalone APK: {target_apk.name} ({target_apk.stat().st_size / (1024*1024):.2f} MB)")
                    created_files.append(target_apk)
                else:
                    base_apks = [f for f in pulled_files if f.name == "base.apk"]
                    target_apk = out_dir / f"{package_name}_base.apk"
                    if base_apks:
                        shutil.copy2(base_apks[0], target_apk)
                    else:
                        shutil.copy2(pulled_files[0], target_apk)
                    print(f"  ℹ️ Base APK: {target_apk.name} ({target_apk.stat().st_size / (1024*1024):.2f} MB)")
                    print("     (Note: Split apps require all splits in .apks to run properly)")
                    created_files.append(target_apk)

            # Generate .apks
            if mode in ("apks", "both"):
                print("\n[3/3] 📦 Generating APKS bundle archive...")
                target_apks = out_dir / f"{package_name}.apks"
                # APKS is standard ZIP container with all split APKs
                with zipfile.ZipFile(target_apks, "w", compression=zipfile.ZIP_DEFLATED) as zipf:
                    for f in pulled_files:
                        zipf.write(f, arcname=f.name)
                print(f"  ✅ APKS Bundle: {target_apks.name} ({target_apks.stat().st_size / (1024*1024):.2f} MB)")
                created_files.append(target_apks)

            print("\n🎉 Extraction Completed Successfully!")
            print("📁 Output Location:", str(out_dir))
            for f in created_files:
                print(f"   • {f.name} ({f.stat().st_size / (1024*1024):.2f} MB)")

            return created_files

    def install_apks(self, apks_path):
        """
        Installs an .apks bundle back to connected device using `adb install-multiple`.
        """
        apks_file = Path(apks_path)
        if not apks_file.exists():
            raise FileNotFoundError(f"File not found: {apks_path}")

        print(f"\n📲 Installing APKS bundle: {apks_file.name} to {self.device_id}...")
        with tempfile.TemporaryDirectory(prefix="adb_install_") as temp_dir:
            temp_path = Path(temp_dir)
            with zipfile.ZipFile(apks_file, "r") as zipf:
                zipf.extractall(temp_path)

            apk_files = list(temp_path.glob("*.apk"))
            if not apk_files:
                raise ValueError("No .apk files found inside .apks archive!")

            if len(apk_files) == 1:
                # Single apk install
                res = self.run_adb(["install", "-r", str(apk_files[0])])
            else:
                # Split apk install
                apk_args = ["install-multiple", "-r"] + [str(f) for f in apk_files]
                res = self.run_adb(apk_args)

            print("ADB Result:", res)
            print("✅ Installation Finished!")


def main():
    parser = argparse.ArgumentParser(description="ADB APK & APKS Extractor")
    parser.add_argument("-p", "--package", help="Package name to extract (e.g., com.example.app)")
    parser.add_argument("-f", "--format", choices=["apk", "apks", "both"], default="both", help="Export format (default: both)")
    parser.add_argument("-o", "--output", default="./extracted", help="Output directory (default: ./extracted)")
    parser.add_argument("-l", "--list", action="store_true", help="List installed third-party packages")
    parser.add_argument("-q", "--query", default="", help="Search query filter when listing packages")
    parser.add_argument("-s", "--device", help="Specific ADB device ID")
    parser.add_argument("--install-apks", help="Path to .apks file to test installation via install-multiple")

    args = parser.parse_args()

    devices = ADBManager.get_connected_devices()
    if not devices:
        print("❌ Error: No ADB devices connected.")
        sys.exit(1)

    device_id = args.device or devices[0]
    print(f"🔌 Connected Device: {device_id}")

    manager = ADBManager(device_id=device_id)

    if args.install_apks:
        manager.install_apks(args.install_apks)
        return

    if args.list:
        pkgs = manager.list_packages(user_only=True, filter_query=args.query)
        print(f"\nFound {len(pkgs)} user packages" + (f" matching '{args.query}'" if args.query else "") + ":")
        for p in pkgs:
            info = manager.get_package_info(p)
            type_str = f"🧩 Split ({info['split_count']} parts)" if info and info['is_split'] else "📦 Single APK"
            print(f"  • {p:<45} [{type_str}]")
        return

    if args.package:
        manager.extract(args.package, output_dir=args.output, mode=args.format)
    else:
        # Interactive mode if no package specified
        pkgs = manager.list_packages(user_only=True)
        print(f"\nFound {len(pkgs)} user packages.")
        print("\nTop 10 packages:")
        for idx, p in enumerate(pkgs[:10], 1):
            info = manager.get_package_info(p)
            type_str = f"🧩 Split ({info['split_count']} parts)" if info and info['is_split'] else "📦 Single APK"
            print(f"  [{idx}] {p:<40} [{type_str}]")

        print("\nUsage examples:")
        print(f"  python3 {sys.argv[0]} -p {pkgs[0]} --format both")
        print(f"  python3 {sys.argv[0]} --list --query google")
        print(f"  python3 {sys.argv[0]} --install-apks ./extracted/{pkgs[0]}.apks")


if __name__ == "__main__":
    main()
