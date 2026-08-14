import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { CallLogItem } from "./types";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Search,
  RefreshCw,
  Clock,
  PhoneCall,
} from "lucide-react";

interface CallLogsPanelProps {
  activeDevice: string;
  callLogs: CallLogItem[];
  loading: boolean;
  onRefresh: () => void;
  onFeedback: (msg: string) => void;
  onTriggerCall: (number: string) => void;
}

export const CallLogsPanel: React.FC<CallLogsPanelProps> = ({
  activeDevice,
  callLogs,
  loading,
  onRefresh,
  onFeedback,
  onTriggerCall,
}) => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [endingCall, setEndingCall] = useState(false);
  const [manualNumber, setManualNumber] = useState("");

  const handleEndCall = async () => {
    setEndingCall(true);
    try {
      await invoke("end_call", { serial: activeDevice });
      onFeedback("Ended active call");
    } catch (err: any) {
      onFeedback(`Error ending call: ${String(err)}`);
    } finally {
      setEndingCall(false);
    }
  };

  const getCallIcon = (type: string) => {
    switch (type) {
      case "incoming":
        return <PhoneIncoming className="h-4 w-4 text-emerald-400" />;
      case "outgoing":
        return <PhoneOutgoing className="h-4 w-4 text-cyan-400" />;
      case "missed":
        return <PhoneMissed className="h-4 w-4 text-rose-500" />;
      default:
        return <Phone className="h-4 w-4 text-[var(--neo-text-muted)]" />;
    }
  };

  const getCallBadge = (type: string) => {
    switch (type) {
      case "incoming":
        return <Badge variant="primary">Incoming</Badge>;
      case "outgoing":
        return <Badge variant="secondary">Outgoing</Badge>;
      case "missed":
        return <Badge variant="danger">Missed</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const filteredLogs = callLogs.filter((log) => {
    if (filterType !== "all" && log.call_type !== filterType) return false;
    const q = search.toLowerCase();
    return log.name.toLowerCase().includes(q) || log.number.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Top Controls & Manual Dialer Bar */}
      <div className="neo-box p-3 bg-black/10 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Input
            value={manualNumber}
            onChange={(e) => setManualNumber(e.target.value)}
            placeholder="Dial phone number..."
            className="w-full sm:w-56"
            icon={<Phone className="h-4 w-4" />}
          />
          <Button
            size="sm"
            variant="primary"
            icon={<PhoneCall className="h-3.5 w-3.5" />}
            onClick={() => {
              if (manualNumber.trim()) onTriggerCall(manualNumber.trim());
            }}
          >
            Call
          </Button>
          <Button
            size="sm"
            variant="rose"
            icon={<PhoneOff className="h-3.5 w-3.5" />}
            loading={endingCall}
            onClick={handleEndCall}
          >
            End Call
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search call logs..."
            className="w-full sm:w-48"
            icon={<Search className="h-4 w-4" />}
          />
          <Button size="sm" variant="ghost" icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={onRefresh}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {["all", "incoming", "outgoing", "missed"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            className={`neo-box px-3 py-1 text-xs font-black uppercase transition-all cursor-pointer ${
              filterType === t
                ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]"
                : "bg-black/10 text-[var(--neo-text)] hover:bg-black/20"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Call History List */}
      {filteredLogs.length === 0 ? (
        <div className="neo-box p-8 text-center bg-[var(--neo-card-bg)]">
          <Phone className="h-8 w-8 text-[var(--neo-text-muted)] mx-auto mb-2 opacity-50" />
          <p className="text-xs font-black uppercase text-[var(--neo-text)]">No call logs found</p>
          <p className="text-[11px] text-[var(--neo-text-muted)]">Call records or matches will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto custom-scrollbar p-1">
          {filteredLogs.map((log) => (
            <div
              key={log.id + log.date}
              className="neo-box p-3 bg-[var(--neo-card-bg)] flex items-center justify-between gap-3 hover:border-[var(--neo-primary)] transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="neo-box p-2 bg-black/10 shrink-0">{getCallIcon(log.call_type)}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black truncate text-[var(--neo-text)]">{log.name}</span>
                    {getCallBadge(log.call_type)}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--neo-primary)] truncate">{log.number}</div>
                  <div className="text-[10px] text-[var(--neo-text-muted)] flex items-center gap-2 font-medium">
                    <span>{log.date}</span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {log.duration}</span>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                variant="primary"
                icon={<PhoneCall className="h-3.5 w-3.5" />}
                onClick={() => onTriggerCall(log.number)}
              >
                Redial
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
