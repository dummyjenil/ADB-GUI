import { ArrowLeftRight } from "lucide-react";
import { Badge } from "../ui/Badge";

interface HeaderBannerProps {
  activeTab: "forward" | "reverse";
  onTabChange: (tab: "forward" | "reverse") => void;
}

export function HeaderBanner({ activeTab, onTabChange }: HeaderBannerProps) {
  return (
    <div className="neo-box p-4 sm:p-5 bg-[var(--neo-card-bg)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-2 border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)] rounded-lg">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-[var(--neo-text)] uppercase tracking-wide">
              Port Forwarding Manager
            </h2>
            <p className="text-xs font-semibold text-[var(--neo-text-muted)]">
              Map arbitrary host/device TCP ports, domain sockets, and JDWP debuggers.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Switcher (Forward vs Reverse) */}
      <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-xl border-2 border-[var(--neo-border)] w-full md:w-auto">
        <button
          onClick={() => onTabChange("forward")}
          className={`neo-btn flex-1 md:flex-none px-4 py-2 text-xs font-black flex items-center justify-center gap-2 transition-all ${
            activeTab === "forward"
              ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
              : "bg-transparent text-[var(--neo-text)] border-transparent shadow-none"
          }`}
        >
          <span>ADB Forward</span>
          <Badge variant="secondary">Host → Device</Badge>
        </button>

        <button
          onClick={() => onTabChange("reverse")}
          className={`neo-btn flex-1 md:flex-none px-4 py-2 text-xs font-black flex items-center justify-center gap-2 transition-all ${
            activeTab === "reverse"
              ? "bg-cyan-300 text-black shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
              : "bg-transparent text-[var(--neo-text)] border-transparent shadow-none"
          }`}
        >
          <span>ADB Reverse</span>
          <Badge variant="accent">Device → Host</Badge>
        </button>
      </div>
    </div>
  );
}
