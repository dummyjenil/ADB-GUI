import React from "react";
import { Smartphone } from "lucide-react";
import { Card } from "./Card";

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No Active Device Selected",
  description = "Please select or connect an Android device in Device Manager to proceed.",
  icon = <Smartphone className="h-9 w-9 text-[var(--neo-primary)]" />,
  action,
  compact = false,
  className = "",
}) => {
  return (
    <Card className={`text-center max-w-lg mx-auto ${compact ? "py-4" : "py-8"} ${className}`}>
      <div
        className={`p-3.5 rounded-xl bg-[var(--neo-bg)] border-2 border-[var(--neo-border)] w-fit mx-auto mb-3.5 shadow-[2px_2px_0px_0px_var(--neo-shadow)] animate-bounce`}
      >
        {icon}
      </div>
      <h3 className="text-sm sm:text-base font-black text-[var(--neo-text)] uppercase tracking-wide">
        {title}
      </h3>
      <p className="text-xs text-[var(--neo-text-muted)] mt-1 max-w-xs mx-auto font-medium leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  );
};
