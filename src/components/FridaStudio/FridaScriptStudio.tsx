import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Play, Square, Trash2, Download, Terminal, Code2, Copy, Check } from "lucide-react";
import { Button, Alert } from "../ui";
import { FridaLogMessage } from "../../types/frida";

interface FridaScriptStudioProps {
  activeDevice: string | null;
  selectedTarget: string | null;
  isSpawn: boolean;
  scriptContent: string;
  onScriptChange: (val: string) => void;
  onToggleSpawn: (val: boolean) => void;
}

export const FridaScriptStudio: React.FC<FridaScriptStudioProps> = ({
  activeDevice,
  selectedTarget,
  isSpawn,
  scriptContent,
  onScriptChange,
  onToggleSpawn,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [logs, setLogs] = useState<FridaLogMessage[]>([]);
  const [logFilter, setLogFilter] = useState<string>("all");
  const [logSearch, setLogSearch] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Listen to Tauri live logs
  useEffect(() => {
    if (!currentSessionId) return;

    const eventName = `frida-log-event-${currentSessionId}`;
    let unlistenFn: (() => void) | null = null;

    listen<FridaLogMessage>(eventName, (event) => {
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          session_id: event.payload.session_id,
          level: event.payload.level,
          message: event.payload.message,
          timestamp: event.payload.timestamp || Date.now(),
        },
      ]);
    }).then((unlisten) => {
      unlistenFn = unlisten;
    });

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [currentSessionId]);

  const handleRunScript = async () => {
    if (!activeDevice || !selectedTarget) {
      setErrorMsg("Please select a valid device and target process first.");
      return;
    }

    const sessionId = `session_${Date.now()}`;
    setErrorMsg(null);
    setIsRunning(true);
    setCurrentSessionId(sessionId);

    // Initial starting log
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        session_id: sessionId,
        level: "status",
        message: `[🚀] Launching Frida (${isSpawn ? "SPAWN" : "ATTACH"}) on target: ${selectedTarget}`,
        timestamp: Date.now(),
      },
    ]);

    try {
      await invoke("run_frida_script", {
        serial: activeDevice,
        target: selectedTarget,
        scriptCode: scriptContent,
        isSpawn,
        sessionId,
      });
    } catch (err: any) {
      setErrorMsg(typeof err === "string" ? err : err.message || "Failed to inject script");
      setIsRunning(false);
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          session_id: sessionId,
          level: "error",
          message: `[!] Error: ${typeof err === "string" ? err : err.message}`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleStopScript = async () => {
    if (!currentSessionId) return;
    try {
      await invoke("stop_frida_script", {
        sessionId: currentSessionId,
      });
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          session_id: currentSessionId,
          level: "info",
          message: `[⏹] Session stopped by user.`,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.error("Failed to stop script", err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleExportLogs = () => {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] ${l.message}`
      )
      .join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `frida_logs_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleInsertSnippet = (snippet: string) => {
    onScriptChange(scriptContent + "\n\n" + snippet);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = logFilter === "all" || log.level === logFilter;
    const matchesSearch =
      !logSearch.trim() || log.message.toLowerCase().includes(logSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header & Target Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Code2 className="h-6 w-6 text-purple-400" />
            Interactive Script Studio & Live Console
          </h2>
          <p className="text-xs text-[var(--neo-text-muted)] font-mono mt-1">
            Write JavaScript/TypeScript Frida hooks and stream real-time logs and output.
          </p>
        </div>

        {/* Target Badge & Mode Control */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-xs font-mono bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded neo-box border flex items-center gap-2">
            <span>Target:</span>
            <strong>{selectedTarget || "None Selected"}</strong>
          </div>

          <button
            onClick={() => onToggleSpawn(!isSpawn)}
            className={`px-3 py-1.5 text-xs font-bold neo-btn transition-all ${isSpawn ? "bg-amber-400 text-black" : "bg-cyan-500 text-white"
              }`}
          >
            {isSpawn ? "SPAWN MODE (-f)" : "ATTACH MODE (-n)"}
          </button>

          {isRunning ? (
            <Button
              size="sm"
              variant="rose"
              onClick={handleStopScript}
              icon={<Square className="h-3.5 w-3.5" />}
            >
              Stop Session
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={handleRunScript}
              disabled={!selectedTarget || !activeDevice}
              icon={<Play className="h-3.5 w-3.5" />}
            >
              Run / Inject Script
            </Button>
          )}
        </div>
      </div>

      {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

      {/* Editor & Console Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Script Editor Column */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--neo-text-muted)] flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-purple-400" />
              Frida JavaScript Editor
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyCode}
                icon={copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              >
                {copiedCode ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Quick Snippet Inserters */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() =>
                handleInsertSnippet(
                  `Java.perform(function() {\n    console.log("[*] Injected successfully!");\n});`
                )
              }
              className="text-[10px] font-mono px-2 py-1 bg-black/10 hover:bg-black/20 rounded font-bold"
            >
              + Java.perform
            </button>
            <button
              onClick={() =>
                handleInsertSnippet(
                  `var Activity = Java.use("android.app.Activity");\nActivity.onResume.implementation = function() {\n    console.log("[+] Activity resumed: " + this.getClass().getName());\n    this.onResume();\n};`
                )
              }
              className="text-[10px] font-mono px-2 py-1 bg-black/10 hover:bg-black/20 rounded font-bold"
            >
              + Hook Activity
            </button>
            <button
              onClick={() =>
                handleInsertSnippet(
                  `Java.choose("com.example.app.MyClass", {\n    onMatch: function(instance) {\n        console.log("[+] Found live heap instance: " + instance);\n    },\n    onComplete: function() {}\n});`
                )
              }
              className="text-[10px] font-mono px-2 py-1 bg-black/10 hover:bg-black/20 rounded font-bold"
            >
              + Java.choose (Heap)
            </button>
          </div>

          <textarea
            value={scriptContent}
            onChange={(e) => onScriptChange(e.target.value)}
            placeholder="// Enter your Frida JavaScript code here..."
            rows={20}
            className="w-full neo-input font-mono text-xs p-3 leading-relaxed resize-y bg-black/80 text-emerald-300 border-2 border-[var(--neo-border)] rounded custom-scrollbar"
            spellCheck={false}
          />
        </div>

        {/* Live Stream Logs Column */}
        <div className="lg:col-span-6 space-y-3 flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--neo-text-muted)] flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-cyan-400" />
              Live Console Output {isRunning && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping inline-block" />}
            </span>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearLogs}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Clear
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleExportLogs}
                icon={<Download className="h-3.5 w-3.5" />}
              >
                Export
              </Button>
            </div>
          </div>

          {/* Log Controls Filter */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              placeholder="Search logs..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="neo-input text-[11px] font-mono py-1 px-2 flex-1"
            />
            <select
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="neo-input text-[11px] font-mono py-1 px-2"
            >
              <option value="all">All Levels</option>
              <option value="log">Log</option>
              <option value="info">Info</option>
              <option value="status">Status</option>
              <option value="error">Error</option>
            </select>
          </div>

          {/* Log Terminal Container */}
          <div
            ref={logContainerRef}
            className="flex-1 min-h-[420px] max-h-[500px] p-3 bg-black/90 text-white font-mono text-xs rounded neo-box border-2 border-[var(--neo-border)] overflow-y-auto custom-scrollbar space-y-1.5"
          >
            {filteredLogs.length === 0 ? (
              <div className="text-zinc-500 italic p-4 text-center">
                {isRunning ? "Waiting for script output..." : "No console logs yet. Run a script to see live output."}
              </div>
            ) : (
              filteredLogs.map((l) => {
                let colorClass = "text-zinc-200";
                if (l.level === "error") colorClass = "text-rose-400 font-bold";
                if (l.level === "status") colorClass = "text-emerald-400 font-bold";
                if (l.level === "info") colorClass = "text-cyan-400";
                if (l.level === "warn") colorClass = "text-amber-400";

                return (
                  <div key={l.id} className={`break-words ${colorClass}`}>
                    <span className="text-zinc-500 select-none mr-2 text-[10px]">
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </span>
                    {l.message}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
