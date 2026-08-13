import React, { useState } from "react";
import { FileOperationProgress } from "../../types/fileManager";
import {
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  Terminal,
} from "lucide-react";

interface FileManagerToastProps {
  operationState: FileOperationProgress;
  onDismiss: () => void;
}

export const FileManagerToast: React.FC<FileManagerToastProps> = ({
  operationState,
  onDismiss,
}) => {
  const [showLogs, setShowLogs] = useState(false);

  if (operationState.status === "idle") return null;

  const isPush = operationState.operation === "push";
  const isPull = operationState.operation === "pull";
  const isSuccess = operationState.status === "success";
  const isError = operationState.status === "error";
  const isInProgress = operationState.status === "in_progress";

  const percent = operationState.progressPercent ?? 0;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 sm:w-96 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
      <div
        className={`neo-box p-4 rounded-xl border-2 backdrop-blur-md bg-opacity-95 bg-[var(--neo-card-bg)] ${
          isInProgress
            ? "border-blue-500/50 shadow-blue-500/10"
            : isSuccess
            ? "border-emerald-500/50 shadow-emerald-500/10"
            : "border-red-500/50 shadow-red-500/10"
        }`}
      >
        {/* Header section */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-lg ${
                isInProgress
                  ? "bg-blue-500/20 text-blue-400"
                  : isSuccess
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {isInProgress ? (
                isPull ? (
                  <Download className="h-5 w-5 animate-bounce" />
                ) : isPush ? (
                  <Upload className="h-5 w-5 animate-bounce" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )
              ) : isSuccess ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--neo-text)]">
                {isInProgress
                  ? isPush
                    ? "Uploading to Device"
                    : isPull
                    ? "Downloading from Device"
                    : "File Operation"
                  : isSuccess
                  ? "Operation Completed"
                  : "Operation Failed"}
              </h4>
              <p className="text-xs font-semibold text-[var(--neo-text-muted)] line-clamp-1 mt-0.5">
                {operationState.message}
              </p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="p-1 rounded-md text-[var(--neo-text-muted)] hover:text-[var(--neo-text)] hover:bg-white/10 transition-colors"
            title="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* File Detail and Counter (for batch ops) */}
        {(operationState.currentFile || operationState.totalItems) && (
          <div className="mt-3 pt-2.5 border-t border-[var(--neo-border)] space-y-1.5">
            {operationState.currentFile && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--neo-text)] font-mono truncate">
                <FileText className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                <span className="truncate" title={operationState.currentFile}>
                  {operationState.currentFile}
                </span>
              </div>
            )}

            {operationState.totalItems !== undefined && (
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--neo-text-muted)]">
                <span>
                  Items: {operationState.completedItems ?? 0} / {operationState.totalItems}
                </span>
                {isInProgress && <span>{percent}%</span>}
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        {isInProgress && (
          <div className="mt-2.5 w-full bg-[var(--neo-bg)] h-2 rounded-full overflow-hidden p-0.5 border border-[var(--neo-border)]">
            <div
              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${Math.max(5, percent)}%`,
              }}
            />
          </div>
        )}

        {/* Expandable Error Log Details */}
        {isError && (
          <div className="mt-3 pt-2 border-t border-red-500/20">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-red-400 hover:underline py-1"
            >
              <span className="flex items-center gap-1">
                <Terminal className="h-3 w-3" />
                {showLogs ? "Hide Error Log" : "View Error Log Details"}
              </span>
              {showLogs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showLogs && (
              <div className="mt-1.5 p-2 bg-black/40 rounded border border-red-500/30 text-[10px] font-mono text-red-300 max-h-32 overflow-y-auto whitespace-pre-wrap break-all">
                {operationState.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
