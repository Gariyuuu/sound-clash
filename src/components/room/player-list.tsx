"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Crown, Eye, MoreVertical, Wifi, WifiOff } from "lucide-react";
import { useRoomStore } from "@/lib/stores/room-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function PlayerList({ code }: { code: string }) {
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const list = Object.values(players).sort((a, b) => (a.isHost ? -1 : b.isHost ? 1 : b.score - a.score));
  const self = selfPlayerId ? players[selfPlayerId] : null;
  const isTeamMode = room?.settings.mode === "team_battle" && room.status === "lobby";
  const TEAM_OPTIONS = ["A", "B"];

  async function handleKick(targetPlayerId: string, ban: boolean) {
    if (!selfPlayerId) return;
    try {
      await api.kickPlayer(code, { requesterPlayerId: selfPlayerId, targetPlayerId, ban });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove player.");
    }
  }

  async function handleAssignTeam(targetPlayerId: string, team: string) {
    if (!selfPlayerId) return;
    try {
      await api.assignTeam(code, { requesterPlayerId: selfPlayerId, targetPlayerId, team });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign team.");
    }
  }

  async function handleToggleReady() {
    if (!self) return;
    try {
      await api.setReady(code, { playerId: self.id, isReady: !self.isReady });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ready status.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Players ({list.filter((p) => !p.isSpectator).length}/20)
        </h3>
        {self && !self.isSpectator && (
          <button
            onClick={handleToggleReady}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold border transition flex items-center gap-1",
              self.isReady ? "border-emerald-400 bg-emerald-400/15 text-emerald-400" : "border-white/10 text-muted-foreground"
            )}
          >
            <Check className="size-3" /> {self.isReady ? "Ready" : "Not ready"}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <AnimatePresence initial={false}>
          {list.map((p) => (
            <motion.div
              key={p.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn(
                "glass rounded-xl p-3 flex items-center gap-2.5 relative",
                p.connectionStatus === "disconnected" && "opacity-50"
              )}
            >
              <div className="text-2xl">{p.avatarEmoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm font-medium truncate">
                  {p.displayName}
                  {p.isHost && <Crown className="size-3.5 text-amber-400 shrink-0" />}
                  {p.isSpectator && <Eye className="size-3.5 text-muted-foreground shrink-0" />}
                  {!p.isHost && !p.isSpectator && p.isReady && <Check className="size-3.5 text-emerald-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {p.connectionStatus === "connected" ? (
                    <Wifi className="size-3" />
                  ) : (
                    <WifiOff className="size-3" />
                  )}
                  {p.isSpectator ? "Spectator" : `${p.score} pts`}
                  {p.team && (
                    <span className="rounded bg-white/10 px-1.5 text-[10px] font-semibold">Team {p.team}</span>
                  )}
                </div>
                {isTeamMode && self?.isHost && !p.isSpectator && (
                  <div className="flex gap-1 mt-1">
                    {TEAM_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => handleAssignTeam(p.id, t)}
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                          p.team === t ? "border-primary bg-primary/20 text-primary" : "border-white/10 text-muted-foreground"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {self?.isHost && p.id !== selfPlayerId && (
                <DropdownMenu>
                  <DropdownMenuTrigger className="p-1 rounded hover:bg-white/10">
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleKick(p.id, false)}>Kick</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleKick(p.id, true)} className="text-destructive">
                      Ban
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
