"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Flame } from "lucide-react";
import { useRoomStore } from "@/lib/stores/room-store";
import { cn } from "@/lib/utils";
import type { RoomPlayerSnapshot } from "@/lib/game/types";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function ScoreboardRow({
  player,
  rank,
  maxScore,
  isBuzzHolder,
  isSelf,
}: {
  player: RoomPlayerSnapshot;
  rank: number;
  maxScore: number;
  isBuzzHolder: boolean;
  isSelf: boolean;
}) {
  const prevScoreRef = useRef(player.score);
  const [flash, setFlash] = useState<"gain" | "loss" | null>(null);

  useEffect(() => {
    if (player.score !== prevScoreRef.current) {
      setFlash(player.score > prevScoreRef.current ? "gain" : "loss");
      prevScoreRef.current = player.score;
      const t = setTimeout(() => setFlash(null), 900);
      return () => clearTimeout(t);
    }
  }, [player.score]);

  const barWidth = maxScore > 0 ? Math.max(4, Math.round((player.score / maxScore) * 100)) : 0;

  return (
    <motion.div
      layout
      className={cn(
        "relative overflow-hidden rounded-xl px-2.5 py-2 text-sm border transition-colors",
        rank === 1 ? "border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-transparent" : "border-white/5",
        isBuzzHolder && "ring-2 ring-primary",
        isSelf && "font-semibold"
      )}
    >
      <div
        className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-700 ease-out"
        style={{ width: `${barWidth}%` }}
      />
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            className={cn("absolute inset-0 pointer-events-none", flash === "gain" ? "bg-emerald-400/40" : "bg-red-500/40")}
          />
        )}
      </AnimatePresence>
      <div className="relative flex items-center gap-2">
        <span className="w-5 text-center text-xs shrink-0">
          {rank <= 3 ? RANK_MEDALS[rank - 1] : <span className="text-muted-foreground">{rank}</span>}
        </span>
        <span className="text-base shrink-0">{player.avatarEmoji}</span>
        <span className="flex-1 min-w-0 truncate flex items-center gap-1">
          {player.displayName}
          {player.isHost && <Crown className="size-3 text-amber-400 shrink-0" />}
          {player.streak >= 2 && (
            <motion.span
              key={player.streak}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-0.5 text-orange-400 shrink-0"
            >
              <Flame className="size-3" />
              <span className="text-[10px] font-bold">{player.streak}</span>
            </motion.span>
          )}
        </span>
        <motion.span
          key={player.score}
          initial={{ y: flash === "gain" ? 6 : flash === "loss" ? -6 : 0, opacity: flash ? 0.4 : 1 }}
          animate={{ y: 0, opacity: 1 }}
          className={cn(
            "tabular-nums font-bold shrink-0",
            flash === "gain" && "text-emerald-400",
            flash === "loss" && "text-red-400"
          )}
        >
          {player.score}
        </motion.span>
      </div>
    </motion.div>
  );
}

export function ScoreboardSidebar({ buzzHolderId }: { buzzHolderId: string | null }) {
  const players = useRoomStore((s) => s.players);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const sorted = Object.values(players)
    .filter((p) => !p.isSpectator)
    .sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score ?? 0;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2 w-full sm:w-64">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Scoreboard</h3>
      {sorted.map((p, i) => (
        <ScoreboardRow
          key={p.id}
          player={p}
          rank={i + 1}
          maxScore={maxScore}
          isBuzzHolder={p.id === buzzHolderId}
          isSelf={p.id === selfPlayerId}
        />
      ))}
      {sorted.length === 0 && <p className="text-sm text-muted-foreground">No players yet.</p>}
    </div>
  );
}
