import React, { useState } from "react";
import { ContactItem } from "./types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  Users,
  PhoneCall,
  MessageSquare,
  Search,
  RefreshCw,
  User,
} from "lucide-react";

interface ContactsPanelProps {
  contacts: ContactItem[];
  loading: boolean;
  onRefresh: () => void;
  onTriggerCall: (number: string) => void;
  onSelectForSms: (number: string) => void;
}

export const ContactsPanel: React.FC<ContactsPanelProps> = ({
  contacts,
  loading,
  onRefresh,
  onTriggerCall,
  onSelectForSms,
}) => {
  const [search, setSearch] = useState("");

  const filteredContacts = contacts.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 neo-box p-3 bg-black/10">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts by name or phone..."
          className="w-full sm:w-72"
          icon={<Search className="h-4 w-4" />}
        />

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-mono text-[var(--neo-text-muted)]">
            {filteredContacts.length} contact(s)
          </span>
          <Button size="sm" variant="ghost" icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      </div>

      {filteredContacts.length === 0 ? (
        <div className="neo-box p-8 text-center bg-[var(--neo-card-bg)]">
          <Users className="h-8 w-8 text-[var(--neo-text-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-xs font-black uppercase text-[var(--neo-text)]">No contacts found</p>
          <p className="text-[11px] text-[var(--neo-text-muted)]">Device phonebook records will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto custom-scrollbar p-1">
          {filteredContacts.map((c) => (
            <div
              key={c.id + c.name + c.number}
              className="neo-box p-3 bg-[var(--neo-card-bg)] flex items-center justify-between gap-2 hover:border-[var(--neo-primary)] transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="neo-box p-2 bg-[var(--neo-primary)] text-[var(--neo-primary-text)] font-black text-xs shrink-0">
                  {c.name.charAt(0).toUpperCase() || <User className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-[var(--neo-text)] truncate">{c.name}</p>
                  <p className="text-[11px] font-mono text-[var(--neo-primary)] truncate">{c.number}</p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  title="Direct Call"
                  onClick={() => onTriggerCall(c.number)}
                  className="neo-box p-1.5 bg-emerald-500 text-white hover:scale-105 transition-transform cursor-pointer"
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Compose SMS"
                  onClick={() => onSelectForSms(c.number)}
                  className="neo-box p-1.5 bg-cyan-500 text-white hover:scale-105 transition-transform cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
