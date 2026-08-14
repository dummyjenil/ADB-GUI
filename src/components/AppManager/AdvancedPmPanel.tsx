import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Terminal, Send, Users, Folder, Package, Copy, Check, XCircle } from "lucide-react";

interface AdvancedPmPanelProps {
  activeDevice: string;
  addLog: (msg: string) => void;
}

export const AdvancedPmPanel: React.FC<AdvancedPmPanelProps> = ({ activeDevice, addLog }) => {
  const [command, setCommand] = useState("list packages");
  const [argsStr, setArgsStr] = useState("-f -3");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handleRunPm = async (cmdToRun: string, argsToRun: string) => {
    if (!activeDevice) return;
    setRunning(true);
    const argsArray = argsToRun.trim().split(/\s+/).filter(Boolean);
    addLog(`Executing: pm ${cmdToRun} ${argsToRun}`);

    try {
      const res: string = await invoke("execute_pm_command", {
        serial: activeDevice,
        command: cmdToRun,
        args: argsArray,
      });
      setOutput(res);
      addLog(`[SUCCESS] pm ${cmdToRun} finished.`);
    } catch (err: any) {
      setOutput(`Error: ${String(err)}`);
      addLog(`[ERROR] pm ${cmdToRun} failed: ${String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  const handleCopyOutput = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickPmPresets = [
    { label: "pm list packages (3rd Party)", cmd: "list packages", args: "-3", icon: <Package className="h-3.5 w-3.5" /> },
    { label: "pm list packages (Full Details)", cmd: "list packages", args: "-f -u", icon: <Package className="h-3.5 w-3.5" /> },
    { label: "pm list users", cmd: "list users", args: "", icon: <Users className="h-3.5 w-3.5" /> },
    { label: "pm list features", cmd: "list features", args: "", icon: <Terminal className="h-3.5 w-3.5" /> },
    { label: "pm list libraries", cmd: "list libraries", args: "", icon: <Folder className="h-3.5 w-3.5" /> },
    { label: "pm path (Chrome)", cmd: "path", args: "com.android.chrome", icon: <Folder className="h-3.5 w-3.5" /> },
    { label: "pm dump (Chrome)", cmd: "dump", args: "com.android.chrome", icon: <Terminal className="h-3.5 w-3.5" /> },
  ];

  return (
    <Card
      headerTitle="Advanced PM (Package Manager) Shell Tool"
      headerIcon={<Terminal className="h-5 w-5" />}
      headerVariant="dark"
    >
      <div className="space-y-4">
        {/* Quick Command Buttons */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">
            Quick PM Presets
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {quickPmPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setCommand(preset.cmd);
                  setArgsStr(preset.args);
                  handleRunPm(preset.cmd, preset.args);
                }}
                className="neo-btn px-2.5 py-1.5 text-xs font-extrabold bg-black/10 hover:bg-black/20 text-[var(--neo-text)] rounded border border-black/20 flex items-center gap-1.5 cursor-pointer"
              >
                {preset.icon}
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Command Input */}
        <div className="flex flex-col sm:flex-row items-end gap-3 pt-2">
          <div className="w-full sm:w-1/3">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] mb-1 block">
              PM Subcommand
            </label>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="list packages"
            />
          </div>

          <div className="flex-1 w-full">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] mb-1 block">
              Arguments / Flags
            </label>
            <Input
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder="-f -u"
            />
          </div>

          <Button
            variant="primary"
            icon={<Send className="h-4 w-4" />}
            loading={running}
            onClick={() => handleRunPm(command, argsStr)}
          >
            Execute PM
          </Button>
        </div>

        {/* Console Execution Output */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-text-muted)]">
              Live Console Output
            </span>
            <div className="flex items-center gap-2">
              {output && (
                <>
                  <button
                    onClick={handleCopyOutput}
                    className="text-[10px] font-extrabold flex items-center gap-1 text-[var(--neo-text)] hover:underline cursor-pointer"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy Output"}
                  </button>
                  <button
                    onClick={() => setOutput("")}
                    className="text-[10px] font-extrabold flex items-center gap-1 text-red-400 hover:underline cursor-pointer"
                  >
                    <XCircle className="h-3 w-3" />
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="neo-box-sm bg-black/95 p-4 font-mono text-xs text-slate-200 h-60 overflow-y-auto custom-scrollbar border-2 border-black">
            {output ? (
              <pre className="whitespace-pre-wrap leading-relaxed select-text">{output}</pre>
            ) : (
              <p className="text-slate-500 italic">Select a quick command above or type arguments to run pm commands...</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
