"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeBackground =
  | "cyberpunk"
  | "galaxy"
  | "neon"
  | "lofi_cafe"
  | "anime"
  | "retro_arcade"
  | "nature"
  | "ocean"
  | "sunset"
  | "rain"
  | "music_studio"
  | "vinyl"
  | "dark_room"
  | "aurora"
  | "desert"
  | "midnight_city"
  | "sakura"
  | "volcano"
  | "frost"
  | "minimal"
  | "custom";

interface SettingsState {
  volumeMusic: number;
  volumeUi: number;
  volumeEffects: number;
  colorMode: "light" | "dark" | "system";
  background: ThemeBackground;
  customBackgroundUrl: string | null;
  colorblindMode: boolean;
  highContrast: boolean;
  fontScale: number;
  reducedMotion: boolean;
  setVolume: (channel: "music" | "ui" | "effects", value: number) => void;
  setColorMode: (mode: "light" | "dark" | "system") => void;
  setBackground: (bg: ThemeBackground, customUrl?: string) => void;
  setColorblindMode: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setFontScale: (v: number) => void;
  setReducedMotion: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      volumeMusic: 80,
      volumeUi: 60,
      volumeEffects: 80,
      colorMode: "system",
      background: "neon",
      customBackgroundUrl: null,
      colorblindMode: false,
      highContrast: false,
      fontScale: 1,
      reducedMotion: false,
      setVolume: (channel, value) =>
        set(() => ({
          [channel === "music" ? "volumeMusic" : channel === "ui" ? "volumeUi" : "volumeEffects"]: value,
        })),
      setColorMode: (colorMode) => set({ colorMode }),
      setBackground: (background, customUrl) =>
        set({ background, customBackgroundUrl: customUrl ?? null }),
      setColorblindMode: (colorblindMode) => set({ colorblindMode }),
      setHighContrast: (highContrast) => set({ highContrast }),
      setFontScale: (fontScale) => set({ fontScale }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    { name: "sound-clash-settings" }
  )
);
