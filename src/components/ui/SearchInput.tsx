import React from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (val: string) => void;
  onClear?: () => void;
  count?: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  count,
  className = "",
  ...props
}) => {
  const handleClear = () => {
    onChange("");
    if (onClear) onClear();
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <div className="absolute left-3 text-[var(--neo-text-muted)] pointer-events-none">
        <Search className="h-4 w-4" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="neo-input w-full py-2 pl-9 pr-16 text-xs font-mono font-medium"
        {...props}
      />
      <div className="absolute right-2.5 flex items-center gap-1.5">
        {count !== undefined && (
          <span className="text-[10px] font-mono text-[var(--neo-text-muted)] bg-black/20 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-[var(--neo-text-muted)] hover:text-[var(--neo-text)] hover:bg-black/10 rounded transition-colors cursor-pointer"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
