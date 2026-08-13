import React from "react";
import { FilePermissionsModal } from "./FilePermissionsModal";
import { StorageVisualizer } from "./StorageVisualizer";
import { PresetPathsBar } from "./PresetPathsBar";
import { FileExplorerToolbar } from "./FileExplorerToolbar";
import { FileTable } from "./FileTable";
import { CreateFolderModal } from "./CreateFolderModal";
import { RenameModal } from "./RenameModal";
import { FileManagerToast } from "./FileManagerToast";
import { useFileManager } from "./useFileManager";
import { AlertCircle, Upload } from "lucide-react";

interface FileManagerProps {
  activeDevice: string | null;
}

export const FileManager: React.FC<FileManagerProps> = ({ activeDevice }) => {
  const {
    currentPath,
    pathInput,
    setPathInput,
    storageList,
    loading,
    searchQuery,
    setSearchQuery,
    selectedPaths,
    permissionTarget,
    setPermissionTarget,
    operationState,
    setOperationState,
    newFolderName,
    setNewFolderName,
    showFolderModal,
    setShowFolderModal,
    renameTarget,
    setRenameTarget,
    renameValue,
    setRenameValue,
    clipboardAction,
    setClipboardAction,
    isDragOver,
    loadDirectory,
    handlePathSubmit,
    handleNavigateUp,
    toggleSelect,
    toggleSelectAll,
    handleSort,
    filteredFiles,
    handleCreateFolder,
    handleRename,
    handleDeleteSelected,
    handleDeleteSingle,
    handlePaste,
    handlePullFile,
    handlePullSelected,
    handlePushFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  } = useFileManager(activeDevice);

  if (!activeDevice) {
    return (
      <div className="neo-box p-8 text-center bg-[var(--neo-card-bg)] space-y-3">
        <AlertCircle className="h-10 w-10 text-amber-400 mx-auto" />
        <h3 className="text-lg font-black">No Active Device Connected</h3>
        <p className="text-xs text-[var(--neo-text-muted)]">
          Please select a connected device from the top navigation bar to explore files.
        </p>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`space-y-4 relative transition-all ${
        isDragOver ? "ring-4 ring-[var(--neo-primary)] ring-offset-2" : ""
      }`}
    >
      {/* Drag Over Overlay Hint */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-[var(--neo-primary)]/20 backdrop-blur-sm border-4 border-dashed border-[var(--neo-primary)] rounded-lg flex items-center justify-center pointer-events-none">
          <div className="neo-box bg-[var(--neo-card-bg)] p-6 text-center shadow-2xl">
            <Upload className="h-12 w-12 text-[var(--neo-primary)] mx-auto animate-bounce" />
            <div className="text-base font-black text-[var(--neo-text)] mt-2">
              Drop Files to Upload to ADB Device
            </div>
            <div className="text-xs text-[var(--neo-text-muted)]">Target path: {currentPath}</div>
          </div>
        </div>
      )}

      {/* Storage Visualizer */}
      <StorageVisualizer storageList={storageList} />

      {/* Preset Paths Shortcuts */}
      <PresetPathsBar currentPath={currentPath} onSelectPath={loadDirectory} />

      {/* Main Explorer Toolbar */}
      <FileExplorerToolbar
        currentPath={currentPath}
        pathInput={pathInput}
        setPathInput={setPathInput}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedCount={selectedPaths.size}
        clipboardAction={clipboardAction}
        loading={loading}
        onNavigateUp={handleNavigateUp}
        onPathSubmit={handlePathSubmit}
        onOpenFolderModal={() => setShowFolderModal(true)}
        onPushFile={handlePushFile}
        onPullSelected={handlePullSelected}
        onCopySelected={() =>
          setClipboardAction({ type: "copy", paths: Array.from(selectedPaths) })
        }
        onMoveSelected={() =>
          setClipboardAction({ type: "move", paths: Array.from(selectedPaths) })
        }
        onDeleteSelected={handleDeleteSelected}
        onPaste={handlePaste}
        onRefresh={() => loadDirectory(currentPath)}
      />

      {/* Operation Feedback Toast */}
      <FileManagerToast
        operationState={operationState}
        onDismiss={() => setOperationState({ status: "idle", message: "" })}
      />

      {/* Files Table */}
      <FileTable
        files={filteredFiles}
        loading={loading}
        selectedPaths={selectedPaths}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        onSort={handleSort}
        onOpenDirectory={loadDirectory}
        onSetPermissionTarget={setPermissionTarget}
        onPullFile={handlePullFile}
        onSetRenameTarget={(file) => {
          setRenameTarget(file);
          setRenameValue(file.name);
        }}
        onDeleteSingleFile={handleDeleteSingle}
      />

      {/* Permissions Modal */}
      {permissionTarget && (
        <FilePermissionsModal
          serial={activeDevice}
          file={permissionTarget}
          onClose={() => setPermissionTarget(null)}
          onSuccess={() => loadDirectory(currentPath)}
        />
      )}

      {/* Create Folder Modal */}
      {showFolderModal && (
        <CreateFolderModal
          folderName={newFolderName}
          setFolderName={setNewFolderName}
          onClose={() => setShowFolderModal(false)}
          onCreate={handleCreateFolder}
        />
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <RenameModal
          renameValue={renameValue}
          setRenameValue={setRenameValue}
          onClose={() => setRenameTarget(null)}
          onRename={handleRename}
        />
      )}
    </div>
  );
};
