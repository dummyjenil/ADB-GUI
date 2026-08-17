import React from "react";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerTitle?: React.ReactNode;
  headerIcon?: React.ReactNode;
  headerAction?: React.ReactNode;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  headerVariant?: "primary" | "secondary" | "accent" | "dark";
  footer?: React.ReactNode;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  bodyClassName = "",
  headerTitle,
  headerIcon,
  headerAction,
  title,
  icon,
  headerVariant = "primary",
  footer,
  noPadding = false,
}) => {
  const displayTitle = headerTitle ?? title;
  const displayIcon = headerIcon ?? icon;

  const headerVariants = {
    primary: "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]",
    secondary: "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)]",
    accent: "bg-[var(--neo-accent)] text-[var(--neo-accent-text)]",
    dark: "bg-[var(--neo-card-header-bg)] text-[var(--neo-card-header-text)]",
  };

  return (
    <div className={`neo-box overflow-hidden animate-neo-pop ${className}`}>
      {displayTitle && (
        <div
          className={`px-5 py-3.5 border-b-3 border-[var(--neo-border)] flex items-center justify-between font-bold ${
            headerVariants[headerVariant]
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm uppercase tracking-wide truncate">
            {displayIcon}
            <span className="truncate">{displayTitle}</span>
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className={noPadding ? bodyClassName : `p-4 sm:p-5 ${bodyClassName}`}>
        {children}
      </div>

      {footer && (
        <div className="p-3.5 border-t-2 border-[var(--neo-border)] bg-black/10 flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
};
