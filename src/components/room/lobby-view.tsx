"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlayerList } from "@/components/room/player-list";
import { HostSettingsPanel } from "@/components/room/host-settings-panel";
import { RoomChat } from "@/components/room/room-chat";
import { LogoFull } from "@/components/branding/logo";
import { useRoomStore } from "@/lib/stores/room-store";
import { GAME_MODE_LABELS } from "@/lib/game/types";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { Copy, Play, Loader2, Music2 } from "lucide-react";

export function LobbyView({ code, sendTyping }: { code: string; sendTyping: (playerId: string, isTyping: boolean) => void }) {
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const [starting, setStarting] = useState(false);
  const self = selfPlayerId ? players[selfPlayerId] : null;
  const activePlayers = Object.values(players).filter((p) => !p.isSpectator && p.connectionStatus === "connected");

  if (!room) return null;

  function copyCode() {
    navigator.clipboard.writeText(code);
    toast.success("Room code copied!");
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
    toast.success("Invite link copied!");
  }

  async function handleStart() {
    if (!selfPlayerId) return;
    setStarting(true);
    try {
      await api.startGame(code, selfPlayerId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start game.");
    } finally {
      setStarting(false);
    }
  }

  const canStart = self?.isHost && activePlayers.length >= 2 && Boolean(room.playlist_id);

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <LogoFull size={26} />
        <div className="flex items-center gap-2">
          <button
            onClick={copyCode}
            className="glass rounded-xl px-4 py-2 font-mono text-xl tracking-[0.3em] hover:bg-white/10 transition flex items-center gap-2"
          >
            {code}
            <Copy className="size-4 text-muted-foreground" />
          </button>
          <Button variant="secondary" onClick={copyLink}>Copy invite link</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="flex flex-col gap-6">
          {self?.isHost ? (
            <HostSettingsPanel code={code} ownerId={self.profileId ?? undefined} />
          ) : (
            <div className="glass rounded-2xl p-5 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Game settings</h3>
              <div className="flex items-center gap-2 text-sm">
                <Music2 className="size-4 text-emerald-400" />
                {GAME_MODE_LABELS[room.settings.mode]} · {room.settings.songCount} songs · {room.settings.timerSeconds}s timer
              </div>
              <p className="text-xs text-muted-foreground">Waiting for the host to start the game...</p>
            </div>
          )}

          <PlayerList code={code} />

          {self?.isHost && (
            <Button size="lg" className="h-14 text-base neon-glow-green self-start" disabled={!canStart || starting} onClick={handleStart}>
              {starting ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />}
              Start Game
            </Button>
          )}
          {self?.isHost && !room.playlist_id && (
            <p className="text-sm text-amber-400 -mt-4">Pick a playlist above before starting.</p>
          )}
          {self?.isHost && room.playlist_id && activePlayers.length < 2 && (
            <p className="text-sm text-amber-400 -mt-4">Need at least 2 players to start.</p>
          )}
        </div>

        <RoomChat code={code} sendTyping={sendTyping} />
      </div>
    </div>
  );
}
