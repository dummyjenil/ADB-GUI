import { ArrowRight, RefreshCw, Trash2, Copy, Activity, Info } from "lucide-react";
import { Badge } from "../ui/Badge";
import { PortMapping } from "./types";

interface ActiveMappingsTableProps {
  activeTab: "forward" | "reverse";
  activeDevice: string | null;
  mappings: PortMapping[];
  loading: boolean;
  actionLoading: boolean;
  testResults: Record<string, boolean | "testing">;
  onRefresh: () => void;
  onClearAll: () => void;
  onRemoveMapping: (localSpec: string, remoteSpec: string) => void;
  onTestTcpConnection: (spec: string) => void;
  onCopyCommand: (cmd: string) => void;
}

export function ActiveMappingsTable({
  activeTab,
  activeDevice,
  mappings,
  loading,
  actionLoading,
  testResults,
  onRefresh,
  onClearAll,
  onRemoveMapping,
  onTestTcpConnection,
  onCopyCommand,
}: ActiveMappingsTableProps) {
  return (
    <div className="neo-box p-4 bg-[var(--neo-card-bg)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black uppercase tracking-wider">
            Active {activeTab === "forward" ? "Port Forward" : "Port Reverse"} Mappings
          </h3>
          <Badge variant="secondary">{mappings.length}</Badge>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="neo-btn p-2 text-xs bg-black/20 text-[var(--neo-text)]"
            title="Refresh port list"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={onClearAll}
            disabled={actionLoading || mappings.length === 0}
            className="neo-btn px-3 py-1.5 text-xs bg-red-500/20 text-red-300 border-red-500 flex items-center gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      {mappings.length === 0 ? (
        <div className="p-8 text-center bg-black/20 rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center gap-2">
          <Info className="h-8 w-8 text-[var(--neo-text-muted)]" />
          <p className="text-sm font-bold text-[var(--neo-text-muted)]">
            No active {activeTab} port mappings found for {activeDevice || "selected device"}.
          </p>
          <p className="text-xs text-[var(--neo-text-muted)]">
            Use the presets above or form to map host and device ports.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-black/30 bg-black/20 text-[var(--neo-text-muted)] font-black uppercase text-[10px]">
                <th className="p-3">Host Spec</th>
                <th className="p-3 text-center">Direction</th>
                <th className="p-3">Device Spec</th>
                <th className="p-3 text-center">Connection Test</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {mappings.map((mapping, idx) => {
                const testStatus = testResults[mapping.local];
                const isTcpHost = mapping.local.startsWith("tcp:");

                return (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-bold text-emerald-300">
                      {mapping.local}
                    </td>

                    <td className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-sans font-black px-2 py-0.5 bg-black/30 border border-white/10 rounded-full">
                        <span>Host</span>
                        <ArrowRight className="h-3 w-3 text-[var(--neo-primary)]" />
                        <span>Device</span>
                      </span>
                    </td>

                    <td className="p-3 font-bold text-cyan-300">
                      {mapping.remote}
                    </td>

                    <td className="p-3 text-center font-sans">
                      {isTcpHost ? (
                        <div className="flex items-center justify-center gap-2">
                          {testStatus === "testing" ? (
                            <Badge variant="warning">
                              <RefreshCw className="h-3 w-3 animate-spin inline mr-1" />
                              Testing...
                            </Badge>
                          ) : testStatus === true ? (
                            <Badge variant="success">Active (127.0.0.1)</Badge>
                          ) : testStatus === false ? (
                            <Badge variant="danger">Inactive</Badge>
                          ) : (
                            <button
                              onClick={() => onTestTcpConnection(mapping.local)}
                              className="neo-btn px-2 py-1 text-[10px] bg-black/30 text-[var(--neo-text-muted)] hover:text-white flex items-center gap-1"
                            >
                              <Activity className="h-3 w-3 text-emerald-400" />
                              <span>Test TCP</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[var(--neo-text-muted)] font-sans">N/A (Domain Socket)</span>
                      )}
                    </td>

                    <td className="p-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            const cmd =
                              activeTab === "forward"
                                ? `adb -s ${activeDevice} forward ${mapping.local} ${mapping.remote}`
                                : `adb -s ${activeDevice} reverse ${mapping.remote} ${mapping.local}`;
                            onCopyCommand(cmd);
                          }}
                          className="neo-btn p-1.5 bg-black/30 text-[var(--neo-text-muted)] hover:text-white"
                          title="Copy ADB command"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => onRemoveMapping(mapping.local, mapping.remote)}
                          disabled={actionLoading}
                          className="neo-btn px-2.5 py-1 text-xs bg-red-500/20 text-red-300 border-red-500 flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
