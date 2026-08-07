// Pure domain types with no database-client dependency — safe to import from
// both server and client code, and from src/lib/db/schema.ts itself (which
// is why these live in a separate file rather than types/database.ts).

export type ConnectionStatus = "connected" | "disconnected" | "kicked" | "banned";
export type RoomStatus = "lobby" | "playing" | "finished";
export type GameStatus = "active" | "finished" | "aborted";
export type RoundStatus = "playing" | "steal" | "resolved" | "skipped";
export type AnswerCategory = "title" | "artist" | "featured_artist" | "album" | "chorus";
export type SongSource = "youtube" | "spotify" | "mixed";
export type RoomMessageKind = "chat" | "reaction" | "system";

export type GameModeKey =
  | "classic"
  | "speed_round"
  | "artist_rush"
  | "album_rush"
  | "chorus_challenge"
  | "instrumental"
  | "reverse_intro"
  | "one_second"
  | "hard_mode"
  | "sudden_death"
  | "team_battle"
  | "chaos";

export type AIDifficulty = "easy" | "medium" | "hard";

export interface RoomSettings {
  songCount: 10 | 20 | 30 | 50 | 100;
  source: SongSource;
  mode: GameModeKey;
  timerSeconds: number;
  hintsEnabled: boolean;
  hintTypes: string[];
  categories: AnswerCategory[];
  teamSize?: 2 | 3 | 4;
  stealEnabled: boolean;
  stealPenalty: number;
  aiDifficulty: AIDifficulty;
  /** Set only for a Career Mode battle — which of the 20 fixed opponents this room's game is against. Drives `finishGame()`'s career-level advancement. */
  careerLevel?: number;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  songCount: 20,
  source: "youtube",
  mode: "classic",
  timerSeconds: 10,
  hintsEnabled: true,
  hintTypes: ["first_letter", "year", "genre"],
  categories: ["title", "artist"],
  stealEnabled: true,
  stealPenalty: 100,
  aiDifficulty: "medium",
};

export interface MatchHistoryPlayerSnapshot {
  playerId: string;
  profileId: string | null;
  displayName: string;
  avatarEmoji: string;
  finalScore: number;
  accuracy: number;
  steals: number;
  fastestBuzzMs: number | null;
  placement: number;
}

export interface MatchHistoryTimelineEvent {
  roundNumber: number;
  songTitle: string;
  songArtist: string;
  buzzWinner: string | null;
  correct: boolean | null;
  pointsAwarded: number;
  wasSteal: boolean;
}
