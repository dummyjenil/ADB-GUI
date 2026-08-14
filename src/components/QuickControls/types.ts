export type ActionCategory =
  | "power_display"
  | "audio_media"
  | "camera_hardware"
  | "navigation"
  | "shortcuts";

export type ActionType = "keyevent" | "dialog" | "custom_exec";

export interface QuickAction {
  id: string;
  title: string;
  subtitle?: string;
  category: ActionCategory;
  type: ActionType;
  keycode?: number;
  icon: React.ReactNode;
  btnVariant?: "primary" | "secondary" | "accent" | "danger" | "ghost" | "amber" | "rose" | "cyan";
  customClass?: string;
  commandSnippet?: {
    title: string;
    command: (serial: string) => string;
    description: string;
  };
}
