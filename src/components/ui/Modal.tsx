import React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  maxWidth = "max-w-xl",
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className={`neo-box w-full ${maxWidth} bg-[var(--neo-card-bg)] text-[var(--neo-text)] shadow-[8px_8px_0px_0px_var(--neo-shadow)] overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b-2 border-[var(--neo-border)] bg-[var(--neo-primary)] text-[var(--neo-primary-text)] font-black">
          <div className="flex items-center gap-2 text-sm uppercase tracking-wide">
            {icon}
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 hover:bg-black/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[80vh] custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};
