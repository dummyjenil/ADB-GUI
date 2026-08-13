import React from "react";
import { Monitor, Cpu, Touchpad, Layers, Clock } from "lucide-react";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";

export const ScreenMirroringTodo: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* TODO Banner Header */}
      <Card
        headerTitle="Scrcpy Screen Mirroring & Controller"
        headerIcon={<Monitor className="h-5 w-5" />}
        headerVariant="accent"
        headerAction={
          <Badge variant="warning" icon={<Clock className="h-3.5 w-3.5" />}>
            Phase 2 Roadmap
          </Badge>
        }
      >
        <p className="text-xs text-[var(--neo-text-muted)] font-medium max-w-2xl mb-6">
          High-performance, zero-lag Android screen streaming and interactive mouse/touch controller using embedded{" "}
          <code className="bg-black/20 text-[var(--neo-primary)] px-1.5 py-0.5 rounded border border-black font-mono">
            scrcpy-server
          </code>{" "}
          and H.264 video decoding.
        </p>

        {/* Canvas Player Sandbox */}
        <div className="neo-box bg-black/80 p-8 text-center text-white relative max-w-xl mx-auto border-3 border-black">
          <div className="w-16 h-16 neo-btn bg-[var(--neo-primary)] text-[var(--neo-primary-text)] flex items-center justify-center mx-auto mb-4">
            <Monitor className="h-8 w-8 animate-pulse" />
          </div>
          <h3 className="text-sm font-extrabold uppercase">Screen Mirror Canvas Sandbox</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Interactive canvas with touch events, swipe gestures, and 60 FPS video stream will render here.
          </p>

          <div className="mt-6 flex justify-center gap-2">
            <Badge variant="secondary">scrcpy-server: pending</Badge>
            <Badge variant="accent">H.264 / WebSockets</Badge>
          </div>
        </div>
      </Card>

      {/* Scrcpy Roadmap Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card headerTitle="1. Server Injection" headerIcon={<Cpu className="h-4 w-4" />} headerVariant="primary">
          <p className="text-xs text-[var(--neo-text-muted)] font-medium">
            Automatically push compiled <code className="font-mono text-[var(--neo-text)]">scrcpy-server.jar</code> into device <code className="font-mono text-[var(--neo-text)]">/data/local/tmp</code> via ADB.
          </p>
        </Card>

        <Card headerTitle="2. Video Pipeline" headerIcon={<Layers className="h-4 w-4" />} headerVariant="secondary">
          <p className="text-xs text-[var(--neo-text-muted)] font-medium">
            Launch app_process on Android and capture raw video frames over high-speed local TCP socket stream.
          </p>
        </Card>

        <Card headerTitle="3. Gesture Handlers" headerIcon={<Touchpad className="h-4 w-4" />} headerVariant="accent">
          <p className="text-xs text-[var(--neo-text-muted)] font-medium">
            Map desktop mouse clicks, drags, and wheel scrolls directly to Android multi-touch injection events.
          </p>
        </Card>
      </div>
    </div>
  );
};
