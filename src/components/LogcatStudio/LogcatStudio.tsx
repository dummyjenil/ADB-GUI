import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  Package,
  Layers,
  ArrowDownCircle,
  FileText,
  Save,
  Check,
  Terminal,
  RefreshCw,
  Copy,
  X,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Select, SelectOption } from "../ui/Select";
import { Input } from "../ui/Input";
import {
  LogcatEntry,
  LogcatFilterConfig,
  LogPriority,
  LogBuffer,
  PackageProcessInfo,
  ExportFormat,
} from "../../types/logcat";

interface LogcatStudioProps {
  activeDevice: string | null;
  initialPackage?: string | null;
}

const MAX_IN_MEMORY_LOGS = 2000;

export const LogcatStudio: React.FC<LogcatStudioProps> = ({ activeDevice, initialPackage }) => {
  // Streaming state - Default is PAUSED
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  // Buffer state
  const [logs, setLogs] = useState<LogcatEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogcatEntry | null>(null);

  // Filters
  const [selectedBuffer, setSelectedBuffer] = useState<LogBuffer>("all");
  const [minPriority, setMinPriority] = useState<LogPriority>("ALL");
  const [selectedPackage, setSelectedPackage] = useState<string>(initialPackage || "all");

  useEffect(() => {
    if (initialPackage) {
      setSelectedPackage(initialPackage);
    }
  }, [initialPackage]);

  const [tagFilter, setTagFilter] = useState<string>("");
  const [pidFilter, setPidFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRegex, setIsRegex] = useState<boolean>(false);

  // Searchable package picker popover state
  const [pkgSearchInput, setPkgSearchInput] = useState<string>("");
  const [isPkgMenuOpen, setIsPkgMenuOpen] = useState<boolean>(false);

  // Process list
  const [processes, setProcesses] = useState<PackageProcessInfo[]>([]);
  const [loadingProcesses, setLoadingProcesses] = useState<boolean>(false);

  // UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [filterWarning, setFilterWarning] = useState<string | null>(null);

  const listContainerRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>(`logcat-${Date.now()}`);
  const incomingQueueRef = useRef<LogcatEntry[]>([]);
  const isPausedRef = useRef<boolean>(true);
  isPausedRef.current = isPaused;

  const pkgMenuRef = useRef<HTMLDivElement>(null);

  // Close package menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pkgMenuRef.current && !pkgMenuRef.current.contains(e.target as Node)) {
        setIsPkgMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch process list from device
  const fetchProcesses = useCallback(async () => {
    if (!activeDevice) return;
    setLoadingProcesses(true);
    try {
      const plist: PackageProcessInfo[] = await invoke("get_device_processes", {
        serial: activeDevice,
      });
      const uniqueProcesses = plist.reduce<PackageProcessInfo[]>((acc, current) => {
        if (!acc.some((item) => item.package_name === current.package_name)) {
          acc.push(current);
        }
        return acc;
      }, []);
      uniqueProcesses.sort((a, b) => a.package_name.localeCompare(b.package_name));
      setProcesses(uniqueProcesses);
    } catch (err) {
      console.error("Failed to fetch device process list:", err);
    } finally {
      setLoadingProcesses(false);
    }
  }, [activeDevice]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // Selected PID from package name
  const selectedPid = useMemo(() => {
    if (selectedPackage === "all") return undefined;
    const p = processes.find((item) => item.package_name === selectedPackage);
    return p ? p.pid : undefined;
  }, [selectedPackage, processes]);

  // Filtered package list for Searchable Picker
  const filteredProcesses = useMemo(() => {
    if (!pkgSearchInput.trim()) return processes;
    const q = pkgSearchInput.trim().toLowerCase();
    return processes.filter(
      (p) => p.package_name.toLowerCase().includes(q) || String(p.pid).includes(q)
    );
  }, [processes, pkgSearchInput]);

  // Start stream helper with mobile-side grep & native filtering
  const startStreamInternal = useCallback(
    async (
      bufferVal: LogBuffer,
      priorityVal: LogPriority,
      pidVal?: number,
      pkgVal?: string,
      tagVal?: string,
      searchVal?: string,
      regexVal?: boolean,
      clearHistoryVal?: boolean
    ) => {
      if (!activeDevice) return;

      setFilterWarning(null);

      const filterConfig: LogcatFilterConfig = {
        buffers: bufferVal === "all" ? ["main", "system", "crash", "events", "radio"] : [bufferVal],
        min_priority: priorityVal,
        pid: pidVal,
        package_name: pkgVal === "all" ? undefined : pkgVal,
        tag: tagVal?.trim() || undefined,
        search: searchVal?.trim() || undefined,
        is_regex: regexVal,
        clear_history: clearHistoryVal,
      };

      try {
        await invoke("start_logcat_stream", {
          serial: activeDevice,
          sessionId: sessionIdRef.current,
          filter: filterConfig,
        });
        setIsStreaming(true);
        setIsPaused(false);
      } catch (err) {
        console.error("Failed to start logcat stream:", err);
      }
    },
    [activeDevice]
  );

  // Stop stream helper
  const stopStream = useCallback(async () => {
    try {
      await invoke("stop_logcat_stream", {
        sessionId: sessionIdRef.current,
      });
    } catch (err) {
      console.error("Failed to stop logcat stream:", err);
    } finally {
      setIsStreaming(false);
      setIsPaused(true);
    }
  }, []);

  // Flush incoming log queue into React state every 150ms to prevent DOM freeze
  useEffect(() => {
    const timer = setInterval(() => {
      if (incomingQueueRef.current.length === 0 || isPausedRef.current) return;

      const chunk = incomingQueueRef.current;
      incomingQueueRef.current = [];

      setLogs((prev) => {
        const next = [...prev, ...chunk];
        if (next.length > MAX_IN_MEMORY_LOGS) {
          return next.slice(next.length - MAX_IN_MEMORY_LOGS);
        }
        return next;
      });
    }, 150);

    return () => clearInterval(timer);
  }, []);

  // Listen to incoming logcat stream IPC batches from Rust
  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen<{ session_id: string; entries: LogcatEntry[] }>(
        "logcat-batch-stream",
        (event) => {
          if (event.payload.session_id !== sessionIdRef.current) return;
          if (isPausedRef.current) return;
          incomingQueueRef.current.push(...event.payload.entries);
        }
      );
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && !isPaused && listContainerRef.current) {
      listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll, isPaused]);

  // Cleanup on unmount or activeDevice change
  useEffect(() => {
    return () => {
      invoke("stop_logcat_stream", { sessionId: sessionIdRef.current });
    };
  }, [activeDevice]);

  // Handle Play/Pause toggle with restriction check
  const togglePlayPause = () => {
    if (isPaused) {
      const hasAppFilter = selectedPackage !== "all" || selectedPid !== undefined;
      const hasSearchFilter = searchQuery.trim().length > 0 || tagFilter.trim().length > 0 || pidFilter.trim().length > 0;

      if (!hasAppFilter && !hasSearchFilter && selectedBuffer === "all") {
        setFilterWarning("Please select an App / Package or enter a Tag / Search filter to start streaming.");
        return;
      }

      startStreamInternal(
        selectedBuffer,
        minPriority,
        selectedPid,
        selectedPackage,
        tagFilter,
        searchQuery,
        isRegex,
        false
      );
    } else {
      stopStream();
    }
  };

  // Handle filter changes when user updates dropdowns or search fields
  const applyMobileFilters = (
    newBuffer = selectedBuffer,
    newPriority = minPriority,
    newPackage = selectedPackage,
    newTag = tagFilter,
    newSearch = searchQuery,
    newRegex = isRegex
  ) => {
    const pidVal = newPackage === "all" ? undefined : processes.find((p) => p.package_name === newPackage)?.pid;
    if (isStreaming && !isPaused) {
      startStreamInternal(newBuffer, newPriority, pidVal, newPackage, newTag, newSearch, newRegex, false);
    }
  };

  // Clear logs action with instant impact
  const handleClear = async () => {
    incomingQueueRef.current = [];
    setLogs([]);
    if (activeDevice) {
      try {
        await invoke("clear_logcat_buffer", { serial: activeDevice });
      } catch (err) {
        console.error("Failed to clear device logcat buffer:", err);
      }
    }
    if (isStreaming && !isPaused) {
      startStreamInternal(
        selectedBuffer,
        minPriority,
        selectedPid,
        selectedPackage,
        tagFilter,
        searchQuery,
        isRegex,
        true // clearHistory = true (-T 1)
      );
    }
  };

  // Strict local package filtering as secondary safety net
  const filteredLogs = useMemo(() => {
    let result = logs;

    if (selectedPackage !== "all") {
      result = result.filter((l) => {
        if (l.package_name) {
          return l.package_name === selectedPackage;
        }
        if (selectedPid) {
          return l.pid === selectedPid;
        }
        return false;
      });
    }

    if (tagFilter.trim()) {
      const lowerTag = tagFilter.trim().toLowerCase();
      result = result.filter((l) => l.tag.toLowerCase().includes(lowerTag));
    }

    if (pidFilter.trim()) {
      const numPid = parseInt(pidFilter.trim(), 10);
      if (!isNaN(numPid)) {
        result = result.filter((l) => l.pid === numPid);
      }
    }

    if (searchQuery.trim()) {
      if (isRegex) {
        try {
          const reg = new RegExp(searchQuery, "i");
          result = result.filter((l) => reg.test(l.message) || reg.test(l.tag) || reg.test(l.raw));
        } catch {
          // Invalid regex, ignore
        }
      } else {
        const lowerSearch = searchQuery.trim().toLowerCase();
        result = result.filter(
          (l) =>
            l.message.toLowerCase().includes(lowerSearch) ||
            l.tag.toLowerCase().includes(lowerSearch) ||
            l.raw.toLowerCase().includes(lowerSearch)
        );
      }
    }

    return result;
  }, [logs, selectedPackage, selectedPid, tagFilter, pidFilter, searchQuery, isRegex]);

  // Export logs handler
  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    setExportMessage(null);
    try {
      const path: string | null = await invoke("pick_save_directory");
      if (!path) {
        setExporting(false);
        return;
      }
      const fileName = `logcat_export_${Date.now()}.${format}`;
      const fullPath = `${path}/${fileName}`;

      await invoke("export_logcat_file", {
        logs: filteredLogs,
        formatType: format,
        filePath: fullPath,
      });

      setExportMessage(`Saved ${filteredLogs.length} logs to ${fileName}`);
      setTimeout(() => setExportMessage(null), 4000);
    } catch (err) {
      console.error("Export failed:", err);
      setExportMessage(`Export error: ${String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  // Priority badge helper
  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case "E":
      case "F":
        return <Badge variant="danger">ERR</Badge>;
      case "W":
        return <Badge variant="warning">WARN</Badge>;
      case "I":
        return <Badge variant="success">INFO</Badge>;
      case "D":
        return <Badge variant="accent">DBG</Badge>;
      default:
        return <Badge variant="secondary">VRB</Badge>;
    }
  };

  // Buffer options for Select component
  const bufferOptions: SelectOption[] = [
    { value: "all", label: "All Buffers", sublabel: "main, system, crash, events, radio" },
    { value: "main", label: "Main Buffer", sublabel: "Main application logs" },
    { value: "system", label: "System Buffer", sublabel: "Android system framework logs" },
    { value: "crash", label: "Crash Buffer", sublabel: "Fatal app crashes & ANR stack traces" },
    { value: "events", label: "Events Buffer", sublabel: "Binary event messages" },
    { value: "radio", label: "Radio Buffer", sublabel: "Telephony and radio stack logs" },
  ];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!activeDevice) {
    return (
      <div className="neo-box p-8 text-center bg-[var(--neo-card-bg)]">
        <Terminal className="h-12 w-12 mx-auto text-[var(--neo-text-muted)] mb-3" />
        <h2 className="text-lg font-black text-[var(--neo-text)] uppercase">No Device Selected</h2>
        <p className="text-xs text-[var(--neo-text-muted)] mt-1 font-mono">
          Please select a connected Android device from the top bar to use Logcat Studio.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-140px)] min-h-[600px]">
      {/* Top Header & Controls Bar */}
      <div className="neo-box p-3.5 bg-[var(--neo-card-bg)] flex flex-col gap-3 shrink-0">
        {/* Row 1: Title, Live Status, Stream Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 neo-btn bg-[var(--neo-accent)] text-[var(--neo-accent-text)] flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase text-[var(--neo-text)] tracking-tight">
                  📜 Logcat Studio
                </h2>
                <Badge variant={isPaused ? "warning" : "success"}>
                  {isPaused ? "Paused" : "Live Streaming"}
                </Badge>
                {isRecording && <Badge variant="danger">Recording Session</Badge>}
              </div>
              <p className="text-[10px] text-[var(--neo-text-muted)] font-mono">
                Mobile Linux Native Filter & Grep Engine • {filteredLogs.length.toLocaleString()} Entries
              </p>
            </div>
          </div>

          {/* Action Buttons: Play/Pause, Clear, Auto-scroll, Export */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={togglePlayPause}
              variant={isPaused ? "primary" : "amber"}
              size="sm"
              icon={isPaused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4" />}
            >
              {isPaused ? "Play Stream" : "Pause"}
            </Button>

            <Button
              onClick={handleClear}
              variant="outline"
              size="sm"
              icon={<Trash2 className="h-3.5 w-3.5 text-rose-400" />}
              title="Clear logcat buffer on device & screen"
            >
              Clear
            </Button>

            <Button
              onClick={() => setAutoScroll((prev) => !prev)}
              variant={autoScroll ? "secondary" : "ghost"}
              size="sm"
              icon={<ArrowDownCircle className={`h-3.5 w-3.5 ${autoScroll ? "text-emerald-400" : ""}`} />}
            >
              {autoScroll ? "Auto-Scroll ON" : "Auto-Scroll OFF"}
            </Button>

            <Button
              onClick={() => setIsRecording((prev) => !prev)}
              variant={isRecording ? "rose" : "ghost"}
              size="sm"
              icon={<Save className="h-3.5 w-3.5" />}
            >
              {isRecording ? "Rec Active" : "Record Session"}
            </Button>

            {/* Export Menu */}
            <div className="flex items-center gap-1 border-l-2 border-[var(--neo-border)] pl-2">
              <Button
                onClick={() => handleExport("txt")}
                loading={exporting}
                variant="ghost"
                size="sm"
                icon={<Download className="h-3.5 w-3.5" />}
                title="Export as TXT file"
              >
                TXT
              </Button>
              <Button
                onClick={() => handleExport("json")}
                loading={exporting}
                variant="ghost"
                size="sm"
                title="Export as JSON file"
              >
                JSON
              </Button>
              <Button
                onClick={() => handleExport("csv")}
                loading={exporting}
                variant="ghost"
                size="sm"
                title="Export as CSV file"
              >
                CSV
              </Button>
            </div>
          </div>
        </div>

        {filterWarning && (
          <div className="p-2.5 text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500 rounded-md flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{filterWarning}</span>
          </div>
        )}

        {/* Row 2: Filter Toolbar (Mobile-Side Native Filters) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-black/10 dark:border-white/10">
          {/* Custom Searchable App / Package Picker Dropdown */}
          <div className="flex flex-col gap-1 relative" ref={pkgMenuRef}>
            <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3 text-emerald-400" /> Searchable App Picker
              </span>
              <button
                onClick={fetchProcesses}
                disabled={loadingProcesses}
                className="text-[9px] text-emerald-400 hover:underline font-mono"
              >
                {loadingProcesses ? "Syncing..." : "Sync PIDs"}
              </button>
            </span>

            {/* Custom Dropdown Trigger Button */}
            <button
              onClick={() => setIsPkgMenuOpen((prev) => !prev)}
              className="neo-btn px-3 py-2 text-xs font-bold flex items-center justify-between gap-2 bg-[var(--neo-card-bg)] text-[var(--neo-text)] border-[var(--neo-border)]"
            >
              <span className="truncate text-left font-mono font-extrabold text-emerald-400">
                {selectedPackage === "all" ? "All Packages / Apps" : selectedPackage}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
            </button>

            {/* Searchable Popover Menu */}
            {isPkgMenuOpen && (
              <div className="absolute top-full left-0 w-full mt-1 z-50 neo-box p-2 bg-[var(--neo-card-bg)] shadow-xl flex flex-col gap-1.5 max-h-64">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-[var(--neo-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Search package name or PID..."
                    value={pkgSearchInput}
                    onChange={(e) => setPkgSearchInput(e.target.value)}
                    className="w-full bg-black/20 border border-[var(--neo-border)] rounded px-8 py-1 text-xs font-mono text-[var(--neo-text)] focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 max-h-48 font-mono text-xs">
                  <button
                    onClick={() => {
                      setSelectedPackage("all");
                      setIsPkgMenuOpen(false);
                      applyMobileFilters(selectedBuffer, minPriority, "all");
                    }}
                    className={`px-2.5 py-1.5 text-left rounded font-bold flex items-center justify-between ${
                      selectedPackage === "all" ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]" : "hover:bg-white/10"
                    }`}
                  >
                    <span>All Packages</span>
                    <span className="text-[10px] opacity-75">Unrestricted</span>
                  </button>

                  {filteredProcesses.map((p) => (
                    <button
                      key={`${p.package_name}-${p.pid}`}
                      onClick={() => {
                        setSelectedPackage(p.package_name);
                        setIsPkgMenuOpen(false);
                        applyMobileFilters(selectedBuffer, minPriority, p.package_name);
                      }}
                      className={`px-2.5 py-1.5 text-left rounded flex items-center justify-between ${
                        selectedPackage === p.package_name
                          ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] font-bold"
                          : "hover:bg-white/10 text-[var(--neo-text)]"
                      }`}
                    >
                      <span className="truncate mr-2 font-semibold">{p.package_name}</span>
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0">PID {p.pid}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Buffer Selector */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] flex items-center gap-1">
              <Layers className="h-3 w-3 text-amber-400" /> Buffer (-b)
            </span>
            <Select
              options={bufferOptions}
              value={selectedBuffer}
              onChange={(val) => {
                const b = val as LogBuffer;
                setSelectedBuffer(b);
                applyMobileFilters(b, minPriority, selectedPackage);
              }}
              variant="accent"
            />
          </div>

          {/* Search Query Input (Piped directly to mobile grep) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Search className="h-3 w-3 text-cyan-400" /> Mobile Grep Search
              </span>
              <button
                onClick={() => {
                  const nextReg = !isRegex;
                  setIsRegex(nextReg);
                  applyMobileFilters(selectedBuffer, minPriority, selectedPackage, tagFilter, searchQuery, nextReg);
                }}
                className={`text-[9px] font-mono px-1 rounded ${
                  isRegex ? "bg-amber-400 text-black font-bold" : "text-[var(--neo-text-muted)] hover:text-white"
                }`}
              >
                REGEX {isRegex ? "ON" : "OFF"}
              </button>
            </span>
            <Input
              type="text"
              placeholder={isRegex ? "Regex pattern e.g. ^Activity..." : "Grep search text..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applyMobileFilters(selectedBuffer, minPriority, selectedPackage, tagFilter, searchQuery, isRegex);
                }
              }}
              className="py-1 text-xs font-mono"
            />
          </div>

          {/* Tag / PID Quick Filters */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Tag Filter</span>
              <Input
                type="text"
                placeholder="Tag"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyMobileFilters(selectedBuffer, minPriority, selectedPackage, tagFilter, searchQuery, isRegex);
                  }
                }}
                className="py-1 text-xs font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">PID</span>
              <Input
                type="text"
                placeholder="PID"
                value={pidFilter}
                onChange={(e) => setPidFilter(e.target.value)}
                className="py-1 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Priority Selector Bar (*:Priority specification) */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] mr-1">
              Priority Filter:
            </span>
            {(["ALL", "VERBOSE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const).map((p) => {
              const code = p === "ALL" ? "ALL" : p[0];
              const isSel = minPriority === code;
              return (
                <button
                  key={p}
                  onClick={() => {
                    setMinPriority(code as LogPriority);
                    applyMobileFilters(selectedBuffer, code as LogPriority, selectedPackage);
                  }}
                  className={`neo-btn px-2.5 py-1 text-[10px] font-extrabold uppercase transition-all ${
                    isSel
                      ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                      : "bg-transparent text-[var(--neo-text-muted)] hover:text-[var(--neo-text)] border-transparent shadow-none"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <Button
            onClick={() => applyMobileFilters()}
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="h-3 w-3" />}
            title="Apply all active mobile-side filters"
          >
            Apply Filters
          </Button>
        </div>

        {exportMessage && (
          <div className="p-2 text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500 rounded-md">
            {exportMessage}
          </div>
        )}
      </div>

      {/* Main Log Table View */}
      <div className="flex-1 neo-box p-0 bg-[var(--neo-card-bg)] flex flex-col overflow-hidden relative">
        {/* Log Table Header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-black/30 text-[10px] font-black uppercase tracking-wider text-[var(--neo-text-muted)] border-b border-[var(--neo-border)] shrink-0">
          <div className="col-span-2">Time</div>
          <div className="col-span-1 text-center">Priority</div>
          <div className="col-span-2">PID / TID</div>
          <div className="col-span-2 truncate">Tag / Package</div>
          <div className="col-span-5">Message</div>
        </div>

        {/* Scrollable Container */}
        <div
          ref={listContainerRef}
          className="flex-1 overflow-y-auto font-mono text-xs custom-scrollbar divide-y divide-white/5"
        >
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-[var(--neo-text-muted)]">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="font-bold text-sm">No Log Entries Found</p>
              <p className="text-xs mt-1">
                {isPaused
                  ? "Logcat stream is currently PAUSED. Select an App or enter a search query, then click 'PLAY STREAM'."
                  : "Waiting for mobile-side adb shell logcat | grep entries matching current filters..."}
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isError = log.priority === "E" || log.priority === "F";
              const isWarn = log.priority === "W";
              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className={`grid grid-cols-12 gap-2 px-3 py-1.5 items-baseline hover:bg-white/10 cursor-pointer transition-colors ${
                    isError
                      ? "bg-rose-500/10 text-rose-300 font-semibold"
                      : isWarn
                      ? "bg-amber-400/10 text-amber-300"
                      : "text-[var(--neo-text)]"
                  }`}
                >
                  {/* Timestamp */}
                  <div className="col-span-2 text-[11px] opacity-75 shrink-0 whitespace-nowrap">
                    {log.timestamp}
                  </div>

                  {/* Priority Tag */}
                  <div className="col-span-1 text-center">{renderPriorityBadge(log.priority)}</div>

                  {/* PID / TID */}
                  <div className="col-span-2 text-[11px] text-[var(--neo-text-muted)] truncate">
                    {log.pid}:{log.tid}
                  </div>

                  {/* Tag / Package Name */}
                  <div className="col-span-2 truncate font-bold">
                    <span title={log.package_name || log.tag}>
                      {log.package_name ? (
                        <span className="text-emerald-400">{log.package_name}</span>
                      ) : (
                        log.tag
                      )}
                    </span>
                  </div>

                  {/* Message Content */}
                  <div className="col-span-5 truncate text-xs break-all">
                    {log.message}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Log Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="neo-box max-w-3xl w-full bg-[var(--neo-card-bg)] p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--neo-border)]">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[var(--neo-accent)]" />
                <h3 className="text-base font-black text-[var(--neo-text)] uppercase">
                  Log Entry Inspector
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="neo-btn p-1 text-[var(--neo-text-muted)] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="neo-box p-2 bg-black/20">
                <span className="text-[10px] text-[var(--neo-text-muted)] block uppercase">Priority</span>
                <div className="mt-1">{renderPriorityBadge(selectedLog.priority)}</div>
              </div>
              <div className="neo-box p-2 bg-black/20">
                <span className="text-[10px] text-[var(--neo-text-muted)] block uppercase">Timestamp</span>
                <div className="mt-1 font-bold text-[var(--neo-text)]">{selectedLog.timestamp}</div>
              </div>
              <div className="neo-box p-2 bg-black/20">
                <span className="text-[10px] text-[var(--neo-text-muted)] block uppercase">PID / TID</span>
                <div className="mt-1 font-bold text-[var(--neo-text)]">
                  {selectedLog.pid} / {selectedLog.tid}
                </div>
              </div>
              <div className="neo-box p-2 bg-black/20">
                <span className="text-[10px] text-[var(--neo-text-muted)] block uppercase">Tag</span>
                <div className="mt-1 font-bold text-amber-400">{selectedLog.tag}</div>
              </div>
            </div>

            {selectedLog.package_name && (
              <div className="neo-box p-2 bg-emerald-500/10 border-emerald-500/30 text-xs font-mono">
                <span className="text-[10px] text-emerald-400 block uppercase font-bold">Matched Package</span>
                <div className="mt-0.5 text-emerald-300 font-bold">{selectedLog.package_name}</div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Log Message</span>
              <pre className="neo-box p-3 bg-black/40 text-xs font-mono whitespace-pre-wrap break-all text-[var(--neo-text)] max-h-60 overflow-y-auto">
                {selectedLog.message}
              </pre>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Raw Logcat Line</span>
              <pre className="neo-box p-3 bg-black/60 text-[11px] font-mono whitespace-pre-wrap break-all text-zinc-400 max-h-40 overflow-y-auto">
                {selectedLog.raw}
              </pre>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--neo-border)]">
              <Button
                onClick={() => copyToClipboard(selectedLog.raw, selectedLog.id)}
                variant="primary"
                size="sm"
                icon={copiedId === selectedLog.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              >
                {copiedId === selectedLog.id ? "Copied Raw Log!" : "Copy Raw Log"}
              </Button>
              <Button onClick={() => setSelectedLog(null)} variant="ghost" size="sm">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
