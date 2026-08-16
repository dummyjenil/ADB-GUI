import React from "react";
import { FilterOption } from "../../types/app_manager";
import { Filter, RefreshCw, X } from "lucide-react";
import { Button, SearchInput } from "../ui";

interface AppFiltersBarProps {
  activeFilters: FilterOption[];
  setActiveFilters: React.Dispatch<React.SetStateAction<FilterOption[]>>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  loading: boolean;
  totalCount: number;
  filteredCount: number;
}

export const AppFiltersBar: React.FC<AppFiltersBarProps> = ({
  activeFilters,
  setActiveFilters,
  searchQuery,
  setSearchQuery,
  onRefresh,
  loading,
  totalCount,
  filteredCount,
}) => {
  const filterOptions: { id: FilterOption; label: string }[] = [
    { id: "all", label: "All Apps" },
    { id: "user", label: "User Apps" },
    { id: "system", label: "System Apps" },
    { id: "enabled", label: "Enabled" },
    { id: "disabled", label: "Disabled" },
    { id: "running", label: "Running" },
    { id: "debuggable", label: "Debuggable" },
    { id: "recently_installed", label: "Recently Installed" },
    { id: "with_apk", label: "With APK" },
    { id: "without_apk", label: "Without APK" },
    { id: "by_uid", label: "By UID" },
  ];

  const handleToggleFilter = (filterId: FilterOption) => {
    if (filterId === "all") {
      setActiveFilters([]);
      return;
    }

    if (activeFilters.includes(filterId)) {
      setActiveFilters(activeFilters.filter((f) => f !== filterId));
    } else {
      setActiveFilters([...activeFilters, filterId]);
    }
  };

  const isAllActive = activeFilters.length === 0 || activeFilters.includes("all");

  return (
    <div className="neo-box p-4 bg-[var(--neo-card-bg)] space-y-3.5">
      {/* Search & Refresh Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1">
          <SearchInput
            placeholder={
              activeFilters.includes("by_uid")
                ? "Filter by UID (e.g. 10169 or u0_a169)..."
                : "Search by App Label, Package Identifier, or UID..."
            }
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 justify-between sm:justify-end">
          <span className="text-xs font-black uppercase text-[var(--neo-text-muted)] bg-black/10 px-3 py-1.5 rounded border border-black/20 font-mono">
            Showing {filteredCount} / {totalCount} Apps
          </span>

          <Button
            size="sm"
            variant="accent"
            icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />}
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Multi-Select Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
        <span className="text-[11px] font-black uppercase text-[var(--neo-text-muted)] shrink-0 flex items-center gap-1 pr-1">
          <Filter className="h-3.5 w-3.5" /> Multi-Filter:
        </span>

        {filterOptions.map((f) => {
          const isActive = f.id === "all" ? isAllActive : activeFilters.includes(f.id);

          return (
            <button
              key={f.id}
              type="button"
              onClick={() => handleToggleFilter(f.id)}
              className={`shrink-0 px-3 py-1.5 text-xs font-extrabold transition-all rounded neo-btn flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                  : "bg-black/10 text-[var(--neo-text)] border-transparent hover:bg-black/20"
              }`}
            >
              <span>{f.label}</span>
              {isActive && f.id !== "all" && <X className="h-3 w-3 opacity-70 hover:opacity-100" />}
            </button>
          );
        })}

        {!isAllActive && (
          <button
            type="button"
            onClick={() => setActiveFilters([])}
            className="shrink-0 px-2 py-1 text-[11px] font-black text-rose-500 hover:underline uppercase cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
};
