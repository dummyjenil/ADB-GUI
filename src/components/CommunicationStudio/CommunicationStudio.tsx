import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CallLogItem, SmsItem, ContactItem } from "./types";
import { CallLogsPanel } from "./CallLogsPanel";
import { SmsHubPanel } from "./SmsHubPanel";
import { ContactsPanel } from "./ContactsPanel";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Phone, MessageSquare, Users, CheckCircle2, PhoneCall } from "lucide-react";
import { CommandPreview } from "../../types/terminal";

interface CommunicationStudioProps {
  activeDevice: string | null;
  onViewCommand?: (preview: CommandPreview) => void;
}

type SubTab = "calls" | "sms" | "contacts";

export const CommunicationStudio: React.FC<CommunicationStudioProps> = ({
  activeDevice,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("calls");
  const [callLogs, setCallLogs] = useState<CallLogItem[]>([]);
  const [smsList, setSmsList] = useState<SmsItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [smsRecipient, setSmsRecipient] = useState<string>("");

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchCallLogs = useCallback(async () => {
    if (!activeDevice) return;
    setLoading(true);
    try {
      const res: CallLogItem[] = await invoke("get_call_logs", { serial: activeDevice });
      setCallLogs(res);
    } catch (err: any) {
      console.error("Failed to fetch call logs:", err);
    } finally {
      setLoading(false);
    }
  }, [activeDevice]);

  const fetchSmsList = useCallback(async () => {
    if (!activeDevice) return;
    setLoading(true);
    try {
      const res: SmsItem[] = await invoke("get_sms_list", { serial: activeDevice });
      setSmsList(res);
    } catch (err: any) {
      console.error("Failed to fetch SMS list:", err);
    } finally {
      setLoading(false);
    }
  }, [activeDevice]);

  const fetchContacts = useCallback(async () => {
    if (!activeDevice) return;
    setLoading(true);
    try {
      const res: ContactItem[] = await invoke("get_contacts_list", { serial: activeDevice });
      setContacts(res);
    } catch (err: any) {
      console.error("Failed to fetch contacts:", err);
    } finally {
      setLoading(false);
    }
  }, [activeDevice]);

  useEffect(() => {
    if (!activeDevice) return;
    if (activeSubTab === "calls") fetchCallLogs();
    else if (activeSubTab === "sms") fetchSmsList();
    else if (activeSubTab === "contacts") fetchContacts();
  }, [activeDevice, activeSubTab, fetchCallLogs, fetchSmsList, fetchContacts]);

  const handleTriggerCall = async (number: string) => {
    if (!activeDevice || !number) return;
    try {
      await invoke("trigger_call", { serial: activeDevice, number });
      showToast(`Initiating call to ${number}...`);
    } catch (err: any) {
      showToast(`Call error: ${String(err)}`);
    }
  };

  const handleSelectForSms = (number: string) => {
    setSmsRecipient(number);
    setActiveSubTab("sms");
  };

  if (!activeDevice) {
    return (
      <EmptyState
        title="No Active Device Selected"
        description="Connect or select a device to use Communication Studio (Calls, SMS & Contacts)."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Subtabs Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("calls")}
          className={`neo-btn px-4 py-2.5 text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === "calls"
              ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)]"
              : "bg-[var(--neo-card-bg)] text-[var(--neo-text)] hover:bg-black/10"
          }`}
        >
          <Phone className="h-4 w-4" />
          <span>Call Management</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("sms")}
          className={`neo-btn px-4 py-2.5 text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === "sms"
              ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)]"
              : "bg-[var(--neo-card-bg)] text-[var(--neo-text)] hover:bg-black/10"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>SMS Inbox & Sender</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("contacts")}
          className={`neo-btn px-4 py-2.5 text-xs font-black uppercase flex items-center gap-2 cursor-pointer transition-all ${
            activeSubTab === "contacts"
              ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)]"
              : "bg-[var(--neo-card-bg)] text-[var(--neo-text)] hover:bg-black/10"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Contacts Access</span>
        </button>
      </div>

      {/* Main Studio Card */}
      <Card
        headerTitle={
          activeSubTab === "calls"
            ? "Call Logs & Dialer Hub"
            : activeSubTab === "sms"
            ? "SMS Messaging & Status Hub"
            : "Device Contacts Directory"
        }
        headerIcon={
          activeSubTab === "calls" ? (
            <PhoneCall className="h-5 w-5 text-emerald-400" />
          ) : activeSubTab === "sms" ? (
            <MessageSquare className="h-5 w-5 text-cyan-400" />
          ) : (
            <Users className="h-5 w-5 text-amber-400" />
          )
        }
        headerVariant="primary"
      >
        {activeSubTab === "calls" && (
          <CallLogsPanel
            activeDevice={activeDevice}
            callLogs={callLogs}
            loading={loading}
            onRefresh={fetchCallLogs}
            onFeedback={showToast}
            onTriggerCall={handleTriggerCall}
          />
        )}

        {activeSubTab === "sms" && (
          <SmsHubPanel
            activeDevice={activeDevice}
            smsList={smsList}
            loading={loading}
            onRefresh={fetchSmsList}
            onFeedback={showToast}
            initialRecipient={smsRecipient}
          />
        )}

        {activeSubTab === "contacts" && (
          <ContactsPanel
            contacts={contacts}
            loading={loading}
            onRefresh={fetchContacts}
            onTriggerCall={handleTriggerCall}
            onSelectForSms={handleSelectForSms}
          />
        )}
      </Card>

      {/* Feedback Toast */}
      {feedback && (
        <div className="fixed bottom-6 right-6 neo-box px-4 py-2.5 bg-[var(--neo-primary)] text-[var(--neo-primary-text)] text-xs font-black flex items-center gap-2 animate-neo-slide z-50 shadow-[4px_4px_0px_0px_var(--neo-shadow)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
};
