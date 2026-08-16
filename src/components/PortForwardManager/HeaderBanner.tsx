import { ArrowLeftRight } from "lucide-react";
import { Tabs } from "../ui";

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
      <Tabs
        activeTab={activeTab}
        onChange={onTabChange}
        variant="buttons"
        tabs={[
          { id: "forward", label: "ADB Forward", badge: "Host → Device" },
          { id: "reverse", label: "ADB Reverse", badge: "Device → Host" },
        ]}
      />
    </div>
  );
}
