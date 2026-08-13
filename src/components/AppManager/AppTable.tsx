import React, { useState } from "react";
import { PackageInfo } from "../../types/app_manager";
import { Badge } from "../ui/Badge";
import {
  Play,
  Square,
  Trash2,
  Download,
  Info,
  Layers,
  ShieldAlert,
  Archive,
  RefreshCcw,
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
} from "lucide-react";

export type SortKey = "name" | "package_name" | "app_type" | "status" | "uid";
export type SortOrder = "asc" | "desc";

interface AppTableProps {
  apps: PackageInfo[];
  selectedPackages: string[];
  setSelectedPackages: React.Dispatch<React.SetStateAction<string[]>>;
  onInspect: (pkg: PackageInfo) => void;
  onLaunch: (pkgName: string) => void;
  onForceStop: (pkgName: string) => void;
  onUninstall: (pkgName: string, userOnly: boolean) => void;
  onDisable: (pkgName: string) => void;
  onEnable: (pkgName: string) => void;
  onClearData: (pkgName: string) => void;
  onExtractApk: (pkgName: string) => void;
  onBackupData: (pkgName: string) => void;
  onOpenLogcat?: (pkgName: string) => void;
  loading: boolean;
}

export const AppTable: React.FC<AppTableProps> = ({
  apps,
  selectedPackages,
  setSelectedPackages,
  onInspect,
  onLaunch,
  onForceStop,
  onUninstall,
  onDisable,
  onEnable,
  onClearData,
  onExtractApk,
  onBackupData,
  onOpenLogcat,
  loading,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedApps = [...apps].sort((a, b) => {
    let valA = (a[sortKey] || "").toString().toLowerCase();
    let valB = (b[sortKey] || "").toString().toLowerCase();
    let comp = valA.localeCompare(valB);
    return sortOrder === "asc" ? comp : -comp;
  });

  const toggleSelectAll = () => {
    if (selectedPackages.length === apps.length) {
      setSelectedPackages([]);
    } else {
      setSelectedPackages(apps.map((a) => a.package_name));
    }
  };

  const toggleSelect = (pkgName: string) => {
    if (selectedPackages.includes(pkgName)) {
      setSelectedPackages(selectedPackages.filter((p) => p !== pkgName));
    } else {
      setSelectedPackages([...selectedPackages, pkgName]);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Running":
        return <Badge variant="accent">Running</Badge>;
      case "Disabled":
        return <Badge variant="danger">Disabled</Badge>;
      default:
        return <Badge variant="secondary">Enabled</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    return type === "User" ? (
      <Badge variant="primary">User</Badge>
    ) : (
      <Badge variant="warning">System</Badge>
    );
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 text-[var(--neo-text-muted)] opacity-50" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-[var(--neo-primary)] font-black" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[var(--neo-primary)] font-black" />
    );
  };

  if (loading) {
    return (
      <div className="neo-box p-12 text-center bg-[var(--neo-card-bg)] space-y-3">
        <div className="animate-spin h-8 w-8 border-4 border-[var(--neo-primary)] border-t-transparent rounded-full mx-auto" />
        <p className="text-sm font-extrabold uppercase text-[var(--neo-text)]">
          Scanning installed packages on device...
        </p>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="neo-box p-12 text-center bg-[var(--neo-card-bg)] space-y-2">
        <Layers className="h-10 w-10 text-[var(--neo-text-muted)] mx-auto" />
        <p className="text-sm font-extrabold uppercase text-[var(--neo-text)]">No packages match the current filter</p>
        <p className="text-xs text-[var(--neo-text-muted)]">Try adjusting your filters or search term.</p>
      </div>
    );
  }

  return (
    <div className="relative neo-box bg-[var(--neo-card-bg)] max-h-[62vh] overflow-auto custom-scrollbar border-2 border-[var(--neo-border)]">
      {/* Backdrop for closing open dropdown */}
      {activeMenu && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setActiveMenu(null)}
        />
      )}

      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead>
          <tr className="sticky top-0 z-30 bg-[var(--neo-card-bg)] border-b-2 border-[var(--neo-border)] text-[11px] font-black uppercase tracking-wider text-[var(--neo-text-muted)] shadow-xs">
            <th className="p-3 w-10 text-center bg-[var(--neo-card-bg)]">
              <input
                type="checkbox"
                checked={apps.length > 0 && selectedPackages.length === apps.length}
                onChange={toggleSelectAll}
                className="rounded border-[var(--neo-border)] accent-[var(--neo-primary)] cursor-pointer"
              />
            </th>
            <th
              onClick={() => handleSort("name")}
              className="p-3 cursor-pointer hover:bg-black/5 transition-colors bg-[var(--neo-card-bg)]"
            >
              <div className="flex items-center gap-1.5">
                <span>App Name</span>
                {renderSortIcon("name")}
              </div>
            </th>
            <th
              onClick={() => handleSort("package_name")}
              className="p-3 cursor-pointer hover:bg-black/5 transition-colors bg-[var(--neo-card-bg)]"
            >
              <div className="flex items-center gap-1.5">
                <span>Package Identifier</span>
                {renderSortIcon("package_name")}
              </div>
            </th>
            <th
              onClick={() => handleSort("app_type")}
              className="p-3 text-center cursor-pointer hover:bg-black/5 transition-colors bg-[var(--neo-card-bg)]"
            >
              <div className="flex items-center justify-center gap-1.5">
                <span>Type</span>
                {renderSortIcon("app_type")}
              </div>
            </th>
            <th
              onClick={() => handleSort("status")}
              className="p-3 text-center cursor-pointer hover:bg-black/5 transition-colors bg-[var(--neo-card-bg)]"
            >
              <div className="flex items-center justify-center gap-1.5">
                <span>Status</span>
                {renderSortIcon("status")}
              </div>
            </th>
            <th
              onClick={() => handleSort("uid")}
              className="p-3 text-center cursor-pointer hover:bg-black/5 transition-colors bg-[var(--neo-card-bg)]"
            >
              <div className="flex items-center justify-center gap-1.5">
                <span>UID</span>
                {renderSortIcon("uid")}
              </div>
            </th>
            <th className="p-3 text-right bg-[var(--neo-card-bg)]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--neo-border)] text-xs font-bold">
          {sortedApps.map((app) => {
            const isSelected = selectedPackages.includes(app.package_name);

            return (
              <tr
                key={app.package_name}
                className={`hover:bg-black/5 transition-colors ${
                  isSelected ? "bg-[var(--neo-primary)]/10" : ""
                }`}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(app.package_name)}
                    className="rounded border-[var(--neo-border)] accent-[var(--neo-primary)] cursor-pointer"
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded neo-box flex items-center justify-center font-black bg-[var(--neo-primary)] text-[var(--neo-primary-text)] shrink-0 text-sm shadow-xs">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-[var(--neo-text)] truncate">{app.name}</p>
                      {app.is_debuggable && (
                        <span className="text-[9px] font-black uppercase text-amber-500 flex items-center gap-0.5">
                          <Zap className="h-2.5 w-2.5" /> Debuggable
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-3 font-mono text-[11px] text-[var(--neo-text-muted)] select-all truncate max-w-xs">
                  {app.package_name}
                </td>
                <td className="p-3 text-center">{getTypeBadge(app.app_type)}</td>
                <td className="p-3 text-center">{getStatusBadge(app.status)}</td>
                <td className="p-3 text-center font-mono text-[11px] text-[var(--neo-text-muted)]">
                  {app.uid || "N/A"}
                </td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onLaunch(app.package_name)}
                      className="p-1.5 rounded text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/50 border border-transparent transition-all"
                      title="Launch App"
                    >
                      <Play className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => onInspect(app)}
                      className="p-1.5 rounded text-sky-500 hover:bg-sky-500/10 hover:border-sky-500/50 border border-transparent transition-all"
                      title="Inspect Details"
                    >
                      <Info className="h-4 w-4" />
                    </button>

                    {onOpenLogcat && (
                      <button
                        onClick={() => onOpenLogcat(app.package_name)}
                        className="p-1.5 rounded text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-500/50 border border-transparent transition-all"
                        title="Open Logcat Studio"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => onForceStop(app.package_name)}
                      className="p-1.5 rounded text-amber-500 hover:bg-amber-500/10 hover:border-amber-500/50 border border-transparent transition-all"
                      title="Force Stop"
                    >
                      <Square className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => onExtractApk(app.package_name)}
                      className="p-1.5 rounded text-purple-500 hover:bg-purple-500/10 hover:border-purple-500/50 border border-transparent transition-all"
                      title="Extract APK"
                    >
                      <Download className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => onClearData(app.package_name)}
                      className="p-1.5 rounded text-indigo-500 hover:bg-indigo-500/10 hover:border-indigo-500/50 border border-transparent transition-all"
                      title="Clear Data & Cache"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => onBackupData(app.package_name)}
                      className="p-1.5 rounded text-teal-500 hover:bg-teal-500/10 hover:border-teal-500/50 border border-transparent transition-all"
                      title="Backup Data"
                    >
                      <Archive className="h-4 w-4" />
                    </button>

                    {app.status === "Disabled" ? (
                      <button
                        onClick={() => onEnable(app.package_name)}
                        className="p-1.5 rounded text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/50 border border-transparent transition-all"
                        title="Enable App"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onDisable(app.package_name)}
                        className="p-1.5 rounded text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/50 border border-transparent transition-all"
                        title="Disable App"
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      onClick={() => onUninstall(app.package_name, true)}
                      className="p-1.5 rounded text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/50 border border-transparent transition-all"
                      title="Uninstall (User)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
