import type { AnswerCategory, GameModeKey, RoomSettings } from "@/types/database";

// ----------------------------------------------------------------------------
// Realtime channel contract
//
// Sound Clash uses Supabase Realtime (Postgres-backed WebSockets) as the
// "Socket.io equivalent" — it's the natural fit for a free-tier Vercel
// deployment because it needs no standalone long-lived server process.
//
// Two channel namespaces:
//   `room:{roomId}`  — lobby presence/chat/reactions, alive from join to close
//   `game:{gameId}`  — round lifecycle broadcast, alive only during play
//
// Scoring/lock arbitration authority: always the Next.js API routes (using
// the service-role client), never the browser — see round_locks/round_answers
// in the SQL schema. Round *pacing* (when a timer expires, when to advance to
// the next round) is driven by the host's client calling the advance API,
// since a serverless deployment has no always-on process to own a wall clock.
// If the host disconnects, host status transfers to the next-longest-joined
// connected player so the game can keep moving.
// ----------------------------------------------------------------------------

export type RoomBroadcastEvent =
  | { type: "player_joined"; player: RoomPlayerSnapshot }
  | { type: "player_left"; playerId: string }
  | { type: "player_updated"; player: RoomPlayerSnapshot }
  | { type: "host_transferred"; newHostId: string }
  | { type: "settings_updated"; settings: RoomSettings }
  | { type: "chat_message"; message: ChatMessage }
  | { type: "typing"; playerId: string; isTyping: boolean }
  | { type: "reaction"; playerId: string; emoji: string }
  | { type: "game_started"; gameId: string };

export type GameBroadcastEvent =
  | { type: "round_started"; round: RoundBroadcastPayload }
  | { type: "hint_revealed"; roundId: string; hint: RevealedHint }
  | { type: "buzz_locked"; roundId: string; phase: number; playerId: string; displayName: string }
  | {
      type: "answer_resolved";
      roundId: string;
      phase: number;
      playerId: string;
      correct: boolean;
      pointsAwarded: number;
      breakdown: ScoreBreakdownEntry[];
      scoreboard: { playerId: string; score: number }[];
    }
  | { type: "steal_round_started"; roundId: string; phase: number }
  | { type: "round_resolved"; roundId: string; song: RoundRevealPayload; scoreboard: { playerId: string; score: number }[] }
  | { type: "chaos_rule_applied"; roundId: string; rule: ChaosRuleKey; label: string }
  | { type: "game_paused" }
  | { type: "game_resumed" }
  | { type: "game_ended"; matchHistoryId: string };

export interface ChatMessage {
  id: string;
  playerId: string;
  displayName: string;
  body: string;
  sentAt: string;
}

export interface RoomPlayerSnapshot {
  id: string;
  profileId: string | null;
  displayName: string;
  avatarEmoji: string;
  isHost: boolean;
  isSpectator: boolean;
  isReady: boolean;
  isAI: boolean;
  team: string | null;
  score: number;
  streak: number;
  connectionStatus: "connected" | "disconnected" | "kicked" | "banned";
  ping?: number;
}

export interface RoundBroadcastPayload {
  roundId: string;
  roundNumber: number;
  totalRounds: number;
  categories: AnswerCategory[];
  timerSeconds: number;
  serverStartedAt: string; // ISO timestamp — clients compute playback offset from this
  clipStartSeconds: number;
  clipDurationSeconds: number;
  youtubeVideoId: string | null;
  spotifyPreviewUrl: string | null;
  coverUrlBlurred: string | null;
  mode: GameModeKey;
}

export interface RevealedHint {
  kind:
    | "first_letter"
    | "last_letter"
    | "year"
    | "genre"
    | "duration"
    | "cover_blur"
    | "random_letters"
    | "artist_silhouette"
    | "word_count";
  value: string;
}

export interface ScoreBreakdownEntry {
  label: string;
  points: number;
}

export interface RoundRevealPayload {
  title: string;
  artist: string;
  featuredArtist: string | null;
  album: string | null;
  year: number | null;
  coverUrl: string | null;
}

export type ChaosRuleKey =
  | "double_points"
  | "no_buzz"
  | "hidden_leaderboard"
  | "reverse_scoring"
  | "mystery_bonus";

export const CHAOS_RULES: Record<ChaosRuleKey, string> = {
  double_points: "Double Points",
  no_buzz: "No Buzz — everyone answers blind",
  hidden_leaderboard: "Hidden Leaderboard",
  reverse_scoring: "Reverse Scoring",
  mystery_bonus: "Mystery Bonus",
};

export const SCORE_VALUES = {
  title: 500,
  artist: 250,
  featured_artist: 150,
  album: 200,
  chorus: 300,
  perfectAnswerBonus: 250,
  fastestBuzzBonus: 150,
  firstTryBonus: 100,
  noHintBonus: 100,
} as const;

export const STEAL_MULTIPLIER = 0.8;

export const GAME_MODE_LABELS: Record<GameModeKey, string> = {
  classic: "Classic",
  speed_round: "Speed Round",
  artist_rush: "Artist Rush",
  album_rush: "Album Rush",
  chorus_challenge: "Chorus Challenge",
  instrumental: "Instrumental Mode",
  reverse_intro: "Reverse Intro",
  one_second: "One Second Challenge",
  hard_mode: "Hard Mode",
  sudden_death: "Sudden Death",
  team_battle: "Team Battle",
  chaos: "Chaos Mode",
};

export type LeaderboardType = "xp" | "total_points" | "wins" | "fastest_buzz" | "steals" | "streak";

export const LEADERBOARD_LABELS: Record<LeaderboardType, string> = {
  xp: "Top XP",
  total_points: "Highest Score",
  wins: "Most Wins",
  fastest_buzz: "Fastest Buzz",
  steals: "Most Steals",
  streak: "Longest Streak",
};

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_emoji: string;
  title: string;
  level: number;
  xp: number;
  total_points: number;
  wins: number;
  games_played: number;
  fastest_buzz_ms: number | null;
  total_steals: number;
  longest_streak: number;
}
