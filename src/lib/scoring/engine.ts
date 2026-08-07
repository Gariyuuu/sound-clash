import type { AnswerCategory } from "@/types/database";
import type { ChaosRuleKey, ScoreBreakdownEntry } from "@/lib/game/types";
import { SCORE_VALUES, STEAL_MULTIPLIER } from "@/lib/game/types";

export interface ScoreContext {
  /** Every category the player answered correctly in this single submission (a round can require more than one — e.g. title + artist). */
  correctCategories: AnswerCategory[];
  isSteal: boolean;
  isFirstAttemptOfRound: boolean;
  buzzRankThisRound: number; // 1 = fastest buzz across the whole round
  usedHint: boolean;
  allCategoriesCorrectThisTurn: boolean; // "perfect answer" — every requested category nailed at once
  chaosRule?: ChaosRuleKey | null;
}

export interface ScoreResult {
  total: number;
  breakdown: ScoreBreakdownEntry[];
}

const CATEGORY_LABEL: Record<AnswerCategory, string> = {
  title: "Song Name",
  artist: "Artist",
  featured_artist: "Featured Artist",
  album: "Album",
  chorus: "Correct Chorus/Lyrics",
};

/**
 * Pure, deterministic scoring function — the single implementation used by
 * both the live scoring API route and (in principle) any future
 * client-side "what you'd earn" preview. Handles every category answered
 * correctly in one submission plus the round-level bonuses and Chaos Mode
 * modifiers. See DECISIONS.md D-007 — this used to have a second, inline
 * reimplementation in the answer route that didn't apply Chaos Mode's
 * modifiers; that duplication has been removed, this is now the only path.
 */
export function computeScore(ctx: ScoreContext): ScoreResult {
  const breakdown: ScoreBreakdownEntry[] = [];

  for (const category of ctx.correctCategories) {
    breakdown.push({ label: CATEGORY_LABEL[category], points: SCORE_VALUES[category] });
  }

  if (ctx.buzzRankThisRound === 1 && !ctx.isSteal) {
    breakdown.push({ label: "Fastest Buzz", points: SCORE_VALUES.fastestBuzzBonus });
  }

  if (ctx.isFirstAttemptOfRound && !ctx.isSteal) {
    breakdown.push({ label: "First Try Bonus", points: SCORE_VALUES.firstTryBonus });
  }

  if (!ctx.usedHint) {
    breakdown.push({ label: "No Hint Bonus", points: SCORE_VALUES.noHintBonus });
  }

  if (ctx.allCategoriesCorrectThisTurn) {
    breakdown.push({ label: "Perfect Answer Bonus", points: SCORE_VALUES.perfectAnswerBonus });
  }

  let total = breakdown.reduce((sum, entry) => sum + entry.points, 0);

  if (ctx.isSteal) {
    total = Math.round(total * STEAL_MULTIPLIER);
    breakdown.push({ label: "Steal (80%)", points: total - breakdown.reduce((s, e) => s + e.points, 0) });
  }

  if (ctx.chaosRule === "double_points") {
    const extra = total;
    breakdown.push({ label: "Chaos: Double Points", points: extra });
    total *= 2;
  } else if (ctx.chaosRule === "reverse_scoring") {
    breakdown.push({ label: "Chaos: Reverse Scoring", points: -2 * total });
    total = -total;
  } else if (ctx.chaosRule === "mystery_bonus") {
    const mystery = [50, 100, 200, 300, 500][Math.floor(Math.random() * 5)];
    breakdown.push({ label: "Chaos: Mystery Bonus", points: mystery });
    total += mystery;
  }

  return { total, breakdown };
}

export function computeIncorrectPenalty(isSteal: boolean, stealPenalty: number): number {
  return isSteal ? -stealPenalty : -Math.round(stealPenalty * 0.5);
}

export function xpForGame(opts: { won: boolean; correctAnswers: number; perfectGame: boolean }): number {
  let xp = 20 + opts.correctAnswers * 5;
  if (opts.won) xp += 50;
  if (opts.perfectGame) xp += 100;
  return xp;
}

export function levelForXp(xp: number): number {
  // Gentle curve: level N requires N*250 cumulative XP more than the last.
  let level = 1;
  let remaining = xp;
  let requirement = 250;
  while (remaining >= requirement) {
    remaining -= requirement;
    level += 1;
    requirement += 250;
  }
  return level;
}
