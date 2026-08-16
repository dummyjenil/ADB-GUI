import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Bell, RefreshCw, Check, Copy, Trash2 } from "lucide-react";
import { Card, Button, Badge, SearchInput, EmptyState, Alert } from "../ui";

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

  const [dismissingIds, setDismissingIds] = useState<Record<string, "left" | "right">>({});
  const [slideOffsets, setSlideOffsets] = useState<Record<string, number>>({});
  const dragStartPos = useRef<Record<string, number>>({});

  const handleDismissNotification = async (item: NotificationItem, direction: "left" | "right" = "right") => {
    if (!item.is_clearable) {
      setErrorMsg(`Cannot dismiss static/persistent notification (${item.app_name}: ${item.title || item.package_name}). This notification is pinned by the system/app.`);
      return;
    }

    const key = item.id + item.package_name + item.title;
    setDismissingIds((prev) => ({ ...prev, [key]: direction }));

    // Send cancel command to device
    if (activeDevice) {
      invoke("dismiss_notification", {
        serial: activeDevice,
        packageName: item.package_name,
        id: item.id,
      }).catch(console.error);
    }

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => !(n.id === item.id && n.package_name === item.package_name && n.title === item.title)));
      setDismissingIds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 300);
  };

  const handleTouchStart = (key: string, clientX: number) => {
    dragStartPos.current[key] = clientX;
  };

  const handleTouchMove = (key: string, clientX: number) => {
    if (dragStartPos.current[key] === undefined) return;
    const delta = clientX - dragStartPos.current[key];
    setSlideOffsets((prev) => ({ ...prev, [key]: delta }));
  };

  const handleTouchEnd = (item: NotificationItem) => {
    const key = item.id + item.package_name + item.title;
    const offset = slideOffsets[key] || 0;
    delete dragStartPos.current[key];
    setSlideOffsets((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    if (Math.abs(offset) > 100) {
      handleDismissNotification(item, offset > 0 ? "right" : "left");
    }
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
      <EmptyState
        title="No Active Device Selected"
        description="Please select a connected Android device from the top bar to view notifications."
      />
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
          Route and mirror active push notifications directly from your Android phone in real-time. Slide or click dismiss to remove clearable alerts.
        </p>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex-1">
            <SearchInput
              placeholder="Search notifications by app, title, or body..."
              value={searchQuery}
              onChange={setSearchQuery}
              count={filteredNotifications.length}
            />
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4">
            <Alert variant="danger" onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
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
            {filteredNotifications.map((item) => {
              const itemKey = item.id + item.package_name + item.title;
              const isDismissing = dismissingIds[itemKey];
              const slideOffset = slideOffsets[itemKey] || 0;

              return (
                <div
                  key={itemKey}
                  style={{
                    transform: isDismissing
                      ? isDismissing === "right"
                        ? "translateX(120%)"
                        : "translateX(-120%)"
                      : slideOffset
                      ? `translateX(${slideOffset}px)`
                      : undefined,
                    opacity: isDismissing ? 0 : 1,
                    transition: isDismissing ? "transform 0.3s ease, opacity 0.3s ease" : undefined,
                  }}
                  onMouseDown={(e) => handleTouchStart(itemKey, e.clientX)}
                  onMouseMove={(e) => {
                    if (e.buttons === 1) handleTouchMove(itemKey, e.clientX);
                  }}
                  onMouseUp={() => handleTouchEnd(item)}
                  onTouchStart={(e) => handleTouchStart(itemKey, e.touches[0].clientX)}
                  onTouchMove={(e) => handleTouchMove(itemKey, e.touches[0].clientX)}
                  onTouchEnd={() => handleTouchEnd(item)}
                  className={`neo-box bg-[var(--neo-card-bg)] p-4 flex flex-col sm:flex-row items-start justify-between gap-4 border-2 border-black cursor-grab active:cursor-grabbing select-none transition-shadow ${
                    !item.is_clearable ? "border-amber-500/50 bg-amber-500/5" : "hover:shadow-[4px_4px_0px_0px_var(--neo-shadow)]"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0 pointer-events-none">
                    <div className="h-10 w-10 neo-btn bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center justify-center shrink-0 font-black uppercase text-xs">
                      {item.app_name.substring(0, 2)}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs text-[var(--neo-text)] uppercase">{item.app_name}</span>
                        <span className="text-[10px] font-mono text-[var(--neo-text-muted)] opacity-80">({item.package_name})</span>
                        {item.is_clearable ? (
                          <Badge variant="primary" className="text-[9px]">
                            Dismissible
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-[9px]">
                            Static / Ongoing
                          </Badge>
                        )}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyNotification(item);
                      }}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissNotification(item, "right");
                      }}
                      variant={item.is_clearable ? "ghost" : "secondary"}
                      size="sm"
                      title={item.is_clearable ? "Dismiss notification" : "Static system notification"}
                      icon={<Trash2 className={`h-3.5 w-3.5 ${item.is_clearable ? "text-red-400" : "text-amber-400"}`} />}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

