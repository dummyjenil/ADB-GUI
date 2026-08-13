import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ThemeProvider } from "./context/ThemeContext";
import { Navbar, DeviceInfo } from "./components/Navbar";
import { DeviceManager } from "./components/DeviceManager";
import { QuickControls } from "./components/QuickControls";
import { KeyboardClipboard } from "./components/KeyboardClipboard";
import { AppManager } from "./components/AppManager/AppManager";
import { ScreenMirroringTodo } from "./components/ScreenMirroringTodo";
import { ShellTerminal } from "./components/Terminal/ShellTerminal";
import { CommandPreviewModal } from "./components/CommandPreviewModal";
import { Smartphone, Zap, Keyboard, Package, Monitor, Terminal } from "lucide-react";
import { Badge } from "./components/ui/Badge";
import { CommandPreview } from "./types/terminal";

type Tab = "devices" | "controls" | "keyboard" | "apk" | "terminal" | "mirror";

export function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>("devices");
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Command preview modal state
  const [previewCommand, setPreviewCommand] = useState<CommandPreview | null>(null);
  const [pendingTerminalCommand, setPendingTerminalCommand] = useState<string | null>(null);

  const fetchDevices = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    }
    try {
      const devList: DeviceInfo[] = await invoke("list_devices");
      setDevices((prev) => {
        if (
          prev.length === devList.length &&
          prev.every(
            (d, i) =>
              d.serial === devList[i].serial &&
              d.model === devList[i].model &&
              d.connection_type === devList[i].connection_type &&
              d.state === devList[i].state
          )
        ) {
          return prev;
        }
        return devList;
      });

      setActiveDevice((prevActive) => {
        if (devList.length > 0) {
          if (!prevActive || !devList.some((d) => d.serial === prevActive)) {
            return devList[0].serial as string;
          }
          return prevActive;
        } else {
          return null;
        }
      });
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchDevices(false);
    const interval = setInterval(() => fetchDevices(true), 5000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const navItems: { id: Tab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: "devices", label: "Device Manager", icon: <Smartphone className="h-4 w-4 shrink-0" /> },
    { id: "controls", label: "Quick Controls", icon: <Zap className="h-4 w-4 shrink-0" /> },
    { id: "keyboard", label: "Keyboard & Clipboard", icon: <Keyboard className="h-4 w-4 shrink-0" /> },
    { id: "apk", label: "App Manager", icon: <Package className="h-4 w-4 shrink-0" /> },
    { id: "terminal", label: "ADB Shell Terminal", icon: <Terminal className="h-4 w-4 shrink-0 text-emerald-400" /> },
    { id: "mirror", label: "Screen Mirroring", icon: <Monitor className="h-4 w-4 shrink-0" />, badge: "TODO" },
  ];

  const handleRunInTerminal = (cmd: string) => {
    setPendingTerminalCommand(cmd);
    setActiveTab("terminal");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--neo-bg)] text-[var(--neo-text)]">
      {/* Top Navigation Bar */}
      <Navbar
        devices={devices}
        activeDevice={activeDevice}
        setActiveDevice={setActiveDevice}
        onRefresh={fetchDevices}
        loading={loading}
      />

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto p-3 sm:p-6 gap-4 sm:gap-6">
        {/* Sidebar / Horizontal Navigation */}
        <aside className="w-full lg:w-64 neo-box p-2 sm:p-3 flex flex-row lg:flex-col gap-2 shrink-0 h-fit sticky top-0 lg:top-20 bg-[var(--neo-card-bg)] overflow-x-auto custom-scrollbar z-40">
          <div className="hidden lg:block text-[10px] font-black uppercase tracking-wider text-[var(--neo-text-muted)] px-3 py-1">
            Navigation Menu
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`neo-btn shrink-0 w-auto lg:w-full px-3 sm:px-3.5 py-2.5 sm:py-3 text-xs font-extrabold flex items-center justify-between gap-2.5 transition-all ${
                  isActive
                    ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-[4px_4px_0px_0px_var(--neo-shadow)]"
                    : "bg-transparent text-[var(--neo-text)] border-transparent shadow-none hover:bg-black/10"
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  <span className="whitespace-nowrap">{item.label}</span>
                </span>
                {item.badge && <Badge variant="warning">{item.badge}</Badge>}
              </button>
            );
          })}
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          {activeTab === "devices" && (
            <DeviceManager
              devices={devices}
              activeDevice={activeDevice}
              setActiveDevice={setActiveDevice}
              onRefresh={fetchDevices}
            />
          )}

          {activeTab === "controls" && (
            <QuickControls
              activeDevice={activeDevice}
              onViewCommand={(cmd) => setPreviewCommand(cmd)}
            />
          )}

          {activeTab === "keyboard" && (
            <KeyboardClipboard
              activeDevice={activeDevice}
              onViewCommand={(cmd) => setPreviewCommand(cmd)}
            />
          )}

          {activeTab === "apk" && (
            <AppManager
              activeDevice={activeDevice}
              onViewCommand={(cmd) => setPreviewCommand(cmd)}
            />
          )}

          {activeTab === "terminal" && (
            <ShellTerminal
              devices={devices}
              activeDevice={activeDevice}
              pendingCommand={pendingTerminalCommand}
              onClearPendingCommand={() => setPendingTerminalCommand(null)}
            />
          )}

          {activeTab === "mirror" && <ScreenMirroringTodo />}
        </main>
      </div>

      {/* Global Command Preview Modal */}
      <CommandPreviewModal
        preview={previewCommand}
        onClose={() => setPreviewCommand(null)}
        onRunInTerminal={handleRunInTerminal}
      />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
