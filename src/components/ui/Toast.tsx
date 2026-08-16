import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
  message: string | null;
  type?: ToastType;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  onClose,
  className = "",
}) => {
  if (!message) return null;

  const typeConfig: Record<
    ToastType,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
    success: {
      bg: "bg-[var(--neo-primary)]",
      text: "text-[var(--neo-primary-text)]",
      icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />,
    },
    error: {
      bg: "bg-rose-500",
      text: "text-white",
      icon: <AlertCircle className="h-4 w-4 shrink-0 text-white" />,
    },
    warning: {
      bg: "bg-amber-400",
      text: "text-black",
      icon: <AlertCircle className="h-4 w-4 shrink-0 text-black" />,
    },
    info: {
      bg: "bg-[var(--neo-secondary)]",
      text: "text-[var(--neo-secondary-text)]",
      icon: <Info className="h-4 w-4 shrink-0 text-cyan-800" />,
    },
  };

  const config = typeConfig[type] || typeConfig.success;

  return (
    <div
      className={`fixed bottom-6 right-6 neo-box px-4 py-3 text-xs font-bold flex items-center gap-2.5 animate-neo-slide z-50 shadow-[5px_5px_0px_0px_var(--neo-shadow)] max-w-md ${config.bg} ${config.text} ${className}`}
      role="alert"
    >
      {config.icon}
      <span className="break-words flex-1">{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer ml-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
