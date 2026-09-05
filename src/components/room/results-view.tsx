"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Trophy, Home, Medal, Handshake, ListOrdered } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { LogoFull } from "@/components/branding/logo";
import { SplashScreen } from "@/components/branding/splash-screen";
import type { MatchHistoryRow } from "@/types/database";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sound/synth";
import { useRoomStore } from "@/lib/stores/room-store";
import { useMotionOff } from "@/lib/hooks/use-motion-off";

/** 1 -> "1st". Placement is spoken, not a bare digit, in the outcome line. */
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/* The header icon followed the trophy for everyone, including last place.
 * One icon per outcome, at one size, all Lucide. */
function OutcomeIcon({ outcome }: { outcome: "win" | "lose" | "draw" | null }) {
  const className = "size-10 mx-auto mb-2";
  if (outcome === "win") return <Trophy className={cn(className, "text-[var(--gl-win)]")} aria-hidden />;
  if (outcome === "draw") return <Handshake className={cn(className, "text-[var(--gl-draw)]")} aria-hidden />;
  if (outcome === "lose") return <Medal className={cn(className, "text-muted-foreground")} aria-hidden />;
  return <ListOrdered className={cn(className, "text-muted-foreground")} aria-hidden />;
}

const PODIUM_HEIGHTS = ["h-40", "h-52", "h-32"]; // 2nd, 1st, 3rd visual order
const PODIUM_ORDER = [1, 0, 2]; // display index -> placement index (0-based)

export function ResultsView({ code }: { code: string }) {
  const [matchHistory, setMatchHistory] = useState<MatchHistoryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const motionOff = useMotionOff();

  // What happened to THE VIEWER, which is a different question from who won.
  // A spectator gets no outcome at all rather than a borrowed one.
  const selfResult = selfPlayerId
    ? (matchHistory?.players.find((p) => p.playerId === selfPlayerId) ?? null)
    : null;
  const sharedFirst =
    matchHistory && selfResult
      ? matchHistory.players.filter((p) => p.placement === 1).length > 1
      : false;
  const outcome: "win" | "lose" | "draw" | null = !selfResult
    ? null
    : selfResult.placement !== 1
      ? "lose"
      : sharedFirst
        ? "draw"
        : "win";
  const outcomeCopy =
    outcome === "win"
      ? "You win"
      : outcome === "draw"
        ? "Tied for first"
        : outcome === "lose"
          ? `You placed ${ordinal(selfResult!.placement)}`
          : "Game over";

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

  // The celebration is for a WIN, not for arriving at this screen. It used to
  // fire for everybody: the player who came sixth got the same victory fanfare
  // and the same 1.5s of confetti as the winner, which is the one moment in the
  // game where the result has to be unambiguous. Confetti and the fanfare are
  // also pure JS, so neither reduce gate in globals.css can touch them — the
  // hook is the only thing that stops them.
  useEffect(() => {
    if (!matchHistory || outcome !== "win") return;
    if (!motionOff) sfx.victory();
    if (motionOff) return;
    const end = Date.now() + 1500;
    let frameId = 0;
    (function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: ["#1ED760", "#7C3AED", "#ffffff"] });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: ["#1ED760", "#7C3AED", "#ffffff"] });
      if (Date.now() < end) frameId = requestAnimationFrame(frame);
    })();
    // The loop outlived the component before: leaving the results screen inside
    // the 1.5s window left a rAF chain still firing confetti over the next page.
    return () => cancelAnimationFrame(frameId);
  }, [matchHistory, outcome, motionOff]);

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
      {/* The result, stated first and in the viewer's own terms. Win rises,
        * a placement settles, a tie converges — three motions that read the
        * same with the sound off and the colour gone, per the W4 layer. */}
      <div className="relative text-center">
        {outcome === "win" && <span className="gl-burst" aria-hidden />}
        <OutcomeIcon outcome={outcome} />
        <h1 className="gl-outcome text-3xl font-extrabold" data-outcome={outcome ?? undefined}>
          {outcomeCopy}
        </h1>
        <p className="gl-outcome-detail text-muted-foreground">
          {selfResult ? `${selfResult.finalScore} pts · ` : ""}
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
                /* Was initial={{height:0,opacity:0}} animate={{opacity:1}} —
                 * height was animated FROM 0 and never animated back to a
                 * value, so the podium either popped or fought the layout.
                 * Transform and opacity only, and skipped entirely under
                 * reduce (framer ignores both CSS reduce gates). */
                initial={motionOff ? false : { opacity: 0, y: 18, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={
                  motionOff
                    ? { duration: 0 }
                    : { delay: displayIndex * 0.12, type: "spring", stiffness: 220, damping: 22 }
                }
                className="flex flex-col items-center gap-2"
              >
                <div className="text-3xl">{p.avatarEmoji}</div>
                <div className="text-sm font-semibold text-center max-w-24 truncate">{p.displayName}</div>
                <div className="text-xs text-muted-foreground">{p.finalScore} pts</div>
                <div
                  className={cn(
                    "w-20 rounded-t-xl glass-strong flex items-start justify-center pt-2 font-bold text-lg",
                    PODIUM_HEIGHTS[displayIndex],
                    i === 0 && "neon-glow-green",
                    p.playerId === selfPlayerId && "ring-2 ring-[var(--gl-turn-you)]"
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
            <div
              key={p.playerId}
              className={cn(
                "flex items-center gap-3 py-1.5 text-sm rounded-lg px-2 -mx-2",
                p.playerId === selfPlayerId && "bg-white/5 font-semibold"
              )}
            >
              <span className="w-6 text-muted-foreground tabular-nums">{p.placement}</span>
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
