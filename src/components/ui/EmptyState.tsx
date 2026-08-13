import React from "react";
import { Smartphone } from "lucide-react";
import { Card } from "./Card";

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "No Active Device Selected",
  description = "Please select or connect an Android device in Device Manager to proceed.",
  icon = <Smartphone className="h-10 w-10 text-[var(--neo-primary)]" />,
}) => {
  return (
    <Card className="text-center py-10 max-w-lg mx-auto">
      <div className="p-4 rounded-xl bg-[var(--neo-bg)] border-2 border-[var(--neo-border)] w-fit mx-auto mb-4 animate-bounce">
        {icon}
      </div>
      <h3 className="text-base font-extrabold text-[var(--neo-text)] uppercase tracking-wide">
        {title}
      </h3>
      <p className="text-xs text-[var(--neo-text-muted)] mt-1 max-w-xs mx-auto">
        {description}
      </p>
    </Card>
  );
};
