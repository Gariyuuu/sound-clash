"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoomStore } from "@/lib/stores/room-store";
import { useGameStore } from "@/lib/stores/game-store";
import { useGameRealtime } from "@/lib/hooks/use-game-realtime";
import { useCountdown } from "@/lib/hooks/use-countdown";
import { api } from "@/lib/api-client";
import { GAME_MODE_LABELS } from "@/lib/game/types";
import { aiBuzzDelayMs } from "@/lib/game/ai-bot";
import type { AnswerCategory } from "@/types/database";
import type { RevealedHint, RoundBroadcastPayload, RoundRevealPayload } from "@/lib/game/types";
import { LogoFull } from "@/components/branding/logo";
import { BuzzerButton, type BuzzerBlock } from "@/components/game/buzzer-button";
import { AnswerPanel } from "@/components/game/answer-panel";
import { HintsPanel } from "@/components/game/hints-panel";
import { YoutubePlayer } from "@/components/game/youtube-player";
import { SpotifyPreviewPlayer } from "@/components/game/spotify-preview-player";
import { ScoreboardSidebar } from "@/components/game/scoreboard-sidebar";
import { FloatingScorePopups } from "@/components/game/floating-score-popups";
import { RoundRevealOverlay } from "@/components/game/round-reveal-overlay";
import { SplashScreen } from "@/components/branding/splash-screen";
import { Button } from "@/components/ui/button";
import { Pause, Play, SkipForward, Timer, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { sfx } from "@/lib/sound/synth";

const ANSWER_WINDOW_MS = 10_000;

export function GameplayView({ code }: { code: string }) {
  const room = useRoomStore((s) => s.room);
  const players = useRoomStore((s) => s.players);
  const selfPlayerId = useRoomStore((s) => s.selfPlayerId);
  const self = selfPlayerId ? players[selfPlayerId] : null;

  const [gameId, setGameIdLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const currentRound = useGameStore((s) => s.currentRound);
  const phase = useGameStore((s) => s.phase);
  const buzzHolderId = useGameStore((s) => s.buzzHolderId);
  const buzzHolderName = useGameStore((s) => s.buzzHolderName);
  const buzzLockedAt = useGameStore((s) => s.buzzLockedAt);
  const stealStartedAt = useGameStore((s) => s.stealStartedAt);
  const hints = useGameStore((s) => s.hints);
  const lastReveal = useGameStore((s) => s.lastReveal);
  const paused = useGameStore((s) => s.paused);
  const chaosLabel = useGameStore((s) => s.chaosLabel);
  const excludedPlayerIds = useGameStore((s) => s.excludedPlayerIds);
  const startRound = useGameStore((s) => s.startRound);
  const startSteal = useGameStore((s) => s.startSteal);
  const addHint = useGameStore((s) => s.addHint);
  const resolveRound = useGameStore((s) => s.resolveRound);
  const resetGame = useGameStore((s) => s.reset);

  useGameRealtime(gameId);

  // Hydrate from the DB on mount / refresh — the realtime subscription only
  // sees events from this point forward, so a fresh page load needs an
  // initial fetch to catch up on whatever round is already in progress.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { game, round } = await api.getGame(code);
        if (cancelled || !game) return;
        setGameIdLocal(game.id);
        const payload = round?.broadcast_payload as RoundBroadcastPayload | null | undefined;
        if (payload) {
          startRound(payload);
          const hintList = (round?.revealed_hints as RevealedHint[] | null) ?? [];
          hintList.forEach((h) => addHint(h));
          if (round?.status === "steal") startSteal(round.current_phase, round.phase_started_at);
          if ((round?.status === "resolved" || round?.status === "skipped") && round.reveal_payload) {
            resolveRound(round.reveal_payload as RoundRevealPayload, {});
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      resetGame();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const isExcluded = selfPlayerId ? excludedPlayerIds.includes(selfPlayerId) : false;
  const isBuzzHolder = selfPlayerId !== null && buzzHolderId === selfPlayerId;

  const deadlineMs = useMemo(() => {
    if (!currentRound) return null;
    if (phase === "listening") {
      return new Date(currentRound.serverStartedAt).getTime() + currentRound.timerSeconds * 1000;
    }
    if (phase === "locked" && buzzLockedAt) {
      return new Date(buzzLockedAt).getTime() + ANSWER_WINDOW_MS;
    }
    if (phase === "steal" && stealStartedAt) {
      return new Date(stealStartedAt).getTime() + currentRound.timerSeconds * 1000;
    }
    return null;
  }, [phase, currentRound, buzzLockedAt, stealStartedAt]);

  const handleExpire = useCallback(() => {
    if (!self?.isHost || !currentRound) return;
    const reason = phase === "locked" ? "no_answer" : "no_buzz";
    api.timeout(currentRound.roundId, { requesterPlayerId: self.id, reason }).catch(() => {});
  }, [self, phase, currentRound]);

  const { remainingSeconds } = useCountdown(deadlineMs, handleExpire);

  // Buzz sound plays for everyone off the shared store transition (not just
  // the clicker) — it fires the instant round_locks' realtime INSERT event
  // updates buzzHolderId, so it's naturally in sync across every client.
  const prevBuzzHolderRef = useRef<string | null>(null);
  useEffect(() => {
    if (buzzHolderId && buzzHolderId !== prevBuzzHolderRef.current) sfx.buzz();
    prevBuzzHolderRef.current = buzzHolderId;
  }, [buzzHolderId]);

  const prevTickSecondRef = useRef<number | null>(null);
  useEffect(() => {
    const active = phase === "listening" || phase === "steal";
    const seconds = Math.max(0, remainingSeconds);
    if (active && seconds <= 3 && seconds >= 1 && seconds !== prevTickSecondRef.current) {
      sfx.countdownTick();
    }
    prevTickSecondRef.current = seconds;
  }, [remainingSeconds, phase]);

  const aiPlayerId = useMemo(() => Object.values(players).find((p) => p.isAI)?.id ?? null, [players]);

  // Schedules the AI opponent's simulated buzz-in for the host's client to
  // trigger — same host-timing-authority pattern as `handleExpire` above,
  // since the server has no wall clock of its own. Re-runs on every new
  // listening/steal window (stealStartedAt changes each escalation) and is
  // a no-op server-side if a human already buzzed first — see
  // `/api/rounds/[roundId]/ai-turn`.
  useEffect(() => {
    if (!self?.isHost || !currentRound || !aiPlayerId || !room) return;
    if (phase !== "listening" && phase !== "steal") return;
    const difficulty = room.settings.aiDifficulty ?? "medium";
    const delay = aiBuzzDelayMs(difficulty, currentRound.timerSeconds);
    const timer = setTimeout(() => {
      api.aiTurn(currentRound.roundId, { requesterPlayerId: self.id }).catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentRound?.roundId, stealStartedAt, self?.isHost, self?.id, aiPlayerId, room?.settings.aiDifficulty]);

  async function handleBuzz() {
    if (!currentRound || !selfPlayerId) return;
    try {
      await api.buzz(currentRound.roundId, { playerId: selfPlayerId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Buzz failed.");
    }
  }

  async function handleSubmitAnswer(answers: Partial<Record<AnswerCategory, string>>) {
    if (!currentRound || !selfPlayerId) return;
    setSubmitting(true);
    try {
      const result = await api.submitAnswer(currentRound.roundId, {
        playerId: selfPlayerId,
        answers,
        usedHint: hints.length > 0,
      });
      if (result.correct) {
        sfx.correct();
        toast.success(`Correct! +${result.total} points`);
      } else {
        sfx.incorrect();
        toast.error(result.penalty ? `Not quite — ${result.penalty} points` : "Not quite!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleHint(kind: RevealedHint["kind"]) {
    if (!currentRound || !selfPlayerId) return;
    try {
      await api.hint(currentRound.roundId, { requesterPlayerId: selfPlayerId, kind });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reveal hint.");
    }
  }

  async function handleControl(action: "pause" | "resume" | "skip") {
    if (!selfPlayerId) return;
    try {
      await api.control(code, { requesterPlayerId: selfPlayerId, action });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function handleSetTimer(seconds: number) {
    if (!selfPlayerId) return;
    try {
      await api.control(code, { requesterPlayerId: selfPlayerId, action: "set_timer", timerSeconds: seconds });
      toast.success(`Buzz timer set to ${seconds}s — takes effect next round.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change the timer.");
    }
  }

  if (loading || !room || !currentRound) {
    return <SplashScreen label="Loading round..." />;
  }

  const canBuzz = (phase === "listening" || phase === "steal") && !self?.isSpectator && !isExcluded && !paused;

  // Why the buzzer is unavailable, most specific reason first — a dimmed
  // circle on its own told a locked-out player nothing about which of the
  // four possible reasons applied to them.
  const buzzBlock: BuzzerBlock = self?.isSpectator
    ? "spectating"
    : paused
      ? "paused"
      : isExcluded
        ? "answered"
        : "waiting";

  // Spectator readout: phase + leader + whose turn, in one strip, so somebody
  // who is not playing can answer "what is happening?" from a screenshot.
  const ranked = Object.values(players)
    .filter((p) => !p.isSpectator)
    .sort((a, b) => b.score - a.score);
  const leader = ranked[0] ?? null;
  const phaseLabel = paused
    ? "Paused"
    : phase === "listening"
      ? `Listening · round ${currentRound.roundNumber}/${currentRound.totalRounds}`
      : phase === "locked"
        ? "Answering"
        : phase === "steal"
          ? "Steal round"
          : "Reveal";
  const turnState = phase === "locked" ? (isBuzzHolder ? "you" : "them") : "idle";
  const turnLabel =
    phase === "locked"
      ? isBuzzHolder
        ? "Your answer"
        : `${buzzHolderName ?? "Someone"} answering`
      : phase === "steal"
        ? "Anyone can steal"
        : phase === "resolved"
          ? "Round over"
          : "Buzzers open";

  return (
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <FloatingScorePopups />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <LogoFull size={24} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Round {currentRound.roundNumber}/{currentRound.totalRounds}</span>
          <span>·</span>
          <span>{GAME_MODE_LABELS[currentRound.mode]}</span>
          {chaosLabel && (
            <span className="rounded-full bg-fuchsia-500/20 text-fuchsia-300 px-2.5 py-0.5 text-xs font-semibold">
              Chaos: {chaosLabel}
            </span>
          )}
        </div>
        {self?.isHost && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 px-1.5 h-8">
              <Timer className="size-3.5 text-muted-foreground" />
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                disabled={room.settings.timerSeconds <= 5}
                onClick={() => handleSetTimer(room.settings.timerSeconds - 5)}
              >
                <Minus className="size-3" />
              </Button>
              <span className="text-xs font-mono tabular-nums w-7 text-center">{room.settings.timerSeconds}s</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                disabled={room.settings.timerSeconds >= 30}
                onClick={() => handleSetTimer(room.settings.timerSeconds + 5)}
              >
                <Plus className="size-3" />
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleControl(paused ? "resume" : "pause")}>
              {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleControl("skip")}>
              <SkipForward className="size-3.5" /> Skip
            </Button>
          </div>
        )}
      </div>

      <div className="gl-readout">
        <span className="gl-phase">{phaseLabel}</span>
        <span className="gl-turn" data-turn={turnState}>
          {turnLabel}
        </span>
        {leader && (
          <span className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
            <span className="max-w-32 truncate">Leading · {leader.displayName}</span>
            <span className="gl-score text-foreground">{leader.score}</span>
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_260px] gap-6">
        <div className="flex flex-col items-center gap-6">
          {currentRound.youtubeVideoId ? (
            <YoutubePlayer
              videoId={currentRound.youtubeVideoId}
              startSeconds={currentRound.clipStartSeconds}
              durationSeconds={currentRound.clipDurationSeconds}
              coverUrl={currentRound.coverUrlBlurred}
            />
          ) : currentRound.spotifyPreviewUrl ? (
            <SpotifyPreviewPlayer previewUrl={currentRound.spotifyPreviewUrl} coverUrl={currentRound.coverUrlBlurred} />
          ) : (
            <div className="aspect-video w-full max-w-md mx-auto rounded-2xl glass-strong flex items-center justify-center text-sm text-muted-foreground text-center p-6">
              No playable clip for this song — it may be missing a YouTube video or a Spotify preview.
            </div>
          )}

          {deadlineMs && (
            <div className="text-3xl font-mono font-bold tabular-nums">
              {Math.max(0, remainingSeconds)}s
            </div>
          )}

          <HintsPanel
            revealed={hints}
            isHost={Boolean(self?.isHost)}
            canReveal={phase === "listening"}
            onReveal={handleHint}
          />

          <AnimatePresence mode="wait">
            {phase === "steal" && (
              <motion.div
                key="steal-banner"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-full bg-destructive/20 text-destructive px-6 py-2 font-bold uppercase tracking-wide"
              >
                Steal Round!
              </motion.div>
            )}

            {isBuzzHolder && phase === "locked" ? (
              <motion.div key="answer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <AnswerPanel categories={currentRound.categories} onSubmit={handleSubmitAnswer} submitting={submitting} />
              </motion.div>
            ) : phase === "locked" ? (
              <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                <p className="text-lg font-semibold">{buzzHolderName} buzzed in!</p>
                <p className="text-sm text-muted-foreground">Everyone else is locked out...</p>
              </motion.div>
            ) : (
              <motion.div key="buzzer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <BuzzerButton disabled={!canBuzz} block={buzzBlock} onBuzz={handleBuzz} />
              </motion.div>
            )}
          </AnimatePresence>

          {paused && (
            <p className="text-sm text-amber-400 font-semibold">Game paused by the host.</p>
          )}
        </div>

        <ScoreboardSidebar buzzHolderId={buzzHolderId} />
      </div>

      {phase === "resolved" && lastReveal && selfPlayerId && (
        <RoundRevealOverlay
          reveal={lastReveal}
          roundId={currentRound.roundId}
          isHost={Boolean(self?.isHost)}
          selfPlayerId={selfPlayerId}
        />
      )}
    </div>
  );
}
