import type { ThemeBackground } from "@/lib/stores/settings-store";

/**
 * Pure-CSS approximations of each named background preset — no image assets
 * are bundled with this repo, so these are gradient/color moods rather than
 * illustrated scenes. "custom" is handled separately (a user-supplied data
 * URL, since no Supabase Storage bucket is configured — see DATABASE.md).
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
  minimal: "",
};
