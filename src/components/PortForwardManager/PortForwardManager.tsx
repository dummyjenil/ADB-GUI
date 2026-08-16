import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Alert } from "../ui";
import { PortMapping, SpecType, PresetItem, SavedProfile, PortForwardManagerProps } from "./types";
import { HeaderBanner } from "./HeaderBanner";
import { QuickPresetsBar } from "./QuickPresetsBar";
import { AddMappingForm } from "./AddMappingForm";
import { SavedProfilesBar } from "./SavedProfilesBar";
import { ActiveMappingsTable } from "./ActiveMappingsTable";

export function PortForwardManager({ activeDevice, onViewCommand }: PortForwardManagerProps) {
  const [activeTab, setActiveTab] = useState<"forward" | "reverse">("forward");
  const [forwards, setForwards] = useState<PortMapping[]>([]);
  const [reverses, setReverses] = useState<PortMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [hostType, setHostType] = useState<SpecType>("tcp");
  const [hostVal, setHostVal] = useState("6100");
  const [deviceType, setDeviceType] = useState<SpecType>("tcp");
  const [deviceVal, setDeviceVal] = useState("7100");

  // Connection testing state (keyed by spec string)
  const [testResults, setTestResults] = useState<Record<string, boolean | "testing">>({});

  // Saved profile rules in localStorage
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>(() => {
    try {
      const stored = localStorage.getItem("adb_saved_port_profiles");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const fetchPortMappings = useCallback(async () => {
    if (!activeDevice) return;
    setLoading(true);
    setError(null);
    try {
      const [fList, rList] = await Promise.all([
        invoke<PortMapping[]>("list_port_forwards", { serial: activeDevice }),
        invoke<PortMapping[]>("list_port_reverses", { serial: activeDevice }),
      ]);
      setForwards(fList);
      setReverses(rList);
    } catch (err: any) {
      console.error("Failed to list port mappings:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [activeDevice]);

  useEffect(() => {
    fetchPortMappings();
  }, [fetchPortMappings]);

  // Helper to build full spec string (e.g. "tcp:6100" or "localabstract:chrome_devtools_remote")
  const buildSpec = (type: SpecType, val: string) => {
    const trimmed = val.trim();
    if (type === "tcp" && !trimmed.startsWith("tcp:")) {
      return `tcp:${trimmed}`;
    }
    if (type === "localabstract" && !trimmed.startsWith("localabstract:")) {
      return `localabstract:${trimmed}`;
    }
    if (type === "localreserved" && !trimmed.startsWith("localreserved:")) {
      return `localreserved:${trimmed}`;
    }
    if (type === "localfilesystem" && !trimmed.startsWith("localfilesystem:")) {
      return `localfilesystem:${trimmed}`;
    }
    if (type === "jdwp" && !trimmed.startsWith("jdwp:")) {
      return `jdwp:${trimmed}`;
    }
    return trimmed;
  };

  const handleAddMapping = async () => {
    if (!activeDevice) return;
    const localSpec = buildSpec(hostType, hostVal);
    const remoteSpec = buildSpec(deviceType, deviceVal);

    if (!hostVal.trim() || !deviceVal.trim()) {
      setError("Please provide both Host and Device port/socket spec values.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (activeTab === "forward") {
        await invoke("add_port_forward", {
          serial: activeDevice,
          localSpec,
          remoteSpec,
        });
        setSuccessMsg(`Forward added: ${localSpec} ➔ ${remoteSpec}`);
      } else {
        await invoke("add_port_reverse", {
          serial: activeDevice,
          remoteSpec,
          localSpec,
        });
        setSuccessMsg(`Reverse added: ${remoteSpec} ➔ ${localSpec}`);
      }
      await fetchPortMappings();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMapping = async (localSpec: string, remoteSpec: string) => {
    if (!activeDevice) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (activeTab === "forward") {
        await invoke("remove_port_forward", {
          serial: activeDevice,
          localSpec,
        });
        setSuccessMsg(`Removed forward: ${localSpec}`);
      } else {
        await invoke("remove_port_reverse", {
          serial: activeDevice,
          remoteSpec,
        });
        setSuccessMsg(`Removed reverse: ${remoteSpec}`);
      }
      await fetchPortMappings();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!activeDevice) return;
    if (!confirm(`Are you sure you want to clear all ${activeTab} port mappings for ${activeDevice}?`)) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (activeTab === "forward") {
        await invoke("clear_all_port_forwards", { serial: activeDevice });
        setSuccessMsg("Cleared all port forwards");
      } else {
        await invoke("clear_all_port_reverses", { serial: activeDevice });
        setSuccessMsg("Cleared all port reverses");
      }
      await fetchPortMappings();
    } catch (err: any) {
      setError(String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApplyPreset = (preset: PresetItem) => {
    setActiveTab(preset.mode);
    setHostType(preset.hostType);
    setHostVal(preset.hostValue);
    setDeviceType(preset.deviceType);
    setDeviceVal(preset.deviceValue);
  };

  const handleTestTcpConnection = async (spec: string) => {
    if (!spec.startsWith("tcp:")) return;
    const portStr = spec.replace("tcp:", "").trim();
    const port = parseInt(portStr, 10);
    if (isNaN(port)) return;

    setTestResults((prev) => ({ ...prev, [spec]: "testing" }));
    try {
      const isOk: boolean = await invoke("test_tcp_port_connection", {
        host: "127.0.0.1",
        port,
      });
      setTestResults((prev) => ({ ...prev, [spec]: isOk }));
    } catch {
      setTestResults((prev) => ({ ...prev, [spec]: false }));
    }
  };

  const handleSaveProfile = () => {
    const local = buildSpec(hostType, hostVal);
    const remote = buildSpec(deviceType, deviceVal);
    const name = prompt("Enter a name for this port rule profile:", `${local} ➔ ${remote}`);
    if (!name) return;

    const newProfile: SavedProfile = {
      id: Date.now().toString(),
      name,
      mode: activeTab,
      local,
      remote,
    };
    const updated = [...savedProfiles, newProfile];
    setSavedProfiles(updated);
    localStorage.setItem("adb_saved_port_profiles", JSON.stringify(updated));
  };

  const handleApplyProfile = async (prof: SavedProfile) => {
    if (!activeDevice) return;
    try {
      if (prof.mode === "forward") {
        await invoke("add_port_forward", {
          serial: activeDevice,
          localSpec: prof.local,
          remoteSpec: prof.remote,
        });
      } else {
        await invoke("add_port_reverse", {
          serial: activeDevice,
          remoteSpec: prof.remote,
          localSpec: prof.local,
        });
      }
      fetchPortMappings();
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleDeleteProfile = (id: string) => {
    const updated = savedProfiles.filter((p) => p.id !== id);
    setSavedProfiles(updated);
    localStorage.setItem("adb_saved_port_profiles", JSON.stringify(updated));
  };

  const handlePreviewCurrentCommand = () => {
    if (!onViewCommand) return;
    const localSpec = buildSpec(hostType, hostVal);
    const remoteSpec = buildSpec(deviceType, deviceVal);

    const fullCmd =
      activeTab === "forward"
        ? `adb ${activeDevice ? `-s ${activeDevice} ` : ""}forward ${localSpec} ${remoteSpec}`
        : `adb ${activeDevice ? `-s ${activeDevice} ` : ""}reverse ${remoteSpec} ${localSpec}`;

    onViewCommand({
      title: activeTab === "forward" ? "ADB Port Forward Command" : "ADB Port Reverse Command",
      command: fullCmd,
      description:
        activeTab === "forward"
          ? `Forwards local host socket (${localSpec}) to device remote socket (${remoteSpec})`
          : `Reverses device socket (${remoteSpec}) to local host socket (${localSpec})`,
      category: "Network / Port Forwarding",
    });
  };

  const currentList = activeTab === "forward" ? forwards : reverses;

  return (
    <div className="flex flex-col gap-6 animate-neo-slide">
      {/* Top Banner & Mode Switcher */}
      <HeaderBanner activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Quick Setup Presets */}
      <QuickPresetsBar onApplyPreset={handleApplyPreset} />

      {/* Add Forward / Reverse Form */}
      <AddMappingForm
        activeTab={activeTab}
        activeDevice={activeDevice}
        hostType={hostType}
        setHostType={setHostType}
        hostVal={hostVal}
        setHostVal={setHostVal}
        deviceType={deviceType}
        setDeviceType={setDeviceType}
        deviceVal={deviceVal}
        setDeviceVal={setDeviceVal}
        actionLoading={actionLoading}
        onAddMapping={handleAddMapping}
        onSaveProfile={handleSaveProfile}
        onViewCommand={onViewCommand ? handlePreviewCurrentCommand : undefined}
        buildSpec={buildSpec}
      />

      {/* Notifications / Feedback */}
      {error && <Alert variant="danger" onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert variant="success" onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

      {/* Saved Rule Profiles Bar */}
      <SavedProfilesBar
        profiles={savedProfiles}
        onApplyProfile={handleApplyProfile}
        onDeleteProfile={handleDeleteProfile}
      />

      {/* Active Mappings Table */}
      <ActiveMappingsTable
        activeTab={activeTab}
        activeDevice={activeDevice}
        mappings={currentList}
        loading={loading}
        actionLoading={actionLoading}
        testResults={testResults}
        onRefresh={fetchPortMappings}
        onClearAll={handleClearAll}
        onRemoveMapping={handleRemoveMapping}
        onTestTcpConnection={handleTestTcpConnection}
        onCopyCommand={(cmd) => {
          navigator.clipboard.writeText(cmd);
          setSuccessMsg("Command copied to clipboard!");
          setTimeout(() => setSuccessMsg(null), 2500);
        }}
      />
    </div>
  );
}
