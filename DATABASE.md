# Database

- **Provider:** Neon (serverless Postgres).
- **Schema source of truth:** `src/lib/db/schema.ts` (Drizzle ORM table definitions, ~330 lines). **This replaces `supabase/migrations/0001_init.sql`**, which is kept in the repo only as historical reference for the original RLS-design reasoning — it is not applied anywhere and no longer reflects the live schema shape.
- **Seed data:** `scripts/seed.ts` (run via `npm run db:seed`) — one demo playlist, 8 songs with real, web-search-verified YouTube video IDs, plus the 9-entry achievement catalog. `chorus_lyrics` intentionally left `null` (no copyrighted lyric text bundled with the repo). Replaces the old `supabase/seed.sql`.
- **Status: never applied to any live database.** No Neon project has been provisioned in this environment, and `npm run db:push` has never been run. Everything below describes the schema *as written* in `schema.ts`, not as verified against a running Postgres instance.
- **Migration tooling:** `drizzle-kit`, configured via `drizzle.config.ts` (points at `src/lib/db/schema.ts`, dialect `postgresql`, credentials from `DATABASE_URL`). No migration files exist under `./drizzle` — the project uses `db:push` (direct schema sync) rather than versioned migrations, appropriate for a project with no live users yet. Switch to `drizzle-kit generate` + tracked migration files before this ever has real production data.

## Entity-relationship diagram

```mermaid
erDiagram
    PROFILES ||--o{ ROOM_PLAYERS : "may back"
    PROFILES ||--o{ PROFILE_ACHIEVEMENTS : unlocks
    ACHIEVEMENTS ||--o{ PROFILE_ACHIEVEMENTS : "unlocked via"
    PROFILES ||--o{ PLAYLISTS : owns
    PLAYLISTS ||--o{ SONGS : contains
    ROOMS ||--o{ ROOM_PLAYERS : seats
    ROOMS ||--o{ ROOM_MESSAGES : has
    ROOMS ||--o{ GAMES : hosts
    ROOMS }o--|| PLAYLISTS : "plays from (nullable)"
    GAMES ||--o{ GAME_ROUNDS : contains
    GAME_ROUNDS }o--|| SONGS : "asks about"
    GAME_ROUNDS ||--o{ ROUND_LOCKS : "buzz race per phase"
    GAME_ROUNDS ||--o{ ROUND_ANSWERS : "submitted guesses"
    ROOM_PLAYERS ||--o{ ROUND_LOCKS : "holds (per phase)"
    ROOM_PLAYERS ||--o{ ROUND_ANSWERS : submits
    GAMES ||--o| MATCH_HISTORY : "produces on finish"
    ROOMS ||--o{ MATCH_HISTORY : "produces on finish"

    PROFILES {
        text id PK "= Clerk user id, NOT a uuid"
        text username UK
        int xp
        int level
        int games_played
        int wins
        int total_points
        int fastest_buzz_ms "nullable"
        int longest_streak
        int total_steals
        int albums_correct
        int fastest_buzz_wins
        int game_win_streak
        jsonb settings "volume + accessibility, unsynced with client localStorage store"
    }
    ACHIEVEMENTS {
        text key PK
        text name
        int xp_reward
    }
    PLAYLISTS {
        uuid id PK
        text owner_id FK "nullable, -> profiles.id"
        text source "youtube|spotify|mixed"
        bool is_public
    }
    SONGS {
        uuid id PK
        uuid playlist_id FK "nullable"
        text title
        text artist
        text featured_artist "nullable"
        text album "nullable"
        int year
        text youtube_video_id "nullable"
        text spotify_track_id "nullable"
        text chorus_lyrics "nullable"
        int clip_start_seconds
    }
    ROOMS {
        uuid id PK
        text code UK "5-char join code"
        text host_id FK "nullable, -> profiles.id"
        text status "lobby|playing|finished"
        jsonb settings "RoomSettings"
        uuid playlist_id FK "nullable"
    }
    ROOM_PLAYERS {
        uuid id PK
        uuid room_id FK
        text profile_id FK "nullable, XOR guest_id"
        text guest_id "nullable, XOR profile_id"
        bool is_host
        bool is_spectator
        int score
        int streak
        text connection_status "connected|disconnected|kicked|banned"
    }
    ROOM_MESSAGES {
        uuid id PK
        uuid room_id FK
        uuid player_id FK "nullable"
        text kind "chat|reaction|system"
    }
    GAMES {
        uuid id PK
        uuid room_id FK
        text mode
        jsonb settings "RoomSettings snapshot"
        uuid song_order_arr "array, locked in at start"
        bool paused
        text status "active|finished"
    }
    GAME_ROUNDS {
        uuid id PK
        uuid game_id FK
        uuid song_id FK
        int round_number
        text status "playing|steal|resolved|skipped"
        int current_phase "buzz-phase pointer"
        timestamptz phase_started_at "server-authoritative timer resume"
        uuid excluded_player_ids_arr
        jsonb broadcast_payload "sanitized, no answers"
        jsonb reveal_payload "answers, post-resolve only"
        jsonb revealed_hints
    }
    ROUND_LOCKS {
        uuid round_id PK_FK
        int phase PK
        uuid player_id FK
        timestamptz buzzed_at
    }
    ROUND_ANSWERS {
        uuid id PK
        uuid round_id FK
        uuid game_id FK
        uuid player_id FK
        text category "title|artist|featured_artist|album|chorus"
        text guess
        bool correct
        int points
    }
    MATCH_HISTORY {
        uuid id PK
        uuid game_id FK
        uuid room_id FK
        text winner_profile_id FK "nullable"
        jsonb players "MatchHistoryPlayerSnapshot[]"
        jsonb timeline "MatchHistoryTimelineEvent[]"
    }
```

## Tables — field/constraint notes not obvious from the diagram

- **`profiles.id` is `text`, not `uuid`** — it holds a Clerk user id (e.g. `user_2abc...`), not a database-generated UUID. This is the single most structurally significant change from the Supabase schema (where `profiles.id` mirrored `auth.users.id`, a uuid). Every foreign key pointing at `profiles.id` (`rooms.host_id`, `room_players.profile_id`, `playlists.owner_id`, `match_history.winner_profile_id`, `profile_achievements.profile_id`) is therefore also `text`, not `uuid` — a mixed-type schema by design, not an oversight.
- **`profiles` rows are created by a Clerk webhook, not a database trigger.** `src/app/api/webhooks/clerk/route.ts` handles `user.created` and inserts the row, deriving a unique username the same way the old `handle_new_user()` Postgres trigger did (de-duplicated with a numeric suffix loop). **If the Clerk Dashboard webhook endpoint isn't configured, no `profiles` row is ever created for a new sign-up** — there is no database-level fallback anymore. This is a real, unverified dependency: the webhook has never fired in this environment.
- **`profiles.settings` jsonb** has a default shape for volume/accessibility that mirrors (but is independent of) the client-side `useSettingsStore` — **these two are not synced by any code**; a signed-in user's `profiles.settings` and their browser's `localStorage` settings-store can drift.
- **`room_players`'s profile_id XOR guest_id invariant is application-enforced, not a database CHECK constraint** — this is a real regression in strictness from the old Supabase schema (which had `constraint room_players_identity check (profile_id is not null or guest_id is not null)`). `src/lib/db/schema.ts` does not currently declare an equivalent check constraint. Every write path (`join/route.ts`) sets exactly one of the two, but nothing in the schema itself would reject a row violating this if a future code path got it wrong. Worth adding a Postgres `CHECK` constraint back via a raw SQL migration if this is a concern — Drizzle supports `check()` in the table builder, it just wasn't ported over during the migration.
- **`games.song_order`** is a `uuid[]` chosen once at `POST /api/rooms/[code]/start` (shuffled from the room's `playlist_id`'s songs, repeating via modulo if the playlist has fewer songs than the requested `songCount`).
- **`game_rounds.current_phase`** is the authoritative pointer the buzz endpoint reads to know which `round_locks` row to race for. Only the answer/timeout endpoints ever increment it.
- **`game_rounds.excluded_player_ids`** accumulates players who've already answered incorrectly this round, so they can't buzz again during subsequent steal phases of the *same* round.
- **`round_locks` primary key `(round_id, phase)`** is the entire anti-cheat/anti-race mechanism, enforced via Drizzle's `.onConflictDoNothing({ target: [round_locks.round_id, round_locks.phase] })` in the buzz route — see `ARCHITECTURE.md` and `SECURITY.md`. Do not change this to a non-unique-constrained shape.
- **`match_history.players`/`.timeline`** are denormalized JSON snapshots (typed as `MatchHistoryPlayerSnapshot[]`/`MatchHistoryTimelineEvent[]` in `src/types/game.ts`), populated once by `src/lib/game/end-game.ts` at game end.
- **All `timestamp` columns use `mode: "string"`** (ISO strings, not JS `Date` objects) — see `CLAUDE.md`'s "Coding conventions" for why this is load-bearing.
- **All UUID primary keys are app-generated** via `crypto.randomUUID()` (`$defaultFn(genId)` in `schema.ts`), not Postgres's `gen_random_uuid()` — avoids needing the `pgcrypto` extension enabled on the Neon project.

## Answer-fuzzy-matching

`src/lib/scoring/fuzzy-match.ts` is a pure TypeScript implementation (Levenshtein-based similarity) — this is unchanged by the migration and remains the only implementation; there is no Postgres-side equivalent anymore (the old `normalize_answer()`/`fuzzy_match()` SQL functions from `0001_init.sql` were never called by application code even before this migration — see `DECISIONS.md` D-005 — and do not exist in the new schema at all).

## Authorization — no RLS, no database-level defense layer

**This is the biggest structural change from the Supabase-era design.** Neon has no Row Level Security concept exercised here, and no anon/service-role key split — there is a single trusted server-side Drizzle connection (`src/lib/db/client.ts`), and **every table is fully reachable by any code that imports `db`.**

| Under Supabase (superseded) | Under Neon (current) |
|---|---|
| `songs` had no public RLS SELECT policy — answer secrecy was database-enforced. | Answer secrecy is **entirely** enforced by API-route discipline: no route may ever return a raw `songs` row to the browser before a round resolves. There is nothing in the database itself stopping a bug from leaking one. |
| Most write policies were permissive (`using (true)`), with the real authorization boundary in API routes anyway (`DECISIONS.md` D-002). | Same real authorization boundary (API routes checking `is_host`/lock ownership), now with no RLS backstop at all — functionally the same *practical* security posture as before, but the "RLS is a second line of defense" framing from D-002 no longer applies; there is no second line. |

See `SECURITY.md` for the full implication of this and `DECISIONS.md` D-013 for the migration's reasoning.

## Realtime — no database-level publication, explicit per-route publish calls

There is no Postgres-level realtime publication anymore (Ably has no CDC/WAL-based equivalent to Supabase's Postgres Changes). Every mutating route explicitly calls `publish(channelName, eventName, payload)` from `src/lib/ably/publish.ts` after a successful write. See `ARCHITECTURE.md`/`CLAUDE.md` for the full event-name contract. **A table having no corresponding `publish()` call anywhere means changes to it are invisible to connected clients in real time** (currently true for `profiles`, `playlists`, `songs`, `achievements`, `profile_achievements`, `match_history` — consistent with the old Supabase-era publication list, which also excluded these).

## Migration risks / known inconsistencies (unverified against a live Neon DB)

1. **Never executed** — `npm run db:push` has never been run against a real Neon project. Column types, defaults, and foreign key ordering are believed correct on read-through but unverified.
2. **The `profile_id`/`guest_id` XOR invariant has no database-level enforcement** (see above) — a real (if currently theoretical) regression from the Supabase schema.
3. **The Clerk webhook has never fired** — `profiles` row auto-creation on sign-up is unverified end to end (webhook signature verification, username de-duplication loop, `onConflictDoNothing` insert).
4. `games.song_order` uses modulo-wraparound (`shuffled[i % shuffled.length]`) when a playlist has fewer songs than the requested `songCount` — a short playlist will repeat songs within one game. Intentional-by-necessity, unchanged from before the migration.

## Ownership / deletion behavior

Nearly everything cascades from `rooms`/`games` (`onDelete: "cascade"` in `schema.ts`) — deleting a room deletes its players, messages, games, rounds, locks, answers. `match_history` also cascades from `games`, meaning deleting a room after a game finishes would delete its own match history — no cleanup/expiry job exists, rooms currently live forever with no retention policy. Unchanged from the Supabase-era design.

## Storage buckets

None configured, same as before the migration — no file/blob storage of any kind is used anywhere (avatars are emoji strings; custom background upload stores a `localStorage` data URL client-side, see `DECISIONS.md` D-012, unaffected by this migration since it never touched the database).

## Sensitive data

No PII beyond whatever Clerk stores on its own side (email, name) — the local `profiles` table only stores a Clerk user id (opaque string) and a derived username, no email/PII duplicated locally. No payment data, no addresses. `DATABASE_URL` (full read/write Postgres access) is now the single most sensitive credential in the system, replacing `SUPABASE_SERVICE_ROLE_KEY` — see `SECURITY.md`.
