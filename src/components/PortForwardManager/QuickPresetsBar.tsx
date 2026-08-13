import { Zap } from "lucide-react";
import { Badge } from "../ui/Badge";
import { PresetItem } from "./types";
import { PRESETS } from "./presets";

interface QuickPresetsBarProps {
  onApplyPreset: (preset: PresetItem) => void;
}

export function QuickPresetsBar({ onApplyPreset }: QuickPresetsBarProps) {
  return (
    <div className="neo-box p-4 bg-[var(--neo-card-bg)] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-[var(--neo-primary)]">
          <Zap className="h-4 w-4" />
          <span>Quick Setup Presets</span>
        </div>
        <span className="text-[11px] font-bold text-[var(--neo-text-muted)]">
          1-Click fill common dev configs
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onApplyPreset(preset)}
            className="neo-btn p-3 bg-black/20 hover:bg-[var(--neo-card-bg)] text-left flex flex-col gap-1.5 transition-all text-xs"
          >
            <div className="flex items-center justify-between font-black">
              <span className="flex items-center gap-1.5 text-sm">
                <span>{preset.icon}</span>
                <span>{preset.name}</span>
              </span>
              <Badge variant={preset.mode === "forward" ? "primary" : "accent"}>
                {preset.mode.toUpperCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--neo-text-muted)] font-semibold line-clamp-1">
              {preset.description}
            </p>
            <div className="text-[10px] font-mono bg-black/30 px-2 py-1 rounded border border-white/10 text-emerald-300 mt-0.5">
              {preset.hostType}:{preset.hostValue} {preset.mode === "forward" ? "➔" : "⬅"} {preset.deviceType}:{preset.deviceValue}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
