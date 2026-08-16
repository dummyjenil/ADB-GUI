import React from "react";

export interface ProgressBarProps {
  value: number;
  max?: number;
  colorClass?: string;
  className?: string;
  showPercent?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  colorClass = "bg-[var(--neo-primary)]",
  className = "",
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={`w-full bg-black/40 h-3 neo-box-sm overflow-hidden p-0.5 relative border border-[var(--neo-border)]/40 ${className}`}
    >
      <div
        className={`h-full rounded-sm transition-all duration-300 border-r-2 border-[var(--neo-border)] ${colorClass}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};
