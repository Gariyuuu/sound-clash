"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Trophy, Home } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { LogoFull } from "@/components/branding/logo";
import { SplashScreen } from "@/components/branding/splash-screen";
import type { MatchHistoryRow } from "@/types/database";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sound/synth";

const PODIUM_HEIGHTS = ["h-40", "h-52", "h-32"]; // 2nd, 1st, 3rd visual order
const PODIUM_ORDER = [1, 0, 2]; // display index -> placement index (0-based)

export function ResultsView({ code }: { code: string }) {
  const [matchHistory, setMatchHistory] = useState<MatchHistoryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { matchHistoryId } = await api.getGame(code);
        if (!matchHistoryId) {
          if (!cancelled) setError("No match history recorded for this game.");
          return;
        }
        const { matchHistory } = await api.getMatchHistory(matchHistoryId);
        if (!cancelled) setMatchHistory(matchHistory);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!matchHistory) return;
    sfx.victory();
    const duration = 1500;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: ["#1ED760", "#7C3AED", "#ffffff"] });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: ["#1ED760", "#7C3AED", "#ffffff"] });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [matchHistory]);

  if (loading) return <SplashScreen label="Tallying scores..." />;

  if (error || !matchHistory) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Game over</h1>
        <p className="text-muted-foreground">{error ?? "Results unavailable."}</p>
        <Button render={<Link href="/" />}>
          <Home className="size-4" /> Back home
        </Button>
      </div>
    );
  }

  const podium = matchHistory.players.slice(0, 3);
  const rest = matchHistory.players.slice(3);

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto p-6 flex flex-col items-center gap-8">
      <LogoFull size={28} />
      <div className="text-center">
        <Trophy className="size-10 text-amber-400 mx-auto mb-2" />
        <h1 className="text-3xl font-extrabold">Game Over!</h1>
        <p className="text-muted-foreground">
          {matchHistory.round_count} rounds · {Math.round(matchHistory.duration_seconds / 60)} min
        </p>
      </div>

      {podium.length > 0 && (
        <div className="flex items-end gap-4">
          {PODIUM_ORDER.filter((i) => podium[i]).map((i, displayIndex) => {
            const p = podium[i];
            return (
              <motion.div
                key={p.playerId}
                initial={{ height: 0, opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: displayIndex * 0.15, type: "spring" }}
                className="flex flex-col items-center gap-2"
              >
                <div className="text-3xl">{p.avatarEmoji}</div>
                <div className="text-sm font-semibold text-center max-w-24 truncate">{p.displayName}</div>
                <div className="text-xs text-muted-foreground">{p.finalScore} pts</div>
                <div
                  className={cn(
                    "w-20 rounded-t-xl glass-strong flex items-start justify-center pt-2 font-bold text-lg",
                    PODIUM_HEIGHTS[displayIndex],
                    i === 0 && "neon-glow-green"
                  )}
                >
                  {p.placement}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {rest.length > 0 && (
        <div className="w-full glass rounded-2xl p-4 flex flex-col gap-1">
          {rest.map((p) => (
            <div key={p.playerId} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="w-6 text-muted-foreground">{p.placement}</span>
              <span>{p.avatarEmoji}</span>
              <span className="flex-1 truncate">{p.displayName}</span>
              <span className="text-muted-foreground">{p.accuracy}% acc</span>
              <span className="tabular-nums font-semibold">{p.finalScore}</span>
            </div>
          ))}
        </div>
      )}

      <Button render={<Link href="/" />} size="lg" className="neon-glow-violet">
        <Home className="size-4" /> Back home
      </Button>
    </div>
  );
}
