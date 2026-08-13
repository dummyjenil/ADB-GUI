import {
  Home,
  Download,
  FileImage,
  FileVideo,
  File,
  HardDrive,
  Folder,
  FileAudio,
  FileArchive,
  FileCode,
} from "lucide-react";
import { DeviceFile } from "../../types/fileManager";

export const PRESET_PATHS = [
  { label: "Internal Storage", path: "/sdcard", icon: <Home className="h-3.5 w-3.5" /> },
  { label: "Downloads", path: "/sdcard/Download", icon: <Download className="h-3.5 w-3.5" /> },
  { label: "DCIM", path: "/sdcard/DCIM", icon: <FileImage className="h-3.5 w-3.5" /> },
  { label: "Pictures", path: "/sdcard/Pictures", icon: <FileImage className="h-3.5 w-3.5" /> },
  { label: "Movies", path: "/sdcard/Movies", icon: <FileVideo className="h-3.5 w-3.5" /> },
  { label: "Documents", path: "/sdcard/Documents", icon: <File className="h-3.5 w-3.5" /> },
  { label: "/data", path: "/data", icon: <HardDrive className="h-3.5 w-3.5 text-amber-400" /> },
  { label: "/system", path: "/system", icon: <HardDrive className="h-3.5 w-3.5 text-red-400" /> },
  { label: "/vendor", path: "/vendor", icon: <HardDrive className="h-3.5 w-3.5 text-purple-400" /> },
  { label: "/tmp", path: "/tmp", icon: <HardDrive className="h-3.5 w-3.5 text-blue-400" /> },
];

export const formatSize = (bytes: number): string => {
  if (bytes === 0) return "-";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getFileIcon = (file: DeviceFile) => {
  if (file.is_dir) return <Folder className="h-4 w-4 text-amber-400 fill-amber-400/20 shrink-0" />;
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext || ""))
    return <FileImage className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (["mp4", "mkv", "avi", "mov"].includes(ext || ""))
    return <FileVideo className="h-4 w-4 text-purple-400 shrink-0" />;
  if (["mp3", "flac", "wav", "ogg"].includes(ext || ""))
    return <FileAudio className="h-4 w-4 text-pink-400 shrink-0" />;
  if (["zip", "tar", "gz", "7z", "rar", "apk"].includes(ext || ""))
    return <FileArchive className="h-4 w-4 text-orange-400 shrink-0" />;
  if (["json", "xml", "sh", "py", "js", "ts", "txt", "log"].includes(ext || ""))
    return <FileCode className="h-4 w-4 text-blue-400 shrink-0" />;

  return <File className="h-4 w-4 text-[var(--neo-text-muted)] shrink-0" />;
};
