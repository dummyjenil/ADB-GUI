# ADB APK & APKS Extractor Prototype

Ye prototype script ADB ke through connected Android device se kisi bhi user app ka **APK** (Single/Base APK) aur **APKS** (Split APKs Bundle) nikalne ke liye hai.

---

## 🔍 Concept: APK vs APKS

1. **Single APK Apps** (e.g. F-Droid / Sideloaded apps):
   - Device par sirf ek `base.apk` hota hai.
   - `adb shell pm path <package>` sirf 1 path return karta hai.
   - Ise directly `.apk` ya `.apks` ke form me extract kiya ja sakta hai.

2. **Split APKs / App Bundles (APKS)** (e.g. Google Play Store apps):
   - Modern apps architecture (ABI, screen density, language) ke hisab se multiple split files me install hoti hain:
     - `base.apk`
     - `split_config.arm64_v8a.apk`
     - `split_config.xxhdpi.apk`
     - `split_config.en.apk`
   - `adb shell pm path <package>` multiple paths return karta hai.
   - **APKS generation**: Hum device se saare split APKs pull karte hain aur unhe standard `.apks` archive (ZIP compressed container) me pack karte hain.
   - Ye `.apks` bundle complete hota hai aur ise device par wapas `adb install-multiple` ya SAI (Split APKs Installer) se direct install kiya ja sakta hai.

---

## 🚀 Usage

### 1. Installed Apps List & Split Detection:
```bash
python3 app_extractor.py --list
# ya search filter ke saath:
python3 app_extractor.py --list --query chat
```

### 2. Kisi bhi App ka APK aur APKS nikalna:
```bash
# Dono formats (.apk & .apks) nikalne ke liye:
python3 app_extractor.py -p com.aurora.store --format both

# Split APK app ke liye:
python3 app_extractor.py -p ai.mistral.chat --format both
```

### 3. Extracted APKS ko Device par Install karke verify karna:
```bash
python3 app_extractor.py --install-apks ./extracted/ai.mistral.chat.apks
```
