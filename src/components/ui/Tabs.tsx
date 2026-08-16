import React from "react";

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  badgeVariant?: "primary" | "secondary" | "accent" | "success" | "danger" | "warning";
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  variant?: "buttons" | "pills" | "compact";
  className?: string;
  fullWidth?: boolean;
  size?: "sm" | "md";
}

export function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  variant = "buttons",
  className = "",
  fullWidth = false,
  size = "md",
}: TabsProps<T>) {
  const sizeClasses = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-xs";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        let activeStyle = "";
        let inactiveStyle = "";

        if (variant === "buttons") {
          activeStyle =
            "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-[3px_3px_0px_0px_var(--neo-shadow)]";
          inactiveStyle =
            "bg-[var(--neo-card-bg)] text-[var(--neo-text)] hover:bg-black/10";
        } else if (variant === "pills") {
          activeStyle =
            "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)] border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]";
          inactiveStyle =
            "bg-transparent text-[var(--neo-text-muted)] hover:text-[var(--neo-text)] hover:bg-black/10 border-transparent shadow-none";
        } else if (variant === "compact") {
          activeStyle =
            "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]";
          inactiveStyle =
            "bg-transparent text-[var(--neo-text)] border-transparent shadow-none hover:bg-black/10";
        }

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            className={`neo-btn font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              fullWidth ? "flex-1" : ""
            } ${sizeClasses} ${isActive ? activeStyle : inactiveStyle}`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.badge && (
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-black/20">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
