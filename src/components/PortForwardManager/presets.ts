import { PresetItem } from "./types";

export const PRESETS: PresetItem[] = [
  {
    name: "React Native Metro",
    icon: "⚛️",
    mode: "reverse",
    hostType: "tcp",
    hostValue: "8081",
    deviceType: "tcp",
    deviceValue: "8081",
    description: "App connects back to Metro bundler on PC",
  },
  {
    name: "Flutter DevTools",
    icon: "⚡",
    mode: "forward",
    hostType: "tcp",
    hostValue: "9100",
    deviceType: "tcp",
    deviceValue: "9100",
    description: "Inspect Flutter app from PC DevTools",
  },
  {
    name: "Local Web Server",
    icon: "🌐",
    mode: "reverse",
    hostType: "tcp",
    hostValue: "3000",
    deviceType: "tcp",
    deviceValue: "3000",
    description: "Access localhost:3000 web server from Phone",
  },
  {
    name: "Chrome DevTools",
    icon: "🔍",
    mode: "forward",
    hostType: "tcp",
    hostValue: "9222",
    deviceType: "localabstract",
    deviceValue: "chrome_devtools_remote",
    description: "Inspect WebViews via Chrome Remote Debugging",
  },
];
