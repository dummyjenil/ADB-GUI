import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PackageInfo } from "../../types/app_manager";
import { Modal, SearchInput, Button, Tabs, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui";
import {
  ShieldCheck,
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
      footer={
        <Button size="sm" variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--neo-text-muted)] font-medium">
          Inspect and 1-click Grant or Revoke dangerous runtime permissions across installed apps.
        </p>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 neo-box p-3 bg-black/10">
          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search apps..."
            />
          </div>

          <Tabs
            size="sm"
            variant="compact"
            activeTab={appTypeFilter}
            onChange={setAppTypeFilter}
            tabs={[
              { id: "user", label: "User Apps" },
              { id: "system", label: "System Apps" },
              { id: "all", label: "All Apps" },
            ]}
          />
        </div>

        {/* Matrix Table */}
        <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Application</TableHead>
                {CRITICAL_PERMS.map((p) => (
                  <TableHead key={p.key} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      {p.icon}
                      <span>{p.label}</span>
                    </div>
                  </TableHead>
                ))}
              </tr>
            </TableHeader>
            <TableBody>
              {filteredApps.slice(0, 50).map((app) => (
                <TableRow key={app.package_name}>
                  <TableCell>
                    <div className="font-bold text-[var(--neo-text)] truncate max-w-[200px]">{app.name}</div>
                    <div className="text-[10px] font-mono text-[var(--neo-text-muted)] truncate max-w-[200px]">
                      {app.package_name}
                    </div>
                  </TableCell>
                  {CRITICAL_PERMS.map((p) => {
                    const isBusy = loadingPkg === `${app.package_name}-${p.key}`;
                    return (
                      <TableCell key={p.key} className="text-center">
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
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Modal>
  );
};
