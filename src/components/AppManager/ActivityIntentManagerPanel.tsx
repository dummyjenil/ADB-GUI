import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Select } from "../ui/Select";
import { IntentExtra, IntentPayload } from "../../types/app_manager";
import { Button } from "../ui/Button";
import {
  Rocket,
  Play,
  Square,
  Plus,
  Trash2,
  Send,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle,
  Code,
  Globe,
  Radio,
  FileCode,
} from "lucide-react";

interface ActivityIntentManagerPanelProps {
  activeDevice: string;
  packageName?: string;
  activities?: string[];
  services?: string[];
  addLog: (msg: string) => void;
}

const COMMON_ACTIONS = [
  "android.intent.action.MAIN",
  "android.intent.action.VIEW",
  "android.intent.action.SEND",
  "android.intent.action.SENDTO",
  "android.intent.action.BOOT_COMPLETED",
  "android.intent.action.SET_WALLPAPER",
  "android.intent.action.SETTINGS",
];

export const ActivityIntentManagerPanel: React.FC<ActivityIntentManagerPanelProps> = ({
  activeDevice,
  packageName = "",
  activities = [],
  addLog,
}) => {
  const [targetPackage, setTargetPackage] = useState(packageName);
  const [selectedActivity, setSelectedActivity] = useState(activities[0] || "");
  const [intentType, setIntentType] = useState<"start" | "startservice" | "broadcast">("start");
  const [action, setAction] = useState("android.intent.action.VIEW");
  const [dataUri, setDataUri] = useState("");
  const [category, setCategory] = useState("android.intent.category.DEFAULT");
  const [flags, setFlags] = useState("");
  const [extras, setExtras] = useState<IntentExtra[]>([]);
  
  const [activitySearch, setActivitySearch] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ success: boolean; msg: string } | null>(null);

  const handleAddExtra = () => {
    setExtras((prev) => [...prev, { key: "", value: "", extra_type: "string" }]);
  };

  const handleUpdateExtra = (index: number, field: keyof IntentExtra, val: string) => {
    setExtras((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val as any };
      return copy;
    });
  };

  const handleRemoveExtra = (index: number) => {
    setExtras((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuickLaunchActivity = async (actName: string) => {
    setRunning(true);
    setRunResult(null);
    try {
      const res: string = await invoke("execute_intent", {
        serial: activeDevice,
        intentType: "start",
        packageName: targetPackage,
        activityName: actName,
        action: null,
        dataUri: null,
        category: null,
        extras: [],
        flags: null,
      });
      const msg = `Launched activity '${actName}': ${res}`;
      addLog(`[SUCCESS] ${msg}`);
      setRunResult({ success: true, msg });
    } catch (err: any) {
      const msg = `Failed to launch activity: ${String(err)}`;
      addLog(`[ERROR] ${msg}`);
      setRunResult({ success: false, msg });
    } finally {
      setRunning(false);
    }
  };

  const handleRunIntent = async () => {
    setRunning(true);
    setRunResult(null);

    const payload: IntentPayload = {
      intent_type: intentType,
      package_name: targetPackage || undefined,
      activity_name: selectedActivity || undefined,
      action: action || undefined,
      data_uri: dataUri || undefined,
      category: category || undefined,
      extras: extras.filter((e) => e.key.trim() !== ""),
      flags: flags || undefined,
    };

    try {
      const res: string = await invoke("execute_intent", {
        serial: activeDevice,
        intentType: payload.intent_type,
        packageName: payload.package_name,
        activityName: payload.activity_name,
        action: payload.action,
        dataUri: payload.data_uri,
        category: payload.category,
        extras: payload.extras,
        flags: payload.flags,
      });
      const msg = `Executed Intent (${payload.intent_type.toUpperCase()}): ${res}`;
      addLog(`[SUCCESS] ${msg}`);
      setRunResult({ success: true, msg });
    } catch (err: any) {
      const msg = `Intent execution failed: ${String(err)}`;
      addLog(`[ERROR] ${msg}`);
      setRunResult({ success: false, msg });
    } finally {
      setRunning(false);
    }
  };

  const handleForceStop = async () => {
    if (!targetPackage) return;
    setRunning(true);
    try {
      const res: string = await invoke("force_stop_app", {
        serial: activeDevice,
        packageName: targetPackage,
      });
      const msg = `Force stopped ${targetPackage}: ${res}`;
      addLog(`[SUCCESS] ${msg}`);
      setRunResult({ success: true, msg });
    } catch (err: any) {
      const msg = `Failed to force stop: ${String(err)}`;
      addLog(`[ERROR] ${msg}`);
      setRunResult({ success: false, msg });
    } finally {
      setRunning(false);
    }
  };

  const filteredActivities = activities.filter((act) =>
    act.toLowerCase().includes(activitySearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-6 text-xs font-sans">
      {/* Header Banner */}
      <div className="flex items-center justify-between gap-3 neo-box p-3 bg-black/10">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-[var(--neo-primary)] shrink-0" />
          <div>
            <h4 className="font-extrabold uppercase tracking-wide text-sm">Activity & Intent Manager</h4>
            <p className="text-[11px] font-mono text-[var(--neo-text-muted)]">
              Launch activities, send custom intents, start services, and pass extras via `am`
            </p>
          </div>
        </div>

        {targetPackage && (
          <Button size="sm" variant="amber" icon={<Square className="h-3.5 w-3.5" />} onClick={handleForceStop} disabled={running}>
            Force Stop App
          </Button>
        )}
      </div>

      {/* Installed Activities Browser */}
      {activities.length > 0 && (
        <div className="space-y-3 neo-box p-4 bg-black/15">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--neo-border)] pb-2.5">
            <h5 className="font-black uppercase tracking-wider flex items-center gap-2 text-xs text-[var(--neo-primary)]">
              <Layers className="h-4 w-4" /> Installed Activities ({activities.length})
            </h5>
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)]" />
              <input
                type="text"
                placeholder="Search activities..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="neo-input pl-8 py-1 text-xs w-full font-mono"
              />
            </div>
          </div>

          <div className="neo-box p-2 bg-black/25 max-h-52 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-1.5">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((act, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-black/20 rounded hover:bg-black/40 transition-all">
                  <span className="truncate select-all text-slate-200 font-semibold">{act}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Play className="h-3 w-3" />}
                      onClick={() => handleQuickLaunchActivity(act)}
                      disabled={running}
                    >
                      Launch
                    </Button>
                    <button
                      onClick={() => setSelectedActivity(act)}
                      className="neo-btn px-2 py-1 text-[10px] bg-black/30 hover:bg-black/50 text-[var(--neo-text)]"
                    >
                      Select in Form
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-[var(--neo-text-muted)] italic text-center py-3">No matching activities found.</p>
            )}
          </div>
        </div>
      )}

      {/* Main Intent Launcher GUI Form */}
      <div className="neo-box p-4 bg-black/15 space-y-4">
        <h5 className="font-black uppercase tracking-wider text-sm text-[var(--neo-primary)] flex items-center gap-2">
          <FileCode className="h-4 w-4" /> Custom Intent Builder & Runner (`am`)
        </h5>

        {/* Intent Mode Tabs */}
        <div className="flex items-center gap-2 border-b border-[var(--neo-border)] pb-2 overflow-x-auto custom-scrollbar">
          {[
            { id: "start", label: "Start Activity (am start)", icon: <Play className="h-3.5 w-3.5" /> },
            { id: "startservice", label: "Start Service (am startservice)", icon: <Radio className="h-3.5 w-3.5" /> },
            { id: "broadcast", label: "Broadcast Intent (am broadcast)", icon: <Send className="h-3.5 w-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setIntentType(t.id as any)}
              className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 rounded border transition-all ${
                intentType === t.id
                  ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] border-[var(--neo-border)] shadow-xs"
                  : "bg-black/20 text-[var(--neo-text-muted)] border-transparent hover:bg-black/40"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Target Package & Activity Input Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Package Name</label>
            <input
              type="text"
              placeholder="e.g. com.example.app"
              value={targetPackage}
              onChange={(e) => setTargetPackage(e.target.value)}
              className="neo-input w-full py-1.5 px-2.5 font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">
              Activity / Component Component
            </label>
            {activities.length > 0 ? (
              <Select
                options={[
                  { value: "", label: "-- None / Select Activity --" },
                  ...activities.map((act) => ({ value: act, label: act })),
                ]}
                value={selectedActivity}
                onChange={setSelectedActivity}
                variant="card"
                className="w-full"
              />
            ) : (
              <input
                type="text"
                placeholder="e.g. .MainActivity or com.example.app/.MainActivity"
                value={selectedActivity}
                onChange={(e) => setSelectedActivity(e.target.value)}
                className="neo-input w-full py-1.5 px-2.5 font-mono text-xs"
              />
            )}
          </div>
        </div>

        {/* Action & Data URI Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] flex items-center justify-between">
              <span>Intent Action</span>
              <span className="text-[9px] font-normal text-[var(--neo-text-muted)]">e.g. android.intent.action.VIEW</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="android.intent.action.VIEW"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="neo-input w-full py-1.5 px-2.5 font-mono text-xs"
              />
              <Select
                options={[
                  { value: "", label: "Presets..." },
                  ...COMMON_ACTIONS.map((act) => ({
                    value: act,
                    label: act.split(".").pop() || act,
                  })),
                ]}
                value=""
                onChange={(val) => {
                  if (val) setAction(val);
                }}
                variant="card"
                className="shrink-0"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)] flex items-center gap-1">
              <Globe className="h-3 w-3" /> Data URI (-d)
            </label>
            <input
              type="text"
              placeholder="e.g. https://example.com or content://..."
              value={dataUri}
              onChange={(e) => setDataUri(e.target.value)}
              className="neo-input w-full py-1.5 px-2.5 font-mono text-xs"
            />
          </div>
        </div>

        {/* Category & Flags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Category (-c)</label>
            <input
              type="text"
              placeholder="android.intent.category.DEFAULT"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="neo-input w-full py-1.5 px-2.5 font-mono text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-[var(--neo-text-muted)]">Flags (-f)</label>
            <input
              type="text"
              placeholder="e.g. 0x10000000"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              className="neo-input w-full py-1.5 px-2.5 font-mono text-xs"
            />
          </div>
        </div>

        {/* Extras Builder Section */}
        <div className="space-y-2 pt-2 border-t border-[var(--neo-border)]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black uppercase text-[var(--neo-text-muted)] flex items-center gap-1.5">
              <Code className="h-3.5 w-3.5 text-amber-400" /> Intent Extras ({extras.length})
            </label>
            <Button size="sm" variant="secondary" icon={<Plus className="h-3 w-3" />} onClick={handleAddExtra}>
              Add Extra
            </Button>
          </div>

          {extras.length > 0 ? (
            <div className="space-y-2">
              {extras.map((extra, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 neo-box p-2 bg-black/20">
                  <input
                    type="text"
                    placeholder="Key (e.g. user_id)"
                    value={extra.key}
                    onChange={(e) => handleUpdateExtra(idx, "key", e.target.value)}
                    className="neo-input py-1 px-2 font-mono text-xs flex-1"
                  />
                  <Select
                    options={[
                      { value: "string", label: "String (--es)" },
                      { value: "int", label: "Int (--ei)" },
                      { value: "bool", label: "Bool (--ez)" },
                      { value: "long", label: "Long (--el)" },
                      { value: "float", label: "Float (--ef)" },
                    ]}
                    value={extra.extra_type}
                    onChange={(val) => handleUpdateExtra(idx, "extra_type", val)}
                    variant="card"
                    className="shrink-0"
                  />
                  <input
                    type="text"
                    placeholder="Value (e.g. 12345)"
                    value={extra.value}
                    onChange={(e) => handleUpdateExtra(idx, "value", e.target.value)}
                    className="neo-input py-1 px-2 font-mono text-xs flex-1"
                  />
                  <button
                    onClick={() => handleRemoveExtra(idx)}
                    className="neo-btn p-1.5 bg-rose-600/30 hover:bg-rose-600/60 text-rose-300 rounded border border-rose-500 shrink-0 self-end sm:self-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--neo-text-muted)] italic">No intent extras added. Click "+ Add Extra" to append custom parameters.</p>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-3 flex items-center justify-end gap-3">
          <Button
            size="md"
            variant="primary"
            icon={<Rocket className="h-4 w-4" />}
            loading={running}
            onClick={handleRunIntent}
            className="w-full sm:w-auto font-black px-6"
          >
            RUN INTENT ({intentType.toUpperCase()})
          </Button>
        </div>

        {/* Result Output Display Box */}
        {runResult && (
          <div
            className={`neo-box p-3 border-l-4 font-mono text-xs space-y-1 ${
              runResult.success
                ? "border-l-emerald-500 bg-emerald-950/20 text-emerald-300"
                : "border-l-rose-500 bg-rose-950/20 text-rose-300"
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {runResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{runResult.success ? "Execution Succeeded" : "Execution Failed"}</span>
            </div>
            <p className="break-all whitespace-pre-wrap select-all font-semibold opacity-90">{runResult.msg}</p>
          </div>
        )}
      </div>
    </div>
  );
};
