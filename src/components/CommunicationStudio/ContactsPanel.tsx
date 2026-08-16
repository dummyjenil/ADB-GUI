import React, { useState } from "react";
import { ContactItem } from "./types";
import { Button, SearchInput, EmptyState } from "../ui";
import {
  Users,
  PhoneCall,
  MessageSquare,
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
        <div className="w-full sm:w-72">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search contacts by name or phone..."
            count={filteredContacts.length}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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

      {filteredContacts.length === 0 ? (
        <EmptyState
          title="No Contacts Found"
          description="Device phonebook records will appear here."
          icon={<Users className="h-8 w-8 text-[var(--neo-primary)]" />}
        />
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

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  size="xs"
                  variant="primary"
                  title="Direct Call"
                  onClick={() => onTriggerCall(c.number)}
                  icon={<PhoneCall className="h-3.5 w-3.5" />}
                />
                <Button
                  size="xs"
                  variant="cyan"
                  title="Compose SMS"
                  onClick={() => onSelectForSms(c.number)}
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
