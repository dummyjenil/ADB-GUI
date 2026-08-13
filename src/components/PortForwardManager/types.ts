import { CommandPreview } from "../../types/terminal";

export interface PortMapping {
  serial: string;
  local: string;  // Host spec (e.g. tcp:6100)
  remote: string; // Device spec (e.g. tcp:7100)
  mode: "forward" | "reverse";
}

export type SpecType = "tcp" | "localabstract" | "localreserved" | "localfilesystem" | "jdwp";

export interface PresetItem {
  name: string;
  icon: string;
  mode: "forward" | "reverse";
  hostType: SpecType;
  hostValue: string;
  deviceType: SpecType;
  deviceValue: string;
  description: string;
}

export interface SavedProfile {
  id: string;
  name: string;
  mode: "forward" | "reverse";
  local: string;
  remote: string;
}

export interface PortForwardManagerProps {
  activeDevice: string | null;
  onViewCommand?: (cmd: CommandPreview) => void;
}
