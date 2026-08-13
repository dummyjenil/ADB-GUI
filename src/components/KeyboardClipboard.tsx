import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input, Textarea } from "./ui/Input";
import { EmptyState } from "./ui/EmptyState";
import {
  Keyboard,
  ClipboardCopy,
  Send,
  CornerDownLeft,
  Delete,
  Space,
  Copy,
  Download,
  Upload,
  CheckCircle2,
  Terminal,
} from "lucide-react";
import { CommandPreview } from "../types/terminal";

interface KeyboardClipboardProps {
  activeDevice: string | null;
  onViewCommand?: (preview: CommandPreview) => void;
}

export const KeyboardClipboard: React.FC<KeyboardClipboardProps> = ({ activeDevice, onViewCommand }) => {
  const [textInput, setTextInput] = useState("");
  const [pcClipboardText, setPcClipboardText] = useState("");
  const [deviceClipboardText, setDeviceClipboardText] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeDevice || !textInput) return;

    try {
      await invoke("send_text_input", { serial: activeDevice, text: textInput });
      showToast("Text sent to phone input");
      setTextInput("");
    } catch (err: any) {
      showToast(`Error: ${err}`);
    }
  };

  const handleShowInputCommand = () => {
    if (!onViewCommand) return;
    const serial = activeDevice || "<serial>";
    const val = textInput || "Hello World";
    const formatted = val.replace(/ /g, "%s");
    onViewCommand({
      title: "Input Text",
      command: `adb -s ${serial} shell input text "${formatted}"`,
      description: "Sends typed text string directly to active input focus on Android device (spaces encoded as %s).",
      category: "Input Text",
    });
  };

  const handleShowPushClipboardCommand = () => {
    if (!onViewCommand) return;
    const serial = activeDevice || "<serial>";
    const text = pcClipboardText || "Sample text";
    onViewCommand({
      title: "Push Clipboard to Phone",
      command: `adb -s ${serial} shell cmd clipboard set "${text}"`,
      description: "Sets the Android system clipboard text buffer via Android cmd service.",
      category: "Clipboard Sync",
    });
  };

  const handleShowPullClipboardCommand = () => {
    if (!onViewCommand) return;
    const serial = activeDevice || "<serial>";
    onViewCommand({
      title: "Pull Clipboard from Phone",
      command: `adb -s ${serial} shell cmd clipboard get`,
      description: "Reads the current contents of the Android system clipboard.",
      category: "Clipboard Sync",
    });
  };

  const handleSendSpecialKey = async (keycode: number) => {
    if (!activeDevice) return;
    try {
      await invoke("send_keyevent", { serial: activeDevice, keycode });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePushClipboard = async () => {
    if (!activeDevice || !pcClipboardText) return;
    try {
      const res: any = await invoke("set_device_clipboard", {
        serial: activeDevice,
        text: pcClipboardText,
      });
      showToast(res);
    } catch (err: any) {
      showToast(`Error: ${err}`);
    }
  };

  const handlePullClipboard = async () => {
    if (!activeDevice) return;
    try {
      const res: string = await invoke("get_device_clipboard", { serial: activeDevice });
      setDeviceClipboardText(res);
      showToast("Pulled clipboard from phone");
    } catch (err: any) {
      showToast(`Error: ${err}`);
    }
  };

  const showToast = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  if (!activeDevice) {
    return <EmptyState title="No Active Device Selected" description="Connect or select a device to send text or sync clipboards." />;
  }

  return (
    <div className="space-y-6">
      {/* Keyboard Input Box */}
      <Card
        headerTitle="Keyboard Controller & Text Sender"
        headerIcon={<Keyboard className="h-5 w-5" />}
        headerVariant="primary"
      >
        <form onSubmit={handleSendText} className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                placeholder="Type text here to send instantly to phone..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" icon={<Send className="h-4 w-4" />}>
              Send Text
            </Button>
            {onViewCommand && (
              <Button
                type="button"
                variant="outline"
                onClick={handleShowInputCommand}
                icon={<Terminal className="h-4 w-4" />}
                title="View ADB Input Text Command"
              >
                View Command
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-3 border-t-2 border-[var(--neo-border)] items-center">
            <span className="text-xs font-black uppercase text-[var(--neo-text-muted)] mr-2">
              Quick Keys:
            </span>

            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleSendSpecialKey(66)}
              icon={<CornerDownLeft className="h-3.5 w-3.5" />}
            >
              Enter (66)
            </Button>

            <Button
              type="button"
              size="sm"
              variant="rose"
              onClick={() => handleSendSpecialKey(67)}
              icon={<Delete className="h-3.5 w-3.5" />}
            >
              Backspace (67)
            </Button>

            <Button
              type="button"
              size="sm"
              variant="amber"
              onClick={() => handleSendSpecialKey(62)}
              icon={<Space className="h-3.5 w-3.5" />}
            >
              Space (62)
            </Button>
          </div>
        </form>
      </Card>

      {/* Cross-Device Clipboard Sync Box */}
      <Card
        headerTitle="Cross-Device Clipboard Sync"
        headerIcon={<ClipboardCopy className="h-5 w-5" />}
        headerVariant="secondary"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PC to Phone */}
          <div className="neo-box-sm p-4 bg-black/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[var(--neo-primary)] flex items-center gap-1.5">
                <Upload className="h-4 w-4" /> PC → Android Phone
              </span>
              {onViewCommand && (
                <button
                  onClick={handleShowPushClipboardCommand}
                  className="text-[10px] font-bold text-[var(--neo-text-muted)] hover:text-black flex items-center gap-1"
                >
                  <Terminal className="h-3 w-3" /> View Command
                </button>
              )}
            </div>

            <Textarea
              rows={3}
              placeholder="Paste text from PC to push to phone clipboard..."
              value={pcClipboardText}
              onChange={(e) => setPcClipboardText(e.target.value)}
            />

            <Button
              onClick={handlePushClipboard}
              variant="primary"
              className="w-full"
              icon={<Copy className="h-3.5 w-3.5" />}
            >
              Push to Phone Clipboard
            </Button>
          </div>

          {/* Phone to PC */}
          <div className="neo-box-sm p-4 bg-black/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-[var(--neo-secondary)] flex items-center gap-1.5">
                <Download className="h-4 w-4" /> Android Phone → PC
              </span>
              {onViewCommand && (
                <button
                  onClick={handleShowPullClipboardCommand}
                  className="text-[10px] font-bold text-[var(--neo-text-muted)] hover:text-black flex items-center gap-1"
                >
                  <Terminal className="h-3 w-3" /> View Command
                </button>
              )}
            </div>

            <Textarea
              rows={3}
              readOnly
              placeholder="Pulled phone clipboard content will appear here..."
              value={deviceClipboardText}
            />

            <Button
              onClick={handlePullClipboard}
              variant="secondary"
              className="w-full"
              icon={<Download className="h-3.5 w-3.5" />}
            >
              Pull Phone Clipboard
            </Button>
          </div>
        </div>
      </Card>

      {statusMsg && (
        <div className="fixed bottom-6 right-6 neo-box px-4 py-2.5 bg-[var(--neo-primary)] text-[var(--neo-primary-text)] text-xs font-black flex items-center gap-2 animate-neo-slide z-50">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{statusMsg}</span>
        </div>
      )}
    </div>
  );
};
