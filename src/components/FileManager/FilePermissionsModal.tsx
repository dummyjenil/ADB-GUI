import React, { useState } from "react";
import { DeviceFile } from "../../types/fileManager";
import { Shield, Check } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Modal, Button, Alert } from "../ui";

interface PermissionsModalProps {
  serial: string;
  file: DeviceFile;
  onClose: () => void;
  onSuccess: () => void;
}

export const FilePermissionsModal: React.FC<PermissionsModalProps> = ({
  serial,
  file,
  onClose,
  onSuccess,
}) => {
  // Parse permissions string like "-rwxr-xr-x" or "755"
  const parsePerms = (str: string) => {
    let u = { r: true, w: true, x: true };
    let g = { r: true, w: false, x: true };
    let o = { r: true, w: false, x: true };

    if (str.length >= 10) {
      u = { r: str[1] === "r", w: str[2] === "w", x: str[3] === "x" };
      g = { r: str[4] === "r", w: str[5] === "w", x: str[6] === "x" };
      o = { r: str[7] === "r", w: str[8] === "w", x: str[9] === "x" };
    }
    return { user: u, group: g, other: o };
  };

  const [perms, setPerms] = useState(parsePerms(file.permissions));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute octal string
  const toOctalDigit = (p: { r: boolean; w: boolean; x: boolean }) => {
    return (p.r ? 4 : 0) + (p.w ? 2 : 0) + (p.x ? 1 : 0);
  };

  const octalMode = `${toOctalDigit(perms.user)}${toOctalDigit(perms.group)}${toOctalDigit(perms.other)}`;

  const handleToggle = (target: "user" | "group" | "other", type: "r" | "w" | "x") => {
    setPerms((prev) => ({
      ...prev,
      [target]: {
        ...prev[target],
        [type]: !prev[target][type],
      },
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke("change_device_file_permissions", {
        serial,
        path: file.path,
        mode: octalMode,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.toString() || "Failed to update permissions");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="File Permissions"
      icon={<Shield className="h-5 w-5 text-[var(--neo-primary)]" />}
      maxWidth="max-w-md"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs font-mono">
            Octal Mode: <span className="font-black text-[var(--neo-primary)]">{octalMode}</span>
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={loading} onClick={handleSave}>
              Apply Permissions
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-[var(--neo-text-muted)]">Target File</div>
          <div className="text-sm font-bold text-[var(--neo-text)] truncate">{file.name}</div>
          <div className="text-[11px] font-mono text-[var(--neo-text-muted)] truncate">{file.path}</div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {/* Matrix Grid */}
        <div className="space-y-3 neo-box p-3 bg-[var(--neo-bg)]">
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-black uppercase text-[var(--neo-text-muted)] border-b border-[var(--neo-border)] pb-2">
            <div>Scope</div>
            <div>Read (r)</div>
            <div>Write (w)</div>
            <div>Exec (x)</div>
          </div>

          {(["user", "group", "other"] as const).map((scope) => (
            <div key={scope} className="grid grid-cols-4 gap-2 items-center text-center text-xs">
              <span className="font-bold capitalize text-left text-[var(--neo-text)] pl-1">
                {scope}
              </span>
              {(["r", "w", "x"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleToggle(scope, type)}
                  className={`neo-btn p-1.5 flex items-center justify-center transition-all ${
                    perms[scope][type]
                      ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] font-black"
                      : "bg-black/10 opacity-50 text-[var(--neo-text-muted)]"
                  }`}
                >
                  {perms[scope][type] ? <Check className="h-4 w-4" /> : "-"}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};
