import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../ui/Modal";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { Bell, Terminal, Send, MessageSquare } from "lucide-react";
import { CommandPreview } from "../../../types/terminal";

interface CustomNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: string;
  onFeedback: (msg: string) => void;
  onViewCommand?: (preview: CommandPreview) => void;
}

export const CustomNotificationModal: React.FC<CustomNotificationModalProps> = ({
  isOpen,
  onClose,
  activeDevice,
  onFeedback,
  onViewCommand,
}) => {
  const [title, setTitle] = useState("ADB GUI Notification");
  const [message, setMessage] = useState("Hello from ADB GUI Studio!");
  const [type, setType] = useState<"toast" | "intent">("toast");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title && !message) return;
    setLoading(true);
    try {
      if (type === "toast") {
        // Send via shell input or broadcast toast
        await invoke("send_text_input", {
          serial: activeDevice,
          text: `[Notification: ${title} - ${message}]`,
        });
        onFeedback(`Sent toast/input: ${title}`);
      } else {
        // Broadcast custom notification intent
        await invoke("execute_pm_command", {
          serial: activeDevice,
          command: `am broadcast -a android.intent.action.MAIN --es title "${title}" --es message "${message}"`,
        });
        onFeedback(`Broadcasted notification intent`);
      }
      onClose();
    } catch (err: any) {
      onFeedback(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = () => {
    if (!onViewCommand) return;
    onViewCommand({
      title: "Custom Notification Broadcast",
      command: `adb -s ${activeDevice} shell am broadcast -a android.intent.action.MAIN --es title "${title}" --es text "${message}"`,
      description: "Dispatches an Android broadcast intent with notification payload.",
      category: "Broadcast Manager",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Custom Notification / Toast Sender"
      icon={<Bell className="h-5 w-5 text-amber-400" />}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--neo-text-muted)] font-medium">
          Broadcast a custom test notification or message payload to verify notification listeners and device UI.
        </p>

        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">Notification Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Alert / Notification Title"
            icon={<Bell className="h-4 w-4" />}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">Message Body</label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Notification message content..."
            icon={<MessageSquare className="h-4 w-4" />}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setType("toast")}
            className={`flex-1 py-2 text-xs font-black uppercase neo-box cursor-pointer transition-all ${
              type === "toast" ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]" : "bg-black/10 text-[var(--neo-text)]"
            }`}
          >
            Type Focus / Input
          </button>
          <button
            type="button"
            onClick={() => setType("intent")}
            className={`flex-1 py-2 text-xs font-black uppercase neo-box cursor-pointer transition-all ${
              type === "intent" ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]" : "bg-black/10 text-[var(--neo-text)]"
            }`}
          >
            Broadcast Intent
          </button>
        </div>

        <div className="pt-3 border-t border-[var(--neo-border)] flex items-center justify-between gap-3">
          {onViewCommand && (
            <Button size="sm" variant="ghost" icon={<Terminal className="h-3.5 w-3.5" />} onClick={handlePreview}>
              Preview
            </Button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="amber"
              icon={<Send className="h-4 w-4" />}
              loading={loading}
              onClick={handleSend}
            >
              Send Notification
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
