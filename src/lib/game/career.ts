import type { AIDifficulty } from "@/types/database";

export const CAREER_TOTAL_OPPONENTS = 20;

export interface CareerOpponent {
  level: number;
  name: string;
  avatar: string;
  difficulty: AIDifficulty;
}

/**
 * 20 fixed opponents for Career Mode, roughly ramping in difficulty —
 * flavor names/avatars only; the actual buzz-speed/accuracy behavior still
 * comes from the same three `AIDifficulty` tiers the ad-hoc "Play vs AI"
 * toggle uses (see lib/game/ai-bot.ts), just bucketed across the ladder
 * (1-7 easy, 8-14 medium, 15-20 hard) rather than inventing a fourth tuning
 * system for one game mode.
 */
export const CAREER_OPPONENTS: CareerOpponent[] = [
  { level: 1, name: "Rookie Riff", avatar: "🎵", difficulty: "easy" },
  { level: 2, name: "Karaoke Kyle", avatar: "🎤", difficulty: "easy" },
  { level: 3, name: "Radio Rita", avatar: "📻", difficulty: "easy" },
  { level: 4, name: "Playlist Pete", avatar: "🎧", difficulty: "easy" },
  { level: 5, name: "Chorus Chloe", avatar: "🎶", difficulty: "easy" },
  { level: 6, name: "Vinyl Vic", avatar: "💿", difficulty: "easy" },
  { level: 7, name: "Hook Hana", avatar: "🪝", difficulty: "easy" },
  { level: 8, name: "Bassline Bea", avatar: "🎸", difficulty: "medium" },
  { level: 9, name: "Tempo Theo", avatar: "🥁", difficulty: "medium" },
  { level: 10, name: "Melody Max", avatar: "🎹", difficulty: "medium" },
  { level: 11, name: "Harmony Hugo", avatar: "🎻", difficulty: "medium" },
  { level: 12, name: "Remix Rae", avatar: "🎛️", difficulty: "medium" },
  { level: 13, name: "Setlist Sam", avatar: "🎷", difficulty: "medium" },
  { level: 14, name: "Encore Eve", avatar: "🎺", difficulty: "medium" },
  { level: 15, name: "Billboard Bex", avatar: "📈", difficulty: "hard" },
  { level: 16, name: "Platinum Priya", avatar: "🏆", difficulty: "hard" },
  { level: 17, name: "Discography Drew", avatar: "📀", difficulty: "hard" },
  { level: 18, name: "Perfect Pitch Piper", avatar: "🎯", difficulty: "hard" },
  { level: 19, name: "Encyclopedia Ez", avatar: "📚", difficulty: "hard" },
  { level: 20, name: "Clash Bot Prime", avatar: "👑", difficulty: "hard" },
];

export function careerOpponentForLevel(level: number): CareerOpponent {
  return CAREER_OPPONENTS[Math.min(Math.max(level, 1), CAREER_TOTAL_OPPONENTS) - 1]!;
}
