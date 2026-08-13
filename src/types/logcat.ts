export type LogPriority = "V" | "D" | "I" | "W" | "E" | "F" | "ALL";

export type LogBuffer = "all" | "main" | "system" | "crash" | "events" | "radio";

export interface LogcatEntry {
  id: string;
  timestamp: string;
  pid: number;
  tid: number;
  priority: "V" | "D" | "I" | "W" | "E" | "F";
  tag: string;
  message: string;
  package_name?: string;
  raw: string;
}

export interface LogcatFilterConfig {
  buffers: LogBuffer[];
  min_priority: LogPriority;
  pid?: number;
  package_name?: string;
  tag?: string;
  search?: string;
  is_regex?: boolean;
  clear_history?: boolean;
}

export interface PackageProcessInfo {
  pid: number;
  package_name: string;
  user: string;
}

export type ExportFormat = "txt" | "json" | "csv";
