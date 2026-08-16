import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PackageInfo, PackageDetails } from "../../types/app_manager";
import { PermissionsManagerPanel } from "./PermissionsManagerPanel";
import { ActivityIntentManagerPanel } from "./ActivityIntentManagerPanel";
import { Modal, Tabs, Badge, Button, SearchInput } from "../ui";
import {
  Play,
  Square,
  Trash2,
  Download,
  ShieldCheck,
  Cpu,
  FileText,
  Clock,
  HardDrive,
  RefreshCcw,
  Zap,
  Archive,
  Layers,
  Rocket,
  Terminal,
} from "lucide-react";
import { CommandPreview } from "../../types/terminal";

interface PackageDetailModalProps {
  activeDevice: string;
  packageInfo: PackageInfo;
  onClose: () => void;
  onRefreshList: () => void;
  addLog: (msg: string) => void;
  onViewCommand?: (preview: CommandPreview) => void;
  onOpenLogcat?: (pkgName: string) => void;
}

type Tab = "overview" | "permissions" | "intents" | "components" | "raw";

export const PackageDetailModal: React.FC<PackageDetailModalProps> = ({
  activeDevice,
  packageInfo,
  onClose,
  onRefreshList,
  addLog,
  onViewCommand,
  onOpenLogcat,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [details, setDetails] = useState<PackageDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [componentSearch, setComponentSearch] = useState("");

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res: PackageDetails = await invoke("get_package_details", {
          serial: activeDevice,
          packageName: packageInfo.package_name,
        });
        setDetails(res);
      } catch (err: any) {
        addLog(`[ERROR] Failed to fetch package details: ${String(err)}`);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [activeDevice, packageInfo.package_name]);

  const handleAction = async (actionFn: () => Promise<string>, successMsg: string) => {
    setActionLoading(true);
    try {
      const msg = await actionFn();
      addLog(`[SUCCESS] ${successMsg}: ${msg}`);
      onRefreshList();
    } catch (err: any) {
      addLog(`[ERROR] Action failed: ${String(err)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLaunch = () =>
    handleAction(
      () => invoke("launch_app", { serial: activeDevice, packageName: packageInfo.package_name }),
      "Launched App"
    );

  const handleForceStop = () =>
    handleAction(
      () => invoke("force_stop_app", { serial: activeDevice, packageName: packageInfo.package_name }),
      "Force Stopped App"
    );

  const handleClearData = () =>
    handleAction(
      () => invoke("clear_app_data", { serial: activeDevice, packageName: packageInfo.package_name }),
      "Cleared App Data"
    );

  const handleClearCache = () =>
    handleAction(
      () => invoke("clear_app_cache", { serial: activeDevice, packageName: packageInfo.package_name }),
      "Cleared App Cache"
    );

  const handleDisable = () =>
    handleAction(
      () => invoke("disable_package", { serial: activeDevice, packageName: packageInfo.package_name }),
      "Disabled App"
    );

  const handleEnable = () =>
    handleAction(
      () => invoke("enable_package", { serial: activeDevice, packageName: packageInfo.package_name }),
      "Enabled App"
    );

  const handleUninstall = (userOnly: boolean) =>
    handleAction(
      () =>
        invoke("uninstall_package", {
          serial: activeDevice,
          packageName: packageInfo.package_name,
          keepData: false,
          userOnly,
        }),
      userOnly ? "Uninstalled for User" : "Uninstalled System-Wide"
    );

  const handleExtract = async () => {
    try {
      const dir: string | null = await invoke("pick_save_directory");
      if (dir) {
        handleAction(
          () =>
            invoke("extract_apk", {
              serial: activeDevice,
              packageName: packageInfo.package_name,
              targetDir: dir,
            }),
          "Extracted APK"
        );
      }
    } catch (e: any) {
      addLog(`[ERROR] File picker error: ${String(e)}`);
    }
  };

  const handleBackup = async () => {
    try {
      const dir: string | null = await invoke("pick_save_directory");
      if (dir) {
        const path = `${dir}/${packageInfo.package_name}.ab`;
        handleAction(
          () =>
            invoke("backup_app_data", {
              serial: activeDevice,
              packageName: packageInfo.package_name,
              savePath: path,
            }),
          "Initiated Backup"
        );
      }
    } catch (e: any) {
      addLog(`[ERROR] Backup error: ${String(e)}`);
    }
  };

  const filterComponents = (list?: string[]) => {
    if (!list) return [];
    const q = componentSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter((item) => item.toLowerCase().includes(q));
  };

  const modalTitle = (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-7 w-7 neo-box flex items-center justify-center font-black text-sm bg-[var(--neo-bg)] text-[var(--neo-text)] shrink-0">
        {packageInfo.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <span className="font-extrabold text-sm uppercase tracking-wide truncate block">{packageInfo.name}</span>
        <span className="text-[10px] font-mono opacity-80 truncate block">{packageInfo.package_name}</span>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={modalTitle}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 font-sans">
        {/* Quick Actions Bar */}
        <div className="p-2.5 bg-black/10 neo-box-sm flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <Button size="sm" variant="primary" icon={<Play className="h-3.5 w-3.5" />} onClick={handleLaunch} disabled={actionLoading}>
            Launch
          </Button>
          <Button size="sm" variant="amber" icon={<Square className="h-3.5 w-3.5" />} onClick={handleForceStop} disabled={actionLoading}>
            Force Stop
          </Button>
          <Button size="sm" variant="accent" icon={<Download className="h-3.5 w-3.5" />} onClick={handleExtract} disabled={actionLoading}>
            Extract APK
          </Button>
          <Button size="sm" variant="secondary" icon={<RefreshCcw className="h-3.5 w-3.5" />} onClick={handleClearData} disabled={actionLoading}>
            Clear Data
          </Button>
          <Button size="sm" variant="secondary" icon={<RefreshCcw className="h-3.5 w-3.5" />} onClick={handleClearCache} disabled={actionLoading}>
            Clear Cache
          </Button>
          <Button size="sm" variant="secondary" icon={<Archive className="h-3.5 w-3.5" />} onClick={handleBackup} disabled={actionLoading}>
            Backup Data
          </Button>

          {onOpenLogcat && (
            <Button
              size="sm"
              variant="accent"
              icon={<FileText className="h-3.5 w-3.5 text-cyan-400" />}
              onClick={() => {
                onClose();
                onOpenLogcat(packageInfo.package_name);
              }}
              title="Open Logcat Studio filtered for this package"
            >
              Logcat
            </Button>
          )}

          {onViewCommand && (
            <Button
              size="sm"
              variant="outline"
              icon={<Terminal className="h-3.5 w-3.5 text-emerald-500" />}
              onClick={() =>
                onViewCommand({
                  title: `Clear App Data (${packageInfo.name})`,
                  command: `adb -s ${activeDevice} shell pm clear ${packageInfo.package_name}`,
                  description: "Clears all cached app data, databases, and preferences associated with this package.",
                  category: "Package Manager",
                })
              }
            >
              Command
            </Button>
          )}

          {packageInfo.status === "Disabled" ? (
            <Button size="sm" variant="accent" icon={<Play className="h-3.5 w-3.5" />} onClick={handleEnable} disabled={actionLoading}>
              Enable
            </Button>
          ) : (
            <Button size="sm" variant="amber" icon={<Square className="h-3.5 w-3.5" />} onClick={handleDisable} disabled={actionLoading}>
              Disable
            </Button>
          )}

          <Button size="sm" variant="rose" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => handleUninstall(true)} disabled={actionLoading}>
            Uninstall
          </Button>
        </div>

        {/* Tabs Navigation */}
        <Tabs
          size="sm"
          variant="compact"
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "overview", label: "Overview", icon: <FileText className="h-3.5 w-3.5" /> },
            { id: "permissions", label: "Permissions & AppOps", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
            { id: "intents", label: `Activities & Intents (${details?.activities.length || 0})`, icon: <Rocket className="h-3.5 w-3.5" /> },
            {
              id: "components",
              label: `Components (${(details?.activities.length || 0) + (details?.services.length || 0) + (details?.receivers.length || 0) + (details?.providers.length || 0)})`,
              icon: <Cpu className="h-3.5 w-3.5" />,
            },
            { id: "raw", label: "Raw Dumpsys", icon: <Layers className="h-3.5 w-3.5" /> },
          ]}
        />

        {/* Tab Body */}
        <div className="min-h-0 overflow-y-auto p-1 custom-scrollbar text-[var(--neo-text)]">
          {loading ? (
            <div className="p-12 text-center space-y-2">
              <div className="animate-spin h-6 w-6 border-3 border-[var(--neo-primary)] border-t-transparent rounded-full mx-auto" />
              <p className="text-xs font-extrabold uppercase text-[var(--neo-text-muted)]">Inspecting package metadata...</p>
            </div>
          ) : (
            <>
              {activeTab === "overview" && (
                <div className="space-y-4 text-xs font-semibold">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    <div className="neo-box p-3 bg-black/5 space-y-1">
                      <span className="text-[10px] uppercase text-[var(--neo-text-muted)] font-black flex items-center gap-1">
                        <HardDrive className="h-3.5 w-3.5" /> APK Code Path
                      </span>
                      <p className="font-mono text-xs break-all text-[var(--neo-text)] bg-black/10 p-1.5 rounded select-all font-bold">{details?.info.apk_path || "N/A"}</p>
                    </div>

                    <div className="neo-box p-3 bg-black/5 space-y-1">
                      <span className="text-[10px] uppercase text-[var(--neo-text-muted)] font-black flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5" /> UID / Process ID
                      </span>
                      <p className="font-mono text-xs text-[var(--neo-text)] font-bold">{details?.info.uid || "N/A"}</p>
                    </div>

                    <div className="neo-box p-3 bg-black/5 space-y-1">
                      <span className="text-[10px] uppercase text-[var(--neo-text-muted)] font-black flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" /> Version Name & Code
                      </span>
                      <p className="text-xs text-[var(--neo-text)] font-bold">
                        {details?.info.version_name} (Version Code: {details?.info.version_code})
                      </p>
                    </div>

                    <div className="neo-box p-3 bg-black/5 space-y-1">
                      <span className="text-[10px] uppercase text-[var(--neo-text-muted)] font-black flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" /> Debuggable Flag
                      </span>
                      <div>
                        {details?.info.is_debuggable ? (
                          <Badge variant="warning">Debuggable Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Release Build</Badge>
                        )}
                      </div>
                    </div>

                    <div className="neo-box p-3 bg-black/5 space-y-1">
                      <span className="text-[10px] uppercase text-[var(--neo-text-muted)] font-black flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> First Install Time
                      </span>
                      <p className="text-xs text-[var(--neo-text)] font-bold">{details?.info.first_install_time || "N/A"}</p>
                    </div>

                    <div className="neo-box p-3 bg-black/5 space-y-1">
                      <span className="text-[10px] uppercase text-[var(--neo-text-muted)] font-black flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Last Update Time
                      </span>
                      <p className="text-xs text-[var(--neo-text)] font-bold">{details?.info.last_update_time || "N/A"}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "permissions" && (
                <PermissionsManagerPanel
                  activeDevice={activeDevice}
                  packageName={packageInfo.package_name}
                  addLog={addLog}
                />
              )}

              {activeTab === "intents" && (
                <ActivityIntentManagerPanel
                  activeDevice={activeDevice}
                  packageName={packageInfo.package_name}
                  activities={details?.activities}
                  services={details?.services}
                  addLog={addLog}
                />
              )}

              {activeTab === "components" && (
                <div className="space-y-4">
                  {/* Component Filter Search Input */}
                  <SearchInput
                    placeholder="Filter components (e.g. Activity, Service, Receiver)..."
                    value={componentSearch}
                    onChange={setComponentSearch}
                  />

                  <div className="space-y-4 text-xs font-medium">
                    {/* Activities */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[var(--neo-text-muted)] flex items-center justify-between">
                        <span>Activities ({details?.activities.length || 0})</span>
                      </h4>
                      <div className="neo-box p-2.5 bg-black/5 max-h-40 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar">
                        {filterComponents(details?.activities).length > 0 ? (
                          filterComponents(details?.activities).map((a, i) => (
                            <div key={i} className="bg-black/10 px-2 py-1 rounded select-all font-semibold">{a}</div>
                          ))
                        ) : (
                          <span className="text-[var(--neo-text-muted)] italic">No matching activities</span>
                        )}
                      </div>
                    </div>

                    {/* Services */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[var(--neo-text-muted)]">
                        Services ({details?.services.length || 0})
                      </h4>
                      <div className="neo-box p-2.5 bg-black/5 max-h-40 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar">
                        {filterComponents(details?.services).length > 0 ? (
                          filterComponents(details?.services).map((s, i) => (
                            <div key={i} className="bg-black/10 px-2 py-1 rounded select-all font-semibold">{s}</div>
                          ))
                        ) : (
                          <span className="text-[var(--neo-text-muted)] italic">No matching services</span>
                        )}
                      </div>
                    </div>

                    {/* Receivers */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[var(--neo-text-muted)]">
                        Receivers ({details?.receivers.length || 0})
                      </h4>
                      <div className="neo-box p-2.5 bg-black/5 max-h-40 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar">
                        {filterComponents(details?.receivers).length > 0 ? (
                          filterComponents(details?.receivers).map((r, i) => (
                            <div key={i} className="bg-black/10 px-2 py-1 rounded select-all font-semibold">{r}</div>
                          ))
                        ) : (
                          <span className="text-[var(--neo-text-muted)] italic">No matching receivers</span>
                        )}
                      </div>
                    </div>

                    {/* Providers */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-black uppercase tracking-wider text-[var(--neo-text-muted)]">
                        Providers ({details?.providers.length || 0})
                      </h4>
                      <div className="neo-box p-2.5 bg-black/5 max-h-40 overflow-y-auto font-mono text-[11px] space-y-1 custom-scrollbar">
                        {filterComponents(details?.providers).length > 0 ? (
                          filterComponents(details?.providers).map((p, i) => (
                            <div key={i} className="bg-black/10 px-2 py-1 rounded select-all font-semibold">{p}</div>
                          ))
                        ) : (
                          <span className="text-[var(--neo-text-muted)] italic">No matching providers</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "raw" && (
                <div className="neo-box-sm bg-black/90 p-4 font-mono text-xs text-slate-200 h-96 overflow-y-auto custom-scrollbar border-2 border-black">
                  <pre className="whitespace-pre-wrap leading-relaxed select-all">{details?.raw_dump || "No raw dump available"}</pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
