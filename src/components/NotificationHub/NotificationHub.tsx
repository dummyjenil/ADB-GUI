import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bell, RefreshCw, Search, Copy, Check, Filter, Trash2, ShieldAlert } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";

interface NotificationItem {
  id: string;
  package_name: string;
  app_name: string;
  title: string;
  text: string;
  sub_text: string;
  post_time: string;
  channel_id: string;
  is_clearable: boolean;
}

interface NotificationHubProps {
  activeDevice: string | null;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({ activeDevice }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNotifications = useCallback(
    async (isBackground = false) => {
      if (!activeDevice) return;
      if (!isBackground) setLoading(true);
      setErrorMsg(null);

      try {
        const res: NotificationItem[] = await invoke("get_device_notifications", { serial: activeDevice });
        setNotifications(res);
      } catch (err: any) {
        if (!isBackground) setErrorMsg(String(err));
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [activeDevice]
  );

  useEffect(() => {
    fetchNotifications(false);
    if (!autoRefresh || !activeDevice) return;

    const interval = setInterval(() => fetchNotifications(true), 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications, autoRefresh, activeDevice]);

  const handleCopyNotification = (item: NotificationItem) => {
    const text = `[${item.app_name}] ${item.title}: ${item.text}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id + item.package_name);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearSingle = (id: string, pkg: string) => {
    setNotifications((prev) => prev.filter((n) => !(n.id === id && n.package_name === pkg)));
  };

  const filteredNotifications = notifications.filter((n) => {
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.text.toLowerCase().includes(q) ||
      n.app_name.toLowerCase().includes(q) ||
      n.package_name.toLowerCase().includes(q)
    );
  });

  if (!activeDevice) {
    return (
      <Card headerTitle="Mobile Notification Mirroring Hub" headerIcon={<Bell className="h-5 w-5" />} headerVariant="accent">
        <div className="text-center py-12 text-[var(--neo-text-muted)] font-bold">
          No device selected. Please select a connected Android device from top bar.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Card Header */}
      <Card
        headerTitle="Mobile Notification Mirroring Hub"
        headerIcon={<Bell className="h-5 w-5" />}
        headerVariant="accent"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setAutoRefresh((prev) => !prev)}
              variant={autoRefresh ? "secondary" : "ghost"}
              size="sm"
            >
              <span className="flex items-center gap-1.5 font-mono text-xs">
                <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                {autoRefresh ? "Auto Poll 5s" : "Poll Paused"}
              </span>
            </Button>
            <Button
              onClick={() => fetchNotifications(false)}
              loading={loading}
              variant="primary"
              size="sm"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </div>
        }
      >
        <p className="text-xs text-[var(--neo-text-muted)] font-medium mb-4">
          Route and mirror active push notifications directly from your Android phone in real-time.
        </p>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex-1">
            <Input
              placeholder="Search notifications by app, title, or body..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" icon={<Filter className="h-3.5 w-3.5" />}>
              Total: {notifications.length}
            </Badge>
          </div>
        </div>

        {errorMsg && (
          <div className="neo-box p-3 mb-4 bg-red-500/20 text-red-300 border-red-500 flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {errorMsg}
            </span>
            <button onClick={() => setErrorMsg(null)} className="text-xs hover:underline opacity-80">
              Dismiss
            </button>
          </div>
        )}

        {/* Notifications Feed */}
        {filteredNotifications.length === 0 ? (
          <div className="neo-box bg-[var(--neo-card-bg)] p-12 text-center">
            <Bell className="h-10 w-10 mx-auto mb-3 text-[var(--neo-text-muted)] opacity-40" />
            <h3 className="text-sm font-extrabold uppercase mb-1">No Active Notifications</h3>
            <p className="text-xs text-[var(--neo-text-muted)] max-w-sm mx-auto">
              There are currently no active push notifications on device ({activeDevice}).
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((item) => (
              <div
                key={item.id + item.package_name + item.title}
                className="neo-box bg-[var(--neo-card-bg)] p-4 flex flex-col sm:flex-row items-start justify-between gap-4 border-2 border-black hover:translate-x-1 transition-transform"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 neo-btn bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center justify-center shrink-0 font-black uppercase text-xs">
                    {item.app_name.substring(0, 2)}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-xs text-[var(--neo-text)] uppercase">{item.app_name}</span>
                      <span className="text-[10px] font-mono text-[var(--neo-text-muted)] opacity-80">({item.package_name})</span>
                      {item.channel_id && (
                        <Badge variant="secondary" className="text-[9px]">
                          {item.channel_id}
                        </Badge>
                      )}
                    </div>

                    {item.title && <h4 className="text-xs font-black text-amber-300 tracking-tight break-words">{item.title}</h4>}

                    {item.text && (
                      <p className="text-xs text-[var(--neo-text)] font-medium leading-relaxed break-words whitespace-pre-wrap">
                        {item.text}
                      </p>
                    )}

                    {item.sub_text && (
                      <p className="text-[11px] text-[var(--neo-text-muted)] italic break-words">{item.sub_text}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-start shrink-0">
                  <Button
                    onClick={() => handleCopyNotification(item)}
                    variant="ghost"
                    size="sm"
                    title="Copy notification text"
                    icon={
                      copiedId === item.id + item.package_name ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {copiedId === item.id + item.package_name ? "Copied" : "Copy"}
                  </Button>

                  <Button
                    onClick={() => handleClearSingle(item.id, item.package_name)}
                    variant="ghost"
                    size="sm"
                    title="Dismiss notification from GUI"
                    icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

