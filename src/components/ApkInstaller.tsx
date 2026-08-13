import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { EmptyState } from "./ui/EmptyState";
import { Package, UploadCloud, CheckCircle2, XCircle, Terminal, FolderOpen } from "lucide-react";

interface ApkInstallerProps {
  activeDevice: string | null;
}

export const ApkInstaller: React.FC<ApkInstallerProps> = ({ activeDevice }) => {
  const [filePath, setFilePath] = useState("");
  const [installing, setInstalling] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleInstall = async (pathToInstall: string) => {
    if (!activeDevice || !pathToInstall) return;
    setInstalling(true);
    addLog(`Initiating installation for: ${pathToInstall}`);

    try {
      const result: string = await invoke("install_apk", {
        serial: activeDevice,
        filePath: pathToInstall,
      });
      addLog(`[SUCCESS] ${result}`);
    } catch (err: any) {
      addLog(`[ERROR] ${String(err)}`);
    } finally {
      setInstalling(false);
    }
  };

  // Listen to Tauri native window drag & drop event
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupDragDrop = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              const droppedPath = paths[0];
              if (droppedPath.toLowerCase().endsWith(".apk")) {
                setFilePath(droppedPath);
                handleInstall(droppedPath);
              } else {
                addLog("[ERROR] Only .apk files are supported!");
              }
            }
          }
        });
      } catch (e) {
        console.error("Failed to setup drag drop listener:", e);
      }
    };

    setupDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, [activeDevice]);

  // Open native OS File Manager picker
  const handleBrowseFile = async () => {
    try {
      const selected: string | null = await invoke("pick_apk_file");
      if (selected) {
        setFilePath(selected);
        handleInstall(selected);
      }
    } catch (err: any) {
      addLog(`[ERROR] Failed to select file: ${String(err)}`);
    }
  };

  // HTML Drop Fallback
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const path = (file as any).path;
      if (path && path.toLowerCase().endsWith(".apk")) {
        setFilePath(path);
        handleInstall(path);
      } else if (!path) {
        addLog("[INFO] Please click 'Browse File Manager' or drop directly onto the app window.");
      } else {
        addLog("[ERROR] Only .apk files are supported!");
      }
    }
  };

  if (!activeDevice) {
    return <EmptyState title="No Active Device Selected" description="Select a device to install APK packages." />;
  }

  return (
    <div className="space-y-6">
      {/* APK Drag & Drop Region */}
      <Card
        headerTitle="APK Package Installer"
        headerIcon={<Package className="h-5 w-5" />}
        headerVariant="primary"
      >
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={handleBrowseFile}
          className="neo-box p-8 text-center bg-black/10 hover:bg-black/20 transition-all cursor-pointer group"
        >
          <UploadCloud className="h-12 w-12 text-[var(--neo-primary)] mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <p className="text-sm font-extrabold uppercase text-[var(--neo-text)]">
            Drag & Drop `.apk` file here or click to browse
          </p>
          <p className="text-xs text-[var(--neo-text-muted)] mt-1 font-medium">
            Open File Manager to pick an APK or drop directly onto app window
          </p>

          <div className="mt-5 flex justify-center">
            <Button
              variant="accent"
              icon={<FolderOpen className="h-4 w-4" />}
              onClick={(e) => {
                e.stopPropagation();
                handleBrowseFile();
              }}
            >
              Browse File Manager
            </Button>
          </div>

          <div className="mt-6 flex max-w-lg mx-auto gap-3 items-end" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1">
              <Input
                placeholder="/path/to/app.apk"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
              />
            </div>
            <Button
              onClick={() => handleInstall(filePath)}
              loading={installing}
              disabled={!filePath}
              variant="primary"
              icon={<Package className="h-4 w-4" />}
            >
              Install APK
            </Button>
          </div>
        </div>
      </Card>

      {/* Installation Logs Console */}
      <Card
        headerTitle="Installation Console Logs"
        headerIcon={<Terminal className="h-5 w-5" />}
        headerVariant="dark"
        headerAction={
          <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
            Clear Logs
          </Button>
        }
      >
        <div className="neo-box-sm bg-black/90 p-4 font-mono text-xs text-slate-200 h-48 overflow-y-auto custom-scrollbar space-y-1.5 border-2 border-black">
          {logs.length === 0 ? (
            <p className="text-slate-500 italic">No installation logs yet...</p>
          ) : (
            logs.map((log, idx) => {
              const isError = log.includes("[ERROR]");
              const isSuccess = log.includes("[SUCCESS]");
              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${
                    isError ? "text-rose-400 font-bold" : isSuccess ? "text-emerald-400 font-bold" : "text-slate-300"
                  }`}
                >
                  {isError && <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-400" />}
                  {isSuccess && <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />}
                  <span>{log}</span>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
};
