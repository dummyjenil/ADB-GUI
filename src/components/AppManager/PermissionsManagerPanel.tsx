import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DetailedPermissions, RuntimePermissionInfo } from "../../types/app_manager";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Camera,
  Mic,
  MapPin,
  Users,
  Bell,
  MessageSquare,
  HardDrive,
  Phone,
  Calendar,
  Zap,
  Sliders,
  RefreshCw,
  Search,
  Lock,
} from "lucide-react";

interface PermissionsManagerPanelProps {
  activeDevice: string;
  packageName: string;
  addLog: (msg: string) => void;
}

const COMMON_PERMISSIONS: { key: string; name: string; icon: React.ReactNode }[] = [
  { key: "android.permission.CAMERA", name: "Camera", icon: <Camera className="h-4 w-4" /> },
  { key: "android.permission.RECORD_AUDIO", name: "Microphone", icon: <Mic className="h-4 w-4" /> },
  { key: "android.permission.ACCESS_FINE_LOCATION", name: "Location", icon: <MapPin className="h-4 w-4" /> },
  { key: "android.permission.READ_CONTACTS", name: "Contacts", icon: <Users className="h-4 w-4" /> },
  { key: "android.permission.POST_NOTIFICATIONS", name: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { key: "android.permission.READ_SMS", name: "SMS", icon: <MessageSquare className="h-4 w-4" /> },
  { key: "android.permission.READ_EXTERNAL_STORAGE", name: "Storage", icon: <HardDrive className="h-4 w-4" /> },
  { key: "android.permission.READ_PHONE_STATE", name: "Phone State", icon: <Phone className="h-4 w-4" /> },
  { key: "android.permission.READ_CALENDAR", name: "Calendar", icon: <Calendar className="h-4 w-4" /> },
];

const COMMON_APPOPS = [
  { op: "CAMERA", name: "Camera Access" },
  { op: "FINE_LOCATION", name: "Fine Location" },
  { op: "POST_NOTIFICATION", name: "Notifications" },
  { op: "READ_CLIPBOARD", name: "Clipboard Read" },
  { op: "WRITE_CLIPBOARD", name: "Clipboard Write" },
  { op: "RUN_IN_BACKGROUND", name: "Background Execution" },
  { op: "WAKE_LOCK", name: "Wake Lock" },
  { op: "MANAGE_EXTERNAL_STORAGE", name: "Manage Storage" },
];

export const PermissionsManagerPanel: React.FC<PermissionsManagerPanelProps> = ({
  activeDevice,
  packageName,
  addLog,
}) => {
  const [data, setData] = useState<DetailedPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [permSearch, setPermSearch] = useState("");
  const [appOpSearch, setAppOpSearch] = useState("");

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const res: DetailedPermissions = await invoke("get_detailed_permissions", {
        serial: activeDevice,
        packageName,
      });
      setData(res);
    } catch (err: any) {
      addLog(`[ERROR] Failed to load permissions for ${packageName}: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [activeDevice, packageName]);

  const handleGrant = async (permission: string) => {
    setActionLoading(`grant_${permission}`);
    try {
      const res: string = await invoke("grant_app_permission", {
        serial: activeDevice,
        packageName,
        permission,
      });
      addLog(`[SUCCESS] Granted ${permission} to ${packageName}: ${res}`);
      await loadPermissions();
    } catch (err: any) {
      addLog(`[ERROR] Failed to grant ${permission}: ${String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (permission: string) => {
    setActionLoading(`revoke_${permission}`);
    try {
      const res: string = await invoke("revoke_app_permission", {
        serial: activeDevice,
        packageName,
        permission,
      });
      addLog(`[SUCCESS] Revoked ${permission} from ${packageName}: ${res}`);
      await loadPermissions();
    } catch (err: any) {
      addLog(`[ERROR] Failed to revoke ${permission}: ${String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetAppOp = async (op: string, mode: string) => {
    setActionLoading(`appop_${op}_${mode}`);
    try {
      const res: string = await invoke("set_app_op_mode", {
        serial: activeDevice,
        packageName,
        op,
        mode,
      });
      addLog(`[SUCCESS] Set AppOp ${op} -> ${mode} for ${packageName}: ${res}`);
      await loadPermissions();
    } catch (err: any) {
      addLog(`[ERROR] Failed to set AppOp ${op}: ${String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="animate-spin h-6 w-6 border-3 border-[var(--neo-primary)] border-t-transparent rounded-full mx-auto" />
        <p className="text-xs font-extrabold uppercase text-[var(--neo-text-muted)]">
          Inspecting runtime permissions & AppOps...
        </p>
      </div>
    );
  }

  // Combine runtime and requested permissions list
  const runtimeMap = new Map<string, RuntimePermissionInfo>();
  data?.runtime_permissions.forEach((p) => runtimeMap.set(p.permission, p));

  const allPermKeys = Array.from(
    new Set([...(data?.requested_permissions || []), ...(data?.runtime_permissions.map((r) => r.permission) || [])])
  );

  const filteredPerms = allPermKeys.filter((p) =>
    p.toLowerCase().includes(permSearch.toLowerCase().trim())
  );

  const filteredAppOps = (data?.app_ops || []).filter(
    (op) =>
      op.op.toLowerCase().includes(appOpSearch.toLowerCase().trim()) ||
      op.raw.toLowerCase().includes(appOpSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-6 text-xs">
      {/* Top Header / Refresh Bar */}
      <div className="flex items-center justify-between gap-3 neo-box p-3 bg-black/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <h4 className="font-extrabold uppercase tracking-wide text-sm">Permissions & AppOps Manager</h4>
            <p className="text-[11px] font-mono text-[var(--neo-text-muted)]">
              Grant/revoke permissions and configure internal Android AppOps state
            </p>
          </div>
        </div>
        <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={loadPermissions}>
          Refresh
        </Button>
      </div>

      {/* Quick Common Permissions Grid */}
      <div className="space-y-2">
        <h5 className="font-black uppercase tracking-wider text-[var(--neo-text-muted)] flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-400" /> Essential Permission Toggles
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {COMMON_PERMISSIONS.map((item) => {
            const runtime = runtimeMap.get(item.key);
            const isRequested = data?.requested_permissions.includes(item.key);
            const isGranted = runtime?.granted ?? false;

            return (
              <div
                key={item.key}
                className={`neo-box p-3 flex items-center justify-between gap-2 border-l-4 ${
                  isGranted
                    ? "border-l-emerald-500 bg-emerald-950/20"
                    : isRequested
                    ? "border-l-amber-500 bg-amber-950/20"
                    : "border-l-slate-600 bg-black/10"
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="p-1.5 neo-box bg-[var(--neo-card-bg)] text-[var(--neo-primary)] shrink-0">
                    {item.icon}
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-xs">{item.name}</p>
                    <div className="flex items-center gap-1">
                      {isGranted ? (
                        <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Granted
                        </span>
                      ) : isRequested ? (
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> Revoked
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--neo-text-muted)] italic">Not Requested</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isGranted ? (
                    <Button
                      size="sm"
                      variant="rose"
                      loading={actionLoading === `revoke_${item.key}`}
                      onClick={() => handleRevoke(item.key)}
                    >
                      Revoke
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="accent"
                      loading={actionLoading === `grant_${item.key}`}
                      onClick={() => handleGrant(item.key)}
                    >
                      Grant
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AppOps GUI Controls */}
      <div className="space-y-3 neo-box p-4 bg-black/15">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--neo-border)] pb-3">
          <div>
            <h5 className="font-black uppercase tracking-wider flex items-center gap-2 text-sm text-[var(--neo-primary)]">
              <Sliders className="h-4 w-4" /> AppOps Configuration (`cmd appops set`)
            </h5>
            <p className="text-[11px] text-[var(--neo-text-muted)] font-mono">
              Control granular background execution, clipboard, location & wake lock modes
            </p>
          </div>

          <div className="relative w-full sm:w-56">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)]" />
            <input
              type="text"
              placeholder="Search AppOps..."
              value={appOpSearch}
              onChange={(e) => setAppOpSearch(e.target.value)}
              className="neo-input pl-8 py-1 text-xs w-full font-mono"
            />
          </div>
        </div>

        {/* Common AppOps Quick Switch Row */}
        <div className="space-y-2">
          <p className="text-[11px] font-extrabold uppercase text-[var(--neo-text-muted)]">Preset AppOps Toggles</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {COMMON_APPOPS.map((appop) => {
              const current = data?.app_ops.find((op) => op.op.toUpperCase().includes(appop.op));
              const mode = current?.mode || "default";

              return (
                <div key={appop.op} className="neo-box p-2.5 bg-black/20 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-xs block">{appop.name}</span>
                    <span className="font-mono text-[10px] text-[var(--neo-text-muted)]">{appop.op}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {(["allow", "ignore", "deny", "default"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => handleSetAppOp(appop.op, m)}
                        disabled={actionLoading === `appop_${appop.op}_${m}`}
                        className={`px-2 py-1 rounded text-[10px] font-extrabold capitalize border transition-all ${
                          mode === m
                            ? m === "allow"
                              ? "bg-emerald-600 text-white border-emerald-400"
                              : m === "ignore" || m === "deny"
                              ? "bg-rose-600 text-white border-rose-400"
                              : "bg-amber-600 text-white border-amber-400"
                            : "bg-black/30 text-[var(--neo-text-muted)] border-transparent hover:bg-black/50"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Full AppOps List */}
        {filteredAppOps.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-extrabold uppercase text-[var(--neo-text-muted)]">
              All Active AppOps ({filteredAppOps.length})
            </p>
            <div className="neo-box p-2 bg-black/25 max-h-48 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-1">
              {filteredAppOps.map((op, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 p-1.5 bg-black/20 rounded">
                  <span className="truncate text-slate-200 font-semibold">{op.raw}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {(["allow", "ignore", "deny", "default"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => handleSetAppOp(op.op, m)}
                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${
                          op.mode === m
                            ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)]"
                            : "bg-black/20 text-[var(--neo-text-muted)] border-transparent hover:bg-black/40"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All Declared Permissions Table */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h5 className="font-black uppercase tracking-wider text-[var(--neo-text-muted)] flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> All Package Permissions ({allPermKeys.length})
          </h5>
          <div className="relative w-full sm:w-60">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)]" />
            <input
              type="text"
              placeholder="Filter permissions..."
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              className="neo-input pl-8 py-1 text-xs w-full font-mono"
            />
          </div>
        </div>

        <div className="neo-box p-3 bg-black/10 max-h-64 overflow-y-auto custom-scrollbar space-y-1.5 font-mono text-xs">
          {filteredPerms.length > 0 ? (
            filteredPerms.map((perm, idx) => {
              const runtime = runtimeMap.get(perm);
              const isGranted = runtime?.granted ?? false;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-2 bg-black/20 rounded hover:bg-black/30 transition-all"
                >
                  <div className="truncate flex items-center gap-2">
                    {isGranted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                    <span className="select-all font-semibold truncate">{perm}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={isGranted ? "accent" : "warning"}>
                      {isGranted ? "GRANTED" : "REVOKED"}
                    </Badge>

                    {isGranted ? (
                      <Button
                        size="sm"
                        variant="rose"
                        loading={actionLoading === `revoke_${perm}`}
                        onClick={() => handleRevoke(perm)}
                      >
                        Revoke
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={actionLoading === `grant_${perm}`}
                        onClick={() => handleGrant(perm)}
                      >
                        Grant
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-[11px] text-[var(--neo-text-muted)] italic text-center py-4">
              No matching permissions found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
