import React, { createContext, useContext, useState, useEffect } from "react";
import themeData from "../themes/themes.json";

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  colors: {
    bg: string;
    cardBg: string;
    cardHeaderBg: string;
    cardHeaderText: string;
    primary: string;
    primaryText: string;
    secondary: string;
    secondaryText: string;
    accent: string;
    accentText: string;
    border: string;
    text: string;
    textMuted: string;
    shadow: string;
  };
  animation: {
    duration: string;
    timing: string;
    pressOffset: string;
    hoverLift: string;
  };
}

interface ThemeContextType {
  currentTheme: ThemeConfig;
  setThemeId: (id: string) => void;
  availableThemes: ThemeConfig[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const availableThemes = themeData.themes as ThemeConfig[];

  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(() => {
    const saved = localStorage.getItem("adb_theme_id");
    return availableThemes.find((t) => t.id === saved) || availableThemes[0];
  });

  const setThemeId = (id: string) => {
    const found = availableThemes.find((t) => t.id === id);
    if (found) {
      setCurrentTheme(found);
      localStorage.setItem("adb_theme_id", id);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    const { colors, animation } = currentTheme;

    root.style.setProperty("--neo-bg", colors.bg);
    root.style.setProperty("--neo-card-bg", colors.cardBg);
    root.style.setProperty("--neo-card-header-bg", colors.cardHeaderBg);
    root.style.setProperty("--neo-card-header-text", colors.cardHeaderText);
    root.style.setProperty("--neo-primary", colors.primary);
    root.style.setProperty("--neo-primary-text", colors.primaryText);
    root.style.setProperty("--neo-secondary", colors.secondary);
    root.style.setProperty("--neo-secondary-text", colors.secondaryText);
    root.style.setProperty("--neo-accent", colors.accent);
    root.style.setProperty("--neo-accent-text", colors.accentText);
    root.style.setProperty("--neo-border", colors.border);
    root.style.setProperty("--neo-text", colors.text);
    root.style.setProperty("--neo-text-muted", colors.textMuted);
    root.style.setProperty("--neo-shadow", colors.shadow);

    root.style.setProperty("--neo-anim-duration", animation.duration);
    root.style.setProperty("--neo-anim-timing", animation.timing);
    root.style.setProperty("--neo-press-offset", animation.pressOffset);
    root.style.setProperty("--neo-hover-lift", animation.hoverLift);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setThemeId, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
