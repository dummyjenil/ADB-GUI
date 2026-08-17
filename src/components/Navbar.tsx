import React from "react";
import { Cpu, Smartphone, RefreshCw, Palette, Wifi, Usb, Zap, ShieldAlert, Home } from "lucide-react";
import { Select, SelectOption } from "./ui/Select";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { useTheme } from "../context/ThemeContext";

export interface DeviceInfo {
  serial: String;
  state: String;
  model: String;
  connection_type: String;
}

export type AppMode = "landing" | "adb" | "frida";

interface NavbarProps {
  devices: DeviceInfo[];
  activeDevice: string | null;
  setActiveDevice: (serial: string) => void;
  onRefresh: () => void;
  loading: boolean;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
  activeMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  devices,
  activeDevice,
  setActiveDevice,
  onRefresh,
  loading,
  autoRefresh = true,
  onToggleAutoRefresh,
  activeMode,
  onSelectMode,
}) => {
  const { currentTheme, setThemeId, availableThemes } = useTheme();

  const currentDev = devices.find((d) => d.serial === activeDevice);

  // Map devices to SelectOption format
  const deviceOptions: SelectOption[] = devices.map((d) => ({
    value: d.serial as string,
    label: String(d.model),
    sublabel: String(d.serial),
    icon: <Smartphone className="h-3.5 w-3.5" />,
  }));

  // Map themes to SelectOption format
  const themeOptions: SelectOption[] = availableThemes.map((t) => ({
    value: t.id,
    label: t.name,
    sublabel: t.description,
    icon: <Palette className="h-3.5 w-3.5" />,
  }));

  return (
    <header className="sticky top-0 z-50 neo-box rounded-none border-t-0 border-x-0 bg-[var(--neo-card-bg)] px-4 sm:px-6 py-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
      {/* Brand Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between md:justify-start gap-4">
        <div
          onClick={() => onSelectMode("landing")}
          className="flex items-center gap-3 cursor-pointer group"
          title="Click to go to Home Workspace Selection"
        >
          <div className="h-10 w-10 neo-btn bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-[var(--neo-text)] uppercase">
                {activeMode === "frida" ? "Frida Dynamic Studio" : "ADB Control Studio"}
              </h1>
              <Badge variant={activeMode === "frida" ? "accent" : "primary"}>
                {activeMode === "frida" ? "FRIDA RUNTIME" : "ADB v2.0"}
              </Badge>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[var(--neo-text-muted)] font-mono font-semibold">
              Tauri v2 • {activeMode === "frida" ? "Dynamic Instrumentation" : "Native Async ADB"}
            </p>
          </div>
        </div>

        {/* Workspace Mode Switcher */}
        <div className="flex items-center p-1 bg-black/10 rounded neo-box border">
          <button
            onClick={() => onSelectMode("landing")}
            className={`px-2.5 py-1 text-xs font-bold neo-btn flex items-center gap-1.5 transition-all ${
              activeMode === "landing"
                ? "bg-[var(--neo-card-bg)] text-[var(--neo-text)] shadow-sm"
                : "bg-transparent text-[var(--neo-text-muted)] hover:text-[var(--neo-text)]"
            }`}
            title="Overview & Mode Selector"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hub</span>
          </button>

          <button
            onClick={() => onSelectMode("adb")}
            className={`px-2.5 py-1 text-xs font-bold neo-btn flex items-center gap-1.5 transition-all ${
              activeMode === "adb"
                ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                : "bg-transparent text-[var(--neo-text-muted)] hover:text-[var(--neo-text)]"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>ADB Tools</span>
          </button>

          <button
            onClick={() => onSelectMode("frida")}
            className={`px-2.5 py-1 text-xs font-bold neo-btn flex items-center gap-1.5 transition-all ${
              activeMode === "frida"
                ? "bg-purple-600 text-white shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                : "bg-transparent text-[var(--neo-text-muted)] hover:text-[var(--neo-text)]"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Frida Studio</span>
          </button>
        </div>
      </div>

      {/* Action Selectors & Controls */}
      <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 sm:gap-3">
        {/* Connection Type Indicator Badge */}
        {currentDev && (
          <Badge
            variant={currentDev.connection_type === "wifi" ? "secondary" : "warning"}
            icon={currentDev.connection_type === "wifi" ? <Wifi className="h-3 w-3" /> : <Usb className="h-3 w-3" />}
          >
            {currentDev.connection_type === "wifi" ? "Wi-Fi" : "USB"}
          </Badge>
        )}

        {/* Custom Animated Device Selector Component */}
        <Select
          options={deviceOptions}
          value={activeDevice || ""}
          onChange={(val) => setActiveDevice(val)}
          placeholder={devices.length === 0 ? "No devices connected" : "Select Device"}
          disabled={devices.length === 0}
          variant="secondary"
          icon={<Smartphone className="h-4 w-4" />}
        />

        {/* Custom Animated Theme Selector Component */}
        <Select
          options={themeOptions}
          value={currentTheme.id}
          onChange={(themeId) => setThemeId(themeId)}
          variant="accent"
          icon={<Palette className="h-4 w-4" />}
        />

        {/* Auto-Refresh Poll Toggle Button */}
        {onToggleAutoRefresh && (
          <Button
            onClick={onToggleAutoRefresh}
            variant={autoRefresh ? "secondary" : "ghost"}
            size="sm"
            title={autoRefresh ? "Auto-detecting devices every 5s (Click to pause)" : "Auto-detect devices paused (Click to resume)"}
          >
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
              {autoRefresh ? "Auto 5s" : "Auto Off"}
            </span>
          </Button>
        )}

        {/* Refresh Device Button */}
        <Button
          onClick={onRefresh}
          loading={loading}
          variant="primary"
          size="sm"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh
        </Button>
      </div>
    </header>
  );
};
