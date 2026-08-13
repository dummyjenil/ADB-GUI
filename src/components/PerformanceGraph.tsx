import React, { useState } from "react";
import { Activity, Cpu, HardDrive, Thermometer } from "lucide-react";

export interface DataPoint {
  time: string;
  cpu: number;
  ram: number;
  temp: number;
}

interface PerformanceGraphProps {
  data: DataPoint[];
}

export const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ data }) => {
  const [visibleMetrics, setVisibleMetrics] = useState({
    cpu: true,
    ram: true,
    temp: true,
  });

  const toggleMetric = (metric: "cpu" | "ram" | "temp") => {
    setVisibleMetrics((prev) => ({ ...prev, [metric]: !prev[metric] }));
  };

  const svgWidth = 600;
  const svgHeight = 180;
  const padding = 25;

  const pointsCount = Math.max(data.length, 1);
  const stepX = (svgWidth - padding * 2) / Math.max(pointsCount - 1, 1);

  // Map value (0-100) to Y coordinate
  const getY = (val: number, maxVal = 100) => {
    const clamped = Math.min(Math.max(val, 0), maxVal);
    return svgHeight - padding - (clamped / maxVal) * (svgHeight - padding * 2);
  };

  // Helper to generate SVG path string
  const createPath = (key: "cpu" | "ram" | "temp", maxVal = 100) => {
    if (data.length === 0) return "";
    return data
      .map((d, idx) => {
        const x = padding + idx * stepX;
        const y = getY(d[key], maxVal);
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  const cpuPath = createPath("cpu", 100);
  const ramPath = createPath("ram", 100);
  const tempPath = createPath("temp", 60); // Max 60°C scaling for temperature

  return (
    <div className="neo-box p-4 bg-[var(--neo-card-bg)] space-y-3">
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[var(--neo-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--neo-primary)]" />
          <span className="text-xs font-black uppercase tracking-wider text-[var(--neo-text)]">
            Real-Time Performance Graphs
          </span>
        </div>

        {/* Legend Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => toggleMetric("cpu")}
            className={`neo-btn px-2.5 py-1 text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
              visibleMetrics.cpu
                ? "bg-[#ef4444] text-white shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                : "bg-black/20 text-gray-400 border-transparent shadow-none"
            }`}
          >
            <Cpu className="h-3 w-3" />
            <span>CPU</span>
            <span className="font-mono text-[10px] ml-1">
              {data.length > 0 ? `${Math.round(data[data.length - 1].cpu)}%` : "0%"}
            </span>
          </button>

          <button
            onClick={() => toggleMetric("ram")}
            className={`neo-btn px-2.5 py-1 text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
              visibleMetrics.ram
                ? "bg-[#3b82f6] text-white shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                : "bg-black/20 text-gray-400 border-transparent shadow-none"
            }`}
          >
            <HardDrive className="h-3 w-3" />
            <span>RAM</span>
            <span className="font-mono text-[10px] ml-1">
              {data.length > 0 ? `${Math.round(data[data.length - 1].ram)}%` : "0%"}
            </span>
          </button>

          <button
            onClick={() => toggleMetric("temp")}
            className={`neo-btn px-2.5 py-1 text-[11px] font-extrabold flex items-center gap-1.5 transition-all ${
              visibleMetrics.temp
                ? "bg-[#f59e0b] text-black shadow-[2px_2px_0px_0px_var(--neo-shadow)]"
                : "bg-black/20 text-gray-400 border-transparent shadow-none"
            }`}
          >
            <Thermometer className="h-3 w-3" />
            <span>Temp</span>
            <span className="font-mono text-[10px] ml-1">
              {data.length > 0 ? `${data[data.length - 1].temp.toFixed(1)}°C` : "0°C"}
            </span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative w-full overflow-hidden rounded-lg bg-black/30 border-2 border-[var(--neo-border)] p-1">
        {data.length < 2 ? (
          <div className="h-36 flex items-center justify-center text-xs font-mono text-[var(--neo-text-muted)] animate-pulse">
            Collecting device telemetry metrics...
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-40 overflow-visible"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((level) => {
              const y = getY(level, 100);
              return (
                <g key={level}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={svgWidth - padding}
                    y2={y}
                    stroke="#ffffff15"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={padding - 5}
                    y={y + 3}
                    fill="#94a3b8"
                    fontSize="9"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {level}%
                  </text>
                </g>
              );
            })}

            {/* Metric Paths */}
            {visibleMetrics.ram && (
              <path
                d={ramPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {visibleMetrics.temp && (
              <path
                d={tempPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {visibleMetrics.cpu && (
              <path
                d={cpuPath}
                fill="none"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Live Data Dots for the latest point */}
            {data.length > 0 && (
              <g>
                {visibleMetrics.cpu && (
                  <circle
                    cx={padding + (data.length - 1) * stepX}
                    cy={getY(data[data.length - 1].cpu, 100)}
                    r="4"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
                {visibleMetrics.ram && (
                  <circle
                    cx={padding + (data.length - 1) * stepX}
                    cy={getY(data[data.length - 1].ram, 100)}
                    r="4"
                    fill="#3b82f6"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
                {visibleMetrics.temp && (
                  <circle
                    cx={padding + (data.length - 1) * stepX}
                    cy={getY(data[data.length - 1].temp, 60)}
                    r="4"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
              </g>
            )}
          </svg>
        )}
      </div>
    </div>
  );
};
