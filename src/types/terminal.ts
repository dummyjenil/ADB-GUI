export interface ShellCommandResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
  timed_out: boolean;
}

export interface TerminalOutputItem {
  id: string;
  command: string;
  timestamp: string;
  result?: ShellCommandResult;
  error?: string;
  isRunning?: boolean;
  execId?: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  targetSerial: string | null; // null means active global device
  outputs: TerminalOutputItem[];
  history: string[];
  historyIndex: number;
  timeoutSecs: number; // 0 = no timeout
}

export interface CommandPreview {
  title: string;
  command: string;
  description?: string;
  category?: string;
}
