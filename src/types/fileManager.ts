export interface DeviceFile {
  name: string;
  path: string;
  is_dir: boolean;
  size: number; // bytes
  permissions: string; // e.g. "-rw-r--r--" or "drwxr-xr-x"
  owner: string;
  group: string;
  modified: string;
}

export interface StoragePartition {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  use_percent: string;
  mounted_on: string;
}

export type SortField = "name" | "size" | "modified" | "is_dir";
export type SortOrder = "asc" | "desc";

export interface FileOperationProgress {
  status: "idle" | "in_progress" | "success" | "error";
  message: string;
  operation?: "push" | "pull" | "delete" | "mkdir" | "rename" | "copy" | "chmod";
  currentFile?: string;
  completedItems?: number;
  totalItems?: number;
  progressPercent?: number;
}
