import React from "react";
import { PRESET_PATHS } from "./fileManagerUtils";

interface PresetPathsBarProps {
  currentPath: string;
  onSelectPath: (path: string) => void;
}

export const PresetPathsBar: React.FC<PresetPathsBarProps> = ({ currentPath, onSelectPath }) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
      {PRESET_PATHS.map((preset) => (
        <button
          key={preset.path}
          onClick={() => onSelectPath(preset.path)}
          className={`neo-btn shrink-0 px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all ${
            currentPath === preset.path
              ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]"
              : "bg-[var(--neo-card-bg)] text-[var(--neo-text)] hover:bg-black/10"
          }`}
        >
          {preset.icon}
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
};
