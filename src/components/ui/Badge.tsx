import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "accent" | "success" | "danger" | "warning";
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  className = "",
  icon,
}) => {
  const variantStyles = {
    primary: "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]",
    secondary: "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)]",
    accent: "bg-[var(--neo-accent)] text-[var(--neo-accent-text)]",
    success: "bg-emerald-400 text-black",
    danger: "bg-rose-500 text-white",
    warning: "bg-amber-400 text-black",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border-2 border-[var(--neo-border)] rounded-md shadow-[2px_2px_0px_0px_var(--neo-shadow)] ${
        variantStyles[variant]
      } ${className}`}
    >
      {icon}
      {children}
    </span>
  );
};
