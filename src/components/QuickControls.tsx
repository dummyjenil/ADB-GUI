import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import {
  Power,
  Volume2,
  Camera,
  Home,
  Sparkles,
  Terminal,
  CheckCircle2,
} from "lucide-react";
import { CommandPreview } from "../types/terminal";
import { QUICK_ACTIONS_REGISTRY } from "./QuickControls/registry";
import { QuickAction, ActionCategory } from "./QuickControls/types";
import { OpenUrlModal } from "./QuickControls/dialogs/OpenUrlModal";
import { CustomNotificationModal } from "./QuickControls/dialogs/CustomNotificationModal";
import { VolumeControlModal } from "./QuickControls/dialogs/VolumeControlModal";

interface QuickControlsProps {
  activeDevice: string | null;
  onViewCommand?: (preview: CommandPreview) => void;
}

export const QuickControls: React.FC<QuickControlsProps> = ({ activeDevice, onViewCommand }) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openUrlOpen, setOpenUrlOpen] = useState(false);
  const [customNotifOpen, setCustomNotifOpen] = useState(false);
  const [volumeModalOpen, setVolumeModalOpen] = useState(false);
  const [currentRotation, setCurrentRotation] = useState<"auto" | "portrait" | "landscape">("auto");

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleActionClick = async (action: QuickAction) => {
    if (!activeDevice) return;

    if (action.type === "dialog") {
      if (action.id === "open_url_dialog") setOpenUrlOpen(true);
      if (action.id === "custom_notification_dialog") setCustomNotifOpen(true);
      if (action.id === "volume_modal") setVolumeModalOpen(true);
      return;
    }

    if (action.type === "keyevent" && action.keycode !== undefined) {
      try {
        await invoke("send_keyevent", { serial: activeDevice, keycode: action.keycode });
        showToast(`Triggered ${action.title}`);
      } catch (err: any) {
        showToast(`Error: ${String(err)}`);
      }
      return;
    }

    if (action.type === "custom_exec") {
      try {
        if (action.id === "lock_screen") {
          await invoke("send_keyevent", { serial: activeDevice, keycode: 26 });
          showToast("Screen locked");
        } else if (action.id === "unlock_screen") {
          await invoke("send_keyevent", { serial: activeDevice, keycode: 224 });
          // Simulating upward swipe to unlock
          await invoke("execute_pm_command", {
            serial: activeDevice,
            command: "input swipe 500 1500 500 500 200",
          });
          showToast("Device unlocked / Swipe sent");
        } else if (action.id === "rotate_screen") {
          const nextMode = currentRotation === "auto" ? "landscape" : currentRotation === "landscape" ? "portrait" : "auto";
          await invoke("set_device_orientation", { serial: activeDevice, orientation: nextMode });
          setCurrentRotation(nextMode);
          showToast(`Orientation set to: ${nextMode.toUpperCase()}`);
        } else if (action.id === "open_camera") {
          await invoke("execute_intent", {
            serial: activeDevice,
            action: "android.media.action.IMAGE_CAPTURE",
            component: null,
            dataUri: null,
            mimeType: null,
            flags: [],
            extras: {},
          });
          showToast("Opened Camera App");
        } else if (action.id === "expand_notifications") {
          await invoke("execute_pm_command", {
            serial: activeDevice,
            command: "cmd statusbar expand-notifications",
          });
          showToast("Notification shade expanded");
        }
      } catch (err: any) {
        showToast(`Error: ${String(err)}`);
      }
    }
  };

  const handleShowPreview = (action: QuickAction) => {
    if (!onViewCommand) return;
    const serial = activeDevice || "<serial>";
    if (action.commandSnippet) {
      onViewCommand({
        title: action.commandSnippet.title,
        command: action.commandSnippet.command(serial),
        description: action.commandSnippet.description,
        category: "Quick Controls",
      });
    } else if (action.type === "keyevent" && action.keycode !== undefined) {
      onViewCommand({
        title: `${action.title} Keyevent`,
        command: `adb -s ${serial} shell input keyevent ${action.keycode}`,
        description: `Sends Android keycode ${action.keycode} to active device.`,
        category: "Input Keyevent",
      });
    }
  };

  if (!activeDevice) {
    return <EmptyState title="No Active Device Selected" description="Connect or select a device to use Quick Controls." />;
  }

  const renderSection = (title: string, icon: React.ReactNode, category: ActionCategory, variant: "primary" | "secondary" | "accent" | "dark") => {
    const actions = QUICK_ACTIONS_REGISTRY.filter((a) => a.category === category);
    return (
      <Card headerTitle={title} headerIcon={icon} headerVariant={variant}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {actions.map((action) => (
            <div key={action.id} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleActionClick(action)}
                className={`neo-btn p-4 flex flex-col items-center justify-center gap-1.5 group cursor-pointer w-full text-center transition-all ${
                  action.btnVariant === "rose"
                    ? "bg-rose-500 text-white"
                    : action.btnVariant === "amber"
                    ? "bg-amber-400 text-black"
                    : action.btnVariant === "cyan"
                    ? "bg-cyan-500 text-black"
                    : action.btnVariant === "primary"
                    ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]"
                    : action.btnVariant === "accent"
                    ? "bg-violet-500 text-white"
                    : "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)]"
                }`}
              >
                <div className="group-hover:scale-110 transition-transform">{action.icon}</div>
                <span className="text-xs font-black uppercase tracking-tight">{action.title}</span>
                {action.subtitle && (
                  <span className="text-[10px] font-mono opacity-80 truncate max-w-full">
                    {action.subtitle}
                  </span>
                )}
              </button>
              {onViewCommand && (action.commandSnippet || action.keycode !== undefined) && (
                <button
                  type="button"
                  onClick={() => handleShowPreview(action)}
                  className="text-[10px] font-bold text-[var(--neo-text-muted)] hover:text-[var(--neo-primary)] flex items-center justify-center gap-1 py-0.5 cursor-pointer"
                >
                  <Terminal className="h-3 w-3" /> View Command
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Power & Display */}
      {renderSection("Power, Screen & Orientation Controls", <Power className="h-5 w-5" />, "power_display", "accent")}

      {/* Audio & Media Controls */}
      {renderSection("Volume & Media Controls", <Volume2 className="h-5 w-5" />, "audio_media", "primary")}

      {/* Camera & Hardware */}
      {renderSection("Camera & Direct Actions", <Camera className="h-5 w-5" />, "camera_hardware", "dark")}

      {/* Navigation Keys */}
      {renderSection("Hardware Navigation Keys", <Home className="h-5 w-5" />, "navigation", "secondary")}

      {/* Shortcuts & Broadcast Dialogs */}
      {renderSection("Shortcuts, URL & Notifications", <Sparkles className="h-5 w-5" />, "shortcuts", "primary")}

      {/* Floating Status Notification Toast */}
      {feedback && (
        <div className="fixed bottom-6 right-6 neo-box px-4 py-2.5 bg-[var(--neo-primary)] text-[var(--neo-primary-text)] text-xs font-black flex items-center gap-2 animate-neo-slide z-50 shadow-[4px_4px_0px_0px_var(--neo-shadow)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Modals */}
      <OpenUrlModal
        isOpen={openUrlOpen}
        onClose={() => setOpenUrlOpen(false)}
        activeDevice={activeDevice}
        onFeedback={showToast}
        onViewCommand={onViewCommand}
      />

      <CustomNotificationModal
        isOpen={customNotifOpen}
        onClose={() => setCustomNotifOpen(false)}
        activeDevice={activeDevice}
        onFeedback={showToast}
        onViewCommand={onViewCommand}
      />

      <VolumeControlModal
        isOpen={volumeModalOpen}
        onClose={() => setVolumeModalOpen(false)}
        activeDevice={activeDevice}
        onFeedback={showToast}
        onViewCommand={onViewCommand}
      />
    </div>
  );
};
