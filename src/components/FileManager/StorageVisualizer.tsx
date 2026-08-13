import React from "react";
import { HardDrive } from "lucide-react";
import { StoragePartition } from "../../types/fileManager";

interface StorageVisualizerProps {
  storageList: StoragePartition[];
}

export const StorageVisualizer: React.FC<StorageVisualizerProps> = ({ storageList }) => {
  const mainPartition =
    storageList.find((s) => s.mounted_on === "/sdcard" || s.mounted_on === "/storage/emulated") ||
    storageList[0];

  if (!mainPartition) return null;

  return (
    <div className="neo-box p-3.5 bg-[var(--neo-card-bg)] flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-2 neo-box bg-[var(--neo-primary)] text-[var(--neo-primary-text)] shrink-0">
          <HardDrive className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-[var(--neo-text-muted)]">
            Storage ({mainPartition.mounted_on})
          </div>
          <div className="text-sm font-extrabold text-[var(--neo-text)]">
            {mainPartition.used} used of {mainPartition.size} ({mainPartition.available} free)
          </div>
        </div>
      </div>

      <div className="w-full sm:w-64 space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-[var(--neo-text-muted)]">
          <span>Used</span>
          <span>{mainPartition.use_percent}</span>
        </div>
        <div className="w-full h-3 neo-box bg-[var(--neo-bg)] p-0.5 overflow-hidden">
          <div
            className="h-full bg-[var(--neo-primary)] transition-all duration-500"
            style={{ width: mainPartition.use_percent }}
          />
        </div>
      </div>
    </div>
  );
};
