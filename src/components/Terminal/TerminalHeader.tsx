import React from "react";
import { Select } from "../ui/Select";
import {
  Terminal as TerminalIcon,
  Plus,
  X,
  Trash2,
  Copy,
  Download,
  Smartphone,
  Code,
  RefreshCw,
  Square,
  Check,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { DeviceInfo } from "../Navbar";

export interface OrganicTab {
  id: string;
  title: string;
  targetSerial: string | null;
  sessionId: string;
}

interface TerminalHeaderProps {
  tabs: OrganicTab[];
  activeTabId: string;
  activeTab: OrganicTab;
  devices: DeviceInfo[];
  activeDevice: string | null;
  isConnected: boolean;
  copiedOutput: boolean;
  isFullScreen: boolean;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onSetTabDevice: (serial: string | null) => void;
  onSendCtrlC: () => void;
  onRestartSession: () => void;
  onCopyOutput: () => void;
  onExportSession: () => void;
  onClearOutput: () => void;
  onToggleFullScreen: () => void;
}

export const TerminalHeader: React.FC<TerminalHeaderProps> = ({
  tabs,
  activeTabId,
  activeTab,
  devices,
  activeDevice,
  isConnected,
  copiedOutput,
  isFullScreen,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onSetTabDevice,
  onSendCtrlC,
  onRestartSession,
  onCopyOutput,
  onExportSession,
  onClearOutput,
  onToggleFullScreen,
}) => {
  return (
    <div className="flex flex-col shrink-0 border-b-2 border-[var(--neo-border)] bg-[var(--neo-bg)]">
      {/* Top Action Bar */}
      <div className="p-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80">
        {/* Title & Device Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider text-[var(--neo-primary-text)] bg-[var(--neo-primary)] px-2.5 py-1 border border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]">
            <TerminalIcon className="h-4 w-4" />
            <span>ADB Shell Terminal</span>
          </div>

          {/* Per-tab Device Selector */}
          <div className="flex items-center gap-1.5 text-xs font-bold bg-[var(--neo-card-bg)] px-2.5 py-1 border border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]">
            <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[var(--neo-text-muted)]">Device:</span>
            <Select
              options={[
                { value: "", label: `Default (${activeDevice || "None"})` },
                ...devices.map((d) => ({
                  value: String(d.serial),
                  label: `${d.model} (${d.serial})`,
                })),
              ]}
              value={activeTab?.targetSerial || ""}
              onChange={(val) => onSetTabDevice(val || null)}
              variant="card"
            />
          </div>

          {/* Session Status Badge */}
          <div
            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 border border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)] ${
              isConnected
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                : "bg-amber-500/20 text-amber-300 border-amber-500/50"
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{isConnected ? "PTY Connected" : "Disconnected"}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onSendCtrlC}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-rose-500 text-white flex items-center gap-1 hover:bg-rose-600"
            title="Send Ctrl+C (SIGINT)"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span>Ctrl+C</span>
          </button>

          <button
            onClick={onRestartSession}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-cyan-600 text-white flex items-center gap-1 hover:bg-cyan-700"
            title="Restart ADB shell process"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reconnect</span>
          </button>

          <button
            onClick={onCopyOutput}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-[var(--neo-card-bg)] flex items-center gap-1 hover:bg-slate-700"
            title="Copy terminal buffer or selection"
          >
            {copiedOutput ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copiedOutput ? "Copied!" : "Copy"}</span>
          </button>

          <button
            onClick={onExportSession}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-[var(--neo-card-bg)] flex items-center gap-1 hover:bg-slate-700"
            title="Save session log file"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={onClearOutput}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-amber-400 text-black flex items-center gap-1 hover:bg-amber-500"
            title="Clear active terminal view"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            onClick={onToggleFullScreen}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-purple-600 text-white flex items-center gap-1 hover:bg-purple-700"
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen Mode"}
          >
            {isFullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center bg-slate-950 px-2 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold cursor-pointer border-r border-slate-800 transition-all select-none ${
                isActive
                  ? "bg-[#090d16] text-[var(--neo-primary)] border-t-2 border-t-[var(--neo-primary)] font-black"
                  : "bg-slate-950 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <Code className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => onCloseTab(tab.id, e)}
                  className="hover:bg-red-500/20 hover:text-red-400 rounded p-0.5 ml-1 transition-colors"
                  title="Close tab"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={onAddTab}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors ml-1"
          title="New Terminal Tab"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
