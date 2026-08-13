import React, { useState, useEffect, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DeviceFile, StoragePartition, SortField, SortOrder } from "../../types/fileManager";
import { useFileOperations } from "./useFileOperations";

export const useFileManager = (activeDevice: string | null) => {
  const [currentPath, setCurrentPath] = useState<string>("/sdcard");
  const [pathInput, setPathInput] = useState<string>("/sdcard");
  const [files, setFiles] = useState<DeviceFile[]>([]);
  const [storageList, setStorageList] = useState<StoragePartition[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Sorting
  const [sortField, setSortField] = useState<SortField>("is_dir");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Permission Target Modal
  const [permissionTarget, setPermissionTarget] = useState<DeviceFile | null>(null);

  // Fetch Storage Information
  const fetchStorageInfo = useCallback(async () => {
    if (!activeDevice) return;
    try {
      const data: StoragePartition[] = await invoke("get_device_storage_info", {
        serial: activeDevice,
      });
      setStorageList(data);
    } catch (err) {
      console.warn("Storage info fetch error:", err);
    }
  }, [activeDevice]);

  // Fetch Directory Files
  const loadDirectory = useCallback(
    async (path: string) => {
      if (!activeDevice) return;
      setLoading(true);
      setSelectedPaths(new Set());
      try {
        const fileList: DeviceFile[] = await invoke("list_device_files", {
          serial: activeDevice,
          path,
        });
        setFiles(fileList);
        setCurrentPath(path);
        setPathInput(path);
      } catch (err: any) {
        // Handle error through operations hook setOperationState if needed
      } finally {
        setLoading(false);
      }
    },
    [activeDevice]
  );

  const ops = useFileOperations({
    activeDevice,
    currentPath,
    loadDirectory,
    selectedPaths,
    setSelectedPaths,
  });

  useEffect(() => {
    if (activeDevice) {
      loadDirectory(currentPath);
      fetchStorageInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDevice]);

  // Real-time ADB Progress Event Listener from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const listenProgress = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<{ serial: string; path: string; percent: number }>(
          "adb-file-progress",
          (event) => {
            if (event.payload && typeof event.payload.percent === "number") {
              ops.setOperationState((prev) => {
                if (prev.status !== "in_progress") return prev;
                return {
                  ...prev,
                  progressPercent: event.payload.percent,
                };
              });
            }
          }
        );
      } catch (e) {
        console.error("Failed to listen for adb progress:", e);
      }
    };

    listenProgress();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Native drag & drop events listener
  const setIsDragOver = ops.setIsDragOver;
  const setOperationState = ops.setOperationState;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const setupNativeDragDrop = async () => {
      try {
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "over") {
            setIsDragOver(true);
          } else if (event.payload.type === "leave") {
            setIsDragOver(false);
          } else if (event.payload.type === "drop") {
            setIsDragOver(false);
            const paths = event.payload.paths;
            if (paths && paths.length > 0 && activeDevice) {
              (async () => {
                const total = paths.length;
                setOperationState({
                  status: "in_progress",
                  operation: "push",
                  message: `Uploading ${total} dropped file(s)...`,
                  completedItems: 0,
                  totalItems: total,
                  progressPercent: 0,
                });
                try {
                  for (let i = 0; i < total; i++) {
                    const localPath = paths[i];
                    const basename = localPath.substring(
                      Math.max(localPath.lastIndexOf("/"), localPath.lastIndexOf("\\")) + 1
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
                      message: `Uploading dropped file (${i + 1}/${total})...`,
                      currentFile: basename,
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
                    message: `Uploaded ${total} file(s) successfully!`,
                    completedItems: total,
                    totalItems: total,
                    progressPercent: 100,
                  });
                  loadDirectory(currentPath);
                } catch (err: any) {
                  setOperationState({
                    status: "error",
                    operation: "push",
                    message: `Push failed: ${err?.toString()}`,
                  });
                }
              })();
            }
          }
        });
      } catch (e) {
        console.error("Failed to setup drag drop listener:", e);
      }
    };

    setupNativeDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, [activeDevice, currentPath, loadDirectory, setIsDragOver, setOperationState]);

  // Navigation handlers
  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      loadDirectory(pathInput.trim());
    }
  };

  const handleNavigateUp = () => {
    let clean = currentPath.trim();
    if (clean.endsWith("/") && clean.length > 1) {
      clean = clean.slice(0, -1);
    }
    if (clean === "/" || clean === "") return;

    const parentPath = clean.substring(0, clean.lastIndexOf("/")) || "/";
    loadDirectory(parentPath);
  };

  // Selection toggle
  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Filtered & Sorted files
  const filteredFiles = useMemo(() => {
    let result = files.filter(
      (f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.permissions.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return result.sort((a, b) => {
      if (sortField === "is_dir") {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return sortOrder === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      if (sortField === "name") {
        return sortOrder === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }

      if (sortField === "size") {
        return sortOrder === "asc" ? a.size - b.size : b.size - a.size;
      }

      if (sortField === "modified") {
        return sortOrder === "asc"
          ? a.modified.localeCompare(b.modified)
          : b.modified.localeCompare(a.modified);
      }

      return 0;
    });
  }, [files, searchQuery, sortField, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedPaths.size === filteredFiles.length) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
    }
  };

  // Sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return {
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
    loadDirectory,
    handlePathSubmit,
    handleNavigateUp,
    toggleSelect,
    toggleSelectAll,
    handleSort,
    filteredFiles,
    ...ops,
  };
};
