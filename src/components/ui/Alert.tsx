import React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export interface AlertProps {
  variant?: "info" | "success" | "warning" | "danger" | "error" | "primary" | "secondary";
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  children,
  icon,
  onClose,
  className = "",
}) => {
  const normalizedVariant = variant === "error" ? "danger" : variant;

  const variantStyles = {
    info: "bg-cyan-500/10 border-cyan-500/30 text-cyan-200",
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-200",
    danger: "bg-rose-500/15 border-rose-500/40 text-rose-200",
    primary: "bg-[var(--neo-primary)]/15 border-[var(--neo-primary)]/40 text-[var(--neo-text)]",
    secondary: "bg-[var(--neo-secondary)]/15 border-[var(--neo-secondary)]/40 text-[var(--neo-text)]",
  };

  const defaultIcons = {
    info: <Info className="h-4 w-4 text-cyan-400 shrink-0" />,
    success: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />,
    danger: <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />,
    primary: <Info className="h-4 w-4 text-[var(--neo-primary)] shrink-0" />,
    secondary: <Info className="h-4 w-4 text-[var(--neo-secondary)] shrink-0" />,
  };

  return (
    <div
      className={`p-3 neo-box-sm border-2 flex items-start gap-2.5 text-xs ${variantStyles[normalizedVariant]} ${className}`}
      role="alert"
    >
      <div className="mt-0.5">{icon || defaultIcons[normalizedVariant]}</div>
      <div className="flex-1 min-w-0">
        {title && <div className="font-extrabold uppercase tracking-wide mb-0.5">{title}</div>}
        <div className="font-medium text-[11px] leading-relaxed">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 hover:bg-black/20 rounded transition-colors cursor-pointer shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
