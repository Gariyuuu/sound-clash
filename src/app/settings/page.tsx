"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSettingsStore, type ThemeBackground } from "@/lib/stores/settings-store";
import { useIdentity } from "@/lib/hooks/use-identity";
import { api } from "@/lib/api-client";
import { LogoFull } from "@/components/branding/logo";
import { NavAuthLinks } from "@/components/home/nav-auth-links";
import { ThemeWheel } from "@/components/settings/theme-wheel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload } from "lucide-react";

const BACKGROUND_LABELS: Record<ThemeBackground, string> = {
  cyberpunk: "Cyberpunk",
  galaxy: "Galaxy",
  neon: "Neon",
  lofi_cafe: "Lo-fi Café",
  anime: "Anime",
  retro_arcade: "Retro Arcade",
  nature: "Nature",
  ocean: "Ocean",
  sunset: "Sunset",
  rain: "Rain",
  music_studio: "Music Studio",
  vinyl: "Vinyl",
  dark_room: "Dark Room",
  aurora: "Aurora",
  desert: "Desert",
  midnight_city: "Midnight City",
  sakura: "Sakura",
  volcano: "Volcano",
  frost: "Frost",
  minimal: "Minimal",
  custom: "Custom",
};

export default function SettingsPage() {
  const identity = useIdentity();
  const { theme, setTheme } = useTheme();
  const store = useSettingsStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function syncToProfile(partial: Parameters<typeof api.updateProfileSettings>[0]) {
    if (identity.isAuthed) api.updateProfileSettings(partial).catch(() => {});
  }

  function handleVolumeChange(channel: "music" | "ui" | "effects", value: number | readonly number[]) {
    const v = Array.isArray(value) ? value[0] : (value as number);
    store.setVolume(channel, v);
  }

  function handleVolumeCommit(channel: "music" | "ui" | "effects", value: number | readonly number[]) {
    const v = Array.isArray(value) ? value[0] : (value as number);
    syncToProfile({ settings: { volume: { [channel]: v } } });
  }

  async function handleCustomUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      store.setBackground("custom", dataUrl);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto p-6 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" render={<Link href="/" />}>
          <ArrowLeft className="size-4" /> Home
        </Button>
        <LogoFull size={24} />
        <NavAuthLinks />
      </div>

      <h1 className="text-3xl font-extrabold text-center">Settings</h1>

      <section className="glass rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Appearance</h2>
        <div className="flex items-center justify-between">
          <Label>Theme</Label>
          {mounted ? (
            <Select value={theme} onValueChange={(v) => v && setTheme(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="w-40 h-8 rounded-lg bg-white/5 animate-pulse" />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label>Background</Label>
            <label className="inline-flex items-center gap-1.5 text-sm text-primary cursor-pointer">
              <Upload className="size-3.5" /> Upload custom
              <input type="file" accept="image/*" className="hidden" onChange={handleCustomUpload} />
            </label>
          </div>
          <ThemeWheel
            options={(Object.keys(BACKGROUND_LABELS) as ThemeBackground[]).filter((b) => b !== "custom")}
            labels={BACKGROUND_LABELS}
            value={store.background}
            onChange={(bg) => store.setBackground(bg)}
          />
        </div>
      </section>

      <section className="glass rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Audio</h2>
        {(["music", "ui", "effects"] as const).map((channel) => (
          <div key={channel} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="capitalize">{channel} volume</Label>
              <span className="text-sm text-muted-foreground">
                {channel === "music" ? store.volumeMusic : channel === "ui" ? store.volumeUi : store.volumeEffects}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[channel === "music" ? store.volumeMusic : channel === "ui" ? store.volumeUi : store.volumeEffects]}
              onValueChange={(v) => handleVolumeChange(channel, v)}
              onValueCommitted={(v) => handleVolumeCommit(channel, v)}
            />
          </div>
        ))}
      </section>

      <section className="glass rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Accessibility</h2>
        <div className="flex items-center justify-between">
          <div>
            <Label>Colorblind-safe palette</Label>
            <p className="text-xs text-muted-foreground">Swaps green/violet accents for blue/orange.</p>
          </div>
          <Switch
            checked={store.colorblindMode}
            onCheckedChange={(v) => {
              store.setColorblindMode(v);
              syncToProfile({ settings: { accessibility: { colorblind: v } } });
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>High contrast</Label>
          <Switch
            checked={store.highContrast}
            onCheckedChange={(v) => {
              store.setHighContrast(v);
              syncToProfile({ settings: { accessibility: { highContrast: v } } });
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Reduced motion</Label>
          <Switch
            checked={store.reducedMotion}
            onCheckedChange={(v) => {
              store.setReducedMotion(v);
              syncToProfile({ settings: { accessibility: { reducedMotion: v } } });
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label>Font size</Label>
          <Select
            value={String(store.fontScale)}
            onValueChange={(v) => {
              const scale = Number(v);
              store.setFontScale(scale);
              syncToProfile({ settings: { accessibility: { fontScale: scale } } });
            }}
          >
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Default</SelectItem>
              <SelectItem value="1.1">Large</SelectItem>
              <SelectItem value="1.25">Larger</SelectItem>
              <SelectItem value="1.4">Largest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
