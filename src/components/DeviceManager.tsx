import React, { useState, useEffect } from "react";
import { DeviceInfo } from "./Navbar";
import { DeviceDashboard } from "./DeviceDashboard";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { QRCode } from "react-qrcode-logo";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Badge } from "./ui/Badge";
import { Select } from "./ui/Select";
import {
  Smartphone,
  Wifi,
  Usb,
  QrCode,
  KeyRound,
  Link2,
  CheckCircle2,
  XCircle,
  Radio,
  Unplug,
  Info,
  Square,
  Play,
  Activity,
  RefreshCw,
} from "lucide-react";

interface DiscoveredService {
  service_type: "pairing" | "connect";
  name: string;
  ip: string;
  port: number;
  full_address: string;
}

interface DeviceManagerProps {
  devices: DeviceInfo[];
  activeDevice: string | null;
  setActiveDevice: (serial: string) => void;
  onRefresh: () => void;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({
  devices,
  activeDevice,
  setActiveDevice,
  onRefresh,
}) => {
  const [viewMode, setViewMode] = useState<"dashboard" | "pairing">("dashboard");
  const [activeSubTab, setActiveSubTab] = useState<"qr" | "code" | "direct">("qr");

  // Discovery State
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredService[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // QR Pairing State
  const [pairingPin] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());
  const [qrStatus, setQrStatus] = useState<string>("Click 'Start QR Discovery' and scan QR code on phone.");
  const [isListening, setIsListening] = useState(false);

  // Manual Pair Code State
  const [pairIp, setPairIp] = useState("");
  const [pairPort, setPairPort] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [pairMsg, setPairMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Direct Connect State
  const [directIpPort, setDirectIpPort] = useState("");
  const [directMsg, setDirectMsg] = useState<{ success: boolean; text: string } | null>(null);

  const scanWirelessServices = async () => {
    setIsDiscovering(true);
    try {
      const res = await invoke<DiscoveredService[]>("discover_wireless_services");
      setDiscoveredServices(res);
    } catch (err) {
      console.error("Discovery error:", err);
    } finally {
      setIsDiscovering(false);
    }
  };

  useEffect(() => {
    if (viewMode === "pairing") {
      scanWirelessServices();
    }
  }, [viewMode, activeSubTab]);

  // Listen to Tauri events for QR pairing status
  useEffect(() => {
    const unlisten = listen<string>("qr-pairing-status", (event) => {
      setQrStatus(event.payload);
      if (event.payload.includes("stopped")) {
        setIsListening(false);
      }
      if (event.payload.includes("successfully")) {
        setIsListening(false);
        onRefresh();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onRefresh]);

  const handleStartQrListener = async () => {
    setIsListening(true);
    try {
      await invoke("start_qr_pair_listener", { pin: pairingPin });
      setQrStatus("Scanning network for pairing request... Scan QR code on your phone.");
    } catch (err: any) {
      setQrStatus(`Error starting listener: ${err}`);
      setIsListening(false);
    }
  };

  const handleStopQrListener = async () => {
    try {
      await invoke("stop_qr_pair_listener");
      setQrStatus("Stopping QR Discovery listener...");
    } catch (err: any) {
      setQrStatus(`Error stopping listener: ${err}`);
    }
  };

  const handlePairWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairIp || !pairPort || !pairCode) return;
    setPairMsg(null);
    try {
      const res: any = await invoke("pair_with_code", {
        ipPort: `${pairIp}:${pairPort}`,
        code: pairCode,
      });
      setPairMsg({ success: res.success, text: res.message });
      if (res.success) onRefresh();
    } catch (err: any) {
      setPairMsg({ success: false, text: String(err) });
    }
  };

  const handleDirectConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directIpPort) return;
    setDirectMsg(null);
    try {
      const res: any = await invoke("connect_device", { ipPort: directIpPort });
      setDirectMsg({ success: res.success, text: res.message });
      if (res.success) onRefresh();
    } catch (err: any) {
      setDirectMsg({ success: false, text: String(err) });
    }
  };

  const handleDisconnect = async (target: string) => {
    try {
      await invoke("disconnect_device", { target });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const qrPayload = `WIFI:T:ADB;S:ADB-GUI;P:${pairingPin};;`;

  return (
    <div className="space-y-6">
      {/* Connected Devices Section */}
      <Card
        headerTitle="Connected ADB Devices"
        headerIcon={<Smartphone className="h-5 w-5" />}
        headerVariant="primary"
        headerAction={
          <Badge variant="accent">
            {devices.length} {devices.length === 1 ? "device" : "devices"}
          </Badge>
        }
      >
        {devices.length === 0 ? (
          <div className="text-center py-8 border-3 border-dashed border-[var(--neo-border)] rounded-xl bg-black/10 p-6">
            <Radio className="h-9 w-9 text-[var(--neo-text-muted)] mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-extrabold uppercase">No ADB devices detected</p>
            <p className="text-xs text-[var(--neo-text-muted)] mt-1">
              Connect via USB with Debugging ON, or use Wireless Pairing below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {devices.map((dev) => {
              const isSelected = dev.serial === activeDevice;
              return (
                <div
                  key={dev.serial as string}
                  onClick={() => setActiveDevice(dev.serial as string)}
                  className={`neo-btn p-3.5 flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] shadow-[4px_4px_0px_0px_var(--neo-shadow)]"
                      : "bg-[var(--neo-card-bg)] text-[var(--neo-text)] hover:bg-black/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg border-2 border-[var(--neo-border)] ${
                        isSelected ? "bg-black text-white" : "bg-[var(--neo-bg)] text-[var(--neo-text)]"
                      }`}
                    >
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase">{dev.model}</span>
                        {isSelected && <Badge variant="accent">Active</Badge>}
                      </div>
                      <p className="text-[11px] font-mono opacity-80 mt-0.5">{dev.serial}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={dev.connection_type === "wifi" ? "secondary" : "warning"}
                      icon={dev.connection_type === "wifi" ? <Wifi className="h-3 w-3" /> : <Usb className="h-3 w-3" />}
                    >
                      {dev.connection_type === "wifi" ? "Wi-Fi" : "USB"}
                    </Badge>

                    {dev.connection_type === "wifi" && (
                      <Button
                        size="sm"
                        variant="rose"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDisconnect(dev.serial as string);
                        }}
                        icon={<Unplug className="h-3.5 w-3.5" />}
                        title="Disconnect"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Mode Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b-2 border-[var(--neo-border)] pb-3">
        <Button
          variant={viewMode === "dashboard" ? "primary" : "ghost"}
          onClick={() => setViewMode("dashboard")}
          icon={<Activity className="h-4 w-4" />}
        >
          Device Dashboard & Telemetry
        </Button>

        <Button
          variant={viewMode === "pairing" ? "secondary" : "ghost"}
          onClick={() => setViewMode("pairing")}
          icon={<Wifi className="h-4 w-4" />}
        >
          Wireless Debugging & Pairing
        </Button>
      </div>

      {/* Dashboard View */}
      {viewMode === "dashboard" && (
        <DeviceDashboard serial={activeDevice || ""} />
      )}

      {/* Wireless Pairing Section */}
      {viewMode === "pairing" && (
        <Card
          headerTitle="Wireless Debugging & Pairing"
          headerIcon={<Wifi className="h-5 w-5" />}
          headerVariant="secondary"
        headerAction={
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={scanWirelessServices}
              icon={<RefreshCw className={`h-3.5 w-3.5 ${isDiscovering ? "animate-spin text-[var(--neo-primary)]" : ""}`} />}
              title="Scan network for wireless ADB services"
            >
              {isDiscovering ? "Scanning..." : "Scan"}
            </Button>
            <Button
              size="sm"
              variant={activeSubTab === "qr" ? "primary" : "ghost"}
              onClick={() => setActiveSubTab("qr")}
              icon={<QrCode className="h-3.5 w-3.5" />}
            >
              QR Pair
            </Button>
            <Button
              size="sm"
              variant={activeSubTab === "code" ? "primary" : "ghost"}
              onClick={() => setActiveSubTab("code")}
              icon={<KeyRound className="h-3.5 w-3.5" />}
            >
              Pair Code
            </Button>
            <Button
              size="sm"
              variant={activeSubTab === "direct" ? "primary" : "ghost"}
              onClick={() => setActiveSubTab("direct")}
              icon={<Link2 className="h-3.5 w-3.5" />}
            >
              Direct IP
            </Button>
          </div>
        }
      >
        {/* Sub-tab 1: QR Code Pair */}
        {activeSubTab === "qr" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Clean QR Code View */}
            <div className="flex flex-col items-center justify-center p-5 neo-box bg-white text-black text-center">
              <div className="p-3 bg-white rounded-xl">
                <QRCode
                  value={qrPayload}
                  size={180}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  qrStyle="squares"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--neo-text-muted)]">
                  Pairing Steps:
                </h3>
                <ol className="text-xs text-[var(--neo-text)] space-y-2 list-decimal list-inside neo-box p-4 bg-black/10">
                  <li>Phone & PC must be connected to <strong>same Wi-Fi network</strong>.</li>
                  <li>Settings → Developer options → <strong>Wireless debugging</strong>.</li>
                  <li>Tap <strong>"Pair device with QR code"</strong> and scan code.</li>
                </ol>
              </div>

              {/* Start & Stop Discovery Buttons */}
              <div className="flex gap-2">
                {!isListening ? (
                  <Button
                    onClick={handleStartQrListener}
                    variant="primary"
                    className="w-full"
                    icon={<Play className="h-4 w-4 fill-black" />}
                  >
                    Start QR Discovery
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopQrListener}
                    variant="rose"
                    className="w-full"
                    icon={<Square className="h-4 w-4 fill-white" />}
                  >
                    Stop QR Discovery
                  </Button>
                )}
              </div>

              <div className="p-3 neo-box-sm text-xs flex items-start gap-2 bg-black/10 font-mono text-[11px]">
                <Info className="h-4 w-4 text-[var(--neo-primary)] shrink-0 mt-0.5" />
                <span>{qrStatus}</span>
              </div>
            </div>
          </div>
        )}

        {/* Sub-tab 2: Pair Code Form */}
        {activeSubTab === "code" && (
          <form onSubmit={handlePairWithCode} className="max-w-md mx-auto space-y-4">
            <p className="text-xs text-[var(--neo-text-muted)] text-center font-medium">
              Developer options → Wireless debugging → Pair device with pairing code.
            </p>

            {/* Discovered Device Selector Box */}
            {discoveredServices.filter((s) => s.service_type === "pairing").length > 0 && (
              <div className="p-3 neo-box-sm bg-emerald-500/10 border-2 border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Discovered Pairing Target
                  </span>
                  <span className="text-[10px] text-[var(--neo-text-muted)]">Select target or type IP/Port below</span>
                </div>
                <Select
                  className="w-full"
                  variant="card"
                  placeholder="-- Choose Discovered Device --"
                  value={
                    discoveredServices
                      .filter((s) => s.service_type === "pairing")
                      .find((s) => s.ip === pairIp && s.port.toString() === pairPort)
                      ?.full_address || ""
                  }
                  onChange={(val) => {
                    const selected = discoveredServices
                      .filter((s) => s.service_type === "pairing")
                      .find((s) => s.full_address === val);
                    if (selected) {
                      setPairIp(selected.ip);
                      setPairPort(selected.port.toString());
                    }
                  }}
                  options={discoveredServices
                    .filter((s) => s.service_type === "pairing")
                    .map((s) => ({
                      value: s.full_address,
                      label: s.full_address,
                      sublabel: s.name.split(".")[0],
                      icon: <Radio className="h-3.5 w-3.5 text-emerald-400" />,
                    }))}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input
                  label="Phone IP Address"
                  placeholder="192.168.1.50"
                  value={pairIp}
                  onChange={(e) => setPairIp(e.target.value)}
                  list="pair-ip-datalist"
                  required
                />
                <datalist id="pair-ip-datalist">
                  {discoveredServices
                    .filter((s) => s.service_type === "pairing")
                    .map((s, i) => (
                      <option key={i} value={s.ip}>
                        {s.name.split(".")[0]}
                      </option>
                    ))}
                </datalist>
              </div>
              <div>
                <Input
                  label="Pairing Port"
                  placeholder="37123"
                  value={pairPort}
                  onChange={(e) => setPairPort(e.target.value)}
                  list="pair-port-datalist"
                  required
                />
                <datalist id="pair-port-datalist">
                  {discoveredServices
                    .filter((s) => s.service_type === "pairing")
                    .map((s, i) => (
                      <option key={i} value={s.port.toString()}>
                        {s.full_address}
                      </option>
                    ))}
                </datalist>
              </div>
            </div>

            <Input
              label="6-Digit Pairing Code"
              placeholder="123456"
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value)}
              className="text-center tracking-widest font-bold text-sm"
              required
            />

            <Button type="submit" variant="primary" className="w-full">
              Pair Device
            </Button>

            {pairMsg && (
              <div
                className={`p-3 neo-box-sm text-xs flex items-center gap-2 font-bold ${
                  pairMsg.success ? "bg-emerald-400 text-black" : "bg-rose-500 text-white"
                }`}
              >
                {pairMsg.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span>{pairMsg.text}</span>
              </div>
            )}
          </form>
        )}

        {/* Sub-tab 3: Direct IP Form */}
        {activeSubTab === "direct" && (
          <form onSubmit={handleDirectConnect} className="max-w-md mx-auto space-y-4">
            <p className="text-xs text-[var(--neo-text-muted)] text-center font-medium">
              Connect to an already-paired device via IP and Wireless Debugging Port.
            </p>

            {/* Discovered Connect Device Selector Box */}
            {discoveredServices.filter((s) => s.service_type === "connect").length > 0 && (
              <div className="p-3 neo-box-sm bg-cyan-500/10 border-2 border-cyan-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-cyan-400 flex items-center gap-1.5">
                    <Radio className="h-3 w-3 animate-pulse" />
                    Discovered Connect Target:
                  </span>
                  <span className="text-[10px] text-[var(--neo-text-muted)]">Select or type manually below</span>
                </div>
                <select
                  className="neo-input w-full py-1.5 px-2.5 text-xs font-mono font-bold bg-black/40 text-cyan-300 border-cyan-500/40 cursor-pointer"
                  value={
                    discoveredServices
                      .filter((s) => s.service_type === "connect")
                      .some((s) => s.full_address === directIpPort)
                      ? directIpPort
                      : ""
                  }
                  onChange={(e) => {
                    if (e.target.value) {
                      setDirectIpPort(e.target.value);
                    }
                  }}
                >
                  <option value="">
                    -- Choose Discovered Device ({discoveredServices.filter((s) => s.service_type === "connect").length} found) --
                  </option>
                  {discoveredServices
                    .filter((s) => s.service_type === "connect")
                    .map((s, idx) => (
                      <option key={idx} value={s.full_address}>
                        {s.full_address} ({s.name.split(".")[0]})
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <Input
                label="Target Device IP:Port"
                placeholder="192.168.1.50:5555"
                value={directIpPort}
                onChange={(e) => setDirectIpPort(e.target.value)}
                list="direct-ip-datalist"
                required
              />
              <datalist id="direct-ip-datalist">
                {discoveredServices
                  .filter((s) => s.service_type === "connect")
                  .map((s, i) => (
                    <option key={i} value={s.full_address}>
                      {s.name.split(".")[0]}
                    </option>
                  ))}
              </datalist>
            </div>

            <Button type="submit" variant="secondary" className="w-full">
              Connect to Wireless Device
            </Button>

            {directMsg && (
              <div
                className={`p-3 neo-box-sm text-xs flex items-center gap-2 font-bold ${
                  directMsg.success ? "bg-emerald-400 text-black" : "bg-rose-500 text-white"
                }`}
              >
                {directMsg.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span>{directMsg.text}</span>
              </div>
            )}
          </form>
        )}
      </Card>
      )}
    </div>
  );
};
