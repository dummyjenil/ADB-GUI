import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  headerTitle?: React.ReactNode;
  headerIcon?: React.ReactNode;
  headerAction?: React.ReactNode;
  headerVariant?: "primary" | "secondary" | "accent" | "dark";
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  headerTitle,
  headerIcon,
  headerAction,
  headerVariant = "primary",
}) => {
  const headerVariants = {
    primary: "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]",
    secondary: "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)]",
    accent: "bg-[var(--neo-accent)] text-[var(--neo-accent-text)]",
    dark: "bg-[var(--neo-card-header-bg)] text-[var(--neo-card-header-text)]",
  };

  return (
    <div className={`neo-box overflow-hidden animate-neo-pop ${className}`}>
      {headerTitle && (
        <div
          className={`px-5 py-3.5 border-b-3 border-[var(--neo-border)] flex items-center justify-between font-bold ${
            headerVariants[headerVariant]
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm uppercase tracking-wide">
            {headerIcon}
            <span>{headerTitle}</span>
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}

      <div className="p-5">{children}</div>
    </div>
  );
};
