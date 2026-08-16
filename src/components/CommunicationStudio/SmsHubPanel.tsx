import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SmsItem } from "./types";
import { Badge, Button, Input, SearchInput, Tabs, EmptyState } from "../ui";
import {
  MessageSquare,
  Send,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
} from "lucide-react";

interface SmsHubPanelProps {
  activeDevice: string;
  smsList: SmsItem[];
  loading: boolean;
  onRefresh: () => void;
  onFeedback: (msg: string) => void;
  initialRecipient?: string;
}

export const SmsHubPanel: React.FC<SmsHubPanelProps> = ({
  activeDevice,
  smsList,
  loading,
  onRefresh,
  onFeedback,
  initialRecipient = "",
}) => {
  const [search, setSearch] = useState("");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || !message.trim()) return;
    setSending(true);
    try {
      const res: string = await invoke("send_sms", {
        serial: activeDevice,
        number: recipient.trim(),
        body: message.trim(),
      });
      onFeedback(res || `SMS dispatched to ${recipient}`);
      setMessage("");
      onRefresh();
    } catch (err: any) {
      onFeedback(`Error sending SMS: ${String(err)}`);
    } finally {
      setSending(false);
    }
  };

  const handleOpenComposer = async () => {
    if (!recipient.trim()) return;
    try {
      const res: string = await invoke("open_sms_composer", {
        serial: activeDevice,
        number: recipient.trim(),
        body: message.trim(),
      });
      onFeedback(res || `Opened SMS Composer on phone for ${recipient}`);
    } catch (err: any) {
      onFeedback(`Error opening SMS composer: ${String(err)}`);
    }
  };

  const filteredSms = smsList.filter((sms) => {
    if (filterType !== "all" && sms.msg_type !== filterType) return false;
    const q = search.toLowerCase();
    return sms.address.toLowerCase().includes(q) || sms.body.toLowerCase().includes(q);
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left 2 Cols: SMS History / Threads */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 neo-box p-3 bg-black/10">
          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search SMS messages / sender..."
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Tabs
              size="sm"
              variant="compact"
              activeTab={filterType}
              onChange={setFilterType}
              tabs={[
                { id: "all", label: "All" },
                { id: "inbox", label: "Inbox" },
                { id: "sent", label: "Sent" },
              ]}
            />
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />}
              onClick={onRefresh}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* SMS List */}
        {filteredSms.length === 0 ? (
          <EmptyState
            title="No SMS Messages Found"
            description="Incoming and sent SMS logs will be listed here."
            icon={<MessageSquare className="h-8 w-8 text-[var(--neo-primary)]" />}
          />
        ) : (
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
            {filteredSms.map((sms) => {
              const isInbox = sms.msg_type === "inbox";
              return (
                <div
                  key={sms.id + sms.date}
                  onClick={() => setRecipient(sms.address)}
                  className="neo-box p-3.5 bg-[var(--neo-card-bg)] hover:border-[var(--neo-primary)] cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isInbox ? (
                        <ArrowDownLeft className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-cyan-400 shrink-0" />
                      )}
                      <span className="text-xs font-black text-[var(--neo-text)]">{sms.address}</span>
                      <Badge variant={isInbox ? "primary" : "secondary"}>
                        {isInbox ? "Received" : "Sent"}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-[var(--neo-text-muted)] flex items-center gap-1 font-medium">
                      <Clock className="h-3 w-3" /> {sms.date}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--neo-text)] opacity-90 leading-relaxed break-words bg-black/5 p-2 rounded">
                    {sms.body}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right 1 Col: Direct SMS Composer */}
      <div className="space-y-3">
        <div className="neo-box p-4 bg-[var(--neo-card-bg)] space-y-4 sticky top-4">
          <div className="flex items-center gap-2 border-b border-[var(--neo-border)] pb-2.5">
            <Send className="h-4 w-4 text-[var(--neo-primary)]" />
            <h3 className="text-xs font-black uppercase tracking-wider text-[var(--neo-text)]">Direct SMS Composer</h3>
          </div>

          <form onSubmit={handleSendSms} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">Recipient Number</label>
              <Input
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="+1234567890"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)]">SMS Message Body</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type SMS text message to dispatch via phone..."
                rows={4}
                required
                className="w-full neo-input p-2.5 text-xs bg-[var(--neo-bg)] text-[var(--neo-text)] resize-none"
              />
            </div>

            <div className="space-y-2 pt-1">
              <Button
                type="submit"
                size="md"
                variant="primary"
                className="w-full justify-center"
                icon={<Send className="h-4 w-4" />}
                loading={sending}
              >
                Send SMS via Device
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full justify-center text-xs"
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                onClick={handleOpenComposer}
              >
                Open Composer on Phone
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
