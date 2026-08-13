import React from "react";
import {
  CheckSquare,
  Square,
  ArrowUpDown,
  RefreshCw,
  Shield,
  Download,
  Edit2,
  Trash2,
} from "lucide-react";
import { DeviceFile, SortField } from "../../types/fileManager";
import { formatSize, getFileIcon } from "./fileManagerUtils";

interface FileTableProps {
  files: DeviceFile[];
  loading: boolean;
  selectedPaths: Set<string>;
  toggleSelect: (path: string) => void;
  toggleSelectAll: () => void;
  onSort: (field: SortField) => void;
  onOpenDirectory: (path: string) => void;
  onSetPermissionTarget: (file: DeviceFile) => void;
  onPullFile: (remotePath: string, fileName: string) => void;
  onSetRenameTarget: (file: DeviceFile) => void;
  onDeleteSingleFile: (file: DeviceFile) => void;
}

export const FileTable: React.FC<FileTableProps> = ({
  files,
  loading,
  selectedPaths,
  toggleSelect,
  toggleSelectAll,
  onSort,
  onOpenDirectory,
  onSetPermissionTarget,
  onPullFile,
  onSetRenameTarget,
  onDeleteSingleFile,
}) => {
  return (
    <div className="neo-box bg-[var(--neo-card-bg)] overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[var(--neo-border)] bg-[var(--neo-bg)] text-[var(--neo-text-muted)] font-black uppercase text-[10px]">
              <th className="p-3 w-10 text-center">
                <button onClick={toggleSelectAll}>
                  {selectedPaths.size > 0 && selectedPaths.size === files.length ? (
                    <CheckSquare className="h-4 w-4 text-[var(--neo-primary)]" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="p-3 cursor-pointer" onClick={() => onSort("name")}>
                <div className="flex items-center gap-1">
                  <span>Name</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="p-3 cursor-pointer hidden md:table-cell" onClick={() => onSort("size")}>
                <div className="flex items-center gap-1">
                  <span>Size</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="p-3 hidden sm:table-cell">Permissions</th>
              <th className="p-3 hidden lg:table-cell" onClick={() => onSort("modified")}>
                <div className="flex items-center gap-1">
                  <span>Modified</span>
                  <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--neo-border)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--neo-text-muted)] font-bold">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[var(--neo-primary)]" />
                  Reading directory contents...
                </td>
              </tr>
            ) : files.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--neo-text-muted)] font-bold">
                  No files found in this directory.
                </td>
              </tr>
            ) : (
              files.map((file) => {
                const isSelected = selectedPaths.has(file.path);
                return (
                  <tr
                    key={file.path}
                    className={`hover:bg-black/5 transition-colors ${
                      isSelected ? "bg-[var(--neo-primary)]/10" : ""
                    }`}
                  >
                    <td className="p-3 text-center">
                      <button onClick={() => toggleSelect(file.path)}>
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-[var(--neo-primary)]" />
                        ) : (
                          <Square className="h-4 w-4 text-[var(--neo-text-muted)]" />
                        )}
                      </button>
                    </td>

                    <td className="p-3 font-semibold text-[var(--neo-text)]">
                      <div className="flex items-center gap-2">
                        {getFileIcon(file)}
                        {file.is_dir ? (
                          <button
                            onClick={() => onOpenDirectory(file.path)}
                            className="hover:underline font-extrabold text-[var(--neo-primary)] text-left truncate max-w-xs sm:max-w-md"
                          >
                            {file.name}
                          </button>
                        ) : (
                          <span className="truncate max-w-xs sm:max-w-md">{file.name}</span>
                        )}
                      </div>
                    </td>

                    <td className="p-3 font-mono text-[var(--neo-text-muted)] hidden md:table-cell">
                      {formatSize(file.size)}
                    </td>

                    <td className="p-3 font-mono text-[11px] text-[var(--neo-text-muted)] hidden sm:table-cell">
                      <button
                        onClick={() => onSetPermissionTarget(file)}
                        className="hover:bg-black/10 px-1.5 py-0.5 rounded flex items-center gap-1"
                        title="Edit Permissions"
                      >
                        <Shield className="h-3 w-3 text-amber-400" />
                        <span>{file.permissions}</span>
                      </button>
                    </td>

                    <td className="p-3 font-mono text-[11px] text-[var(--neo-text-muted)] hidden lg:table-cell">
                      {file.modified || "-"}
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!file.is_dir && (
                          <button
                            onClick={() => onPullFile(file.path, file.name)}
                            className="neo-btn p-1.5 hover:bg-emerald-500/10 text-emerald-400"
                            title="Download (ADB Pull)"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onSetRenameTarget(file)}
                          className="neo-btn p-1.5 hover:bg-blue-500/10 text-blue-400"
                          title="Rename"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() => onDeleteSingleFile(file)}
                          className="neo-btn p-1.5 hover:bg-red-500/10 text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
