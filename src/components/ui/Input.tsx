import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, icon, className = "", ...props }) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-xs font-bold uppercase tracking-wider text-[var(--neo-text-muted)] block">{label}</label>}
      <div className="relative flex items-center">
        {icon && <div className="absolute left-3 text-[var(--neo-text-muted)] pointer-events-none">{icon}</div>}
        <input
          className={`neo-input w-full py-2.5 px-3 text-xs font-mono font-medium ${
            icon ? "pl-9" : ""
          } ${className}`}
          {...props}
        />
      </div>
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, className = "", ...props }) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-xs font-bold uppercase tracking-wider text-[var(--neo-text-muted)] block">{label}</label>}
      <textarea
        className={`neo-input w-full p-3 text-xs font-mono font-medium resize-none ${className}`}
        {...props}
      />
    </div>
  );
};
