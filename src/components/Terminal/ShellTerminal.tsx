import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { UnlistenFn } from "@tauri-apps/api/event";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { DeviceInfo } from "../Navbar";
import { TerminalHeader, OrganicTab } from "./TerminalHeader";
import { TerminalView } from "./TerminalView";

interface ShellTerminalProps {
  devices: DeviceInfo[];
  activeDevice: string | null;
  pendingCommand?: string | null;
  onClearPendingCommand?: () => void;
}

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
  const [isFullScreen, setIsFullScreen] = useState(false);

  const xtermInstances = useRef<
    Record<
      string,
      {
        term: XTerm;
        fitAddon: FitAddon;
        unlistenOutput?: UnlistenFn;
        unlistenClosed?: UnlistenFn;
      }
    >
  >({});

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const targetDeviceSerial = activeTab ? (activeTab.targetSerial || activeDevice) : activeDevice;

  const handleRegisterInstance = useCallback(
    (
      tabId: string,
      inst: {
        term: XTerm;
        fitAddon: FitAddon;
        unlistenOutput?: UnlistenFn;
        unlistenClosed?: UnlistenFn;
      }
    ) => {
      xtermInstances.current[tabId] = inst;
    },
    []
  );

  const handleUnregisterInstance = useCallback((tabId: string) => {
    delete xtermInstances.current[tabId];
  }, []);

  const handleConnectionChange = useCallback((tabId: string, connected: boolean) => {
    setConnectedSessions((prev) => ({ ...prev, [tabId]: connected }));
  }, []);

  // Refit terminal helper
  const refitActiveTerminal = useCallback(() => {
    if (!activeTabId) return;
    const activeInst = xtermInstances.current[activeTabId];
    if (activeInst && activeTab) {
      activeInst.fitAddon.fit();
      activeInst.term.focus();
      invoke("resize_terminal_session", {
        sessionId: activeTab.sessionId,
        cols: activeInst.term.cols,
        rows: activeInst.term.rows,
      }).catch(console.error);
    }
  }, [activeTabId, activeTab]);

  // Handle window resize & fullscreen toggle
  useEffect(() => {
    const handleResize = () => {
      refitActiveTerminal();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [refitActiveTerminal]);

  useEffect(() => {
    const timer = setTimeout(refitActiveTerminal, 60);
    return () => clearTimeout(timer);
  }, [activeTabId, isFullScreen, refitActiveTerminal]);

  // External pending command handler
  useEffect(() => {
    if (pendingCommand && activeTab) {
      let cleanCmd = pendingCommand.trim();
      cleanCmd = cleanCmd.replace(/^adb(\.exe)?\s+(-s\s+\S+\s+)?shell\s+/i, "");

      const timer = setTimeout(() => {
        invoke("write_terminal_input", {
          sessionId: activeTab.sessionId,
          input: cleanCmd + "\n",
        }).catch(console.error);

        if (onClearPendingCommand) {
          onClearPendingCommand();
        }

        const activeInst = xtermInstances.current[activeTabId];
        if (activeInst) {
          activeInst.term.focus();
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [pendingCommand, activeTab, activeTabId, onClearPendingCommand]);

  // Tab operations
  const handleAddTab = () => {
    const nextNum = tabs.length + 1;
    const newId = `tab-${Date.now()}`;
    const newTab: OrganicTab = {
      id: newId,
      title: `Terminal ${nextNum}`,
      targetSerial: null,
      sessionId: `session-${newId}`,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;

    const targetTab = tabs.find((t) => t.id === id);
    if (targetTab) {
      await invoke("close_interactive_shell", { sessionId: targetTab.sessionId }).catch(console.error);
    }

    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  const handleSetTabDevice = async (serial: string | null) => {
    if (!activeTab) return;

    await invoke("close_interactive_shell", { sessionId: activeTab.sessionId }).catch(console.error);

    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, targetSerial: serial } : t))
    );
  };

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

  const handleSendCtrlC = () => {
    if (!activeTab) return;
    invoke("write_terminal_input", {
      sessionId: activeTab.sessionId,
      input: "\x03",
    }).catch(console.error);
  };

  const handleClearOutput = () => {
    const inst = xtermInstances.current[activeTabId];
    if (inst) {
      inst.term.clear();
    }
  };

  const handleCopyTabOutput = () => {
    const inst = xtermInstances.current[activeTabId];
    if (inst) {
      let text = inst.term.getSelection();
      if (!text) {
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
    <div
      className={`flex flex-col neo-box bg-[var(--neo-card-bg)] text-[var(--neo-text)] shadow-[8px_8px_0px_0px_var(--neo-shadow)] overflow-hidden transition-all duration-200 ${
        isFullScreen
          ? "fixed inset-2 z-50 h-[calc(100vh-16px)]"
          : "h-[calc(100vh-140px)] min-h-[550px]"
      }`}
    >
      {/* Refactored Terminal Header Component */}
      <TerminalHeader
        tabs={tabs}
        activeTabId={activeTabId}
        activeTab={activeTab}
        devices={devices}
        activeDevice={activeDevice}
        isConnected={!!connectedSessions[activeTabId]}
        copiedOutput={copiedOutput}
        isFullScreen={isFullScreen}
        onSelectTab={setActiveTabId}
        onAddTab={handleAddTab}
        onCloseTab={handleCloseTab}
        onSetTabDevice={handleSetTabDevice}
        onSendCtrlC={handleSendCtrlC}
        onRestartSession={handleRestartSession}
        onCopyOutput={handleCopyTabOutput}
        onExportSession={handleExportSession}
        onClearOutput={handleClearOutput}
        onToggleFullScreen={() => setIsFullScreen((prev) => !prev)}
      />

      {/* Terminal Views Viewport */}
      <div className="flex-1 bg-[#090d16] p-2 relative overflow-hidden">
        {tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            tabId={tab.id}
            sessionId={tab.sessionId}
            targetSerial={tab.targetSerial}
            activeDevice={activeDevice}
            isActive={tab.id === activeTabId}
            onConnectionChange={handleConnectionChange}
            onRegisterInstance={handleRegisterInstance}
            onUnregisterInstance={handleUnregisterInstance}
          />
        ))}
      </div>
    </div>
  );
};
