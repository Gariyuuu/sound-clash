import { create } from "zustand";
import type {
  RevealedHint,
  RoundBroadcastPayload,
  RoundRevealPayload,
  ScoreBreakdownEntry,
} from "@/lib/game/types";

export type BuzzPhase = "listening" | "locked" | "steal" | "resolved";

export interface FloatingScorePopup {
  id: string;
  playerId: string;
  label: string;
  points: number;
}

interface GameState {
  gameId: string | null;
  currentRound: RoundBroadcastPayload | null;
  phase: BuzzPhase;
  buzzHolderId: string | null;
  buzzHolderName: string | null;
  buzzPhaseNumber: number;
  buzzLockedAt: string | null;
  stealStartedAt: string | null;
  hints: RevealedHint[];
  lastReveal: RoundRevealPayload | null;
  scoreboard: Record<string, number>;
  popups: FloatingScorePopup[];
  paused: boolean;
  chaosLabel: string | null;
  excludedPlayerIds: string[];

  setGameId: (gameId: string) => void;
  setExcludedPlayerIds: (ids: string[]) => void;
  startRound: (round: RoundBroadcastPayload) => void;
  lockBuzz: (playerId: string, displayName: string, phaseNumber: number, buzzedAt: string) => void;
  startSteal: (phaseNumber: number, phaseStartedAt?: string) => void;
  addHint: (hint: RevealedHint) => void;
  resolveRound: (reveal: RoundRevealPayload, scoreboard: Record<string, number>) => void;
  pushPopup: (playerId: string, breakdown: ScoreBreakdownEntry[]) => void;
  clearPopup: (id: string) => void;
  setScoreboard: (scoreboard: Record<string, number>) => void;
  setPaused: (paused: boolean) => void;
  setChaosLabel: (label: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  currentRound: null,
  phase: "listening",
  buzzHolderId: null,
  buzzHolderName: null,
  buzzPhaseNumber: 1,
  buzzLockedAt: null,
  stealStartedAt: null,
  hints: [],
  lastReveal: null,
  scoreboard: {},
  popups: [],
  paused: false,
  chaosLabel: null,
  excludedPlayerIds: [],

  setGameId: (gameId) => set({ gameId }),
  setExcludedPlayerIds: (excludedPlayerIds) => set({ excludedPlayerIds }),
  startRound: (round) =>
    set({
      currentRound: round,
      phase: "listening",
      buzzHolderId: null,
      buzzHolderName: null,
      buzzPhaseNumber: 1,
      buzzLockedAt: null,
      stealStartedAt: null,
      hints: [],
      lastReveal: null,
    }),
  lockBuzz: (playerId, displayName, phaseNumber, buzzedAt) =>
    set({ phase: "locked", buzzHolderId: playerId, buzzHolderName: displayName, buzzPhaseNumber: phaseNumber, buzzLockedAt: buzzedAt }),
  // Prefer the server-recorded `game_rounds.phase_started_at` timestamp over
  // the local clock whenever the caller has it (postgres_changes UPDATE
  // events and the initial hydration fetch both do) — that's what lets a
  // reconnecting client or a newly-promoted host resume the correct
  // remaining countdown instead of restarting a full one. See
  // ARCHITECTURE.md's "host-disconnect-mid-round" note.
  startSteal: (phaseNumber, phaseStartedAt) =>
    set({
      phase: "steal",
      buzzHolderId: null,
      buzzHolderName: null,
      buzzPhaseNumber: phaseNumber,
      buzzLockedAt: null,
      stealStartedAt: phaseStartedAt ?? new Date().toISOString(),
    }),
  addHint: (hint) => set((state) => ({ hints: [...state.hints, hint] })),
  resolveRound: (reveal, scoreboard) =>
    set({ phase: "resolved", lastReveal: reveal, scoreboard }),
  pushPopup: (playerId, breakdown) =>
    set((state) => ({
      popups: [
        ...state.popups,
        ...breakdown.map((entry) => ({
          id: crypto.randomUUID(),
          playerId,
          label: entry.label,
          points: entry.points,
        })),
      ],
    })),
  clearPopup: (id) => set((state) => ({ popups: state.popups.filter((p) => p.id !== id) })),
  setScoreboard: (scoreboard) => set({ scoreboard }),
  setPaused: (paused) => set({ paused }),
  setChaosLabel: (chaosLabel) => set({ chaosLabel }),
  reset: () =>
    set({
      gameId: null,
      currentRound: null,
      phase: "listening",
      buzzHolderId: null,
      buzzHolderName: null,
      buzzPhaseNumber: 1,
      buzzLockedAt: null,
      stealStartedAt: null,
      hints: [],
      lastReveal: null,
      scoreboard: {},
      popups: [],
      paused: false,
      chaosLabel: null,
      excludedPlayerIds: [],
    }),
}));
