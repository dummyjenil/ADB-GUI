import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DeviceFile, FileOperationProgress } from "../../types/fileManager";

interface UseFileOperationsParams {
  activeDevice: string | null;
  currentPath: string;
  loadDirectory: (path: string) => Promise<void>;
  selectedPaths: Set<string>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useFileOperations = ({
  activeDevice,
  currentPath,
  loadDirectory,
  selectedPaths,
  setSelectedPaths,
}: UseFileOperationsParams) => {
  const [operationState, setOperationState] = useState<FileOperationProgress>({
    status: "idle",
    message: "",
  });

  const [newFolderName, setNewFolderName] = useState<string>("");
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);

  const [renameTarget, setRenameTarget] = useState<DeviceFile | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");

  const [clipboardAction, setClipboardAction] = useState<{
    type: "copy" | "move";
    paths: string[];
  } | null>(null);

  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleCreateFolder = async () => {
    if (!activeDevice || !newFolderName.trim()) return;
    const targetDir =
      currentPath === "/" ? `/${newFolderName.trim()}` : `${currentPath}/${newFolderName.trim()}`;

    setOperationState({ status: "in_progress", message: "Creating directory..." });
    try {
      await invoke("create_device_directory", { serial: activeDevice, path: targetDir });
      setOperationState({ status: "success", message: `Folder '${newFolderName}' created` });
      setShowFolderModal(false);
      setNewFolderName("");
      loadDirectory(currentPath);
    } catch (err: any) {
      setOperationState({ status: "error", message: err?.toString() || "Failed to create folder" });
    }
  };

  const handleRename = async () => {
    if (!activeDevice || !renameTarget || !renameValue.trim()) return;
    const parent = renameTarget.path.substring(0, renameTarget.path.lastIndexOf("/")) || "/";
    const dest = parent === "/" ? `/${renameValue.trim()}` : `${parent}/${renameValue.trim()}`;

    setOperationState({ status: "in_progress", message: "Renaming..." });
    try {
      await invoke("rename_or_move_device_file", {
        serial: activeDevice,
        srcPath: renameTarget.path,
        destPath: dest,
      });
      setOperationState({ status: "success", message: "Rename successful" });
      setRenameTarget(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      setOperationState({ status: "error", message: err?.toString() || "Rename failed" });
    }
  };

  const handleDeleteSelected = async () => {
    if (!activeDevice || selectedPaths.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPaths.size} selected item(s)?`)) return;

    setOperationState({ status: "in_progress", message: "Deleting selected items..." });
    try {
      for (const path of selectedPaths) {
        await invoke("delete_device_file_or_dir", { serial: activeDevice, path });
      }
      setOperationState({ status: "success", message: "Items deleted successfully" });
      setSelectedPaths(new Set());
      loadDirectory(currentPath);
    } catch (err: any) {
      setOperationState({ status: "error", message: err?.toString() || "Deletion failed" });
    }
  };

  const handleDeleteSingle = async (file: DeviceFile) => {
    if (!activeDevice) return;
    if (confirm(`Delete ${file.name}?`)) {
      setOperationState({
        status: "in_progress",
        operation: "delete",
        message: `Deleting ${file.name}...`,
      });
      try {
        await invoke("delete_device_file_or_dir", {
          serial: activeDevice,
          path: file.path,
        });
        setOperationState({
          status: "success",
          operation: "delete",
          message: `'${file.name}' deleted successfully`,
        });
        loadDirectory(currentPath);
      } catch (err: any) {
        setOperationState({
          status: "error",
          operation: "delete",
          message: `Failed to delete '${file.name}': ${err?.toString() || "Unknown error"}`,
        });
      }
    }
  };

  const handlePaste = async () => {
    if (!activeDevice || !clipboardAction || clipboardAction.paths.length === 0) return;

    setOperationState({
      status: "in_progress",
      message: `${clipboardAction.type === "copy" ? "Copying" : "Moving"} items...`,
    });

    try {
      for (const src of clipboardAction.paths) {
        const basename = src.substring(src.lastIndexOf("/") + 1);
        const dest = currentPath === "/" ? `/${basename}` : `${currentPath}/${basename}`;

        if (clipboardAction.type === "copy") {
          await invoke("copy_device_file", { serial: activeDevice, srcPath: src, destPath: dest });
        } else {
          await invoke("rename_or_move_device_file", {
            serial: activeDevice,
            srcPath: src,
            destPath: dest,
          });
        }
      }
      setOperationState({ status: "success", message: "Paste completed" });
      setClipboardAction(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      setOperationState({ status: "error", message: err?.toString() || "Paste failed" });
    }
  };

  const handlePullFile = async (remotePath: string, fileName: string) => {
    if (!activeDevice) return;
    try {
      const saveDir: string | null = await invoke("pick_save_directory");
      if (!saveDir) return;

      const localPath = `${saveDir}/${fileName}`;
      setOperationState({
        status: "in_progress",
        operation: "pull",
        message: `Downloading ${fileName}...`,
        currentFile: fileName,
        completedItems: 0,
        totalItems: 1,
        progressPercent: 30,
      });

      await invoke("pull_device_file", { serial: activeDevice, remotePath, localPath });
      setOperationState({
        status: "success",
        operation: "pull",
        message: `Saved ${fileName} to ${saveDir}`,
        currentFile: fileName,
        completedItems: 1,
        totalItems: 1,
        progressPercent: 100,
      });
    } catch (err: any) {
      setOperationState({ status: "error", operation: "pull", message: err?.toString() || "ADB pull failed" });
    }
  };

  const handlePullSelected = async () => {
    if (!activeDevice || selectedPaths.size === 0) return;
    try {
      const saveDir: string | null = await invoke("pick_save_directory");
      if (!saveDir) return;

      const pathsToPull = Array.from(selectedPaths);
      const total = pathsToPull.length;

      setOperationState({
        status: "in_progress",
        operation: "pull",
        message: `Preparing to download ${total} item(s)...`,
        completedItems: 0,
        totalItems: total,
        progressPercent: 0,
      });

      for (let i = 0; i < total; i++) {
        const remotePath = pathsToPull[i];
        const fileName = remotePath.substring(remotePath.lastIndexOf("/") + 1) || "downloaded_file";
        const localPath = `${saveDir}/${fileName}`;

        setOperationState({
          status: "in_progress",
          operation: "pull",
          message: `Downloading (${i + 1}/${total})...`,
          currentFile: fileName,
          completedItems: i,
          totalItems: total,
          progressPercent: Math.round((i / total) * 100),
        });

        await invoke("pull_device_file", { serial: activeDevice, remotePath, localPath });
      }

      setOperationState({
        status: "success",
        operation: "pull",
        message: `Successfully downloaded ${total} item(s) to ${saveDir}`,
        completedItems: total,
        totalItems: total,
        progressPercent: 100,
      });
      setSelectedPaths(new Set());
    } catch (err: any) {
      setOperationState({ status: "error", operation: "pull", message: err?.toString() || "Batch download failed" });
    }
  };

  const handlePushFile = async () => {
    if (!activeDevice) return;
    try {
      const selectedFiles: string[] | null = await invoke("pick_multiple_files");
      if (!selectedFiles || selectedFiles.length === 0) return;

      const total = selectedFiles.length;
      setOperationState({
        status: "in_progress",
        operation: "push",
        message: `Preparing to upload ${total} file(s)...`,
        completedItems: 0,
        totalItems: total,
        progressPercent: 0,
      });

      for (let i = 0; i < total; i++) {
        const localFile = selectedFiles[i];
        const basename = localFile.substring(
          Math.max(localFile.lastIndexOf("/"), localFile.lastIndexOf("\\")) + 1
        );
        const remoteTarget =
          currentPath === "/"
            ? `/${basename}`
            : currentPath.endsWith("/")
            ? `${currentPath}${basename}`
            : `${currentPath}/${basename}`;

        setOperationState({
          status: "in_progress",
          operation: "push",
          message: `Uploading (${i + 1}/${total})...`,
          currentFile: basename,
          completedItems: i,
          totalItems: total,
          progressPercent: Math.round((i / total) * 100),
        });

        await invoke("push_device_file", {
          serial: activeDevice,
          localPath: localFile,
          remotePath: remoteTarget,
        });
      }

      setOperationState({
        status: "success",
        operation: "push",
        message: `Successfully uploaded ${total} file(s)`,
        completedItems: total,
        totalItems: total,
        progressPercent: 100,
      });
      loadDirectory(currentPath);
    } catch (err: any) {
      setOperationState({ status: "error", operation: "push", message: err?.toString() || "Push failed" });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (!activeDevice) return;
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const total = droppedFiles.length;
    setOperationState({
      status: "in_progress",
      operation: "push",
      message: `Uploading ${total} dragged file(s)...`,
      completedItems: 0,
      totalItems: total,
      progressPercent: 0,
    });

    try {
      for (let i = 0; i < total; i++) {
        const file = droppedFiles[i];
        const remoteTarget =
          currentPath === "/"
            ? `/${file.name}`
            : currentPath.endsWith("/")
            ? `${currentPath}${file.name}`
            : `${currentPath}/${file.name}`;

        const localPath = (file as any).path || file.name;

        setOperationState({
          status: "in_progress",
          operation: "push",
          message: `Uploading dragged file (${i + 1}/${total})...`,
          currentFile: file.name,
          completedItems: i,
          totalItems: total,
          progressPercent: Math.round((i / total) * 100),
        });

        await invoke("push_device_file", {
          serial: activeDevice,
          localPath,
          remotePath: remoteTarget,
        });
      }
      setOperationState({
        status: "success",
        operation: "push",
        message: `Pushed ${total} file(s) successfully`,
        completedItems: total,
        totalItems: total,
        progressPercent: 100,
      });
      loadDirectory(currentPath);
    } catch (err: any) {
      setOperationState({ status: "error", operation: "push", message: err?.toString() || "Drop push failed" });
    }
  };

  return {
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
    setIsDragOver,
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
  };
};
