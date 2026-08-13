import React from "react";
import { Cpu, Smartphone, RefreshCw, Palette, Wifi, Usb } from "lucide-react";
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

interface NavbarProps {
  devices: DeviceInfo[];
  activeDevice: string | null;
  setActiveDevice: (serial: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  devices,
  activeDevice,
  setActiveDevice,
  onRefresh,
  loading,
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
      {/* Brand Header */}
      <div className="flex items-center justify-between md:justify-start gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 neo-btn bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center justify-center shrink-0">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-[var(--neo-text)] uppercase">
                ADB Control Studio
              </h1>
              <Badge variant="accent">v2.0 Neo</Badge>
            </div>
            <p className="text-[10px] sm:text-[11px] text-[var(--neo-text-muted)] font-mono font-semibold">
              Tauri v2 • Native Async ADB
            </p>
          </div>
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
