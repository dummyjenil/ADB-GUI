import React from "react";
import { Cpu, Terminal, Zap, ShieldAlert, Sparkles, Smartphone, ArrowRight, Layers, FileText, Folder, CheckCircle2, ShieldCheck, Activity, Code2 } from "lucide-react";
import { Badge, Button } from "./ui";

interface ModeSelectorLandingProps {
  onSelectMode: (mode: "adb" | "frida") => void;
  connectedDevicesCount: number;
  activeDevice: string | null;
}

export const ModeSelectorLanding: React.FC<ModeSelectorLandingProps> = ({
  onSelectMode,
  connectedDevicesCount,
  activeDevice,
}) => {
  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-10 px-4 space-y-8 animate-fadeIn">
      {/* Hero Welcome Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-black/10 rounded-full neo-box text-xs font-mono font-bold">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>DroidCrack • Android Engineering & Security Suite</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-[var(--neo-text)]">
          Choose Your Workspace
        </h1>
        <p className="text-xs sm:text-sm text-[var(--neo-text-muted)] max-w-xl mx-auto font-mono">
          Select between Standard ADB Device Management and Frida Dynamic Runtime Instrumentation.
        </p>
      </div>

      {/* Device Connectivity Pill */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-3 px-4 py-2 bg-[var(--neo-card-bg)] neo-box text-xs">
          <Smartphone className="h-4 w-4 text-[var(--neo-primary)]" />
          <span>
            Connected Devices: <strong>{connectedDevicesCount}</strong>
          </span>
          {activeDevice && (
            <Badge variant="accent" icon={<CheckCircle2 className="h-3 w-3" />}>
              Active: {activeDevice}
            </Badge>
          )}
        </div>
      </div>

      {/* Two Prominent Suite Choice Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 pt-4">
        {/* ADB Suite Card */}
        <div
          onClick={() => onSelectMode("adb")}
          className="group cursor-pointer neo-box bg-[var(--neo-card-bg)] p-6 sm:p-8 flex flex-col justify-between gap-6 border-4 hover:border-[var(--neo-primary)] hover:shadow-[10px_10px_0px_0px_var(--neo-shadow)] transition-all hover:-translate-y-1 relative overflow-hidden"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 neo-btn bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center justify-center">
                <Zap className="h-8 w-8" />
              </div>
              <Badge variant="primary">COMPLETE SUITE</Badge>
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-[var(--neo-text)] group-hover:text-[var(--neo-primary)] transition-colors">
                ADB Based Tools
              </h2>
              <p className="text-xs text-[var(--neo-text-muted)] mt-1.5 leading-relaxed font-mono">
                Full-fledged Android Device Management, Package Control, File Operations, Interactive Terminal & Diagnostics.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-2 pt-2 border-t border-black/10 text-xs">
              <div className="flex items-center gap-2">
                <Smartphone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Device Manager & Wireless Pairing (QR / IP)</span>
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>Full PTY Interactive ADB Shell Terminal</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span>Live Filtered Logcat Studio & Crash Dumper</span>
              </div>
              <div className="flex items-center gap-2">
                <Folder className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span>File Manager, App Installer & Permission Hub</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span>UI Inspector & Screen Recording Studio</span>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            variant="primary"
            className="w-full justify-between"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Launch ADB Tools Studio
          </Button>
        </div>

        {/* Frida Dynamic Studio Card */}
        <div
          onClick={() => onSelectMode("frida")}
          className="group cursor-pointer neo-box bg-[var(--neo-card-bg)] p-6 sm:p-8 flex flex-col justify-between gap-6 border-4 border-purple-500 hover:shadow-[10px_10px_0px_0px_var(--neo-shadow)] transition-all hover:-translate-y-1 relative overflow-hidden"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 neo-btn bg-purple-600 text-white flex items-center justify-center">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <Badge variant="accent">DYNAMIC HOOKING</Badge>
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-[var(--neo-text)] group-hover:text-purple-400 transition-colors">
                Frida Based Tools
              </h2>
              <p className="text-xs text-[var(--neo-text-muted)] mt-1.5 leading-relaxed font-mono">
                Advanced Dynamic Instrumentation, Security Bypasses, Live Scripting, Class Hook Generation & Memory Inspection.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-2 pt-2 border-t border-black/10 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span>Frida Server Daemon Deployer & Status Checker</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                <span>1-Click Universal SSL Pinning & Root Bypasses</span>
              </div>
              <div className="flex items-center gap-2">
                <Code2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Live Interactive Script Studio & Colored Stream Logs</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                <span>Java Class & Method Hook Generator with Overloads</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span>Native C/C++ Interceptor & Crypto Key Logger</span>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            variant="accent"
            className="w-full justify-between !bg-purple-600 !text-white"
            icon={<ArrowRight className="h-4 w-4" />}
          >
            Launch Frida Dynamic Studio
          </Button>
        </div>
      </div>
    </div>
  );
};
