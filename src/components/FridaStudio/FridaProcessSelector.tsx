import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Target, RefreshCw, Smartphone, Sparkles, Activity } from "lucide-react";
import { Button, Badge, SearchInput, Alert } from "../ui";
import { FridaProcessInfo } from "../../types/frida";

interface FridaProcessSelectorProps {
  activeDevice: string | null;
  selectedTarget: string | null;
  isSpawn: boolean;
  onSelectTarget: (target: string, isSpawn: boolean) => void;
}

export const FridaProcessSelector: React.FC<FridaProcessSelectorProps> = ({
  activeDevice,
  selectedTarget,
  isSpawn,
  onSelectTarget,
}) => {
  const [processes, setProcesses] = useState<FridaProcessInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [customTarget, setCustomTarget] = useState("");

  const fetchProcesses = async () => {
    if (!activeDevice) return;
    setLoading(true);
    setError(null);
    try {
      const list: FridaProcessInfo[] = await invoke("list_frida_processes", {
        serial: activeDevice,
      });
      setProcesses(list);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err.message || "Failed to list device processes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
  }, [activeDevice]);

  const filtered = useMemo(() => {
    if (!search.trim()) return processes;
    const q = search.toLowerCase();
    return processes.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.identifier.toLowerCase().includes(q) ||
        String(p.pid).includes(q)
    );
  }, [processes, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-purple-400" />
            Target App & Process Selector
          </h2>
          <p className="text-xs text-[var(--neo-text-muted)] font-mono mt-1">
            Choose a running target to <strong className="text-[var(--neo-text)]">Attach</strong> or specify a package to <strong className="text-[var(--neo-text)]">Spawn</strong> on startup.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={fetchProcesses}
            loading={loading}
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh List
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* Selected Target Summary Banner */}
      <div className="p-3.5 neo-box bg-[var(--neo-card-bg)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-2 border-purple-400">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 neo-btn bg-purple-500 text-white flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-[var(--neo-text-muted)]">
              Active Injection Target
            </div>
            <div className="text-sm font-black font-mono flex items-center gap-2">
              {selectedTarget ? (
                <>
                  <span className="text-purple-400">{selectedTarget}</span>
                  <Badge variant={isSpawn ? "primary" : "accent"}>
                    {isSpawn ? "SPAWN MODE" : "ATTACH MODE"}
                  </Badge>
                </>
              ) : (
                <span className="text-[var(--neo-text-muted)] italic">None Selected</span>
              )}
            </div>
          </div>
        </div>

        {/* Custom Target Input */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Custom Package (e.g. com.example.app)"
            value={customTarget}
            onChange={(e) => setCustomTarget(e.target.value)}
            className="neo-input text-xs font-mono py-1.5 px-3 w-full md:w-64"
          />
          <Button
            size="sm"
            variant="primary"
            disabled={!customTarget.trim()}
            onClick={() => {
              if (customTarget.trim()) {
                onSelectTarget(customTarget.trim(), true);
                setCustomTarget("");
              }
            }}
          >
            Spawn Custom
          </Button>
          <Button
            size="sm"
            variant="accent"
            title="Attach to libfrida-gadget.so embedded in non-rooted APK"
            onClick={() => onSelectTarget("Gadget", false)}
          >
            ⚡ Gadget Target
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search processes by Name, Package or PID..."
          />
        </div>
      </div>

      {/* Process Table List */}
      <div className="neo-box bg-[var(--neo-card-bg)] overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto custom-scrollbar divide-y divide-black/10">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--neo-text-muted)]">
              {loading ? "Loading processes from device..." : "No matching processes found."}
            </div>
          ) : (
            filtered.map((proc) => {
              const isSelected = selectedTarget === proc.name || selectedTarget === String(proc.pid);
              return (
                <div
                  key={proc.pid}
                  className={`p-3 flex items-center justify-between gap-3 hover:bg-black/5 transition-colors ${isSelected ? "bg-purple-500/10 border-l-4 border-purple-500" : ""
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded neo-btn bg-black/10 flex items-center justify-center shrink-0">
                      <Smartphone className="h-4 w-4 text-[var(--neo-text-muted)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs truncate max-w-[280px] sm:max-w-md">
                          {proc.name}
                        </span>
                        {proc.is_frontmost && (
                          <Badge variant="accent" icon={<Sparkles className="h-3 w-3" />}>
                            FRONTMOST
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--neo-text-muted)] flex items-center gap-2">
                        <span>PID: <strong className="text-[var(--neo-text)]">{proc.pid}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant={isSelected && !isSpawn ? "accent" : "secondary"}
                      onClick={() => onSelectTarget(proc.name, false)}
                      title="Attach to running process"
                    >
                      Attach
                    </Button>
                    <Button
                      size="sm"
                      variant={isSelected && isSpawn ? "primary" : "ghost"}
                      onClick={() => onSelectTarget(proc.name, true)}
                      title="Cold spawn process on start"
                    >
                      Spawn
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
