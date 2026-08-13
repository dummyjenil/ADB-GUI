import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import {
  Power,
  Sun,
  Moon,
  Volume2,
  Volume1,
  VolumeX,
  Home,
  ArrowLeft,
  Square,
  CheckCircle2,
  Terminal,
} from "lucide-react";
import { CommandPreview } from "../types/terminal";

interface QuickControlsProps {
  activeDevice: string | null;
  onViewCommand?: (preview: CommandPreview) => void;
}

export const QuickControls: React.FC<QuickControlsProps> = ({ activeDevice, onViewCommand }) => {
  const [feedback, setFeedback] = useState<string | null>(null);

  const triggerKey = async (keycode: number, label: string) => {
    if (!activeDevice) return;
    try {
      await invoke("send_keyevent", { serial: activeDevice, keycode });
      setFeedback(`Triggered ${label}`);
      setTimeout(() => setFeedback(null), 2000);
    } catch (err: any) {
      setFeedback(`Error: ${err}`);
    }
  };

  const handleShowCommand = (title: string, keycode: number, description: string) => {
    if (!onViewCommand) return;
    const serial = activeDevice || "<serial>";
    onViewCommand({
      title,
      command: `adb -s ${serial} shell input keyevent ${keycode}`,
      description,
      category: "Input Keyevent",
    });
  };

  if (!activeDevice) {
    return <EmptyState title="No Active Device Selected" description="Connect or select a device to use Quick Controls." />;
  }

  return (
    <div className="space-y-6">
      {/* Power & Display Controls */}
      <Card
        headerTitle="Power & Display Controls"
        headerIcon={<Power className="h-5 w-5" />}
        headerVariant="accent"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => triggerKey(26, "Power Button")}
              className="neo-btn p-5 bg-rose-500 text-white flex flex-col items-center justify-center gap-2 group cursor-pointer w-full"
            >
              <Power className="h-8 w-8 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-extrabold uppercase">Power Toggle</span>
              <span className="text-[11px] font-mono opacity-80">KEYEVENT_POWER (26)</span>
            </button>
            {onViewCommand && (
              <button
                onClick={() => handleShowCommand("Power Keyevent", 26, "Toggles device power / screen state.")}
                className="text-[10px] font-bold text-[var(--neo-text-muted)] hover:text-rose-500 flex items-center justify-center gap-1 py-1"
              >
                <Terminal className="h-3 w-3" /> View Command
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => triggerKey(224, "Screen Wakeup")}
              className="neo-btn p-5 bg-amber-400 text-black flex flex-col items-center justify-center gap-2 group cursor-pointer w-full"
            >
              <Sun className="h-8 w-8 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-extrabold uppercase">Wake Up Screen</span>
              <span className="text-[11px] font-mono opacity-80">KEYCODE_WAKEUP (224)</span>
            </button>
            {onViewCommand && (
              <button
                onClick={() => handleShowCommand("Wakeup Keyevent", 224, "Wakes up screen display.")}
                className="text-[10px] font-bold text-[var(--neo-text-muted)] hover:text-amber-500 flex items-center justify-center gap-1 py-1"
              >
                <Terminal className="h-3 w-3" /> View Command
              </button>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <button
              onClick={() => triggerKey(223, "Screen Sleep")}
              className="neo-btn p-5 bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)] flex flex-col items-center justify-center gap-2 group cursor-pointer w-full"
            >
              <Moon className="h-8 w-8 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-extrabold uppercase">Sleep Screen</span>
              <span className="text-[11px] font-mono opacity-80">KEYCODE_SLEEP (223)</span>
            </button>
            {onViewCommand && (
              <button
                onClick={() => handleShowCommand("Sleep Keyevent", 223, "Puts device display to sleep.")}
                className="text-[10px] font-bold text-[var(--neo-text-muted)] hover:text-[var(--neo-secondary)] flex items-center justify-center gap-1 py-1"
              >
                <Terminal className="h-3 w-3" /> View Command
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Volume Controller */}
      <Card
        headerTitle="Volume Controller"
        headerIcon={<Volume2 className="h-5 w-5" />}
        headerVariant="primary"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button
            onClick={() => triggerKey(24, "Volume Up")}
            variant="primary"
            size="lg"
            className="w-full justify-center"
            icon={<Volume2 className="h-5 w-5" />}
          >
            Volume Up (+1)
          </Button>

          <Button
            onClick={() => triggerKey(25, "Volume Down")}
            variant="secondary"
            size="lg"
            className="w-full justify-center"
            icon={<Volume1 className="h-5 w-5" />}
          >
            Volume Down (-1)
          </Button>

          <Button
            onClick={() => triggerKey(164, "Mute Volume")}
            variant="rose"
            size="lg"
            className="w-full justify-center"
            icon={<VolumeX className="h-5 w-5" />}
          >
            Toggle Mute
          </Button>
        </div>
      </Card>

      {/* Navigation Keys */}
      <Card
        headerTitle="Hardware Navigation Keys"
        headerIcon={<Home className="h-5 w-5" />}
        headerVariant="secondary"
      >
        <div className="grid grid-cols-3 gap-4">
          <Button
            onClick={() => triggerKey(4, "Back")}
            variant="accent"
            size="lg"
            className="flex-col py-4 gap-1.5"
            icon={<ArrowLeft className="h-6 w-6" />}
          >
            Back Key
          </Button>

          <Button
            onClick={() => triggerKey(3, "Home")}
            variant="primary"
            size="lg"
            className="flex-col py-4 gap-1.5"
            icon={<Home className="h-6 w-6" />}
          >
            Home Key
          </Button>

          <Button
            onClick={() => triggerKey(187, "App Switcher / Recents")}
            variant="secondary"
            size="lg"
            className="flex-col py-4 gap-1.5"
            icon={<Square className="h-6 w-6" />}
          >
            Recents Key
          </Button>
        </div>
      </Card>

      {/* Floating Status Notification Toast */}
      {feedback && (
        <div className="fixed bottom-6 right-6 neo-box px-4 py-2.5 bg-[var(--neo-primary)] text-[var(--neo-primary-text)] text-xs font-black flex items-center gap-2 animate-neo-slide z-50">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
};
