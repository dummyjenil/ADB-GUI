import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server, Play, Square, RefreshCw, Cpu, ShieldCheck, ShieldAlert, Terminal, CheckCircle2, AlertTriangle, UploadCloud } from "lucide-react";
import { Button, Badge, Card, Alert } from "../ui";
import { FridaServerStatus } from "../../types/frida";

interface FridaServerManagerProps {
  activeDevice: string | null;
  serverStatus: FridaServerStatus | null;
  onRefreshStatus: () => void;
  loading: boolean;
}

export const FridaServerManager: React.FC<FridaServerManagerProps> = ({
  activeDevice,
  serverStatus,
  onRefreshStatus,
  loading,
}) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStartServer = async () => {
    if (!activeDevice) return;
    setActionLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res: string = await invoke("start_frida_server", {
        serial: activeDevice,
        binaryPath: null,
      });
      setStatusMsg(res);
      onRefreshStatus();
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to start Frida server");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopServer = async () => {
    if (!activeDevice) return;
    setActionLoading(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const res: string = await invoke("stop_frida_server", {
        serial: activeDevice,
      });
      setStatusMsg(res);
      onRefreshStatus();
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to stop Frida server");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Server className="h-6 w-6 text-purple-400" />
            Frida Server & Environment
          </h2>
          <p className="text-xs text-[var(--neo-text-muted)] font-mono mt-1">
            Manage daemon status on Android target device and verify host environment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={onRefreshStatus}
            loading={loading || actionLoading}
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Check Status
          </Button>

          {serverStatus?.is_running ? (
            <Button
              onClick={handleStopServer}
              loading={actionLoading}
              variant="rose"
              size="sm"
              icon={<Square className="h-3.5 w-3.5" />}
            >
              Stop Server
            </Button>
          ) : (
            <Button
              onClick={handleStartServer}
              loading={actionLoading}
              disabled={!activeDevice}
              variant="primary"
              size="sm"
              icon={<Play className="h-3.5 w-3.5" />}
            >
              Start Frida Server
            </Button>
          )}
        </div>
      </div>

      {statusMsg && <Alert variant="success">{statusMsg}</Alert>}
      {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

      {!activeDevice && (
        <Alert variant="warning">
          No Android device selected. Please connect or select a device from the top navbar.
        </Alert>
      )}

      {/* Status Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Device Server Status */}
        <Card
          headerTitle="Server Status"
          headerIcon={<Server className="h-4 w-4" />}
          headerAction={
            serverStatus?.is_running ? (
              <Badge variant="accent">RUNNING</Badge>
            ) : (
              <Badge variant="warning">STOPPED</Badge>
            )
          }
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--neo-text-muted)]">State:</span>
              <span className="font-bold">
                {serverStatus?.is_running ? "Active Daemon" : "Not Running"}
              </span>
            </div>
            {serverStatus?.pid && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--neo-text-muted)]">PID:</span>
                <span className="font-mono font-bold text-purple-400">
                  {serverStatus.pid}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-[var(--neo-text-muted)]">Target Path:</span>
              <span className="font-mono text-[10px] truncate max-w-[150px]">
                {serverStatus?.binary_path || "/data/local/tmp/frida-server"}
              </span>
            </div>
          </div>
        </Card>

        {/* Device Architecture */}
        <Card
          headerTitle="Device Architecture"
          headerIcon={<Cpu className="h-4 w-4" />}
          headerAction={<Badge variant="primary">{serverStatus?.device_abi || "N/A"}</Badge>}
        >
          <div className="space-y-2 text-xs">
            <p className="text-[var(--neo-text-muted)]">
              Use matching binary release:
            </p>
            <div className="font-mono font-bold bg-black/10 p-1.5 rounded text-center">
              frida-server-*-android-{serverStatus?.device_abi?.includes("64") ? "arm64" : "arm"}
            </div>
          </div>
        </Card>

        {/* Root Access */}
        <Card
          headerTitle="Root Access"
          headerIcon={<ShieldCheck className="h-4 w-4" />}
          headerAction={
            serverStatus?.has_root ? (
              <Badge variant="accent">ROOTED (su)</Badge>
            ) : (
              <Badge variant="danger">NO ROOT</Badge>
            )
          }
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              {serverStatus?.has_root ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Device has su binary with root execution capability.</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>Root not detected. Gadget mode or Root required.</span>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Host CLI Environment */}
        <Card
          headerTitle="Host Frida CLI"
          headerIcon={<Terminal className="h-4 w-4" />}
          headerAction={
            serverStatus?.host_frida_version ? (
              <Badge variant="accent">v{serverStatus.host_frida_version}</Badge>
            ) : (
              <Badge variant="warning">CLI Missing</Badge>
            )
          }
        >
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--neo-text-muted)]">Host Tools:</span>
              <span className="font-bold">
                {serverStatus?.host_frida_version ? "Installed" : "pip install frida-tools"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Frida Gadget (Non-Rooted Device) Support Card */}
      <Card
        headerTitle="Frida Gadget Mode (Non-Rooted / Repackaged APKs)"
        headerIcon={<ShieldCheck className="h-4 w-4 text-cyan-400" />}
        headerAction={<Badge variant="accent">NO ROOT REQUIRED</Badge>}
      >
        <div className="space-y-4 text-xs leading-relaxed">
          <div className="p-3 bg-black/5 rounded neo-box border">
            <p className="text-[var(--neo-text)] font-semibold mb-2">
              Agar aapka Android phone <strong className="text-amber-400">Non-Rooted</strong> hai, toh aap <strong className="text-cyan-400">Frida Gadget</strong> (libfrida-gadget.so) se bina root ke kisi bhi app ko instrument kar sakte hain:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[var(--neo-text-muted)] font-mono text-[11px]">
              <li>App ko <strong>objection patchapk</strong> ya <strong>apktool</strong> se patch karke <code className="text-purple-400">libfrida-gadget.so</code> inject karein.</li>
              <li>Patched APK phone me install karke launch karein (App startup par pause ho jaayegi).</li>
              <li>Frida port forward karein: <code className="text-emerald-400">adb forward tcp:27042 tcp:27042</code></li>
              <li>Target Process me <strong className="text-cyan-400">Gadget</strong> select karke script inject karein.</li>
            </ol>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                if (!activeDevice) return;
                try {
                  await invoke("add_port_forward", {
                    serial: activeDevice,
                    localSpec: "tcp:27042",
                    remoteSpec: "tcp:27042",
                  });
                  setStatusMsg("ADB Port Forwarded: tcp:27042 -> tcp:27042 for Frida Gadget!");
                } catch (e: any) {
                  setErrorMsg("Port forward error: " + (e.message || e));
                }
              }}
              icon={<Cpu className="h-3.5 w-3.5 text-cyan-400" />}
            >
              1-Click Gadget Port Forward (27042)
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Setup Guide */}
      <Card headerTitle="Frida Server Quick Setup & Troubleshooting" headerIcon={<AlertTriangle className="h-4 w-4" />}>
        <div className="space-y-3 text-xs leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-black/5 rounded neo-box border">
              <h4 className="font-bold uppercase text-[11px] mb-1 flex items-center gap-1.5">
                <UploadCloud className="h-3.5 w-3.5 text-purple-400" />
                1. Manual Push via ADB Terminal
              </h4>
              <p className="text-[var(--neo-text-muted)] mb-2">
                Agar phone me frida-server nahi hai, download karke push karein:
              </p>
              <pre className="p-2 bg-black/20 rounded font-mono text-[10px] overflow-x-auto">
                {`adb push frida-server /data/local/tmp/
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "su -c /data/local/tmp/frida-server -D &"`}
              </pre>
            </div>

            <div className="p-3 bg-black/5 rounded neo-box border">
              <h4 className="font-bold uppercase text-[11px] mb-1 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                2. Host System Requirement
              </h4>
              <p className="text-[var(--neo-text-muted)] mb-2">
                Make sure Python frida tools are installed on your workstation:
              </p>
              <pre className="p-2 bg-black/20 rounded font-mono text-[10px] overflow-x-auto">
                {`pip install frida-tools
# Test connection
frida-ps -U`}
              </pre>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
