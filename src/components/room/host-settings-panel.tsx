"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlaylistPicker } from "@/components/room/playlist-picker";
import { api } from "@/lib/api-client";
import { useRoomStore } from "@/lib/stores/room-store";
import { GAME_MODE_LABELS } from "@/lib/game/types";
import { AI_DIFFICULTY_LABELS } from "@/lib/game/ai-bot";
import type { AIDifficulty, AnswerCategory, GameModeKey, RoomSettings } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SONG_COUNTS = [10, 20, 30, 50, 100] as const;
const CATEGORY_OPTIONS: { key: AnswerCategory; label: string }[] = [
  { key: "title", label: "Song Name" },
  { key: "artist", label: "Artist" },
  { key: "featured_artist", label: "Featured Artist" },
  { key: "album", label: "Album" },
  { key: "chorus", label: "Chorus/Lyrics" },
];

export function HostSettingsPanel({ code, ownerId }: { code: string; ownerId?: string }) {
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const setSettings = useRoomStore((s) => s.setSettings);
  const [saving, setSaving] = useState(false);
  const [roomName, setRoomName] = useState(room?.name ?? "");
  if (!room) return null;

  const settings = room.settings;
  const hasAiOpponent = Object.values(players).some((p) => p.isAI);

  async function toggleAiOpponent(enabled: boolean) {
    setSaving(true);
    try {
      await api.setAiOpponent(code, { requesterPlayerId: selfPlayerId, enabled, difficulty: settings.aiDifficulty });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update AI opponent.");
    } finally {
      setSaving(false);
    }
  }

  async function setAiDifficulty(difficulty: AIDifficulty) {
    persist({ ...settings, aiDifficulty: difficulty });
    if (hasAiOpponent) {
      try {
        await api.setAiOpponent(code, { requesterPlayerId: selfPlayerId, enabled: true, difficulty });
      } catch {
        // settings.aiDifficulty already updated optimistically above; the bot
        // will just pick up the new difficulty next time it's toggled.
      }
    }
  }

  async function persistRoomMeta(overrides: { roomName?: string; isPublic?: boolean }) {
    setSaving(true);
    try {
      await api.updateSettings(code, { requesterPlayerId: selfPlayerId, settings, ...overrides });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update room.");
    } finally {
      setSaving(false);
    }
  }

  async function persist(next: RoomSettings) {
    setSettings(next);
    setSaving(true);
    try {
      await api.updateSettings(code, { requesterPlayerId: selfPlayerId, settings: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  }

  async function persistPlaylist(playlistId: string) {
    try {
      await api.updateSettings(code, { requesterPlayerId: selfPlayerId, settings, playlistId });
      toast.success("Playlist selected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to select playlist.");
    }
  }

  function toggleCategory(cat: AnswerCategory) {
    const has = settings.categories.includes(cat);
    const next = has ? settings.categories.filter((c) => c !== cat) : [...settings.categories, cat];
    if (next.length === 0) return;
    persist({ ...settings, categories: next });
  }

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Host Settings</h3>
        {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="room-name">Room name</Label>
          <Input
            id="room-name"
            value={roomName}
            maxLength={40}
            onChange={(e) => setRoomName(e.target.value)}
            onBlur={() => roomName.trim() && persistRoomMeta({ roomName: roomName.trim() })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 px-3">
          <div>
            <Label>Public room</Label>
            <p className="text-xs text-muted-foreground">Listed for anyone to join.</p>
          </div>
          <Switch checked={room.is_public} onCheckedChange={(v) => persistRoomMeta({ isPublic: v })} />
        </div>
      </div>

      <PlaylistPicker selectedId={room.playlist_id} onSelect={persistPlaylist} ownerId={ownerId} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Songs per game</Label>
          <Select value={String(settings.songCount)} onValueChange={(v) => persist({ ...settings, songCount: Number(v) as RoomSettings["songCount"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SONG_COUNTS.map((n) => (
                <SelectItem key={n} value={String(n)}>{n} songs</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Music source</Label>
          <Select value={settings.source} onValueChange={(v) => persist({ ...settings, source: v as RoomSettings["source"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="spotify">Spotify</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Game mode</Label>
          <Select value={settings.mode} onValueChange={(v) => persist({ ...settings, mode: v as GameModeKey })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(GAME_MODE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {settings.mode === "team_battle" && (
          <div className="flex flex-col gap-1.5">
            <Label>Team size</Label>
            <Select value={String(settings.teamSize ?? 2)} onValueChange={(v) => persist({ ...settings, teamSize: Number(v) as 2 | 3 | 4 })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2v2</SelectItem>
                <SelectItem value="3">3v3</SelectItem>
                <SelectItem value="4">4v4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Buzz timer</Label>
          <span className="text-sm text-muted-foreground">{settings.timerSeconds}s</span>
        </div>
        <Slider
          min={5}
          max={20}
          step={1}
          value={[settings.timerSeconds]}
          onValueChange={(value) => {
            const v = Array.isArray(value) ? value[0] : value;
            setSettings({ ...settings, timerSeconds: v });
          }}
          onValueCommitted={(value) => {
            const v = Array.isArray(value) ? value[0] : value;
            persist({ ...settings, timerSeconds: v });
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Categories to guess</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggleCategory(opt.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm border transition",
                settings.categories.includes(opt.key)
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-white/10 bg-white/5 text-muted-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Hints</Label>
          <p className="text-xs text-muted-foreground">Let players reveal clues before buzzing.</p>
        </div>
        <Switch checked={settings.hintsEnabled} onCheckedChange={(v) => persist({ ...settings, hintsEnabled: v })} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label>Steal rounds</Label>
          <p className="text-xs text-muted-foreground">Wrong answers open the floor for everyone else.</p>
        </div>
        <Switch checked={settings.stealEnabled} onCheckedChange={(v) => persist({ ...settings, stealEnabled: v })} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-white/10 p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>🤖 AI opponent</Label>
            <p className="text-xs text-muted-foreground">Play solo — the bot buzzes in and answers on its own.</p>
          </div>
          <Switch checked={hasAiOpponent} onCheckedChange={toggleAiOpponent} />
        </div>
        {hasAiOpponent && (
          <div className="flex flex-col gap-1.5">
            <Label>Bot difficulty</Label>
            <Select value={settings.aiDifficulty ?? "medium"} onValueChange={(v) => v && setAiDifficulty(v as AIDifficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(AI_DIFFICULTY_LABELS) as [AIDifficulty, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
