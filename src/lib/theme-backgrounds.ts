import type { ThemeBackground } from "@/lib/stores/settings-store";

/**
 * Pure-CSS approximations of each named background preset — no image assets
 * are bundled with this repo, so these are gradient/color moods rather than
 * illustrated scenes. "custom" is handled separately (a user-supplied data
 * URL, since no Supabase Storage bucket is configured — see DATABASE.md).
 * `NOISE_TEXTURE_DATA_URI` (below) is layered on top by `BackgroundLayer` to
 * cut the "flat gradient" look without needing a real bitmap.
 */
export const THEME_BACKGROUNDS: Record<Exclude<ThemeBackground, "custom">, string> = {
  cyberpunk: "radial-gradient(circle at 20% 20%, #ff00c8 0%, transparent 45%), radial-gradient(circle at 80% 80%, #00fff0 0%, transparent 45%), #0a0018",
  galaxy: "radial-gradient(circle at 50% 0%, #4c1d95 0%, transparent 50%), radial-gradient(circle at 20% 80%, #1e3a8a 0%, transparent 45%), #05030f",
  neon: "radial-gradient(circle at 15% 0%, rgba(30,215,96,0.25) 0%, transparent 45%), radial-gradient(circle at 85% 20%, rgba(124,58,237,0.28) 0%, transparent 45%), #0a0e17",
  lofi_cafe: "linear-gradient(160deg, #3a2a1e 0%, #6b4a34 50%, #a9744f 100%)",
  anime: "linear-gradient(160deg, #ff9a9e 0%, #fecfef 50%, #a18cd1 100%)",
  retro_arcade: "repeating-linear-gradient(45deg, #1a0033 0 20px, #2a0050 20px 40px), radial-gradient(circle at 50% 0%, #ff2e88 0%, transparent 50%)",
  nature: "linear-gradient(160deg, #134e2c 0%, #2d6a4f 50%, #74a57f 100%)",
  ocean: "linear-gradient(180deg, #003049 0%, #00668c 50%, #219ebc 100%)",
  sunset: "linear-gradient(160deg, #3a0ca3 0%, #d90429 55%, #ff9e00 100%)",
  rain: "linear-gradient(180deg, #1e293b 0%, #334155 60%, #475569 100%)",
  music_studio: "radial-gradient(circle at 30% 10%, rgba(220,38,38,0.25) 0%, transparent 45%), #14100c",
  vinyl: "repeating-radial-gradient(circle at 50% 50%, #1c1c1c 0, #1c1c1c 2px, #0d0d0d 3px, #0d0d0d 6px)",
  dark_room: "radial-gradient(circle at 50% 30%, #1a1a1a 0%, #050505 70%)",
  aurora: "radial-gradient(circle at 30% 0%, #00ffa3 0%, transparent 45%), radial-gradient(circle at 70% 30%, #7b2ff7 0%, transparent 50%), radial-gradient(circle at 50% 85%, #00c9ff 0%, transparent 45%), #030712",
  desert: "linear-gradient(160deg, #f2c14e 0%, #e08e45 45%, #a35d3a 75%, #5c2f1f 100%)",
  midnight_city: "radial-gradient(circle at 10% 90%, rgba(255,214,10,0.15) 0%, transparent 20%), radial-gradient(circle at 80% 20%, rgba(56,189,248,0.25) 0%, transparent 45%), linear-gradient(180deg, #0b1220 0%, #131c31 60%, #1c2740 100%)",
  sakura: "linear-gradient(160deg, #ffd1dc 0%, #ffb7c5 40%, #e698b3 70%, #6b3a52 100%)",
  volcano: "radial-gradient(circle at 50% 100%, #ff4d00 0%, transparent 55%), radial-gradient(circle at 30% 20%, #7a0c0c 0%, transparent 50%), #0d0603",
  frost: "linear-gradient(160deg, #e0f7ff 0%, #a8dadc 40%, #457b9d 75%, #1d3557 100%)",
  minimal: "",
};

/** 5-swatch dominant-color summary of each preset, shown as palette dots in ThemeWheel/settings. */
export const THEME_PALETTES: Record<Exclude<ThemeBackground, "custom">, string[]> = {
  cyberpunk: ["#ff00c8", "#00fff0", "#7b2ff7", "#0a0018", "#1a0033"],
  galaxy: ["#4c1d95", "#1e3a8a", "#7c3aed", "#05030f", "#0f172a"],
  neon: ["#1ed760", "#7c3aed", "#38bdf8", "#0a0e17", "#111827"],
  lofi_cafe: ["#3a2a1e", "#6b4a34", "#a9744f", "#c9986b", "#efd9b4"],
  anime: ["#ff9a9e", "#fecfef", "#a18cd1", "#fbc2eb", "#8fd3f4"],
  retro_arcade: ["#ff2e88", "#2a0050", "#1a0033", "#00fff0", "#ffe600"],
  nature: ["#134e2c", "#2d6a4f", "#74a57f", "#a7c957", "#dde5b6"],
  ocean: ["#003049", "#00668c", "#219ebc", "#8ecae6", "#caf0f8"],
  sunset: ["#3a0ca3", "#d90429", "#ff9e00", "#ff477e", "#7209b7"],
  rain: ["#1e293b", "#334155", "#475569", "#64748b", "#94a3b8"],
  music_studio: ["#dc2626", "#7f1d1d", "#14100c", "#f59e0b", "#292524"],
  vinyl: ["#1c1c1c", "#0d0d0d", "#3a3a3a", "#050505", "#2a2a2a"],
  dark_room: ["#1a1a1a", "#050505", "#2e2e2e", "#000000", "#3d3d3d"],
  aurora: ["#00ffa3", "#7b2ff7", "#00c9ff", "#030712", "#0d1b2a"],
  desert: ["#f2c14e", "#e08e45", "#a35d3a", "#5c2f1f", "#2b140c"],
  midnight_city: ["#38bdf8", "#ffd60a", "#131c31", "#1c2740", "#0b1220"],
  sakura: ["#ffd1dc", "#ffb7c5", "#e698b3", "#6b3a52", "#3a1f2c"],
  volcano: ["#ff4d00", "#c1121f", "#7a0c0c", "#3a0505", "#0d0603"],
  frost: ["#e0f7ff", "#a8dadc", "#457b9d", "#1d3557", "#0b1a2b"],
  minimal: ["#fafafa", "#e5e5e5", "#a3a3a3", "#525252", "#171717"],
};

/**
 * A tiny tiled fractal-noise texture, generated as an inline SVG filter
 * rather than a bundled bitmap (no image assets/storage in this repo — see
 * the file-level comment). Layered at low opacity with `mix-blend-mode:
 * overlay` in BackgroundLayer, it gives the gradients a grainy, printed
 * texture instead of looking like a flat CSS blob.
 */
export const NOISE_TEXTURE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>
    <filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter>
    <rect width='100%' height='100%' filter='url(#n)'/>
  </svg>`
)}`;
