import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import type {
  RoomSettings,
  RoomStatus,
  GameStatus,
  RoundStatus,
  AnswerCategory,
  SongSource,
  ConnectionStatus,
  RoomMessageKind,
  MatchHistoryPlayerSnapshot,
  MatchHistoryTimelineEvent,
} from "@/types/game";

/**
 * Drizzle schema for Neon Postgres — replaces the old Supabase-managed
 * schema (see supabase/migrations/0001_init.sql, kept in the repo only as
 * historical reference — it is NOT applied to Neon). See DECISIONS.md D-013
 * for the full list of differences from that version (Clerk-based
 * `profiles.id`, no RLS, dropped vestigial SQL fuzzy-match functions,
 * app-generated UUIDs instead of `gen_random_uuid()`).
 *
 * DELIBERATE NAMING CHOICE: every JS-side field name below is kept
 * snake_case, matching the Postgres column name exactly (e.g.
 * `avatar_emoji: text("avatar_emoji")`, not the more idiomatic Drizzle
 * convention of a camelCase JS key mapped to a snake_case column). This is
 * NOT an oversight — the entire pre-existing frontend (Zustand stores,
 * hooks, ~40 components) was written against `RoomPlayerRow`-shaped objects
 * with snake_case fields (`row.avatar_emoji`, `row.room_id`, `row.is_host`,
 * etc.), inherited from the original Supabase-generated-style types. Naming
 * columns this way makes `typeof table.$inferSelect` produce object shapes
 * that are structurally identical to the old hand-authored `*Row`
 * interfaces, so the migration from Supabase to Neon/Drizzle did not
 * require touching every frontend consumer's property access. Follow this
 * convention for any new column you add.
 */

const genId = () => crypto.randomUUID();

export const profiles = pgTable(
  "profiles",
  {
    id: text("id").primaryKey(), // Clerk user id (e.g. "user_2abc...")
    username: text("username").notNull().unique(),
    avatar_url: text("avatar_url"),
    avatar_emoji: text("avatar_emoji").notNull().default("🎧"),
    profile_border: text("profile_border").notNull().default("default"),
    title: text("title").notNull().default("Rookie Listener"),
    theme: text("theme").notNull().default("system"),
    background_key: text("background_key").notNull().default("neon"),
    custom_background_url: text("custom_background_url"),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    games_played: integer("games_played").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    total_points: bigint("total_points", { mode: "number" }).notNull().default(0),
    songs_guessed: integer("songs_guessed").notNull().default(0),
    correct_answers: integer("correct_answers").notNull().default(0),
    total_answers: integer("total_answers").notNull().default(0),
    fastest_buzz_ms: integer("fastest_buzz_ms"),
    longest_streak: integer("longest_streak").notNull().default(0),
    total_steals: integer("total_steals").notNull().default(0),
    albums_correct: integer("albums_correct").notNull().default(0),
    fastest_buzz_wins: integer("fastest_buzz_wins").notNull().default(0),
    game_win_streak: integer("game_win_streak").notNull().default(0),
    favorite_genre: text("favorite_genre"),
    career_level: integer("career_level").notNull().default(0),
    settings: jsonb("settings")
      .$type<{
        volume: { music: number; ui: number; effects: number };
        accessibility: { colorblind: boolean; highContrast: boolean; fontScale: number; reducedMotion: boolean };
      }>()
      .notNull()
      .default({
        volume: { music: 80, ui: 60, effects: 80 },
        accessibility: { colorblind: false, highContrast: false, fontScale: 1, reducedMotion: false },
      }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("profiles_xp_idx").on(t.xp), index("profiles_total_points_idx").on(t.total_points)]
);

export const achievements = pgTable("achievements", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("🏆"),
  xp_reward: integer("xp_reward").notNull().default(50),
});

export const profile_achievements = pgTable(
  "profile_achievements",
  {
    profile_id: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    achievement_key: text("achievement_key")
      .notNull()
      .references(() => achievements.key, { onDelete: "cascade" }),
    unlocked_at: timestamp("unlocked_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.profile_id, t.achievement_key] })]
);

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().$defaultFn(genId),
  owner_id: text("owner_id").references(() => profiles.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  source: text("source").$type<SongSource>().notNull(),
  genre: text("genre"),
  decade: text("decade"),
  mood: text("mood"),
  is_public: boolean("is_public").notNull().default(true),
  cover_url: text("cover_url"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const songs = pgTable(
  "songs",
  {
    id: uuid("id").primaryKey().$defaultFn(genId),
    playlist_id: uuid("playlist_id").references(() => playlists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    featured_artist: text("featured_artist"),
    album: text("album"),
    year: integer("year"),
    genre: text("genre"),
    duration_seconds: integer("duration_seconds"),
    youtube_video_id: text("youtube_video_id"),
    spotify_track_id: text("spotify_track_id"),
    preview_url: text("preview_url"),
    cover_url: text("cover_url"),
    chorus_lyrics: text("chorus_lyrics"),
    clip_start_seconds: integer("clip_start_seconds").notNull().default(30),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("songs_playlist_idx").on(t.playlist_id)]
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().$defaultFn(genId),
    code: text("code").notNull().unique(),
    host_id: text("host_id").references(() => profiles.id, { onDelete: "set null" }),
    name: text("name").notNull().default("Sound Clash Room"),
    is_public: boolean("is_public").notNull().default(false),
    status: text("status").$type<RoomStatus>().notNull().default("lobby"),
    settings: jsonb("settings").$type<RoomSettings>().notNull(),
    playlist_id: uuid("playlist_id").references(() => playlists.id, { onDelete: "set null" }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("rooms_code_idx").on(t.code)]
);

export const room_players = pgTable(
  "room_players",
  {
    id: uuid("id").primaryKey().$defaultFn(genId),
    room_id: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    profile_id: text("profile_id").references(() => profiles.id, { onDelete: "set null" }),
    guest_id: text("guest_id"),
    display_name: text("display_name").notNull(),
    avatar_emoji: text("avatar_emoji").notNull().default("🎧"),
    is_host: boolean("is_host").notNull().default(false),
    is_spectator: boolean("is_spectator").notNull().default(false),
    is_ready: boolean("is_ready").notNull().default(false),
    team: text("team"),
    score: integer("score").notNull().default(0),
    streak: integer("streak").notNull().default(0),
    connection_status: text("connection_status").$type<ConnectionStatus>().notNull().default("connected"),
    joined_at: timestamp("joined_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("room_players_unique_profile").on(t.room_id, t.profile_id),
    uniqueIndex("room_players_unique_guest").on(t.room_id, t.guest_id),
    index("room_players_room_idx").on(t.room_id),
  ]
);

export const games = pgTable("games", {
  id: uuid("id").primaryKey().$defaultFn(genId),
  room_id: uuid("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("classic"),
  settings: jsonb("settings").$type<RoomSettings>().notNull(),
  status: text("status").$type<GameStatus>().notNull().default("active"),
  song_order: uuid("song_order").array().notNull().default([]),
  paused: boolean("paused").notNull().default(false),
  started_at: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  ended_at: timestamp("ended_at", { withTimezone: true, mode: "string" }),
});

export const game_rounds = pgTable(
  "game_rounds",
  {
    id: uuid("id").primaryKey().$defaultFn(genId),
    game_id: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    song_id: uuid("song_id")
      .notNull()
      .references(() => songs.id),
    round_number: integer("round_number").notNull(),
    chaos_rule: text("chaos_rule"),
    started_at: timestamp("started_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    ended_at: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    status: text("status").$type<RoundStatus>().notNull().default("playing"),
    current_phase: integer("current_phase").notNull().default(1),
    phase_started_at: timestamp("phase_started_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    excluded_player_ids: uuid("excluded_player_ids").array().notNull().default([]),
    broadcast_payload: jsonb("broadcast_payload"),
    reveal_payload: jsonb("reveal_payload"),
    revealed_hints: jsonb("revealed_hints").notNull().default([]),
  },
  (t) => [index("game_rounds_game_idx").on(t.game_id)]
);

export const round_locks = pgTable(
  "round_locks",
  {
    round_id: uuid("round_id")
      .notNull()
      .references(() => game_rounds.id, { onDelete: "cascade" }),
    phase: integer("phase").notNull().default(1),
    player_id: uuid("player_id")
      .notNull()
      .references(() => room_players.id, { onDelete: "cascade" }),
    buzzed_at: timestamp("buzzed_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    client_latency_ms: integer("client_latency_ms").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.round_id, t.phase] })]
);

export const round_answers = pgTable(
  "round_answers",
  {
    id: uuid("id").primaryKey().$defaultFn(genId),
    round_id: uuid("round_id")
      .notNull()
      .references(() => game_rounds.id, { onDelete: "cascade" }),
    game_id: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    player_id: uuid("player_id")
      .notNull()
      .references(() => room_players.id, { onDelete: "cascade" }),
    phase: integer("phase").notNull().default(1),
    category: text("category").$type<AnswerCategory>().notNull(),
    guess: text("guess").notNull(),
    correct: boolean("correct").notNull(),
    points: integer("points").notNull().default(0),
    answered_at: timestamp("answered_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("round_answers_round_idx").on(t.round_id), index("round_answers_game_idx").on(t.game_id)]
);

export const match_history = pgTable(
  "match_history",
  {
    id: uuid("id").primaryKey().$defaultFn(genId),
    game_id: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    room_id: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    players: jsonb("players").$type<MatchHistoryPlayerSnapshot[]>().notNull(),
    winner_profile_id: text("winner_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    round_count: integer("round_count").notNull(),
    duration_seconds: integer("duration_seconds").notNull(),
    timeline: jsonb("timeline").$type<MatchHistoryTimelineEvent[]>().notNull().default([]),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("match_history_created_idx").on(t.created_at)]
);

export const room_messages = pgTable(
  "room_messages",
  {
    id: uuid("id").primaryKey().$defaultFn(genId),
    room_id: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    player_id: uuid("player_id").references(() => room_players.id, { onDelete: "set null" }),
    display_name: text("display_name").notNull(),
    kind: text("kind").$type<RoomMessageKind>().notNull(),
    body: text("body").notNull(),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  },
  (t) => [index("room_messages_room_idx").on(t.room_id, t.created_at)]
);

export type ProfileRow = typeof profiles.$inferSelect;
export type AchievementRow = typeof achievements.$inferSelect;
export type PlaylistRow = typeof playlists.$inferSelect;
export type SongRow = typeof songs.$inferSelect;
export type RoomRow = typeof rooms.$inferSelect;
export type RoomPlayerRow = typeof room_players.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type GameRoundRow = typeof game_rounds.$inferSelect;
export type RoundLockRow = typeof round_locks.$inferSelect;
export type RoundAnswerRow = typeof round_answers.$inferSelect;
export type MatchHistoryRow = typeof match_history.$inferSelect;
export type RoomMessageRow = typeof room_messages.$inferSelect;
