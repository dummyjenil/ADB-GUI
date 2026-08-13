import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface SelectProps<T extends string = string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "accent" | "card";
  icon?: React.ReactNode;
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  disabled = false,
  className = "",
  variant = "primary",
  icon,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const variantStyles = {
    primary: "bg-[var(--neo-primary)] text-[var(--neo-primary-text)]",
    secondary: "bg-[var(--neo-secondary)] text-[var(--neo-secondary-text)]",
    accent: "bg-[var(--neo-accent)] text-[var(--neo-accent-text)]",
    card: "bg-[var(--neo-card-bg)] text-[var(--neo-text)]",
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`neo-btn px-3.5 py-2 text-xs font-bold flex items-center justify-between gap-2.5 min-w-[170px] ${
          variantStyles[variant]
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon || selectedOption?.icon}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Animated Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-60 neo-box z-50 overflow-hidden bg-[var(--neo-card-bg)] p-1.5 animate-neo-pop">
          <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--neo-text-muted)] italic text-center">
                No options available
              </div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-all border-2 border-transparent ${
                      isSelected
                        ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                        : "text-[var(--neo-text)] hover:bg-[var(--neo-secondary)] hover:text-[var(--neo-secondary-text)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {option.icon}
                      <div>
                        <div className="truncate">{option.label}</div>
                        {option.sublabel && (
                          <div className="text-[10px] opacity-75 font-mono font-normal">
                            {option.sublabel}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
