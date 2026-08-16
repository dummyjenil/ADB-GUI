import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  headerVariant?: "primary" | "secondary" | "accent" | "dark";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = "max-w-xl",
  headerVariant = "primary",
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const headerVariants = {
    primary: "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]",
    secondary: "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)]",
    accent: "bg-[var(--neo-accent)] text-[var(--neo-accent-text)]",
    dark: "bg-[var(--neo-card-header-bg)] text-[var(--neo-card-header-text)]",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`neo-box w-full ${maxWidth} bg-[var(--neo-card-bg)] text-[var(--neo-text)] shadow-[8px_8px_0px_0px_var(--neo-shadow)] overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-3.5 border-b-2 border-[var(--neo-border)] ${headerVariants[headerVariant]} font-black`}
        >
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide truncate">
            {icon}
            <span className="truncate">{title}</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 hover:bg-black/10 rounded transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="p-3.5 border-t-2 border-[var(--neo-border)] bg-black/10 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
