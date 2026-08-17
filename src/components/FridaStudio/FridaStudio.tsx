import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Server, Target, Zap, Code2, Layers, Cpu } from "lucide-react";
import { FridaServerManager } from "./FridaServerManager";
import { FridaProcessSelector } from "./FridaProcessSelector";
import { FridaPresetHub } from "./FridaPresetHub";
import { FridaScriptStudio } from "./FridaScriptStudio";
import { FridaClassExplorer } from "./FridaClassExplorer";
import { FridaMemoryInspector } from "./FridaMemoryInspector";
import { FridaServerStatus } from "../../types/frida";

interface FridaStudioProps {
  activeDevice: string | null;
}

type FridaTab = "server" | "targets" | "presets" | "editor" | "explorer" | "memory";

export const FridaStudio: React.FC<FridaStudioProps> = ({ activeDevice }) => {
  const [activeTab, setActiveTab] = useState<FridaTab>("server");
  const [serverStatus, setServerStatus] = useState<FridaServerStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isSpawn, setIsSpawn] = useState<boolean>(false);
  const [scriptContent, setScriptContent] = useState<string>(`/* Frida Script */
Java.perform(function () {
    console.log("[*] Frida script attached successfully!");
});`);

  const fetchServerStatus = useCallback(async () => {
    if (!activeDevice) {
      setServerStatus(null);
      return;
    }
    setLoadingStatus(true);
    try {
      const status: FridaServerStatus = await invoke("check_frida_server_status", {
        serial: activeDevice,
      });
      setServerStatus(status);
    } catch (err) {
      console.error("Failed to check Frida server status:", err);
    } finally {
      setLoadingStatus(false);
    }
  }, [activeDevice]);

  useEffect(() => {
    fetchServerStatus();
  }, [fetchServerStatus]);

  const handleSelectTarget = (target: string, spawn: boolean) => {
    setSelectedTarget(target);
    setIsSpawn(spawn);
    // Switch to Script Studio when a target is picked
    setActiveTab("editor");
  };

  const handleLoadScript = (script: string, _autoRun = false) => {
    setScriptContent(script);
    setActiveTab("editor");
  };

  const handleInsertCode = (code: string) => {
    setScriptContent(code);
    setActiveTab("editor");
  };

  const tabs: { id: FridaTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "server",
      label: "Frida Server",
      icon: <Server className="h-4 w-4 shrink-0 text-purple-400" />,
      badge: serverStatus?.is_running ? "RUNNING" : "STOPPED",
    },
    {
      id: "targets",
      label: "Target Selector",
      icon: <Target className="h-4 w-4 shrink-0 text-rose-400" />,
      badge: selectedTarget ? "1 TARGET" : undefined,
    },
    {
      id: "presets",
      label: "1-Click Bypasses",
      icon: <Zap className="h-4 w-4 shrink-0 text-amber-400" />,
    },
    {
      id: "editor",
      label: "Script Studio",
      icon: <Code2 className="h-4 w-4 shrink-0 text-emerald-400" />,
    },
    {
      id: "explorer",
      label: "Class Explorer",
      icon: <Layers className="h-4 w-4 shrink-0 text-violet-400" />,
    },
    {
      id: "memory",
      label: "Native Interceptor",
      icon: <Cpu className="h-4 w-4 shrink-0 text-cyan-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Subnav Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[var(--neo-card-bg)] neo-box overflow-x-auto custom-scrollbar">
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3.5 py-2 text-xs font-black neo-btn flex items-center gap-2 transition-all shrink-0 ${isActive
                ? "bg-purple-600 text-white shadow-[3px_3px_0px_0px_var(--neo-shadow)]"
                : "bg-transparent text-[var(--neo-text)] hover:bg-black/5"
                }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${t.badge === "RUNNING"
                    ? "bg-emerald-400 text-black font-bold"
                    : "bg-black/20 text-[var(--neo-text)]"
                    }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Views */}
      <div className="min-w-0">
        {activeTab === "server" && (
          <FridaServerManager
            activeDevice={activeDevice}
            serverStatus={serverStatus}
            onRefreshStatus={fetchServerStatus}
            loading={loadingStatus}
          />
        )}

        {activeTab === "targets" && (
          <FridaProcessSelector
            activeDevice={activeDevice}
            selectedTarget={selectedTarget}
            isSpawn={isSpawn}
            onSelectTarget={handleSelectTarget}
          />
        )}

        {activeTab === "presets" && (
          <FridaPresetHub
            onLoadScript={handleLoadScript}
            selectedTarget={selectedTarget}
          />
        )}

        {activeTab === "editor" && (
          <FridaScriptStudio
            activeDevice={activeDevice}
            selectedTarget={selectedTarget}
            isSpawn={isSpawn}
            scriptContent={scriptContent}
            onScriptChange={setScriptContent}
            onToggleSpawn={setIsSpawn}
          />
        )}

        {activeTab === "explorer" && (
          <FridaClassExplorer
            onInsertCode={handleInsertCode}
            selectedTarget={selectedTarget}
          />
        )}

        {activeTab === "memory" && (
          <FridaMemoryInspector
            onInsertCode={handleInsertCode}
            selectedTarget={selectedTarget}
          />
        )}
      </div>
    </div>
  );
};
