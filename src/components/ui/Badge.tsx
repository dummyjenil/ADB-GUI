import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "accent" | "success" | "danger" | "warning" | "dark";
  size?: "sm" | "md";
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  size = "sm",
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
    dark: "bg-black/40 text-[var(--neo-text)]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider border-2 border-[var(--neo-border)] rounded-md shadow-[2px_2px_0px_0px_var(--neo-shadow)] select-none ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
};
