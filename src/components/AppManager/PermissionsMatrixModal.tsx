import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PackageInfo } from "../../types/app_manager";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import {
  ShieldCheck,
  Search,
  Camera,
  Mic,
  MapPin,
  Users,
  Bell,
  MessageSquare,
  HardDrive,
  Check,
  X,
} from "lucide-react";

interface PermissionsMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: string;
  apps: PackageInfo[];
  addLog: (msg: string) => void;
}

const CRITICAL_PERMS = [
  { key: "android.permission.CAMERA", label: "Camera", icon: <Camera className="h-3.5 w-3.5" /> },
  { key: "android.permission.RECORD_AUDIO", label: "Mic", icon: <Mic className="h-3.5 w-3.5" /> },
  { key: "android.permission.ACCESS_FINE_LOCATION", label: "Location", icon: <MapPin className="h-3.5 w-3.5" /> },
  { key: "android.permission.READ_CONTACTS", label: "Contacts", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "android.permission.READ_SMS", label: "SMS", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: "android.permission.POST_NOTIFICATIONS", label: "Notif", icon: <Bell className="h-3.5 w-3.5" /> },
  { key: "android.permission.READ_EXTERNAL_STORAGE", label: "Storage", icon: <HardDrive className="h-3.5 w-3.5" /> },
];

export const PermissionsMatrixModal: React.FC<PermissionsMatrixModalProps> = ({
  isOpen,
  onClose,
  activeDevice,
  apps,
  addLog,
}) => {
  const [search, setSearch] = useState("");
  const [appTypeFilter, setAppTypeFilter] = useState<"all" | "user" | "system">("user");
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);

  const handleTogglePerm = async (pkgName: string, permKey: string, isGrant: boolean) => {
    setLoadingPkg(`${pkgName}-${permKey}`);
    try {
      if (isGrant) {
        await invoke("grant_app_permission", {
          serial: activeDevice,
          packageName: pkgName,
          permission: permKey,
        });
        addLog(`[SUCCESS] Granted ${permKey} to ${pkgName}`);
      } else {
        await invoke("revoke_app_permission", {
          serial: activeDevice,
          packageName: pkgName,
          permission: permKey,
        });
        addLog(`[SUCCESS] Revoked ${permKey} from ${pkgName}`);
      }
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    } finally {
      setLoadingPkg(null);
    }
  };

  const filteredApps = apps.filter((app) => {
    if (appTypeFilter === "user" && app.app_type.toLowerCase() !== "user") return false;
    if (appTypeFilter === "system" && app.app_type.toLowerCase() !== "system") return false;
    const q = search.toLowerCase();
    return app.name.toLowerCase().includes(q) || app.package_name.toLowerCase().includes(q);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="App Permissions & Runtime Matrix"
      icon={<ShieldCheck className="h-5 w-5 text-emerald-400" />}
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--neo-text-muted)] font-medium">
          Inspect and 1-click Grant or Revoke dangerous runtime permissions across installed apps.
        </p>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 neo-box p-3 bg-black/10">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps..."
            className="w-full sm:w-64"
            icon={<Search className="h-4 w-4" />}
          />

          <div className="flex items-center gap-1.5">
            {(["user", "system", "all"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAppTypeFilter(mode)}
                className={`neo-box px-3 py-1 text-xs font-black uppercase transition-all cursor-pointer ${
                  appTypeFilter === mode
                    ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]"
                    : "bg-black/10 text-[var(--neo-text)]"
                }`}
              >
                {mode} Apps
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Table */}
        <div className="max-h-[500px] overflow-x-auto overflow-y-auto border-2 border-[var(--neo-border)] custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-black/20 text-[var(--neo-text)] sticky top-0 uppercase text-[10px] font-black z-10">
              <tr>
                <th className="p-3 border-b-2 border-[var(--neo-border)]">Application</th>
                {CRITICAL_PERMS.map((p) => (
                  <th key={p.key} className="p-2 border-b-2 border-[var(--neo-border)] text-center">
                    <div className="flex flex-col items-center gap-1">
                      {p.icon}
                      <span>{p.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--neo-border)] bg-[var(--neo-card-bg)]">
              {filteredApps.slice(0, 50).map((app) => (
                <tr key={app.package_name} className="hover:bg-black/5 transition-colors">
                  <td className="p-3">
                    <div className="font-bold text-[var(--neo-text)] truncate max-w-[200px]">{app.name}</div>
                    <div className="text-[10px] font-mono text-[var(--neo-text-muted)] truncate max-w-[200px]">
                      {app.package_name}
                    </div>
                  </td>
                  {CRITICAL_PERMS.map((p) => {
                    const isBusy = loadingPkg === `${app.package_name}-${p.key}`;
                    return (
                      <td key={p.key} className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title={`Grant ${p.label}`}
                            disabled={isBusy}
                            onClick={() => handleTogglePerm(app.package_name, p.key, true)}
                            className="neo-box p-1 text-[10px] font-black bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors cursor-pointer"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title={`Revoke ${p.label}`}
                            disabled={isBusy}
                            onClick={() => handleTogglePerm(app.package_name, p.key, false)}
                            className="neo-box p-1 text-[10px] font-black bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
