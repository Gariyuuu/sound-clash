"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/lib/stores/settings-store";

/**
 * Mirrors accessibility preferences from the persisted settings store onto
 * `<html>` data-attributes, which globals.css keys off of (font scale,
 * high contrast, colorblind-safe palette, reduced motion).
 */
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const { colorblindMode, highContrast, fontScale, reducedMotion } = useSettingsStore();

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.colorblind = String(colorblindMode);
    html.dataset.highContrast = String(highContrast);
    html.dataset.reducedMotion = String(reducedMotion);
    html.dataset.fontScale = String(fontScale);
  }, [colorblindMode, highContrast, fontScale, reducedMotion]);

  return <>{children}</>;
}
