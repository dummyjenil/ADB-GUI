import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "rose"
    | "amber"
    | "cyan"
    | "outline"
    | "ghost";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  active?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  active = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary: "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]",
    secondary: "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)]",
    accent: "bg-[var(--neo-accent)] text-[var(--neo-accent-text)]",
    rose: "bg-rose-500 text-white",
    amber: "bg-amber-400 text-black",
    cyan: "bg-cyan-400 text-black",
    outline: "bg-transparent text-[var(--neo-text)] border-[var(--neo-border)]",
    ghost: "bg-transparent text-[var(--neo-text)] border-transparent shadow-none hover:bg-black/10",
  };

  const sizeStyles = {
    xs: "px-2 py-1 text-[11px] font-bold gap-1",
    sm: "px-2.5 py-1.5 text-xs font-bold gap-1.5",
    md: "px-4 py-2.5 text-xs font-bold gap-2",
    lg: "px-5 py-3 text-sm font-bold gap-2.5",
    icon: "p-2 text-xs font-bold shrink-0",
  };

  const activeStyles = active
    ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-[3px_3px_0px_0px_var(--neo-shadow)]"
    : "";

  return (
    <button
      disabled={disabled || loading}
      className={`neo-btn inline-flex items-center justify-center cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${
        activeStyles || variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : icon}
      {children}
    </button>
  );
};
