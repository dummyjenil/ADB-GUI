import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Modal } from "../../ui/Modal";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { Globe, ArrowRight, ExternalLink, Terminal } from "lucide-react";
import { CommandPreview } from "../../../types/terminal";

interface OpenUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDevice: string;
  onFeedback: (msg: string) => void;
  onViewCommand?: (preview: CommandPreview) => void;
}

const PRESET_URLS = [
  { label: "Google", url: "https://www.google.com" },
  { label: "YouTube", url: "https://www.youtube.com" },
  { label: "GitHub", url: "https://github.com" },
  { label: "Settings", url: "android.settings.SETTINGS" },
  { label: "Dev Options", url: "android.settings.APPLICATION_DEVELOPMENT_SETTINGS" },
];

export const OpenUrlModal: React.FC<OpenUrlModalProps> = ({
  isOpen,
  onClose,
  activeDevice,
  onFeedback,
  onViewCommand,
}) => {
  const [url, setUrl] = useState("https://");
  const [loading, setLoading] = useState(false);

  const handleLaunch = async (targetUrl?: string) => {
    const finalUrl = (targetUrl || url).trim();
    if (!finalUrl) return;
    setLoading(true);
    try {
      if (finalUrl.startsWith("http://") || finalUrl.startsWith("https://") || finalUrl.includes("://")) {
        await invoke("open_url_on_device", { serial: activeDevice, url: finalUrl });
      } else {
        // Assume intent or settings action
        await invoke("execute_intent", {
          serial: activeDevice,
          action: finalUrl,
          component: null,
          dataUri: null,
          mimeType: null,
          flags: [],
          extras: {},
        });
      }
      onFeedback(`Opened: ${finalUrl}`);
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
      title: "Open URL / Deep Link",
      command: `adb -s ${activeDevice} shell am start -a android.intent.action.VIEW -d "${url}"`,
      description: "Opens web URL or deep link inside default browser or app on Android.",
      category: "Activity Manager",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Open URL / Deep Link"
      icon={<Globe className="h-5 w-5 text-cyan-400" />}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-[var(--neo-text-muted)] font-medium">
          Send a web address, custom app scheme (e.g. <code className="text-[var(--neo-primary)]">myapp://home</code>), or Android Settings Intent to launch directly on screen.
        </p>

        <div className="space-y-1">
          <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">Target URL or Intent Action</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com or scheme://path"
            icon={<ExternalLink className="h-4 w-4" />}
          />
        </div>

        <div className="space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-text-muted)]">Quick Presets:</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_URLS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setUrl(preset.url);
                  handleLaunch(preset.url);
                }}
                className="neo-box px-2.5 py-1 text-[11px] font-bold bg-black/10 hover:bg-[var(--neo-primary)] hover:text-[var(--neo-primary-text)] transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
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
              variant="primary"
              icon={<ArrowRight className="h-4 w-4" />}
              loading={loading}
              onClick={() => handleLaunch()}
            >
              Launch on Device
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
