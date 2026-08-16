import React, { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

interface TerminalViewProps {
  tabId: string;
  sessionId: string;
  targetSerial: string | null;
  activeDevice: string | null;
  isActive: boolean;
  onConnectionChange: (tabId: string, connected: boolean) => void;
  onRegisterInstance: (
    tabId: string,
    inst: {
      term: XTerm;
      fitAddon: FitAddon;
      unlistenOutput?: UnlistenFn;
      unlistenClosed?: UnlistenFn;
    }
  ) => void;
  onUnregisterInstance: (tabId: string) => void;
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

export const TerminalView: React.FC<TerminalViewProps> = ({
  tabId,
  sessionId,
  targetSerial,
  activeDevice,
  isActive,
  onConnectionChange,
  onRegisterInstance,
  onUnregisterInstance,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create xterm terminal
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
      theme: neoTerminalTheme,
      convertEol: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    fitAddon.fit();

    // Input listener
    const dataDisposable = term.onData((data) => {
      let cleaned = data;
      // Automatically strip host 'adb [flags] shell/exec-out' prefix if user pastes full command
      if (cleaned.length > 5 && /^adb(\.exe)?\s+/i.test(cleaned.trim())) {
        const hasTrailingNewline = cleaned.endsWith("\r") || cleaned.endsWith("\n");
        let unwrapped = cleaned.trim();
        unwrapped = unwrapped.replace(/^adb(\.exe)?(\s+-s\s+\S+)?\s+(shell|exec-out)\s+/i, "");
        if (/^adb(\.exe)?(\s+-s\s+\S+)?\s+shell\s*$/i.test(unwrapped)) {
          unwrapped = "";
        }
        if (
          (unwrapped.startsWith('"') && unwrapped.endsWith('"')) ||
          (unwrapped.startsWith("'") && unwrapped.endsWith("'"))
        ) {
          if (unwrapped.length >= 2) {
            unwrapped = unwrapped.slice(1, -1);
          }
        }
        cleaned = unwrapped + (hasTrailingNewline ? "\r" : "");
      }
      invoke("write_terminal_input", {
        sessionId,
        input: cleaned,
      }).catch(console.error);
    });

    // Resize listener
    const resizeDisposable = term.onResize(({ cols, rows }) => {
      invoke("resize_terminal_session", {
        sessionId,
        cols,
        rows,
      }).catch(console.error);
    });

    let unlistenOutput: UnlistenFn | undefined;
    let unlistenClosed: UnlistenFn | undefined;

    // Start PTY session
    const startSession = async () => {
      try {
        await invoke("start_interactive_shell", {
          serial: targetSerial || activeDevice,
          sessionId,
          cols: term.cols,
          rows: term.rows,
        });

        onConnectionChange(tabId, true);

        const outputEvent = `terminal-output-${sessionId}`;
        unlistenOutput = await listen<string>(outputEvent, (event) => {
          if (event.payload) {
            term.write(event.payload);
          }
        });

        const closedEvent = `terminal-closed-${sessionId}`;
        unlistenClosed = await listen<boolean>(closedEvent, () => {
          onConnectionChange(tabId, false);
          term.writeln("\r\n\x1b[33m[Session disconnected]\x1b[0m\r\n");
        });

        onRegisterInstance(tabId, {
          term,
          fitAddon,
          unlistenOutput,
          unlistenClosed,
        });
      } catch (err) {
        console.error("Failed to start terminal session:", err);
        term.writeln(`\r\n\x1b[31m[Error starting ADB shell: ${String(err)}]\x1b[0m\r\n`);
        onRegisterInstance(tabId, { term, fitAddon });
      }
    };

    startSession();

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (unlistenOutput) unlistenOutput();
      if (unlistenClosed) unlistenClosed();
      term.dispose();
      onUnregisterInstance(tabId);
    };
  }, [tabId, sessionId, targetSerial, activeDevice]);

  // Handle active state & tab fit
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      const timer = setTimeout(() => {
        if (fitAddonRef.current && termRef.current) {
          fitAddonRef.current.fit();
          termRef.current.focus();
          invoke("resize_terminal_session", {
            sessionId,
            cols: termRef.current.cols,
            rows: termRef.current.rows,
          }).catch(console.error);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, sessionId]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden ${isActive ? "block" : "hidden"}`}
    />
  );
};
