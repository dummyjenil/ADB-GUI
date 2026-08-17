export interface FridaServerStatus {
  is_running: boolean;
  pid: number | null;
  binary_path: string;
  device_abi: string;
  has_root: boolean;
  host_frida_version: string | null;
}

export interface FridaProcessInfo {
  pid: number;
  name: string;
  identifier: string;
  is_running: boolean;
  is_frontmost: boolean;
}

export interface FridaLogMessage {
  id: string;
  session_id: string;
  level: "info" | "log" | "warn" | "error" | "status";
  message: string;
  timestamp: number;
}

export interface PresetScript {
  id: string;
  title: string;
  category: "Security Bypass" | "Inspection" | "Crypto & Storage" | "UI & UX";
  description: string;
  tags: string[];
  script: string;
}
