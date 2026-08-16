import React from "react";
import {
  ChevronRight,
  FolderPlus,
  Upload,
  Download,
  Copy,
  Move,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button, SearchInput } from "../ui";

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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onNavigateUp}
            disabled={currentPath === "/"}
            icon={<ChevronRight className="h-4 w-4 rotate-180" />}
            title="Go to Parent Directory"
          >
            Up
          </Button>

          <div className="flex-1 relative flex items-center">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              className="w-full neo-input text-xs font-mono py-2 pl-3 pr-8 bg-[var(--neo-bg)] text-[var(--neo-text)] font-semibold"
              placeholder="Enter remote path (e.g. /sdcard)"
            />
          </div>

          <Button type="submit" size="sm" variant="primary">
            Go
          </Button>
        </form>

        {/* Search Box */}
        <div className="w-full sm:w-56">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter current folder..."
          />
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--neo-border)] pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenFolderModal}
            icon={<FolderPlus className="h-3.5 w-3.5 text-amber-400" />}
          >
            New Folder
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onPushFile}
            icon={<Upload className="h-3.5 w-3.5 text-emerald-400" />}
            title="Upload single or multiple files from PC to ADB device"
          >
            Push / Upload Files
          </Button>

          {/* Batch Download / Copy / Move / Delete */}
          {selectedCount > 0 && (
            <>
              <Button
                size="sm"
                variant="cyan"
                onClick={onPullSelected}
                icon={<Download className="h-3.5 w-3.5" />}
                title="Download selected items to local PC folder"
              >
                Pull ({selectedCount})
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={onCopySelected}
                icon={<Copy className="h-3.5 w-3.5" />}
              >
                Copy ({selectedCount})
              </Button>

              <Button
                size="sm"
                variant="accent"
                onClick={onMoveSelected}
                icon={<Move className="h-3.5 w-3.5" />}
              >
                Move ({selectedCount})
              </Button>

              <Button
                size="sm"
                variant="rose"
                onClick={onDeleteSelected}
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Delete ({selectedCount})
              </Button>
            </>
          )}

          {clipboardAction && (
            <Button
              size="sm"
              variant="primary"
              onClick={onPaste}
              className="animate-pulse"
            >
              Paste {clipboardAction.paths.length} item(s) here ({clipboardAction.type})
            </Button>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          disabled={loading}
          icon={<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />}
          title="Refresh Directory"
        />
      </div>
    </div>
  );
};
