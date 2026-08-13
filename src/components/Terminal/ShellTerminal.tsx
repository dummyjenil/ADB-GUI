import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
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
} from "lucide-react";
import { DeviceInfo } from "../Navbar";

interface ShellTerminalProps {
  devices: DeviceInfo[];
  activeDevice: string | null;
  pendingCommand?: string | null;
  onClearPendingCommand?: () => void;
}

interface OrganicTab {
  id: string;
  title: string;
  targetSerial: string | null;
  sessionId: string;
}

const neoTerminalTheme = {
  background: "#090d16",
  foreground: "#f8fafc",
  cursor: "#fef08a",
  cursorAccent: "#000000",
  selectionBackground: "rgba(254, 240, 138, 0.35)",
  black: "#1e293b",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#38bdf8",
  white: "#f8fafc",
  brightBlack: "#475569",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde047",
  brightBlue: "#93c5fd",
  brightMagenta: "#e9d5ff",
  brightCyan: "#7dd3fc",
  brightWhite: "#ffffff",
};

export const ShellTerminal: React.FC<ShellTerminalProps> = ({
  devices,
  activeDevice,
  pendingCommand,
  onClearPendingCommand,
}) => {
  const [tabs, setTabs] = useState<OrganicTab[]>([
    {
      id: "tab-1",
      title: "Terminal 1",
      targetSerial: null,
      sessionId: "session-tab-1",
    },
  ]);

  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [connectedSessions, setConnectedSessions] = useState<Record<string, boolean>>({});

  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const xtermInstances = useRef<
    Record<
      string,
      {
        term: XTerm;
        fitAddon: FitAddon;
        unlisten?: UnlistenFn;
      }
    >
  >({});

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const targetDeviceSerial = activeTab?.targetSerial || activeDevice;

  // Initialize and attach xterm instance for a specific tab
  const initTabTerminal = useCallback(
    async (tab: OrganicTab) => {
      const container = containerRefs.current[tab.id];
      if (!container || xtermInstances.current[tab.id]) return;

      const term = new XTerm({
        cursorBlink: true,
        cursorStyle: "block",
        fontSize: 13,
        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
        theme: neoTerminalTheme,
        convertEol: true,
        scrollback: 10000,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(container);
      fitAddon.fit();

      // Forward keystrokes directly to Rust master PTY
      term.onData((data) => {
        invoke("write_terminal_input", {
          sessionId: tab.sessionId,
          input: data,
        }).catch(console.error);
      });

      // Forward terminal resize to Rust PTY ioctl
      term.onResize(({ cols, rows }) => {
        invoke("resize_terminal_session", {
          sessionId: tab.sessionId,
          cols,
          rows,
        }).catch(console.error);
      });

      // Start native ADB shell PTY session
      try {
        await invoke("start_interactive_shell", {
          serial: tab.targetSerial || activeDevice,
          sessionId: tab.sessionId,
          cols: term.cols,
          rows: term.rows,
        });

        setConnectedSessions((prev) => ({ ...prev, [tab.id]: true }));

        // Listen for PTY output stream
        const eventName = `terminal-output-${tab.sessionId}`;
        const unlisten = await listen<string>(eventName, (event) => {
          if (event.payload) {
            term.write(event.payload);
          }
        });

        xtermInstances.current[tab.id] = { term, fitAddon, unlisten };
      } catch (err) {
        console.error("Failed to start terminal session:", err);
        term.writeln(`\r\n\x1b[31m[Error starting ADB shell: ${String(err)}]\x1b[0m\r\n`);
        xtermInstances.current[tab.id] = { term, fitAddon };
      }
    },
    [activeDevice]
  );

  // Initialize active tab terminal when container is mounted
  useEffect(() => {
    if (activeTab) {
      initTabTerminal(activeTab);
    }
  }, [activeTab, initTabTerminal]);

  // Fit current active terminal on tab switch or window resize
  useEffect(() => {
    const activeInst = xtermInstances.current[activeTabId];
    if (activeInst) {
      setTimeout(() => {
        activeInst.fitAddon.fit();
        activeInst.term.focus();
        invoke("resize_terminal_session", {
          sessionId: activeTab.sessionId,
          cols: activeInst.term.cols,
          rows: activeInst.term.rows,
        }).catch(console.error);
      }, 50);
    }
  }, [activeTabId, activeTab]);

  // Global window resize listener
  useEffect(() => {
    const handleResize = () => {
      const activeInst = xtermInstances.current[activeTabId];
      if (activeInst) {
        activeInst.fitAddon.fit();
        invoke("resize_terminal_session", {
          sessionId: activeTab.sessionId,
          cols: activeInst.term.cols,
          rows: activeInst.term.rows,
        }).catch(console.error);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeTabId, activeTab]);

  // Handle external pending command from "Run in Terminal"
  useEffect(() => {
    if (pendingCommand && activeTab) {
      invoke("write_terminal_input", {
        sessionId: activeTab.sessionId,
        input: pendingCommand + "\n",
      }).catch(console.error);

      if (onClearPendingCommand) {
        onClearPendingCommand();
      }

      const activeInst = xtermInstances.current[activeTabId];
      if (activeInst) {
        activeInst.term.focus();
      }
    }
  }, [pendingCommand, activeTab, activeTabId, onClearPendingCommand]);

  // Add new tab
  const handleAddTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: OrganicTab = {
      id: newId,
      title: `Terminal ${tabs.length + 1}`,
      targetSerial: null,
      sessionId: `session-${newId}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close tab
  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;

    const targetTab = tabs.find((t) => t.id === id);
    if (targetTab) {
      const inst = xtermInstances.current[id];
      if (inst) {
        if (inst.unlisten) inst.unlisten();
        inst.term.dispose();
        delete xtermInstances.current[id];
      }
      invoke("close_interactive_shell", { sessionId: targetTab.sessionId }).catch(console.error);
    }

    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  // Target device change per tab
  const handleSetTabTargetSerial = async (serial: string | null) => {
    if (!activeTab) return;

    const inst = xtermInstances.current[activeTabId];
    if (inst) {
      if (inst.unlisten) inst.unlisten();
      inst.term.dispose();
      delete xtermInstances.current[activeTabId];
    }
    await invoke("close_interactive_shell", { sessionId: activeTab.sessionId }).catch(console.error);

    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, targetSerial: serial } : t))
    );

    // Re-initialize terminal with new serial target
    setTimeout(() => {
      const updatedTab = { ...activeTab, targetSerial: serial };
      initTabTerminal(updatedTab);
    }, 100);
  };

  // Reconnect/Restart interactive shell session
  const handleRestartSession = async () => {
    if (!activeTab) return;

    setConnectedSessions((prev) => ({ ...prev, [activeTabId]: false }));
    const inst = xtermInstances.current[activeTabId];
    if (inst) {
      inst.term.clear();
      inst.term.writeln("\x1b[33mReconnecting ADB shell session...\x1b[0m\r\n");
    }

    await invoke("close_interactive_shell", { sessionId: activeTab.sessionId }).catch(console.error);

    try {
      const cols = inst ? inst.term.cols : 80;
      const rows = inst ? inst.term.rows : 24;

      await invoke("start_interactive_shell", {
        serial: targetDeviceSerial,
        sessionId: activeTab.sessionId,
        cols,
        rows,
      });
      setConnectedSessions((prev) => ({ ...prev, [activeTabId]: true }));
    } catch (e) {
      console.error(e);
      if (inst) {
        inst.term.writeln(`\x1b[31mFailed to reconnect: ${String(e)}\x1b[0m\r\n`);
      }
    }
  };

  // Send Ctrl+C (SIGINT) to organic shell
  const handleSendCtrlC = () => {
    if (!activeTab) return;
    invoke("write_terminal_input", {
      sessionId: activeTab.sessionId,
      input: "\x03",
    }).catch(console.error);
  };

  // Clear current tab terminal
  const handleClearOutput = () => {
    const inst = xtermInstances.current[activeTabId];
    if (inst) {
      inst.term.clear();
    }
  };

  // Copy active tab terminal content or selection
  const handleCopyTabOutput = () => {
    const inst = xtermInstances.current[activeTabId];
    if (inst) {
      let text = inst.term.getSelection();
      if (!text) {
        // Select all text, copy, and restore
        inst.term.selectAll();
        text = inst.term.getSelection();
        inst.term.clearSelection();
      }
      if (text) {
        navigator.clipboard.writeText(text);
        setCopiedOutput(true);
        setTimeout(() => setCopiedOutput(false), 2000);
      }
    }
  };

  // Export terminal scrollback buffer to text file
  const handleExportSession = () => {
    const inst = xtermInstances.current[activeTabId];
    if (!inst) return;

    inst.term.selectAll();
    const text = inst.term.getSelection();
    inst.term.clearSelection();

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeTab.title.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] neo-box bg-[var(--neo-card-bg)] text-[var(--neo-text)] shadow-[8px_8px_0px_0px_var(--neo-shadow)] overflow-hidden">
      {/* Header Controls */}
      <div className="p-3 border-b-2 border-[var(--neo-border)] bg-[var(--neo-bg)] flex flex-wrap items-center justify-between gap-3">
        {/* Title & Device Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider text-[var(--neo-primary-text)] bg-[var(--neo-primary)] px-2.5 py-1 border border-[var(--neo-border)]">
            <TerminalIcon className="h-4 w-4" />
            <span>ADB Shell Terminal</span>
          </div>

          {/* Per-tab Device Selector */}
          <div className="flex items-center gap-1.5 text-xs font-bold bg-[var(--neo-card-bg)] px-2.5 py-1 border border-[var(--neo-border)]">
            <Smartphone className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[var(--neo-text-muted)]">Device:</span>
            <select
              value={activeTab.targetSerial || ""}
              onChange={(e) => handleSetTabTargetSerial(e.target.value || null)}
              className="bg-transparent font-extrabold focus:outline-none cursor-pointer"
            >
              <option value="">Default Active ({activeDevice || "None"})</option>
              {devices.map((d) => (
                <option key={String(d.serial)} value={String(d.serial)}>
                  {d.model} ({d.serial})
                </option>
              ))}
            </select>
          </div>

          {/* Session Status Badge */}
          <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 border border-[var(--neo-border)] bg-emerald-400/20 text-emerald-900">
            <div
              className={`h-2 w-2 rounded-full ${
                connectedSessions[activeTabId] ? "bg-emerald-500 animate-pulse" : "bg-amber-400"
              }`}
            />
            <span>{connectedSessions[activeTabId] ? "PTY Shell Connected" : "Connecting..."}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendCtrlC}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-rose-500 text-white flex items-center gap-1"
            title="Send Ctrl+C (SIGINT)"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            <span>Ctrl+C</span>
          </button>

          <button
            onClick={handleRestartSession}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-[var(--neo-card-bg)] flex items-center gap-1"
            title="Restart ADB shell process"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reconnect</span>
          </button>

          <button
            onClick={handleCopyTabOutput}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-[var(--neo-card-bg)] flex items-center gap-1"
            title="Copy terminal buffer or selection"
          >
            {copiedOutput ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copiedOutput ? "Copied!" : "Copy"}</span>
          </button>

          <button
            onClick={handleExportSession}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-[var(--neo-card-bg)] flex items-center gap-1"
            title="Save session log file"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={handleClearOutput}
            className="neo-btn px-2.5 py-1 text-xs font-bold bg-amber-400 text-black flex items-center gap-1"
            title="Clear active terminal view"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation Header */}
      <div className="flex items-center bg-slate-900 border-b-2 border-[var(--neo-border)] px-2 overflow-x-auto custom-scrollbar shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-bold cursor-pointer border-r border-slate-700 transition-colors select-none ${
                isActive
                  ? "bg-[#090d16] text-[var(--neo-text)] border-t-2 border-t-[var(--neo-primary)] font-black"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <Code className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  className="hover:bg-red-500/20 hover:text-red-400 rounded p-0.5 ml-1 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          onClick={handleAddTab}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors ml-1"
          title="New Terminal Tab"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Terminal Canvas Container viewport */}
      <div className="flex-1 bg-[#090d16] p-2 relative overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={(el) => {
              containerRefs.current[tab.id] = el;
            }}
            className={`w-full h-full ${tab.id === activeTabId ? "block" : "hidden"}`}
          />
        ))}
      </div>
    </div>
  );
};
