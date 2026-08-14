export interface CallLogItem {
  id: string;
  number: string;
  name: string;
  date: string;
  duration: string;
  call_type: "incoming" | "outgoing" | "missed" | "voicemail" | "rejected" | "blocked" | "unknown";
}

export interface SmsItem {
  id: string;
  address: string;
  body: string;
  date: string;
  msg_type: "inbox" | "sent" | "draft" | "outbox";
  read: boolean;
}

export interface ContactItem {
  id: string;
  name: string;
  number: string;
}
