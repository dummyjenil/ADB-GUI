import { Trash2 } from "lucide-react";
import { SavedProfile } from "./types";

interface SavedProfilesBarProps {
  profiles: SavedProfile[];
  onApplyProfile: (profile: SavedProfile) => void;
  onDeleteProfile: (id: string) => void;
}

export function SavedProfilesBar({
  profiles,
  onApplyProfile,
  onDeleteProfile,
}: SavedProfilesBarProps) {
  if (profiles.length === 0) return null;

  return (
    <div className="neo-box p-3 bg-black/20 flex flex-col gap-2">
      <div className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">
        Saved Rule Profiles
      </div>
      <div className="flex flex-wrap gap-2">
        {profiles.map((prof) => (
          <div
            key={prof.id}
            className="flex items-center gap-2 bg-[var(--neo-card-bg)] px-3 py-1.5 rounded-lg border-2 border-[var(--neo-border)] text-xs font-bold"
          >
            <span>{prof.name}</span>
            <button
              onClick={() => onApplyProfile(prof)}
              className="text-emerald-400 hover:underline font-extrabold text-[10px]"
            >
              Apply
            </button>
            <button
              onClick={() => onDeleteProfile(prof.id)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
