"use client";

import { motion } from "framer-motion";
import { Crown, Flame } from "lucide-react";
import { useRoomStore } from "@/lib/stores/room-store";
import { cn } from "@/lib/utils";

export function ScoreboardSidebar({ buzzHolderId }: { buzzHolderId: string | null }) {
  const players = useRoomStore((s) => s.players);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const sorted = Object.values(players)
    .filter((p) => !p.isSpectator)
    .sort((a, b) => b.score - a.score);

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2 w-full sm:w-64">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Scoreboard</h3>
      {sorted.map((p, i) => (
        <motion.div
          key={p.id}
          layout
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
            p.id === buzzHolderId && "bg-primary/15",
            p.id === selfPlayerId && "font-semibold"
          )}
        >
          <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
          <span>{p.avatarEmoji}</span>
          <span className="flex-1 truncate flex items-center gap-1">
            {p.displayName}
            {p.isHost && <Crown className="size-3 text-amber-400" />}
            {p.streak >= 2 && <Flame className="size-3 text-orange-400" />}
          </span>
          <span className="tabular-nums">{p.score}</span>
        </motion.div>
      ))}
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">No players yet.</p>}
    </div>
  );
}
