import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { PackageInfo } from "../../types/app_manager";
import {
  Download,
  FolderOpen,
  Layers,
  FileBox,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ExtractModalProps {
  app: PackageInfo;
  activeDevice: string;
  onClose: () => void;
  onLog?: (msg: string) => void;
}

export const ExtractModal: React.FC<ExtractModalProps> = ({
  app,
  activeDevice,
  onClose,
  onLog,
}) => {
  const [apkPaths, setApkPaths] = useState<string[]>([]);
  const [loadingPaths, setLoadingPaths] = useState(true);
  const [extractFormat, setExtractFormat] = useState<"apk" | "apks" | "both">("apks");
  const [extracting, setExtracting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPaths = async () => {
      setLoadingPaths(true);
      try {
        const paths: string[] = await invoke("get_apk_path", {
          serial: activeDevice,
          packageName: app.package_name,
        });
        if (isMounted) {
          setApkPaths(paths);
          // If single apk, default to apk, else default to apks
          if (paths.length <= 1) {
            setExtractFormat("apk");
          } else {
            setExtractFormat("apks");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setApkPaths([]);
        }
      } finally {
        if (isMounted) setLoadingPaths(false);
      }
    };

    fetchPaths();
    return () => {
      isMounted = false;
    };
  }, [activeDevice, app.package_name]);

  const isSplit = apkPaths.length > 1;

  const handleStartExtract = async () => {
    setErrorMessage(null);
    setResultMessage(null);
    try {
      const dir: string | null = await invoke("pick_save_directory");
      if (!dir) return;

      setExtracting(true);
      let successMessages: string[] = [];

      if (extractFormat === "apk" || extractFormat === "both") {
        const res: string = await invoke("extract_apk", {
          serial: activeDevice,
          packageName: app.package_name,
          targetDir: dir,
        });
        successMessages.push(res);
        onLog?.(`[SUCCESS] ${res}`);
      }

      if (extractFormat === "apks" || extractFormat === "both") {
        const res: string = await invoke("extract_apks", {
          serial: activeDevice,
          packageName: app.package_name,
          targetDir: dir,
        });
        successMessages.push(res);
        onLog?.(`[SUCCESS] ${res}`);
      }

      setResultMessage(successMessages.join(" & "));
    } catch (err: any) {
      const msg = String(err);
      setErrorMessage(msg);
      onLog?.(`[ERROR] Extraction failed: ${msg}`);
    } finally {
      setExtracting(false);
    }
  };

  const modalTitle = (
    <div className="flex items-center gap-2">
      <Download className="h-5 w-5 text-[var(--neo-accent)]" />
      <span className="font-black text-sm uppercase tracking-wide">
        Extract Application Files
      </span>
    </div>
  );

  return (
    <Modal isOpen={true} onClose={onClose} title={modalTitle} maxWidth="max-w-lg">
      <div className="space-y-4 font-sans text-[var(--neo-text)]">
        {/* App Info Header */}
        <div className="p-3 neo-box-sm bg-[var(--neo-bg)] flex items-start gap-3">
          <div className="h-10 w-10 neo-box flex items-center justify-center font-black text-base bg-[var(--neo-primary)] text-[var(--neo-primary-text)] shrink-0">
            {app.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-sm truncate">{app.name}</h4>
            <p className="text-xs font-mono opacity-70 truncate">{app.package_name}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
              {loadingPaths ? (
                <span className="inline-flex items-center gap-1 text-[11px] opacity-70">
                  <Loader2 className="h-3 w-3 animate-spin" /> Detecting package type...
                </span>
              ) : isSplit ? (
                <Badge variant="accent">
                  <Layers className="h-3 w-3 mr-1 inline" />
                  Split APK ({apkPaths.length} components)
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <FileBox className="h-3 w-3 mr-1 inline" />
                  Single APK
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Splits Details Box (if split) */}
        {!loadingPaths && isSplit && (
          <div className="p-3 neo-box-sm bg-purple-500/5 border border-purple-500/30 text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1 text-purple-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Split APK Components Detected:</span>
            </div>
            <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1 font-mono text-[11px] opacity-90 pl-1">
              {apkPaths.map((p, idx) => {
                const name = p.split("/").pop() || p;
                return (
                  <div key={idx} className="flex items-center gap-1.5 truncate">
                    <span className="text-purple-400">[{idx + 1}]</span>
                    <span className="truncate">{name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Format Selection Cards */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider block opacity-90">
            Select Export Format:
          </label>

          <div className="grid grid-cols-1 gap-2">
            {/* APKS Option */}
            <div
              onClick={() => setExtractFormat("apks")}
              className={`p-3 neo-box-sm cursor-pointer transition-all border ${
                extractFormat === "apks"
                  ? "bg-purple-500/15 border-purple-500 shadow-sm"
                  : "bg-black/5 hover:bg-black/10 border-transparent"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      extractFormat === "apks"
                        ? "border-purple-500 bg-purple-500"
                        : "border-gray-400"
                    }`}
                  >
                    {extractFormat === "apks" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      APKS Bundle (.apks)
                      {isSplit && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">
                          Recommended
                        </span>
                      )}
                    </span>
                    <p className="text-[11px] opacity-70 mt-0.5">
                      Complete archive containing all splits. Ready for install via ADB or SAI.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* APK Option */}
            <div
              onClick={() => setExtractFormat("apk")}
              className={`p-3 neo-box-sm cursor-pointer transition-all border ${
                extractFormat === "apk"
                  ? "bg-purple-500/15 border-purple-500 shadow-sm"
                  : "bg-black/5 hover:bg-black/10 border-transparent"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      extractFormat === "apk"
                        ? "border-purple-500 bg-purple-500"
                        : "border-gray-400"
                    }`}
                  >
                    {extractFormat === "apk" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      Standalone / Base APK (.apk)
                      {!isSplit && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                          Recommended
                        </span>
                      )}
                    </span>
                    <p className="text-[11px] opacity-70 mt-0.5">
                      {isSplit
                        ? "Extracts only the base.apk component."
                        : "Standard standalone Android application package."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Both Option */}
            {isSplit && (
              <div
                onClick={() => setExtractFormat("both")}
                className={`p-3 neo-box-sm cursor-pointer transition-all border ${
                  extractFormat === "both"
                    ? "bg-purple-500/15 border-purple-500 shadow-sm"
                    : "bg-black/5 hover:bg-black/10 border-transparent"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        extractFormat === "both"
                          ? "border-purple-500 bg-purple-500"
                          : "border-gray-400"
                      }`}
                    >
                      {extractFormat === "both" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-xs">Both Formats (.apk & .apks)</span>
                      <p className="text-[11px] opacity-70 mt-0.5">
                        Exports both Base APK and complete APKS bundle into chosen directory.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {resultMessage && (
          <div className="p-3 neo-box-sm bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs flex items-start gap-2 animate-in fade-in">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{resultMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 neo-box-sm bg-red-500/10 border border-red-500/40 text-red-400 text-xs flex items-start gap-2 animate-in fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="break-all">{errorMessage}</span>
          </div>
        )}

        {/* Footer Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--neo-border)]/20">
          <Button size="sm" variant="secondary" onClick={onClose} disabled={extracting}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="accent"
            icon={
              extracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )
            }
            onClick={handleStartExtract}
            disabled={extracting || loadingPaths}
          >
            {extracting ? "Extracting..." : "Choose Folder & Extract"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
