import React, { useState, useEffect, useRef } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Camera, Video, Download, StopCircle, Play, Film, Image as ImageIcon, CheckCircle } from "lucide-react";
import { Card, Button, Badge, Select, EmptyState, Alert } from "../ui";

interface ScreenshotResult {
  success: boolean;
  file_path: string;
  data_url?: string;
  timestamp: string;
  error?: string;
}

interface ScreenRecordResult {
  success: boolean;
  file_path: string;
  timestamp: string;
  error?: string;
}

interface ScreenStudioProps {
  activeDevice: string | null;
}

export const ScreenStudio: React.FC<ScreenStudioProps> = ({ activeDevice }) => {
  // Screenshot states
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<ScreenshotResult | null>(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLoading, setRecordingLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [bitrate, setBitrate] = useState("8000000"); // 8Mbps default
  const [timeLimit, setTimeLimit] = useState("180"); // 180s default
  const [recordingResult, setRecordingResult] = useState<ScreenRecordResult | null>(null);

  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTakeScreenshot = async () => {
    if (!activeDevice) return;
    setCapturing(true);
    setStatusMsg(null);

    try {
      const res: ScreenshotResult = await invoke("take_screenshot", { serial: activeDevice });
      if (res.success) {
        setScreenshot(res);
        setStatusMsg({ type: "success", text: "Screenshot captured directly to disk!" });
      } else {
        setStatusMsg({ type: "error", text: res.error || "Failed to capture screenshot" });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: String(err) });
    } finally {
      setCapturing(false);
    }
  };

  const handleStartRecording = async () => {
    if (!activeDevice) return;
    setRecordingLoading(true);
    setStatusMsg(null);
    setRecordingResult(null);

    try {
      await invoke("start_screen_recording", {
        serial: activeDevice,
        bitRate: bitrate ? parseInt(bitrate, 10) : undefined,
        timeLimit: timeLimit ? parseInt(timeLimit, 10) : undefined,
      });

      setIsRecording(true);
      setRecordingTime(0);
      setStatusMsg({ type: "success", text: "Screen recording started..." });

      // Start elapsed timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setStatusMsg({ type: "error", text: String(err) });
    } finally {
      setRecordingLoading(false);
    }
  };

  const handleStopRecording = async () => {
    if (!activeDevice) return;
    setRecordingLoading(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const res: ScreenRecordResult = await invoke("stop_screen_recording", { serial: activeDevice });
      setIsRecording(false);

      if (res.success) {
        setRecordingResult(res);
        setStatusMsg({ type: "success", text: "Recording saved to disk & ready for playback!" });
      } else {
        setStatusMsg({ type: "error", text: res.error || "Recording failed or resulted in empty file" });
      }
    } catch (err: any) {
      setIsRecording(false);
      setStatusMsg({ type: "error", text: String(err) });
    } finally {
      setRecordingLoading(false);
    }
  };

  const handleDownloadScreenshot = async () => {
    if (!screenshot || !screenshot.file_path) return;
    const defaultName = `screenshot_${activeDevice || "device"}_${Date.now()}.png`;

    try {
      const path: string = await invoke("save_media_file", {
        tempFilePath: screenshot.file_path,
        defaultFilename: defaultName,
      });
      setStatusMsg({ type: "success", text: `Screenshot saved to ${path}` });
    } catch (err: any) {
      if (err !== "Save cancelled by user") {
        setStatusMsg({ type: "error", text: String(err) });
      }
    }
  };

  const handleDownloadRecording = async () => {
    if (!recordingResult || !recordingResult.file_path) return;
    const defaultName = `screenrecord_${activeDevice || "device"}_${Date.now()}.mp4`;

    try {
      const path: string = await invoke("save_media_file", {
        tempFilePath: recordingResult.file_path,
        defaultFilename: defaultName,
      });
      setStatusMsg({ type: "success", text: `Recording saved to ${path}` });
    } catch (err: any) {
      if (err !== "Save cancelled by user") {
        setStatusMsg({ type: "error", text: String(err) });
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!activeDevice) {
    return (
      <EmptyState
        title="No Active Device Selected"
        description="Please select a connected Android device from the top navigation bar to access Screen & Recording features."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Status */}
      <Card
        headerTitle="Screen Capture & Recording Studio"
        headerIcon={<Film className="h-5 w-5" />}
        headerVariant="accent"
        headerAction={
          <Badge variant="primary" icon={<Camera className="h-3.5 w-3.5" />}>
            Device: {activeDevice}
          </Badge>
        }
      >
        <p className="text-xs text-[var(--neo-text-muted)] font-medium mb-4">
          Capture high-resolution screenshots and record device screen video in real-time with zero-base64 disk streaming.
        </p>

        {statusMsg && (
          <div className="mb-4">
            <Alert
              variant={statusMsg.type === "success" ? "success" : "danger"}
              onClose={() => setStatusMsg(null)}
            >
              {statusMsg.text}
            </Alert>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SCREENSHOT SECTION */}
          <div className="neo-box bg-[var(--neo-card-bg)] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-black/20 pb-2">
                <span className="flex items-center gap-2 font-black uppercase text-xs tracking-wider">
                  <ImageIcon className="h-4 w-4 text-[var(--neo-primary)]" /> Screenshot Tool
                </span>
                {screenshot && (
                  <Badge variant="secondary" icon={<CheckCircle className="h-3 w-3" />}>
                    Captured
                  </Badge>
                )}
              </div>

              <div className="neo-box bg-black/40 min-h-[240px] flex items-center justify-center p-3 mb-4 relative overflow-hidden group">
                {screenshot && (screenshot.data_url || screenshot.file_path) ? (
                  <div className="relative w-full flex flex-col items-center">
                    <img
                      src={screenshot.data_url || convertFileSrc(screenshot.file_path)}
                      alt="Device Screenshot"
                      className="max-h-[320px] rounded border border-white/10 shadow-lg object-contain"
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 text-[var(--neo-text-muted)]">
                    <Camera className="h-10 w-10 mx-auto mb-2 opacity-40 animate-bounce" />
                    <p className="text-xs font-bold">No screenshot captured yet</p>
                    <p className="text-[10px] opacity-75">Click "Capture Screenshot" below</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleTakeScreenshot}
                loading={capturing}
                disabled={isRecording}
                variant="primary"
                size="sm"
                icon={<Camera className="h-4 w-4" />}
                className="flex-1"
              >
                {capturing ? "Capturing..." : "Capture Screenshot"}
              </Button>

              {screenshot && screenshot.file_path && (
                <Button
                  onClick={handleDownloadScreenshot}
                  variant="secondary"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                >
                  Download PNG
                </Button>
              )}
            </div>
          </div>

          {/* SCREEN RECORDING SECTION */}
          <div className="neo-box bg-[var(--neo-card-bg)] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-black/20 pb-2">
                <span className="flex items-center gap-2 font-black uppercase text-xs tracking-wider">
                  <Video className="h-4 w-4 text-emerald-400" /> Screen Recorder
                </span>
                {isRecording ? (
                  <Badge variant="warning" icon={<span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />}>
                    REC {formatTimer(recordingTime)}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Ready</Badge>
                )}
              </div>

              {/* Recorder Settings */}
              {!isRecording && !recordingResult && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[var(--neo-text-muted)] mb-1">
                      Bitrate Quality
                    </label>
                    <Select
                      options={[
                        { value: "4000000", label: "4 Mbps (Standard)" },
                        { value: "8000000", label: "8 Mbps (High)" },
                        { value: "16000000", label: "16 Mbps (Ultra)" },
                      ]}
                      value={bitrate}
                      onChange={setBitrate}
                      variant="secondary"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[var(--neo-text-muted)] mb-1">
                      Time Limit
                    </label>
                    <Select
                      options={[
                        { value: "30", label: "30 Seconds" },
                        { value: "60", label: "1 Minute" },
                        { value: "180", label: "3 Minutes" },
                      ]}
                      value={timeLimit}
                      onChange={setTimeLimit}
                      variant="secondary"
                    />
                  </div>
                </div>
              )}

              {/* Video Player / Recording Box */}
              <div className="neo-box bg-black/40 min-h-[200px] flex items-center justify-center p-3 mb-4 relative overflow-hidden">
                {isRecording ? (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto animate-pulse">
                      <Video className="h-7 w-7 text-red-500" />
                    </div>
                    <div className="font-mono text-xl font-black text-red-400">{formatTimer(recordingTime)}</div>
                    <p className="text-[11px] text-slate-400">Recording screen on device...</p>
                  </div>
                ) : recordingResult && recordingResult.file_path ? (
                  <div className="w-full flex flex-col items-center">
                    <video
                      src={convertFileSrc(recordingResult.file_path)}
                      controls
                      autoPlay
                      className="max-h-[300px] w-full rounded border border-white/10 shadow-lg object-contain bg-black"
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 text-[var(--neo-text-muted)]">
                    <Video className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold">No screen recording yet</p>
                    <p className="text-[10px] opacity-75">Click "Start Recording" below</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!isRecording ? (
                <Button
                  onClick={handleStartRecording}
                  loading={recordingLoading}
                  disabled={capturing}
                  variant="primary"
                  size="sm"
                  icon={<Play className="h-4 w-4" />}
                  className="flex-1 bg-emerald-500 text-black hover:bg-emerald-400"
                >
                  Start Recording
                </Button>
              ) : (
                <Button
                  onClick={handleStopRecording}
                  loading={recordingLoading}
                  variant="primary"
                  size="sm"
                  icon={<StopCircle className="h-4 w-4" />}
                  className="flex-1 bg-red-600 text-white hover:bg-red-500 animate-pulse"
                >
                  {recordingLoading ? "Finalizing Video..." : "Stop & Save Recording"}
                </Button>
              )}

              {recordingResult && recordingResult.file_path && (
                <Button
                  onClick={handleDownloadRecording}
                  variant="secondary"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                >
                  Download MP4
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
