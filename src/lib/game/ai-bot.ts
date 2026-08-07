import type { AIDifficulty } from "@/types/database";

// Client-safe constants/pure math only — no server-only imports. The browser
// (gameplay-view.tsx, host-settings-panel.tsx) needs AI_BOT_GUEST_ID and
// aiBuzzDelayMs(); the actual answer-generation logic (which needs the real
// song row) lives in the server-only lib/game/answer-service.ts instead.

/** Fixed `guest_id` identifying the synthetic AI-opponent `room_players` row — never a real guest's id since real guest ids are random nanoids. */
export const AI_BOT_GUEST_ID = "ai-opponent-bot";
export const AI_BOT_DISPLAY_NAME = "Clash Bot";
export const AI_BOT_AVATAR = "🤖";

export const AI_DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/**
 * Fraction of the round's `timerSeconds` the bot waits before buzzing, as
 * [min, max) — randomized within the range each turn so it doesn't feel
 * robotic. Widened from the original ranges (easy .55-.95, medium .3-.65,
 * hard .1-.4) after user feedback that even "easy" was routinely buzzing in
 * before a human had a real chance to listen and react — the bot should
 * feel beatable by default, not just on paper.
 */
const AI_DIFFICULTY_TIMING: Record<AIDifficulty, [number, number]> = {
  easy: [0.7, 1.0],
  medium: [0.45, 0.8],
  hard: [0.2, 0.5],
};

/** Independent per-category chance the bot "knows" the answer. */
const AI_DIFFICULTY_ACCURACY: Record<AIDifficulty, number> = {
  easy: 0.35,
  medium: 0.6,
  hard: 0.85,
};

export function aiBuzzDelayMs(difficulty: AIDifficulty, timerSeconds: number): number {
  const [min, max] = AI_DIFFICULTY_TIMING[difficulty];
  const fraction = min + Math.random() * (max - min);
  return Math.round(timerSeconds * 1000 * fraction);
}

/** Independent per-category chance the bot "knows" the answer, exported for the server-only answer-generation logic in lib/game/answer-service.ts. */
export function aiAccuracyFor(difficulty: AIDifficulty): number {
  return AI_DIFFICULTY_ACCURACY[difficulty];
}
