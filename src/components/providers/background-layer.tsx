"use client";

import type { CSSProperties } from "react";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { THEME_BACKGROUNDS, NOISE_TEXTURE_DATA_URI } from "@/lib/theme-backgrounds";

/** Renders the user's chosen theme background as a fixed full-viewport layer behind all content. */
export function BackgroundLayer() {
  const background = useSettingsStore((s) => s.background);
  const customUrl = useSettingsStore((s) => s.customBackgroundUrl);

  if (background === "minimal") return null;

  let style: CSSProperties = {};
  if (background === "custom") {
    if (!customUrl) return null;
    style = { backgroundImage: `url(${customUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
  } else {
    style = { background: THEME_BACKGROUNDS[background] };
  }

  return (
    <div aria-hidden className="fixed inset-0 -z-50 pointer-events-none" style={style}>
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_TEXTURE_DATA_URI}")`, backgroundRepeat: "repeat" }}
      />
    </div>
  );
}
