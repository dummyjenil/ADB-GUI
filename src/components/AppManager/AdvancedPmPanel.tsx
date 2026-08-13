import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Terminal, Send, Play, Users, Folder, Shield, Trash2, Package } from "lucide-react";

interface AdvancedPmPanelProps {
  activeDevice: string;
  addLog: (msg: string) => void;
}

export const AdvancedPmPanel: React.FC<AdvancedPmPanelProps> = ({ activeDevice, addLog }) => {
  const [command, setCommand] = useState("list packages");
  const [argsStr, setArgsStr] = useState("-f -u");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string>("");

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

  const quickPmPresets = [
    { label: "pm list packages", cmd: "list", args: "packages", icon: <Package className="h-3.5 w-3.5" /> },
    { label: "pm list users", cmd: "list", args: "users", icon: <Users className="h-3.5 w-3.5" /> },
    { label: "pm path", cmd: "path", args: "com.android.chrome", icon: <Folder className="h-3.5 w-3.5" /> },
    { label: "pm dump", cmd: "dump", args: "com.android.chrome", icon: <Terminal className="h-3.5 w-3.5" /> },
    { label: "pm clear", cmd: "clear", args: "com.android.chrome", icon: <Trash2 className="h-3.5 w-3.5" /> },
    { label: "pm disable-user", cmd: "disable-user", args: "--user 0 com.android.chrome", icon: <Shield className="h-3.5 w-3.5" /> },
    { label: "pm enable", cmd: "enable", args: "com.android.chrome", icon: <Play className="h-3.5 w-3.5" /> },
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
            Quick PM Commands
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {quickPmPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCommand(preset.cmd);
                  setArgsStr(preset.args);
                  handleRunPm(preset.cmd, preset.args);
                }}
                className="neo-btn px-2.5 py-1.5 text-xs font-extrabold bg-black/10 hover:bg-black/20 text-[var(--neo-text)] rounded border border-black/20 flex items-center gap-1.5"
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
              Subcommand (e.g. list, dump, path)
            </label>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="list packages"
            />
          </div>

          <div className="flex-1 w-full">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] mb-1 block">
              Arguments (e.g. -f -3 -d or package name)
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
        <div className="neo-box-sm bg-black/90 p-4 font-mono text-xs text-slate-200 h-56 overflow-y-auto custom-scrollbar border-2 border-black">
          {output ? (
            <pre className="whitespace-pre-wrap leading-relaxed">{output}</pre>
          ) : (
            <p className="text-slate-500 italic">Select a quick command above or type arguments to run pm commands...</p>
          )}
        </div>
      </div>
    </Card>
  );
};
