import React, { useState } from "react";
import { Zap, Code2, Check, Copy, ShieldCheck, Key, Eye, Lock } from "lucide-react";
import { Button, Badge, SearchInput } from "../ui";
import { FRIDA_PRESETS } from "./presetsData";
import { PresetScript } from "../../types/frida";

interface FridaPresetHubProps {
  onLoadScript: (script: string, autoRun?: boolean) => void;
  selectedTarget: string | null;
}

export const FridaPresetHub: React.FC<FridaPresetHubProps> = ({
  onLoadScript,
  selectedTarget,
}) => {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ["All", "Security Bypass", "Crypto & Storage", "Inspection", "UI & UX"];

  const filteredPresets = FRIDA_PRESETS.filter((preset) => {
    const matchesCat = selectedCategory === "All" || preset.category === selectedCategory;
    const matchesSearch =
      !search.trim() ||
      preset.title.toLowerCase().includes(search.toLowerCase()) ||
      preset.description.toLowerCase().includes(search.toLowerCase()) ||
      preset.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleCopy = (preset: PresetScript) => {
    navigator.clipboard.writeText(preset.script);
    setCopiedId(preset.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-400" />
            1-Click Security Bypasses & Presets
          </h2>
          <p className="text-xs text-[var(--neo-text-muted)] font-mono mt-1">
            Production-grade dynamic instrumentation scripts for SSL unpinning, root detection, crypto interception, and testing.
          </p>
        </div>

        {selectedTarget && (
          <div className="text-xs font-mono bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded neo-box border">
            Target: <strong>{selectedTarget}</strong>
          </div>
        )}
      </div>

      {/* Filter and Categories */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-bold neo-btn transition-all ${selectedCategory === cat
                  ? "bg-purple-500 text-white shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                  : "bg-transparent text-[var(--neo-text)] hover:bg-black/5"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full md:w-64">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search scripts & tags..."
          />
        </div>
      </div>

      {/* Presets Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPresets.map((preset) => (
          <div
            key={preset.id}
            className="p-4 neo-box bg-[var(--neo-card-bg)] flex flex-col justify-between gap-4 hover:shadow-[6px_6px_0px_0px_var(--neo-shadow)] transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  {preset.category === "Security Bypass" && <ShieldCheck className="h-4 w-4 text-rose-400" />}
                  {preset.category === "Crypto & Storage" && <Key className="h-4 w-4 text-cyan-400" />}
                  {preset.category === "Inspection" && <Eye className="h-4 w-4 text-amber-400" />}
                  {preset.category === "UI & UX" && <Lock className="h-4 w-4 text-emerald-400" />}
                  {preset.title}
                </h3>
                <Badge variant="accent">{preset.category}</Badge>
              </div>

              <p className="text-xs text-[var(--neo-text-muted)] leading-relaxed mb-3">
                {preset.description}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {preset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-2 py-0.5 bg-black/10 text-[var(--neo-text)] rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-black/10">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(preset)}
                icon={copiedId === preset.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              >
                {copiedId === preset.id ? "Copied" : "Copy Code"}
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onLoadScript(preset.script, false)}
                  icon={<Code2 className="h-3.5 w-3.5" />}
                >
                  Open in Editor
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
