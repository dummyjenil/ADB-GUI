import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import { Volume2, VolumeX, Music, Bell, Phone, ArrowUp, ArrowDown, Terminal } from "lucide-react";
import { CommandPreview } from "../../../types/terminal";

interface VolumeControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: string;
  onFeedback: (msg: string) => void;
  onViewCommand?: (preview: CommandPreview) => void;
}

const STREAMS = [
  { id: "music", label: "Media / Music", icon: <Music className="h-4 w-4 text-cyan-400" /> },
  { id: "ring", label: "Ring & Notifications", icon: <Bell className="h-4 w-4 text-amber-400" /> },
  { id: "call", label: "Voice Call Volume", icon: <Phone className="h-4 w-4 text-emerald-400" /> },
  { id: "alarm", label: "Alarm Volume", icon: <Volume2 className="h-4 w-4 text-rose-400" /> },
];

export const VolumeControlModal: React.FC<VolumeControlModalProps> = ({
  isOpen,
  onClose,
  activeDevice,
  onFeedback,
  onViewCommand,
}) => {
  const [loadingStream, setLoadingStream] = useState<string | null>(null);

  const handleAdjust = async (stream: string, direction: "up" | "down" | "mute" | "unmute") => {
    setLoadingStream(`${stream}-${direction}`);
    try {
      await invoke("adjust_volume", {
        serial: activeDevice,
        streamType: stream,
        direction,
      });
      onFeedback(`${stream.toUpperCase()} volume: ${direction.toUpperCase()}`);
    } catch (err: any) {
      onFeedback(`Error: ${String(err)}`);
    } finally {
      setLoadingStream(null);
    }
  };

  const handlePreview = () => {
    if (!onViewCommand) return;
    onViewCommand({
      title: "Media Volume Controller",
      command: `adb -s ${activeDevice} shell media volume --stream 3 --set 1`,
      description: "Controls Android audio streams (Media, Ring, Voice Call, Alarm) via shell media volume daemon.",
      category: "Audio Service",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Advanced Multi-Stream Volume Controls"
      icon={<Volume2 className="h-5 w-5 text-cyan-400" />}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--neo-text-muted)] font-medium">
          Control dedicated hardware volume channels independently: Media, Ring, In-Call and Alarm.
        </p>

        <div className="space-y-3">
          {STREAMS.map((st) => (
            <div key={st.id} className="neo-box p-3 bg-black/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {st.icon}
                <span className="text-xs font-black uppercase text-[var(--neo-text)]">{st.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ArrowDown className="h-3.5 w-3.5" />}
                  loading={loadingStream === `${st.id}-down`}
                  onClick={() => handleAdjust(st.id, "down")}
                >
                  Down
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<ArrowUp className="h-3.5 w-3.5" />}
                  loading={loadingStream === `${st.id}-up`}
                  onClick={() => handleAdjust(st.id, "up")}
                >
                  Up
                </Button>
                <Button
                  size="sm"
                  variant="rose"
                  icon={<VolumeX className="h-3.5 w-3.5" />}
                  loading={loadingStream === `${st.id}-mute`}
                  onClick={() => handleAdjust(st.id, "mute")}
                >
                  Mute
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-[var(--neo-border)] flex items-center justify-between gap-3">
          {onViewCommand && (
            <Button size="sm" variant="ghost" icon={<Terminal className="h-3.5 w-3.5" />} onClick={handlePreview}>
              Preview
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
