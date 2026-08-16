import React from "react";
import { ProgressBar } from "./ProgressBar";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  progress?: number;
  progressColor?: string;
  subLeft?: React.ReactNode;
  subRight?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  icon,
  progress,
  progressColor = "bg-[var(--neo-primary)]",
  subLeft,
  subRight,
  className = "",
}) => {
  return (
    <div className={`neo-box-sm p-3.5 bg-[var(--neo-card-bg)] space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="flex items-center gap-1.5 text-[var(--neo-text-muted)]">
          {icon}
          {label}
        </span>
        <span className="font-mono font-bold text-sm">{value}</span>
      </div>

      {progress !== undefined && (
        <ProgressBar value={progress} colorClass={progressColor} />
      )}

      {(subLeft || subRight) && (
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--neo-text-muted)]">
          <span>{subLeft}</span>
          <span>{subRight}</span>
        </div>
      )}
    </div>
  );
};
