# ADB Control Studio — Comprehensive Features List

**ADB Control Studio** is a high-performance, modern cross-platform desktop application built with **Tauri v2**, **React**, **TypeScript**, and **Rust (`adb_client`, Tokio, mDNS)**. It features a Neo-Brutalist design system with customizable dynamic themes and native async ADB integration.

---

## 📱 1. Device Management & Wireless Connectivity

### 1.1 Device Discovery & Active State Tracking
- **Automatic Device Listing (`list_devices`)**: Scans local ADB daemon (`127.0.0.1:5037`) for all connected Android devices (both USB & Wireless).
- **Automatic Model Resolution**: Queries device property `ro.product.model` via ADB shell to display actual model names (e.g., *Pixel 7*, *Samsung Galaxy S22*) instead of generic serials.
- **Connection Type Detection**: Automatically classifies connected devices into **Wi-Fi** or **USB** mode based on target IP/Serial patterns.
- **Active Device Selector**: Allows switching between multiple connected devices globally across all control tabs.
- **Auto-Refresh Polling**: Periodically checks device states every 5 seconds, ensuring real-time status updates without manual intervention.

### 1.2 Wireless Debugging & Pairing Methods
- **Zero-Configuration QR Code Pairing (`start_qr_pair_listener`, `stop_qr_pair_listener`)**:
  - Automatically generates a 6-digit random Pair PIN.
  - Generates a dynamic QR code payload (`WIFI:T:ADB;S:ADB-GUI;P:<PIN>;;`).
  - Runs a background mDNS network discovery listener targeting `_adb-tls-pairing._tcp.local.` and `_adb-tls-connect._tcp.local.`.
  - Automatically pairs and auto-connects to the phone when the QR code is scanned in Android Developer Options.
  - Broadcasts live status updates to the UI via Tauri window events.
- **Manual Pair Code Pairing (`pair_with_code`)**:
  - Pair via target IP address, pairing port, and 6-digit pairing code (`adb pair <ip:port> <code>`).
  - Includes auto-mDNS resolution to discover and auto-connect to the connect port immediately after pairing success.
- **Direct IP:Port Wireless Connection (`connect_device`, `disconnect_device`)**:
  - Direct connection to pre-paired devices using Wireless Debugging IP and Port (`adb connect <ip:port>`).
  - One-click wireless disconnection for Wi-Fi connected devices (`adb disconnect <target>`).

---

## ⚡ 2. Quick Controls & Hardware Navigation

### 2.1 Power & Display Management (`send_keyevent`)
- **Power Toggle**: Triggers `KEYEVENT_POWER` (keycode `26`) to lock/unlock screen or open power menu.
- **Wake Up Screen**: Triggers `KEYCODE_WAKEUP` (keycode `224`) to turn on display.
- **Sleep Screen**: Triggers `KEYCODE_SLEEP` (keycode `223`) to put screen to sleep.

### 2.2 Volume Controller (`send_keyevent`)
- **Volume Up**: Triggers `KEYEVENT_VOLUME_UP` (keycode `24`) (+1 step).
- **Volume Down**: Triggers `KEYEVENT_VOLUME_DOWN` (keycode `25`) (-1 step).
- **Toggle Mute**: Triggers `KEYEVENT_VOLUME_MUTE` (keycode `164`).

### 2.3 Hardware Navigation Keys (`send_keyevent`)
- **Back Button**: Triggers `KEYCODE_BACK` (keycode `4`).
- **Home Button**: Triggers `KEYCODE_HOME` (keycode `3`).
- **Recents / App Switcher**: Triggers `KEYCODE_APP_SWITCH` (keycode `187`).

### 2.4 Action Feedback
- Floating status toast notifications confirming triggered key events in real time.

---

## ⌨️ 3. Keyboard Controller & Cross-Device Clipboard

### 3.1 Text Input & Remote Keyboard (`send_text_input`, `send_keyevent`)
- **Direct Text Injection**: Send text typed on PC directly into the active text input field on the phone (`adb shell input text <formatted_text>`). Automatically handles spaces (`%s`).
- **Quick Control Action Keys**:
  - **Enter Key**: Send keycode `66`.
  - **Backspace Key**: Send keycode `67`.
  - **Space Key**: Send keycode `62`.

### 3.2 Cross-Device Clipboard Synchronization
- **Push PC → Phone Clipboard (`set_device_clipboard`)**: Pushes PC text into phone's Android clipboard via `adb shell cmd clipboard set`, with automatic fallback to text injection if restricted.
- **Pull Phone → PC Clipboard (`get_device_clipboard`)**: Reads current phone clipboard contents using `adb shell cmd clipboard get` and displays it on PC for easy copying.

---

## 📦 4. APK Package Installer

### 4.1 Installation Workflows (`install_apk`, `pick_apk_file`)
- **Drag & Drop Window Listener**: Intercepts native OS window drag-and-drop events (`onDragDropEvent` in Tauri webview window) for instant `.apk` installation upon drop.
- **HTML Drag-and-Drop Dropzone**: Drag and drop `.apk` files directly onto UI dropzone element.
- **Native OS File Manager Dialog**: Open system file picker filtered for `.apk` packages using native `rfd` rust library.
- **Manual File Path Input**: Type or paste file paths directly.
- **Reinstall/Update Flag**: Executes `adb install -r <path>` to update existing app installations without losing application data.

### 4.2 Interactive Console & Logs
- Live installation console showing timestamps and color-coded status badges (`[SUCCESS]`, `[ERROR]`, `[INFO]`).
- Log clearing and custom scrolling window.

---

## 🖥️ 5. Screen Mirroring & Remote Control (Phase 2 Sandbox)

- Interface sandbox designed for `scrcpy-server` integration.
- Planned features:
  - Injection of compiled `scrcpy-server.jar` into `/data/local/tmp`.
  - Low-latency H.264 video decoding over local TCP socket stream.
  - Interactive mouse click, drag, scroll, and multi-touch event mapping.

---

## 🎨 6. UI/UX Design System & Customization

### 6.1 Neo-Brutalist Design System
- High-contrast 3D box shadows, thick borders (`border-2`, `border-3`), vibrant badge colors, and crisp typographic hierarchy using `lucide-react` icons.
- Micro-animations for button presses, hover lifts, dropdown menus, and state changes.

### 6.2 Dynamic Theme Switcher Engine (`ThemeContext`)
- Full CSS Variable engine (`--neo-bg`, `--neo-primary`, `--neo-secondary`, `--neo-accent`, `--neo-shadow`, etc.).
- Switch between presets with immediate UI update and `localStorage` persistence:
  1. **Cyberpop Yellow & Cyan**: High-contrast yellow & cyan with dark Slate background.
  2. **Retro Arcade Neon**: Dark cyberpunk theme with neon pink, lime, and cyan accents.
  3. **Classic Paper Light**: Crisp paper-white theme with dynamic light accents.

---

## 🛠️ 7. Rust Backend Services & Tauri Commands (`src-tauri/src/adb_service.rs`)

| Command Name | Description | Parameters |
| :--- | :--- | :--- |
| `list_devices` | Gets list of connected ADB devices with serial, state, connection type & model | None |
| `pair_with_code` | Pairs device via IP:Port & pairing code + auto connect via mDNS | `ipPort`, `code` |
| `connect_device` | Connects directly to pre-paired device IP:Port | `ipPort` |
| `disconnect_device` | Disconnects wireless ADB device | `target` |
| `start_qr_pair_listener` | Starts async mDNS listener for QR pairing & auto-connect | `pin` |
| `stop_qr_pair_listener` | Stops background mDNS listener | None |
| `send_keyevent` | Sends hardware key event to target device | `serial`, `keycode` |
| `send_text_input` | Injects text into target device's active text field | `serial`, `text` |
| `set_device_clipboard` | Sets clipboard content on target device | `serial`, `text` |
| `get_device_clipboard` | Reads current clipboard content from target device | `serial` |
| `install_apk` | Installs/reinstalls APK file on device | `serial`, `filePath` |
| `pick_apk_file` | Opens native file dialog to pick an `.apk` file | None |
