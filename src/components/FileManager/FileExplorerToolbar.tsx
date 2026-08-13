import React from "react";
import {
  ChevronRight,
  Search,
  FolderPlus,
  Upload,
  Download,
  Copy,
  Move,
  Trash2,
  RefreshCw,
} from "lucide-react";

interface FileExplorerToolbarProps {
  currentPath: string;
  pathInput: string;
  setPathInput: (path: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCount: number;
  clipboardAction: { type: "copy" | "move"; paths: string[] } | null;
  loading: boolean;
  onNavigateUp: () => void;
  onPathSubmit: (e: React.FormEvent) => void;
  onOpenFolderModal: () => void;
  onPushFile: () => void;
  onPullSelected: () => void;
  onCopySelected: () => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onPaste: () => void;
  onRefresh: () => void;
}

export const FileExplorerToolbar: React.FC<FileExplorerToolbarProps> = ({
  currentPath,
  pathInput,
  setPathInput,
  searchQuery,
  setSearchQuery,
  selectedCount,
  clipboardAction,
  loading,
  onNavigateUp,
  onPathSubmit,
  onOpenFolderModal,
  onPushFile,
  onPullSelected,
  onCopySelected,
  onMoveSelected,
  onDeleteSelected,
  onPaste,
  onRefresh,
}) => {
  return (
    <div className="neo-box p-3 bg-[var(--neo-card-bg)] space-y-3">
      {/* Navigation & Search bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={onPathSubmit} className="flex-1 flex gap-2">
          <button
            type="button"
            onClick={onNavigateUp}
            disabled={currentPath === "/"}
            className="neo-btn px-3 py-2 text-xs font-extrabold flex items-center gap-1 disabled:opacity-40"
            title="Go to Parent Directory"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            <span>Up</span>
          </button>

          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="w-full neo-input text-xs font-mono py-2 pl-3 pr-8 bg-[var(--neo-bg)] text-[var(--neo-text)] font-semibold"
              placeholder="Enter remote path (e.g. /sdcard)"
            />
          </div>

          <button
            type="submit"
            className="neo-btn px-3 py-2 text-xs font-black bg-[var(--neo-primary)] text-[var(--neo-primary-text)]"
          >
            Go
          </button>
        </form>

        {/* Search Box */}
        <div className="relative w-full sm:w-56">
          <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-[var(--neo-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter current folder..."
            className="w-full neo-input text-xs py-2 pl-8 pr-3 bg-[var(--neo-bg)]"
          />
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--neo-border)] pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenFolderModal}
            className="neo-btn px-3 py-1.5 text-xs font-extrabold flex items-center gap-1.5 bg-[var(--neo-bg)]"
          >
            <FolderPlus className="h-3.5 w-3.5 text-amber-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={onPushFile}
            className="neo-btn px-3 py-1.5 text-xs font-extrabold flex items-center gap-1.5 bg-[var(--neo-bg)]"
            title="Upload single or multiple files from PC to ADB device"
          >
            <Upload className="h-3.5 w-3.5 text-emerald-400" />
            <span>Push / Upload Files</span>
          </button>

          {/* Batch Download / Copy / Move / Delete */}
          {selectedCount > 0 && (
            <>
              <button
                onClick={onPullSelected}
                className="neo-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 bg-teal-500/10 text-teal-400"
                title="Download selected items to local PC folder"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Pull / Download ({selectedCount})</span>
              </button>

              <button
                onClick={onCopySelected}
                className="neo-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 bg-blue-500/10 text-blue-400"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy ({selectedCount})</span>
              </button>

              <button
                onClick={onMoveSelected}
                className="neo-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 bg-purple-500/10 text-purple-400"
              >
                <Move className="h-3.5 w-3.5" />
                <span>Move ({selectedCount})</span>
              </button>

              <button
                onClick={onDeleteSelected}
                className="neo-btn px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 bg-red-500/10 text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete ({selectedCount})</span>
              </button>
            </>
          )}

          {clipboardAction && (
            <button
              onClick={onPaste}
              className="neo-btn px-3 py-1.5 text-xs font-black bg-emerald-500 text-white animate-pulse"
            >
              Paste {clipboardAction.paths.length} item(s) here ({clipboardAction.type})
            </button>
          )}
        </div>

        <button
          onClick={onRefresh}
          disabled={loading}
          className="neo-btn p-1.5 text-xs font-bold flex items-center gap-1"
          title="Refresh Directory"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
};
