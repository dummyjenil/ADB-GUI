import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../ui/Modal";
import { Input, Textarea } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import {
  Bell,
  Terminal,
  Send,
  ExternalLink,
  Layers,
  Pin,
  Flame,
  FileText,
  Sliders,
} from "lucide-react";
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
  const [title, setTitle] = useState("ADB GUI Alert");
  const [message, setMessage] = useState("Hello from ADB GUI Studio! Your custom notification payload is live.");
  const [subText, setSubText] = useState("System Broadcast");
  const [clickUri, setClickUri] = useState("");
  const [isOngoing, setIsOngoing] = useState(false);
  const [isUniqueTag, setIsUniqueTag] = useState(true);
  const [priority, setPriority] = useState<"default" | "high" | "low">("high");
  const [channelId, setChannelId] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);

  const buildAdbCommand = () => {
    const titleVal = title.trim() || "ADB Studio";
    const msgVal = message.trim() || "Notification";
    let cmd = `adb -s ${activeDevice} shell cmd notification post -S bigtext -t "${titleVal}"`;
    if (subText.trim()) cmd += ` -s "${subText.trim()}"`;
    if (channelId.trim()) cmd += ` -c "${channelId.trim()}"`;
    if (priority === "high") cmd += ` -p 1`;
    if (priority === "low") cmd += ` -p -1`;
    if (isOngoing) cmd += ` --ongoing`;
    if (clickUri.trim()) cmd += ` -d "${clickUri.trim()}"`;
    const tag = isUniqueTag ? `ADB_GUI_${Date.now()}` : "ADB_GUI_CUSTOM";
    cmd += ` "${tag}" "${msgVal}"`;
    return cmd;
  };

  const handleSend = async () => {
    if (!title && !message) return;
    setLoading(true);
    try {
      const res: string = await invoke("post_custom_notification", {
        serial: activeDevice,
        title,
        message,
        subText: subText.trim() || null,
        clickUri: clickUri.trim() || null,
        isOngoing,
        isUniqueTag,
        priority,
        channelId: channelId.trim() || null,
      });
      onFeedback(res || `Notification posted: "${title}"`);
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
      title: "Dynamic Custom Notification Post",
      command: buildAdbCommand(),
      description: "Dispatches a fully customizable Android system notification with dynamic style, click intent, priority, and ongoing status.",
      category: "Notification Manager",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dynamic Notification Dispatcher"
      icon={<Bell className="h-5 w-5 text-amber-400" />}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--neo-text-muted)] font-medium">
          Broadcast dynamic rich notifications with custom click action URLs, sticky/ongoing modes, stackable tags, and urgency levels.
        </p>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">Notification Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Alert / Notification Title"
            icon={<Bell className="h-4 w-4" />}
          />
        </div>

        {/* Message Body */}
        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">Notification Body (BigText)</label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Multi-line message body..."
            rows={2}
          />
        </div>

        {/* Click Action URL / Intent */}
        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)] flex items-center justify-between">
            <span>Click Action URL / Intent (Optional)</span>
            <span className="text-[10px] lowercase text-amber-400">e.g. https://google.com or tel:9601687787</span>
          </label>
          <Input
            value={clickUri}
            onChange={(e) => setClickUri(e.target.value)}
            placeholder="https://example.com, tel:+12345, or intent URI..."
            icon={<ExternalLink className="h-4 w-4 text-cyan-400" />}
          />
        </div>

        {/* Quick Toggles: Sticky & Stackable */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setIsOngoing(!isOngoing)}
            className={`p-2.5 neo-box-sm flex items-center justify-between text-left transition-all ${
              isOngoing ? "bg-amber-950/40 border-amber-400 text-amber-300" : "bg-black/20 text-[var(--neo-text-muted)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Pin className={`h-4 w-4 ${isOngoing ? "text-amber-400" : "text-slate-400"}`} />
              <div>
                <div className="text-xs font-bold text-[var(--neo-text)]">Sticky / Ongoing</div>
                <div className="text-[10px]">{isOngoing ? "Cannot be swiped away" : "Normal dismissible"}</div>
              </div>
            </div>
            <Badge variant={isOngoing ? "accent" : "secondary"}>{isOngoing ? "ON" : "OFF"}</Badge>
          </button>

          <button
            type="button"
            onClick={() => setIsUniqueTag(!isUniqueTag)}
            className={`p-2.5 neo-box-sm flex items-center justify-between text-left transition-all ${
              isUniqueTag ? "bg-emerald-950/40 border-emerald-400 text-emerald-300" : "bg-black/20 text-[var(--neo-text-muted)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Layers className={`h-4 w-4 ${isUniqueTag ? "text-emerald-400" : "text-slate-400"}`} />
              <div>
                <div className="text-xs font-bold text-[var(--neo-text)]">Stack Multiple</div>
                <div className="text-[10px]">{isUniqueTag ? "Creates unique post ID" : "Replaces previous"}</div>
              </div>
            </div>
            <Badge variant={isUniqueTag ? "success" : "secondary"}>{isUniqueTag ? "MULTI" : "SINGLE"}</Badge>
          </button>
        </div>

        {/* Priority & Urgency */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)] flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-rose-400" />
            Priority / Importance Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "high", label: "High (Heads-up)", color: "text-rose-400" },
                { id: "default", label: "Default / Normal", color: "text-amber-400" },
                { id: "low", label: "Low / Silent", color: "text-sky-400" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPriority(p.id)}
                className={`py-1.5 px-2 text-xs font-bold neo-box-sm text-center transition-all ${
                  priority === p.id
                    ? "bg-[var(--neo-primary)] text-black font-black"
                    : "bg-black/30 text-[var(--neo-text-muted)] hover:bg-black/50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options Collapsible */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[11px] font-bold text-cyan-400 hover:underline flex items-center gap-1 my-1"
          >
            <Sliders className="h-3.5 w-3.5" />
            {showAdvanced ? "Hide Advanced Properties" : "Show Advanced Options (Subtext, Channel ID)"}
          </button>

          {showAdvanced && (
            <div className="space-y-2.5 p-3 neo-box-sm bg-black/30 mt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Subtext / Summary</label>
                <Input
                  value={subText}
                  onChange={(e) => setSubText(e.target.value)}
                  placeholder="e.g. System Alert, App Info"
                  icon={<FileText className="h-3.5 w-3.5" />}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Notification Channel ID</label>
                <Input
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="Optional channel ID (e.g. alerts_channel)"
                  icon={<Sliders className="h-3.5 w-3.5" />}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[var(--neo-border)] flex items-center justify-between gap-3">
          {onViewCommand && (
            <Button size="sm" variant="ghost" icon={<Terminal className="h-3.5 w-3.5" />} onClick={handlePreview}>
              Preview Command
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
              Dispatch Notification
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

