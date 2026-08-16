import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CallLogItem, SmsItem, ContactItem } from "./types";
import { CallLogsPanel } from "./CallLogsPanel";
import { SmsHubPanel } from "./SmsHubPanel";
import { ContactsPanel } from "./ContactsPanel";
import { Card, EmptyState, Tabs, Toast } from "../ui";
import { Phone, MessageSquare, Users, PhoneCall } from "lucide-react";
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
      <Tabs
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        variant="buttons"
        tabs={[
          {
            id: "calls",
            label: "Call Management",
            icon: <Phone className="h-4 w-4" />,
          },
          {
            id: "sms",
            label: "SMS Inbox & Sender",
            icon: <MessageSquare className="h-4 w-4" />,
          },
          {
            id: "contacts",
            label: "Contacts Access",
            icon: <Users className="h-4 w-4" />,
          },
        ]}
      />

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

      {/* Reusable Feedback Toast */}
      <Toast
        message={feedback}
        type="success"
        onClose={() => setFeedback(null)}
      />
    </div>
  );
};
