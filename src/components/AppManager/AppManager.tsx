import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { PackageInfo, FilterOption } from "../../types/app_manager";
import { AppFiltersBar } from "./AppFiltersBar";
import { AppTable } from "./AppTable";
import { PackageDetailModal } from "./PackageDetailModal";
import { AdvancedPmPanel } from "./AdvancedPmPanel";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import {
  Package,
  UploadCloud,
  Terminal,
  Trash2,
  Square,
  CheckCircle2,
  XCircle,
  FolderOpen,
  SlidersHorizontal,
} from "lucide-react";

import { CommandPreview } from "../../types/terminal";

interface AppManagerProps {
  activeDevice: string | null;
  onViewCommand?: (preview: CommandPreview) => void;
}

export const AppManager: React.FC<AppManagerProps> = ({ activeDevice, onViewCommand }) => {
  const [apps, setApps] = useState<PackageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [inspectedPackage, setInspectedPackage] = useState<PackageInfo | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showAdvancedPm, setShowAdvancedPm] = useState(false);
  const [installing, setInstalling] = useState(false);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const fetchPackages = useCallback(async () => {
    if (!activeDevice) return;
    setLoading(true);
    try {
      const res: PackageInfo[] = await invoke("list_packages", {
        serial: activeDevice,
        filter: "all",
      });
      setApps(res);
    } catch (err: any) {
      addLog(`[ERROR] Failed to fetch package list: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [activeDevice]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Drag & drop window listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupDragDrop = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const apkPaths = paths.filter((p) => p.toLowerCase().endsWith(".apk"));
              if (apkPaths.length > 0) {
                handleInstallApks(apkPaths);
              } else {
                addLog("[ERROR] Only .apk files are supported!");
              }
            }
          }
        });
      } catch (e) {
        console.error("Failed to setup drag drop listener:", e);
      }
    };
    setupDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, [activeDevice]);

  const handleInstallApks = async (paths: string[]) => {
    if (!activeDevice || paths.length === 0) return;
    setInstalling(true);
    addLog(`Initiating installation for ${paths.length} APK(s)...`);
    try {
      const res: string = await invoke("install_apks", {
        serial: activeDevice,
        filePaths: paths,
        update: true,
      });
      addLog(`[SUCCESS] ${res}`);
      fetchPackages();
    } catch (err: any) {
      addLog(`[ERROR] Installation failed: ${String(err)}`);
    } finally {
      setInstalling(false);
    }
  };

  const handlePickAndInstallApks = async () => {
    try {
      const selected: string[] = await invoke("pick_multiple_apk_files");
      if (selected && selected.length > 0) {
        handleInstallApks(selected);
      }
    } catch (err: any) {
      addLog(`[ERROR] File picker error: ${String(err)}`);
    }
  };

  // Package Action Handlers
  const handleLaunch = async (pkgName: string) => {
    try {
      const res: string = await invoke("launch_app", { serial: activeDevice, packageName: pkgName });
      addLog(`[SUCCESS] ${res}`);
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  const handleForceStop = async (pkgName: string) => {
    try {
      await invoke("force_stop_app", { serial: activeDevice, packageName: pkgName });
      addLog(`[SUCCESS] Force stopped ${pkgName}`);
      fetchPackages();
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  const handleUninstall = async (pkgName: string, userOnly: boolean) => {
    try {
      await invoke("uninstall_package", { serial: activeDevice, packageName: pkgName, userOnly });
      addLog(`[SUCCESS] Uninstalled ${pkgName}`);
      fetchPackages();
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  const handleDisable = async (pkgName: string) => {
    try {
      await invoke("disable_package", { serial: activeDevice, packageName: pkgName });
      addLog(`[SUCCESS] Disabled ${pkgName}`);
      fetchPackages();
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  const handleEnable = async (pkgName: string) => {
    try {
      await invoke("enable_package", { serial: activeDevice, packageName: pkgName });
      addLog(`[SUCCESS] Enabled ${pkgName}`);
      fetchPackages();
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  const handleClearData = async (pkgName: string) => {
    try {
      await invoke("clear_app_data", { serial: activeDevice, packageName: pkgName });
      addLog(`[SUCCESS] Cleared data for ${pkgName}`);
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  const handleExtractApk = async (pkgName: string) => {
    try {
      const dir: string | null = await invoke("pick_save_directory");
      if (dir) {
        const res: string = await invoke("extract_apk", {
          serial: activeDevice,
          packageName: pkgName,
          targetDir: dir,
        });
        addLog(`[SUCCESS] ${res}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  const handleBackupData = async (pkgName: string) => {
    try {
      const dir: string | null = await invoke("pick_save_directory");
      if (dir) {
        const path = `${dir}/${pkgName}.ab`;
        const res: string = await invoke("backup_app_data", {
          serial: activeDevice,
          packageName: pkgName,
          savePath: path,
        });
        addLog(`[SUCCESS] ${res}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    }
  };

  // Batch Operations
  const handleBatchUninstall = async () => {
    if (selectedPackages.length === 0) return;
    for (const pkg of selectedPackages) {
      await handleUninstall(pkg, true);
    }
    setSelectedPackages([]);
  };

  const handleBatchDisable = async () => {
    if (selectedPackages.length === 0) return;
    for (const pkg of selectedPackages) {
      await handleDisable(pkg);
    }
    setSelectedPackages([]);
  };

  // Multi-Filter checking logic
  const filteredApps = apps.filter((app) => {
    // 1. Search Query check
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const isUidMatch = activeFilters.includes("by_uid");
      if (isUidMatch) {
        if (!app.uid || !app.uid.toLowerCase().includes(q)) return false;
      } else {
        const matchesQuery =
          app.name.toLowerCase().includes(q) ||
          app.package_name.toLowerCase().includes(q) ||
          (app.uid && app.uid.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }
    }

    // 2. Multi-Filter checks (Must satisfy all active filter pills)
    if (activeFilters.length === 0 || activeFilters.includes("all")) {
      return true;
    }

    for (const f of activeFilters) {
      if (f === "user" && app.app_type !== "User") return false;
      if (f === "system" && app.app_type !== "System") return false;
      if (f === "disabled" && app.status !== "Disabled") return false;
      if (f === "enabled" && app.status === "Disabled") return false;
      if (f === "running" && app.status !== "Running") return false;
      if (f === "debuggable" && !app.is_debuggable) return false;
      if (f === "with_apk" && !app.has_apk) return false;
      if (f === "without_apk" && app.has_apk) return false;
    }

    return true;
  });

  if (!activeDevice) {
    return <EmptyState title="No Active Device Selected" description="Please connect and select a device to use the App Manager." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 neo-box p-4 bg-[var(--neo-card-bg)]">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide text-[var(--neo-text)] flex items-center gap-2">
            <Package className="h-6 w-6 text-[var(--neo-primary)]" />
            App Manager & ADB Package Suite
          </h2>
          <p className="text-xs text-[var(--neo-text-muted)] mt-0.5 font-bold">
            List, multi-filter, inspect, install, extract, and manage installed Android packages on target device
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button
            variant="primary"
            icon={<FolderOpen className="h-4 w-4" />}
            onClick={handlePickAndInstallApks}
            loading={installing}
          >
            Install APK(s)
          </Button>

          <Button
            variant={showAdvancedPm ? "accent" : "secondary"}
            icon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setShowAdvancedPm(!showAdvancedPm)}
          >
            {showAdvancedPm ? "Hide Advanced PM" : "Advanced PM Tool"}
          </Button>
        </div>
      </div>

      {/* Batch Floating Actions Bar */}
      {selectedPackages.length > 0 && (
        <div className="neo-box p-3 bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center justify-between gap-3 shadow-[4px_4px_0px_0px_var(--neo-shadow)] animate-in slide-in-from-top-2">
          <span className="text-xs font-black uppercase tracking-wider">
            {selectedPackages.length} package(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="amber" icon={<Square className="h-3.5 w-3.5" />} onClick={handleBatchDisable}>
              Batch Disable
            </Button>
            <Button size="sm" variant="rose" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={handleBatchUninstall}>
              Batch Uninstall
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedPackages([])}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Quick Drag & Drop APK Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) {
            const paths = Array.from(e.dataTransfer.files)
              .map((f: any) => f.path)
              .filter(Boolean);
            handleInstallApks(paths);
          }
        }}
        onClick={handlePickAndInstallApks}
        className="neo-box p-5 text-center bg-black/10 hover:bg-black/20 transition-all cursor-pointer group"
      >
        <UploadCloud className="h-8 w-8 text-[var(--neo-primary)] mx-auto mb-2 group-hover:scale-110 transition-transform" />
        <p className="text-xs font-black uppercase text-[var(--neo-text)]">
          Drag & drop `.apk` package files here or click to browse & install
        </p>
      </div>

      {/* Advanced PM Tool Panel */}
      {showAdvancedPm && <AdvancedPmPanel activeDevice={activeDevice} addLog={addLog} />}

      {/* Filters Bar */}
      <AppFiltersBar
        activeFilters={activeFilters}
        setActiveFilters={setActiveFilters}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefresh={fetchPackages}
        loading={loading}
        totalCount={apps.length}
        filteredCount={filteredApps.length}
      />

      {/* Installed Apps Table */}
      <AppTable
        apps={filteredApps}
        selectedPackages={selectedPackages}
        setSelectedPackages={setSelectedPackages}
        onInspect={(pkg) => setInspectedPackage(pkg)}
        onLaunch={handleLaunch}
        onForceStop={handleForceStop}
        onUninstall={handleUninstall}
        onDisable={handleDisable}
        onEnable={handleEnable}
        onClearData={handleClearData}
        onExtractApk={handleExtractApk}
        onBackupData={handleBackupData}
        loading={loading}
      />

      {/* Package Detail Modal Drawer */}
      {inspectedPackage && (
        <PackageDetailModal
          activeDevice={activeDevice}
          packageInfo={inspectedPackage}
          onClose={() => setInspectedPackage(null)}
          onRefreshList={fetchPackages}
          addLog={addLog}
          onViewCommand={onViewCommand}
        />
      )}

      {/* Console Execution Logs */}
      <Card
        headerTitle="App Manager Execution Logs"
        headerIcon={<Terminal className="h-5 w-5" />}
        headerVariant="dark"
        headerAction={
          <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
            Clear Logs
          </Button>
        }
      >
        <div className="neo-box-sm bg-black/90 p-3 font-mono text-xs text-slate-200 h-36 overflow-y-auto custom-scrollbar space-y-1 border-2 border-black">
          {logs.length === 0 ? (
            <p className="text-slate-500 italic">No package manager logs generated yet...</p>
          ) : (
            logs.map((log, idx) => {
              const isError = log.includes("[ERROR]");
              const isSuccess = log.includes("[SUCCESS]");
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    isError ? "text-rose-400 font-bold" : isSuccess ? "text-emerald-400 font-bold" : "text-slate-300"
                  }`}
                >
                  {isError && <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-400" />}
                  {isSuccess && <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />}
                  <span>{log}</span>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};
