import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { PerformanceGraph, DataPoint } from "./PerformanceGraph";
import {
  Smartphone,
  BatteryCharging,
  Thermometer,
  HardDrive,
  Cpu,
  Wifi,
  Radio,
  Clock,
  ShieldCheck,
  Search,
  Copy,
  Check,
  RefreshCw,
  Info,
  Terminal,
  Activity,
  Layers,
} from "lucide-react";

export interface DeviceDetails {
  serial: string;
  model: string;
  manufacturer: string;
  brand: string;
  device_name: string;
  android_version: string;
  sdk_level: string;
  build_id: string;
  build_fingerprint: string;
  security_patch: string;
  bootloader_state: string;
  build_type: string;
  cpu_abi: string;
  supported_abis: string;
  architecture: string;
  kernel_version: string;
  hostname: string;
  device_uptime: string;
  usb_state: string;
  adb_state: string;
  usb_debugging: string;
  wifi_debugging: string;
  root_availability: string;
  selinux_status: string;
}

export interface DeviceHealth {
  battery_level: number;
  battery_temp: number;
  battery_status: string;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_usage_percent: number;
  storage_total_gb: number;
  storage_used_gb: number;
  storage_usage_percent: number;
  cpu_usage_percent: number;
  network_type: string;
  adb_status: string;
  uptime_formatted: string;
}

interface DeviceDashboardProps {
  serial: string;
}

export const DeviceDashboard: React.FC<DeviceDashboardProps> = ({ serial }) => {
  const [details, setDetails] = useState<DeviceDetails | null>(null);
  const [health, setHealth] = useState<DeviceHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [graphData, setGraphData] = useState<DataPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  const fetchFullDetails = useCallback(async (targetSerial: string) => {
    if (!targetSerial) return;
    try {
      const detailsRes = await invoke<DeviceDetails>("get_device_full_details", { serial: targetSerial });
      setDetails(detailsRes);
    } catch (err) {
      console.error("Failed to fetch device full details:", err);
    }
  }, []);

  const fetchHealthTelemetry = useCallback(async (targetSerial: string) => {
    if (!targetSerial) return;
    try {
      const healthRes = await invoke<DeviceHealth>("get_device_health", { serial: targetSerial });
      setHealth(healthRes);

      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

      setGraphData((prev) => {
        const next = [
          ...prev,
          {
            time: timeStr,
            cpu: healthRes.cpu_usage_percent,
            ram: healthRes.ram_usage_percent,
            temp: healthRes.battery_temp,
          },
        ];
        return next.slice(-15);
      });
    } catch (err) {
      console.error("Failed to fetch device health telemetry:", err);
    }
  }, []);

  const handleManualRefresh = useCallback(async () => {
    if (!serial) return;
    setLoading(true);
    try {
      await Promise.all([fetchFullDetails(serial), fetchHealthTelemetry(serial)]);
    } finally {
      setLoading(false);
    }
  }, [serial, fetchFullDetails, fetchHealthTelemetry]);

  useEffect(() => {
    if (!serial) return;
    setLoading(true);
    setGraphData([]);

    Promise.all([fetchFullDetails(serial), fetchHealthTelemetry(serial)]).finally(() => {
      setLoading(false);
    });

    const interval = setInterval(() => {
      fetchHealthTelemetry(serial);
    }, 3000);

    return () => clearInterval(interval);
  }, [serial, fetchFullDetails, fetchHealthTelemetry]);

  const handleCopySpecs = () => {
    if (!details) return;
    const formattedText = Object.entries(details)
      .map(([k, v]) => `${k.toUpperCase().replace(/_/g, " ")}: ${v}`)
      .join("\n");

    navigator.clipboard.writeText(formattedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!serial) {
    return (
      <Card headerTitle="Device Dashboard" headerIcon={<Smartphone className="h-5 w-5" />}>
        <div className="text-center py-10 text-xs font-mono text-[var(--neo-text-muted)] uppercase">
          Select an active ADB device to view telemetry & detailed properties.
        </div>
      </Card>
    );
  }

  // Neobrutalist Progress Bar helper
  const ProgressBar = ({
    value,
    colorClass = "bg-[var(--neo-primary)]",
  }: {
    value: number;
    colorClass?: string;
  }) => {
    const clamped = Math.min(Math.max(value, 0), 100);
    return (
      <div className="w-full bg-black/40 h-3.5 neo-box-sm overflow-hidden p-0.5 relative">
        <div
          className={`h-full rounded-sm transition-all duration-500 border-r-2 border-[var(--neo-border)] ${colorClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  };

  const allPropertiesList = details
    ? [
        { label: "Serial Number", value: details.serial, icon: <Radio className="h-4 w-4 text-emerald-400" /> },
        { label: "Model", value: details.model, icon: <Smartphone className="h-4 w-4 text-amber-400" /> },
        { label: "Manufacturer", value: details.manufacturer, icon: <Layers className="h-4 w-4 text-sky-400" /> },
        { label: "Brand", value: details.brand, icon: <Smartphone className="h-4 w-4 text-purple-400" /> },
        { label: "Device Name", value: details.device_name, icon: <Info className="h-4 w-4 text-indigo-400" /> },
        { label: "Android Version", value: details.android_version, icon: <Smartphone className="h-4 w-4 text-emerald-400" /> },
        { label: "SDK / API Level", value: details.sdk_level, icon: <Terminal className="h-4 w-4 text-rose-400" /> },
        { label: "Build ID", value: details.build_id, icon: <Terminal className="h-4 w-4 text-teal-400" /> },
        { label: "Build Fingerprint", value: details.build_fingerprint, icon: <Terminal className="h-4 w-4 text-slate-400" /> },
        { label: "Security Patch Level", value: details.security_patch, icon: <ShieldCheck className="h-4 w-4 text-emerald-400" /> },
        { label: "Bootloader State", value: details.bootloader_state, icon: <ShieldCheck className="h-4 w-4 text-amber-400" /> },
        { label: "Build Type", value: details.build_type, icon: <Layers className="h-4 w-4 text-sky-400" /> },
        { label: "CPU ABI", value: details.cpu_abi, icon: <Cpu className="h-4 w-4 text-rose-400" /> },
        { label: "Supported ABIs", value: details.supported_abis, icon: <Cpu className="h-4 w-4 text-purple-400" /> },
        { label: "Architecture", value: details.architecture, icon: <Cpu className="h-4 w-4 text-amber-400" /> },
        { label: "Kernel Version", value: details.kernel_version, icon: <Terminal className="h-4 w-4 text-emerald-400" /> },
        { label: "Hostname", value: details.hostname, icon: <Wifi className="h-4 w-4 text-cyan-400" /> },
        { label: "Device Uptime", value: details.device_uptime, icon: <Clock className="h-4 w-4 text-amber-400" /> },
        { label: "USB State", value: details.usb_state, icon: <Radio className="h-4 w-4 text-sky-400" /> },
        { label: "ADB State", value: details.adb_state, icon: <Activity className="h-4 w-4 text-emerald-400" /> },
        { label: "USB Debugging State", value: details.usb_debugging, icon: <Terminal className="h-4 w-4 text-teal-400" /> },
        { label: "Wi-Fi Debugging State", value: details.wifi_debugging, icon: <Wifi className="h-4 w-4 text-emerald-400" /> },
        { label: "Root Availability", value: details.root_availability, icon: <ShieldCheck className="h-4 w-4 text-rose-400" /> },
        { label: "SELinux Status", value: details.selinux_status, icon: <ShieldCheck className="h-4 w-4 text-indigo-400" /> },
      ]
    : [];

  const filteredProperties = allPropertiesList.filter(
    (p) =>
      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-neo-pop">
      {/* 1. Device Health Card Section */}
      <Card
        headerTitle={details ? `${details.manufacturer} ${details.model}` : "Device Health Card"}
        headerIcon={<Activity className="h-5 w-5" />}
        headerVariant="primary"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleManualRefresh}
              loading={loading}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            />
            {details && (
              <Badge variant="accent">
                Android {details.android_version} (API {details.sdk_level})
              </Badge>
            )}
          </div>
        }
      >
        {health ? (
          <div className="space-y-5">
            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Battery Card */}
              <div className="neo-box-sm p-3 bg-[var(--neo-card-bg)] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[var(--neo-text-muted)]">
                    <BatteryCharging className="h-4 w-4 text-emerald-400" />
                    Battery
                  </span>
                  <span className="font-mono text-emerald-400">{health.battery_level}%</span>
                </div>
                <ProgressBar
                  value={health.battery_level}
                  colorClass={
                    health.battery_level > 20 ? "bg-emerald-400" : "bg-rose-500"
                  }
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--neo-text-muted)]">
                  <span>{health.battery_status}</span>
                  <span>{health.battery_temp.toFixed(1)}°C</span>
                </div>
              </div>

              {/* Temperature Card */}
              <div className="neo-box-sm p-3 bg-[var(--neo-card-bg)] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[var(--neo-text-muted)]">
                    <Thermometer className="h-4 w-4 text-amber-400" />
                    Temperature
                  </span>
                  <span className="font-mono text-amber-400">{health.battery_temp.toFixed(1)}°C</span>
                </div>
                <ProgressBar
                  value={(health.battery_temp / 50) * 100}
                  colorClass={health.battery_temp > 40 ? "bg-rose-500" : "bg-amber-400"}
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--neo-text-muted)]">
                  <span>Thermal Status</span>
                  <span>{health.battery_temp > 40 ? "HOT" : "NORMAL"}</span>
                </div>
              </div>

              {/* RAM Usage Card */}
              <div className="neo-box-sm p-3 bg-[var(--neo-card-bg)] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[var(--neo-text-muted)]">
                    <HardDrive className="h-4 w-4 text-sky-400" />
                    RAM Memory
                  </span>
                  <span className="font-mono text-sky-400">
                    {(health.ram_used_mb / 1024).toFixed(1)} / {(health.ram_total_mb / 1024).toFixed(1)} GB
                  </span>
                </div>
                <ProgressBar value={health.ram_usage_percent} colorClass="bg-sky-400" />
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--neo-text-muted)]">
                  <span>Usage</span>
                  <span>{health.ram_usage_percent.toFixed(1)}%</span>
                </div>
              </div>

              {/* Storage Card */}
              <div className="neo-box-sm p-3 bg-[var(--neo-card-bg)] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[var(--neo-text-muted)]">
                    <HardDrive className="h-4 w-4 text-purple-400" />
                    Storage (/data)
                  </span>
                  <span className="font-mono text-purple-400">
                    {health.storage_used_gb.toFixed(1)} / {health.storage_total_gb.toFixed(1)} GB
                  </span>
                </div>
                <ProgressBar value={health.storage_usage_percent} colorClass="bg-purple-400" />
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--neo-text-muted)]">
                  <span>Free Space</span>
                  <span>{(health.storage_total_gb - health.storage_used_gb).toFixed(1)} GB</span>
                </div>
              </div>
            </div>

            {/* Sub-bar Dashboard Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-black/20 p-3 neo-box-sm font-mono text-xs">
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--neo-text-muted)] uppercase">CPU Usage</span>
                <span className="font-bold text-rose-400">{health.cpu_usage_percent.toFixed(1)}%</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--neo-text-muted)] uppercase">Network</span>
                <span className="font-bold text-cyan-400">{health.network_type}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--neo-text-muted)] uppercase">ADB Connection</span>
                <span className="font-bold text-emerald-400">{health.adb_status}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--neo-text-muted)] uppercase">Device Uptime</span>
                <span className="font-bold text-amber-400">{health.uptime_formatted}</span>
              </div>
            </div>

            {/* Performance Graphs Component */}
            <PerformanceGraph data={graphData} />
          </div>
        ) : (
          <div className="py-8 text-center text-xs font-mono text-[var(--neo-text-muted)] animate-pulse">
            Loading device health metrics...
          </div>
        )}
      </Card>

      {/* 2. Detailed Device Information Grid (24 Properties) */}
      <Card
        headerTitle="Device Information & System Specifications"
        headerIcon={<Info className="h-5 w-5" />}
        headerVariant="secondary"
        headerAction={
          <Button
            size="sm"
            variant="primary"
            onClick={handleCopySpecs}
            icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          >
            {copied ? "Copied!" : "Copy Specs"}
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Search Filter Bar */}
          <div className="max-w-md">
            <Input
              placeholder="Search properties (e.g. ABI, Kernel, Serial, Version)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          {/* Grid Layout of 24 Properties */}
          {filteredProperties.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--neo-text-muted)] font-mono">
              No matching device properties found for "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredProperties.map((prop, idx) => (
                <div
                  key={idx}
                  className="neo-box-sm p-3 bg-[var(--neo-card-bg)] flex items-start gap-3 hover:bg-black/10 transition-colors"
                >
                  <div className="p-2 rounded-lg border-2 border-[var(--neo-border)] bg-black/40 shrink-0">
                    {prop.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] tracking-wider">
                      {prop.label}
                    </div>
                    <div className="text-xs font-mono font-bold text-[var(--neo-text)] truncate mt-0.5 select-text" title={prop.value}>
                      {prop.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
