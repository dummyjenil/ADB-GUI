import { Plus, Eye, Bookmark } from "lucide-react";
import { SpecType } from "./types";

interface AddMappingFormProps {
  activeTab: "forward" | "reverse";
  activeDevice: string | null;
  hostType: SpecType;
  setHostType: (t: SpecType) => void;
  hostVal: string;
  setHostVal: (v: string) => void;
  deviceType: SpecType;
  setDeviceType: (t: SpecType) => void;
  deviceVal: string;
  setDeviceVal: (v: string) => void;
  actionLoading: boolean;
  onAddMapping: () => void;
  onSaveProfile: () => void;
  onViewCommand?: () => void;
  buildSpec: (type: SpecType, val: string) => string;
}

export function AddMappingForm({
  activeTab,
  activeDevice,
  hostType,
  setHostType,
  hostVal,
  setHostVal,
  deviceType,
  setDeviceType,
  deviceVal,
  setDeviceVal,
  actionLoading,
  onAddMapping,
  onSaveProfile,
  onViewCommand,
  buildSpec,
}: AddMappingFormProps) {
  return (
    <div className="neo-box p-4 sm:p-5 bg-[var(--neo-card-bg)] flex flex-col gap-4">
      <div className="flex items-center justify-between border-b-2 border-black/20 pb-3">
        <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
          <Plus className="h-4 w-4 text-[var(--neo-primary)]" />
          <span>Create New {activeTab === "forward" ? "Forward" : "Reverse"} Mapping</span>
        </h3>
        {onViewCommand && (
          <button
            onClick={onViewCommand}
            className="neo-btn px-3 py-1.5 text-xs bg-purple-500/20 text-purple-300 border-purple-500 flex items-center gap-1.5"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>View ADB Command</span>
          </button>
        )}
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Host Spec Configuration */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-black uppercase text-[var(--neo-text-muted)]">
            {activeTab === "forward" ? "Host (PC) Spec" : "Host Target Spec"}
          </label>
          <div className="flex gap-2">
            <select
              value={hostType}
              onChange={(e) => setHostType(e.target.value as SpecType)}
              className="neo-input px-3 py-2 text-xs font-bold bg-[var(--neo-card-bg)] text-[var(--neo-text)] shrink-0 w-36"
            >
              <option value="tcp">tcp:</option>
              <option value="localabstract">localabstract:</option>
              <option value="localreserved">localreserved:</option>
              <option value="localfilesystem">localfilesystem:</option>
              <option value="jdwp">jdwp:</option>
            </select>
            <input
              type="text"
              placeholder={hostType === "tcp" ? "Port (e.g. 6100)" : "Socket name / PID"}
              value={hostVal}
              onChange={(e) => setHostVal(e.target.value)}
              className="neo-input px-3 py-2 text-xs font-mono flex-1"
            />
          </div>
          <p className="text-[10px] text-[var(--neo-text-muted)]">
            Full spec: <code className="text-emerald-400 font-mono">{buildSpec(hostType, hostVal)}</code>
          </p>
        </div>

        {/* Device Spec Configuration */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-black uppercase text-[var(--neo-text-muted)]">
            {activeTab === "forward" ? "Device (Phone) Spec" : "Device Source Spec"}
          </label>
          <div className="flex gap-2">
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as SpecType)}
              className="neo-input px-3 py-2 text-xs font-bold bg-[var(--neo-card-bg)] text-[var(--neo-text)] shrink-0 w-36"
            >
              <option value="tcp">tcp:</option>
              <option value="localabstract">localabstract:</option>
              <option value="localreserved">localreserved:</option>
              <option value="localfilesystem">localfilesystem:</option>
              <option value="jdwp">jdwp:</option>
            </select>
            <input
              type="text"
              placeholder={deviceType === "tcp" ? "Port (e.g. 7100)" : "Socket name / PID"}
              value={deviceVal}
              onChange={(e) => setDeviceVal(e.target.value)}
              className="neo-input px-3 py-2 text-xs font-mono flex-1"
            />
          </div>
          <p className="text-[10px] text-[var(--neo-text-muted)]">
            Full spec: <code className="text-cyan-400 font-mono">{buildSpec(deviceType, deviceVal)}</code>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          onClick={onSaveProfile}
          className="neo-btn px-3 py-2 text-xs bg-amber-500/20 text-amber-300 border-amber-500 flex items-center gap-1.5"
        >
          <Bookmark className="h-3.5 w-3.5" />
          <span>Save Profile</span>
        </button>

        <button
          onClick={onAddMapping}
          disabled={actionLoading || !activeDevice}
          className="neo-btn px-5 py-2 text-xs font-black bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>{activeTab === "forward" ? "+ Add Forward Rule" : "+ Add Reverse Rule"}</span>
        </button>
      </div>
    </div>
  );
}
