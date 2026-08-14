import React, { useState } from "react";
import { Terminal, Copy, Check, ExternalLink, X, Code2, Info } from "lucide-react";
import { CommandPreview } from "../types/terminal";

interface CommandPreviewModalProps {
  preview: CommandPreview | null;
  onClose: () => void;
  onRunInTerminal?: (cmd: string) => void;
}

export const CommandPreviewModal: React.FC<CommandPreviewModalProps> = ({
  preview,
  onClose,
  onRunInTerminal,
}) => {
  const [copied, setCopied] = useState(false);

  if (!preview) return null;

  const handleCopy = async () => {
    const cleanCmd = preview.command.replace(/\r\n/g, "\n").trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(cleanCmd);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (e) {
        console.error("Clipboard API error", e);
      }
    }
    const textArea = document.createElement("textarea");
    textArea.value = cleanCmd;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    if (onRunInTerminal) {
      let cmd = preview.command.trim();
      // Strip host ADB command prefix to run purely inside interactive device shell
      cmd = cmd.replace(/^adb(\.exe)?\s+(-s\s+\S+\s+)?shell\s+/i, "");
      onRunInTerminal(cmd);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="neo-box w-full max-w-xl bg-[var(--neo-card-bg)] text-[var(--neo-text)] shadow-[8px_8px_0px_0px_var(--neo-shadow)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[var(--neo-border)] bg-[var(--neo-primary)] text-[var(--neo-primary-text)] font-black">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide">
            <Code2 className="h-5 w-5 shrink-0" />
            <span>Raw ADB Command Preview</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/10 rounded transition-colors text-current cursor-pointer"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          <div>
            <span className="text-xs font-bold text-[var(--neo-text-muted)] uppercase tracking-wider block mb-1">
              Action Name
            </span>
            <h3 className="text-base font-extrabold">{preview.title}</h3>
            {preview.description && (
              <p className="text-xs text-[var(--neo-text-muted)] mt-1 flex items-start gap-1.5">
                <Info className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>{preview.description}</span>
              </p>
            )}
          </div>

          {/* Command display block */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--neo-text-muted)]">
                Command Execution
              </span>
              {preview.category && (
                <span className="text-[10px] font-black uppercase px-2 py-0.5 border border-[var(--neo-border)] bg-amber-400 text-black">
                  {preview.category}
                </span>
              )}
            </div>

            <div className="relative group">
              <div className="overflow-x-auto custom-scrollbar p-3.5 pr-14 rounded bg-slate-900 border-2 border-black shadow-[inset_0px_2px_4px_rgba(0,0,0,0.5)]">
                <pre className="text-emerald-400 font-mono text-xs leading-relaxed whitespace-pre inline-block min-w-full">
                  <code>{preview.command}</code>
                </pre>
              </div>

              <button
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 neo-btn px-2 py-1 text-xs bg-slate-800 text-white border-slate-700 hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                title="Copy Command"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 text-[10px] font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[var(--neo-text-muted)] bg-[var(--neo-bg)] p-3 border-2 border-[var(--neo-border)] flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>
              Executing this command in your system terminal or the built-in ADB Shell will yield identical results.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t-2 border-[var(--neo-border)] bg-[var(--neo-bg)] flex items-center justify-end gap-3">
          <button onClick={onClose} className="neo-btn px-4 py-2 text-xs font-bold bg-gray-200 text-gray-800">
            Close
          </button>
          <button
            onClick={handleCopy}
            className="neo-btn px-4 py-2 text-xs font-extrabold bg-blue-400 text-black flex items-center gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Command
          </button>
          {onRunInTerminal && (
            <button
              onClick={handleRun}
              className="neo-btn px-4 py-2 text-xs font-extrabold bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center gap-1.5"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Run in Shell Terminal</span>
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
