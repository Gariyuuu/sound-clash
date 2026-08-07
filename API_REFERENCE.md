# API Reference

All routes are Next.js App Router route handlers under `src/app/api/`, using
the singleton Drizzle client (`db` from `src/lib/db/client.ts`) unless noted.
As of 2026-08-06 the backend runs on Neon + Drizzle + Clerk + Ably, not
Supabase — see `DECISIONS.md` D-013. None of these have been exercised
against a live database — documented from reading the source, not from
observed responses. All request/response
shapes below match `src/lib/api-client.ts`'s typed wrappers, which is the
canonical contract the frontend actually uses.

Every mutating route does its own authorization check (see `ARCHITECTURE.md`
→ "Backend structure") — there is no shared middleware/guard; each file
repeats the same pattern of "look up requester's `room_players` row, check a
permission field."

Rate limiting: `src/lib/rate-limit.ts`, in-memory, keyed by `x-forwarded-for`
IP + a per-route suffix. Applied to: room creation, room join, chat/reaction
messages, buzz, answer submission, YouTube playlist import. **Not** applied
to: settings updates, kick, start, control, hint, timeout, next-round, or any
GET route.

---

## Rooms

### `POST /api/rooms`
Create a room. **File:** `src/app/api/rooms/route.ts`
- **Auth:** none — anyone (guest or authed) can create a room.
- **Rate limit:** 10 / 60s per IP.
- **Body:** `{ hostDisplayName: string, hostAvatarEmoji: string, hostProfileId?: string, hostGuestId?: string, isPublic?: boolean, roomName?: string, playlistId?: string, settings?: Partial<RoomSettings> }`
- **Response:** `{ room: RoomRow, player: RoomPlayerRow }`
- **Side effects:** generates a unique 5-char code (`lib/game/room-code.ts`, retries up to 5x on collision), inserts `rooms` + a `room_players` row with `is_host: true`. If the player insert fails, the room row is deleted (best-effort cleanup).
- **Errors:** 400 missing identity, 429 rate limited, 500 DB error.

### `GET /api/rooms`
List public lobby-status rooms. **File:** same file, `GET` export.
- **Query:** `?limit=20` (default 20).
- **Response:** `{ rooms: (RoomRow & { room_players: { count: number }[] })[] }` — filtered to `is_public = true AND status = 'lobby'`. As of the fourth session, includes a live player count per room via an embedded `room_players(count)` select.
- **Called by:** `src/app/browse/page.tsx` (new).

### `GET /api/rooms/[code]`
Fetch a room + its non-banned players. **File:** `src/app/api/rooms/[code]/route.ts`
- **Response:** `{ room: RoomRow, players: RoomPlayerRow[] }` or 404.

### `POST /api/rooms/[code]/join`
Join (or rejoin) a room. **File:** `.../[code]/join/route.ts`
- **Rate limit:** 20 / 60s per IP.
- **Body:** `{ displayName, avatarEmoji, profileId?, guestId?, isSpectator? }`
- **Response:** `{ room: RoomRow, player: RoomPlayerRow }`
- **Behavior:** if a `room_players` row already exists for this `profile_id`/`guest_id` in this room (rejoin case), it's marked `connected` and returned as-is rather than duplicated. Banned players get 403. If the room isn't in `lobby` status and the joiner isn't requesting spectator mode, returns 409 (client is expected to retry with `isSpectator: true`). Enforces the 20-player cap (spectators excluded from the count). Inserts a `room_messages` "joined the room" system message on a genuinely new join.

### `POST /api/rooms/[code]/leave`
Mark a player disconnected; promote a new host if needed. **File:** `.../[code]/leave/route.ts`
- **Body:** `{ playerId }`
- **Response:** `{ success: true }`
- **Behavior:** sets `connection_status = 'disconnected'`. If the leaving player was host, promotes the longest-connected other active player to host (updates `room_players.is_host` on both rows and `rooms.host_id`), and posts a system chat message. **Does not** re-arm any in-progress round timer for the new host — see `ARCHITECTURE.md` known gap.
- **Called via:** `navigator.sendBeacon` on the browser's `beforeunload` event (`room-client.tsx`), so this is best-effort and not guaranteed to fire (e.g., a crashed tab or lost network won't trigger it).

### `POST /api/rooms/[code]/kick`
Host removes a player. **File:** `.../[code]/kick/route.ts`
- **Body:** `{ requesterPlayerId, targetPlayerId, ban?: boolean }`
- **Response:** `{ player: RoomPlayerRow }` (updated row, `connection_status` set to `kicked` or `banned`)
- **Authorization:** requester must be `is_host`; can't target self.

### `POST /api/rooms/[code]/settings`
Host updates game settings pre-game. **File:** `.../[code]/settings/route.ts`
- **Body:** `{ requesterPlayerId, settings: RoomSettings, roomName?, isPublic?, playlistId? }`
- **Response:** `{ room: RoomRow }`
- **Authorization:** requester must be `is_host`. **Only allowed while `room.status === 'lobby'`** (409 otherwise).

### `POST /api/rooms/[code]/team`
Host assigns a player to a team, for Team Battle mode. **File:** `.../[code]/team/route.ts` (new)
- **Body:** `{ requesterPlayerId, targetPlayerId, team: string | null }` (team is a free-form string, `PlayerList` uses `"A"`/`"B"`)
- **Response:** `{ player: RoomPlayerRow }`
- **Authorization:** requester must be `is_host`. **Only allowed while `room.status === 'lobby'`** (409 otherwise).
- **Note:** teams are purely a `room_players.team` string match — the answer route pools points across every `room_players` row in the same room with the same non-null `team` value when a correct answer is scored in `team_battle` mode.

### `POST /api/rooms/[code]/ready`
Any player toggles their own ready status. **File:** `.../[code]/ready/route.ts` (new)
- **Body:** `{ playerId, isReady: boolean }`
- **Response:** `{ player: RoomPlayerRow }`
- **Authorization:** none beyond "the row exists in this room" — ready status isn't security-sensitive, unlike host-only actions.

### `POST /api/rooms/[code]/start`
Host starts the game. **File:** `.../[code]/start/route.ts`
- **Body:** `{ requesterPlayerId }`
- **Response:** `{ game: GameRow, round: GameRoundRow }`
- **Preconditions checked:** host-only, room must be `lobby`, a `playlist_id` must be set on the room, at least 2 connected non-spectator players, the playlist must have ≥1 song.
- **Side effects:** shuffles the playlist's songs into `games.song_order` (length = `settings.songCount`, repeating via modulo if the playlist is shorter), sets `rooms.status = 'playing'`, resets everyone's `score`/`streak` to 0, creates round 1 via `lib/game/round-service.ts`'s `createRoundForGame`.

### `POST /api/rooms/[code]/control`
Host pause/resume/skip. **File:** `.../[code]/control/route.ts`
- **Body:** `{ requesterPlayerId, action: "pause" | "resume" | "skip" }`
- **Response:** `{ paused: boolean }` (pause/resume) or `{ skipped: true }` (skip)
- **Authorization:** host-only, requires an `active`-status game to exist for the room.
- **Skip behavior:** force-resolves the current live round with no winner, populating `reveal_payload` so the answer is shown.
- **Note:** there is no `"restart"` action despite the original spec listing host restart controls — not implemented.

### `GET /api/rooms/[code]/game`
Fetch the room's most recent game + its latest round (for page load / refresh recovery). **File:** `.../[code]/game/route.ts`
- **Response:** `{ game: GameRow | null, round: GameRoundRow | null, matchHistoryId: string | null }` — `matchHistoryId` is populated only if `game.status === 'finished'`.
- **Note:** there is no corresponding `GET /api/match-history/[id]` route to actually fetch the match history row's contents — a results/replay page would need that route built (see `TASKS.md`).

### `POST /api/rooms/[code]/messages`
Send a chat message or emoji reaction. **File:** `.../[code]/messages/route.ts`
- **Rate limit:** 20 / 10s per IP.
- **Body:** `{ playerId, displayName, kind: "chat" | "reaction", body: string }` (max 280 chars)
- **Response:** `{ success: true }`

---

## Rounds

### `POST /api/rounds/[roundId]/buzz`
Race to lock the buzzer. **File:** `.../rounds/[roundId]/buzz/route.ts`
- **Rate limit:** 30 / 10s per IP.
- **Body:** `{ playerId, clientLatencyMs? }`
- **Response (won):** `{ locked: true, phase: number, displayName: string }`
- **Response (lost):** `{ locked: false, holderId: string | null }` or `{ locked: false, reason: "round_over" | "excluded" }`
- **Mechanism:** atomic `upsert` into `round_locks` on `(round_id, phase)` with `ignoreDuplicates: true` — see `ARCHITECTURE.md`/`DATABASE.md` for why this is race-safe. Excluded players (already answered wrong this round) get 403.

### `POST /api/rounds/[roundId]/answer`
Submit an answer while holding the buzzer. **File:** `.../rounds/[roundId]/answer/route.ts`
- **Rate limit:** 15 / 10s per IP.
- **Body:** `{ playerId, answers: Partial<Record<AnswerCategory, string>>, usedHint: boolean }`
- **Response (correct):** `{ correct: true, total: number, breakdown: {label, points}[], scoreboard: {playerId, score}[] }`
- **Response (incorrect):** `{ correct: false, penalty: number, roundOver: boolean, nextPhase?: number, reveal?: RoundRevealPayload }`
- **Authorization:** caller must currently hold the `round_locks` row for `game_rounds.current_phase` — re-checked server-side every time, never trusted from the client.
- **Scoring:** per requested category (`title`/`artist`/`featured_artist`/`album`/`chorus`), fuzzy-matched via `lib/scoring/fuzzy-match.ts` (JS, not the SQL `fuzzy_match` function) against the real `songs` row (fetched server-side only). Point math for all correct categories in one submission is computed by `lib/scoring/engine.ts`'s `computeScore()` (bonuses: fastest buzz, first try, no hint, perfect answer; steal answers get ×0.8; Chaos Mode's double-points/reverse-scoring/mystery-bonus modifiers now apply here too — see `DECISIONS.md` D-007, this used to be a separate inline reimplementation that skipped Chaos modifiers). Wrong answers apply a penalty (`computeIncorrectPenalty`) and either open a new steal phase or resolve the round unsolved if no eligible players remain.
- **Side effects on correct:** updates `room_players.score`/`.streak`, sets `game_rounds.status = 'resolved'` with `reveal_payload` populated. **Team Battle:** if `settings.mode === "team_battle"` and the answerer has a `team` set, the same point total is also added to every other `room_players` row in the room with a matching `team` (wrong-answer penalties stay individual — see the code comment in the route for why).
- **Steal-phase transition:** when an answer opens a new steal phase (`current_phase + 1`), the route also sets `game_rounds.phase_started_at = now()` — the server-authoritative timestamp a reconnecting client or newly-promoted host uses to resume the correct countdown instead of restarting one (see `ARCHITECTURE.md`, `DECISIONS.md` D-003).
- **Sudden Death mode:** a wrong answer flips the player's `room_players.is_spectator = true` (see `lib/game/rules.ts`'s `eliminatesOnWrongAnswer`) — this is how "elimination" is represented, there's no separate eliminated flag.

### `POST /api/rounds/[roundId]/timeout`
Host-driven advance when a timer expires (no server-side clock exists — see `ARCHITECTURE.md`). **File:** `.../rounds/[roundId]/timeout/route.ts`
- **Body:** `{ requesterPlayerId, reason: "no_buzz" | "no_answer" }`
- **Response:** `{ resolved: boolean, nextPhase?: number, reveal?: RoundRevealPayload }`
- **Authorization:** host-only.
- **`"no_answer"` behavior:** treats the current lock-holder's silence as a miss — same penalty/steal-phase logic as a wrong answer in the `/answer` route (including setting `phase_started_at` on a steal transition), without an actual submitted guess.

### `POST /api/rounds/[roundId]/hint`
Host reveals a hint. **File:** `.../rounds/[roundId]/hint/route.ts`
- **Body:** `{ requesterPlayerId, kind: RevealedHint["kind"] }` (one of `first_letter | last_letter | year | genre | duration | cover_blur | random_letters | artist_silhouette | word_count`)
- **Response:** `{ hint: RevealedHint }`
- **Authorization:** host-only. Only allowed while `game_rounds.status === 'playing'` (i.e., before anyone has buzzed) and only if the mode allows hints (`lib/game/rules.ts`'s `hintsAllowed` — false for `hard_mode`/`sudden_death`).
- **Side effect:** appends to `game_rounds.revealed_hints` (jsonb array).

### `POST /api/rounds/[roundId]/next`
Host advances to the next round, or ends the game. **File:** `.../rounds/[roundId]/next/route.ts`
- **Body:** `{ requesterPlayerId }`
- **Response:** `{ round: GameRoundRow }` (more rounds remain) or `{ ended: true, matchHistoryId: string }` (game over)
- **Authorization:** host-only; current round must be `resolved` or `skipped`.
- **On game end:** calls `lib/game/end-game.ts`'s `finishGame()`, which builds `match_history`, marks `games`/`rooms` finished, and updates every participating profile's aggregate stats (`xp`, `level`, `games_played`, `wins`, `total_points`, `songs_guessed`, `correct_answers`, `total_answers`, `total_steals`, `longest_streak`, plus three columns added this session — `albums_correct`, `fastest_buzz_wins`, `game_win_streak` — and `fastest_buzz_ms`, now actually computed instead of hardcoded `null`). Then calls `lib/game/achievements.ts`'s `checkAndUnlockAchievements()` per profile, which **does** now insert into `profile_achievements` for any newly-met threshold (see `FEATURES.md`'s Achievements entry — this used to not exist at all).

---

## Playlists

### `GET /api/playlists`
Browse playlists. **File:** `src/app/api/playlists/route.ts`
- **Query:** `?genre=&decade=&mood=&ownerId=` (any combination) — `ownerId` present switches from "public only" to "owned by this id" filtering.
- **Response:** `{ playlists: (PlaylistRow & { songs: { count: number }[] })[] }`, limit 60.

### `GET /api/playlists/[id]/songs`
Browse a playlist's songs (pre-game curation view — intentionally allowed even though `songs` has no public RLS policy, because this route uses the admin client and only exposes non-secret metadata). **File:** `.../playlists/[id]/songs/route.ts`
- **Response:** `{ songs: { id, title, artist, album, year, genre, duration_seconds, cover_url }[] }`
- **Note:** exposing `title`/`artist` here for playlist *browsing* is an intentional exception to the mid-round secrecy design (analogous to a quiz host reviewing questions before play) — see `DECISIONS.md` `D-004`. Not currently called from any UI (the `PlaylistPicker` component shows playlist names/song counts, not individual songs).

### `POST /api/playlists/import-youtube`
Resolve a YouTube playlist URL into a new `playlists` + `songs` set. **File:** `.../playlists/import-youtube/route.ts`
- **Rate limit:** 5 / 60s per IP.
- **Body:** `{ playlistUrl, name, ownerId?, genre?, decade?, mood?, isPublic? }`
- **Response:** `{ playlist: PlaylistRow, songCount: number }`
- **Requires:** `YOUTUBE_API_KEY` env var — throws a descriptive error if unset (`lib/youtube/resolve.ts`).
- **Behavior:** extracts the playlist ID from the URL (or accepts a raw ID), paginates `youtube.playlistItems` (up to 200 videos), batch-fetches `youtube.videos` for duration + thumbnail, splits each video title into `artist`/`title` using common `"Artist - Title"` separator conventions (best-effort; falls back to `"Unknown Artist"` if no separator found), and bulk-inserts into `songs`. `clip_start_seconds` is heuristically set to 25% into the track (capped 0–30s).

### `POST /api/playlists/import-spotify`
Resolve a Spotify playlist URL into a new `playlists` + `songs` set. **File:** `.../playlists/import-spotify/route.ts` (new)
- **Rate limit:** 5 / 60s per IP.
- **Body:** `{ playlistUrl, name, ownerId?, genre?, decade?, mood?, isPublic? }`
- **Response:** `{ playlist: PlaylistRow, songCount: number, songsWithPreview: number, warning: string | null }` — `warning` is a human-readable note when some imported tracks have no 30s preview available (a real, disclosed Spotify limitation, not a bug — see `lib/spotify/resolve.ts`'s comment).
- **Requires:** `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` env vars — throws a descriptive error if unset.
- **Behavior:** obtains an access token via the Client Credentials flow (cached module-scope, refreshed ~60s before expiry), paginates the playlist's tracks (up to 200), and bulk-inserts into `songs` with `spotify_track_id`/`preview_url`/`cover_url` populated. `clip_start_seconds` is `0` (Spotify preview clips are already a fixed ~30s excerpt chosen by Spotify, unlike YouTube's full-length videos).

---

## Match history

### `GET /api/match-history/[id]`
Fetch a single match history row by id, for the results/podium screen. **File:** `src/app/api/match-history/[id]/route.ts` (added when `results-view.tsx` was built)
- **Response:** `{ matchHistory: MatchHistoryRow }` (includes `players` and `timeline` JSON — see `DATABASE.md`) or 404.
- **Authorization:** none — match history rows have a public RLS SELECT policy (see `DATABASE.md`) and contain no secret data (final scores/placements, not mid-round answers).
- **Called by:** `src/components/room/results-view.tsx`, after first calling `GET /api/rooms/[code]/game` to obtain the `matchHistoryId`.

---

## Leaderboards

### `GET /api/leaderboards`
Global leaderboard, sortable by one of 6 metrics. **File:** `src/app/api/leaderboards/route.ts` (new)
- **Query:** `?type=xp|total_points|wins|fastest_buzz|steals|streak` (default `xp`), `?limit=25` (max 100).
- **Response:** `{ type: string, entries: LeaderboardEntry[] }` — each entry a subset of `profiles` columns.
- **Authorization:** none — public data.
- **Note:** `fastest_buzz` sorts ascending (lower is better) and excludes profiles with a null `fastest_buzz_ms` (never buzzed); every other metric sorts descending. Only a global, all-time leaderboard exists per metric — no friends-only or time-windowed (weekly/monthly) leaderboards from the original spec are implemented (would need additional schema).

## Profiles

### `GET /api/profiles/[username]`
Fetch a profile and its unlocked achievements by username. **File:** `src/app/api/profiles/[username]/route.ts`
- **Response:** `{ profile: ProfileRow, achievements: (AchievementRow & { unlocked_at: string })[] }` or 404.
- **Authorization:** none — public data.
- **Implementation note:** does a two-query join in application code (`profile_achievements` then `achievements`) rather than a Drizzle relational query — kept as two queries + in-memory join to keep this route's shape identical across the Supabase → Drizzle migration.

### `GET /api/profiles/me`
Fetch the signed-in user's own extended profile row. **File:** `src/app/api/profiles/me/route.ts` (new, session five)
- **Response:** `{ profile: ProfileRow | null }`
- **Authorization:** Clerk session via `auth()` — returns `null` (not 401) if unauthenticated, since `useIdentity()` calls this for every visitor and falls back to guest identity when it comes back empty.

### `POST /api/profiles/me/settings`
Update the signed-in user's own theme/background/avatar/volume/accessibility settings. **File:** `src/app/api/profiles/me/settings/route.ts`
- **Body:** `{ theme?, background_key?, custom_background_url?, avatar_emoji?, settings?: { volume?: {...}, accessibility?: {...} } }` (all fields optional; provided ones are merged over the existing row)
- **Response:** `{ profile: ProfileRow }`
- **Authorization:** this is one of only two routes in the app that use a real session instead of a client-supplied id — `auth()` from `@clerk/nextjs/server` determines the caller (`userId`), and the route checks nothing else beyond that, since a real Clerk session exists here (guests have no session and can't call this route meaningfully). Returns 401 if not signed in. **There is no RLS-equivalent backstop anymore** (see `SECURITY.md`) — this route's correctness entirely depends on `auth()` being trustworthy, which it is (Clerk-verified session), and on the route itself only ever updating `eq(profiles.id, userId)`.
- **Called by:** `/settings` page, best-effort/fire-and-forget alongside the equivalent `localStorage`-backed `useSettingsStore` update (which is what guests and the rest of the app actually read from — this route is purely for cross-device persistence of a signed-in user's preferences).

---

## Auth & realtime infrastructure

### `GET /api/ably-token`
Mints a short-lived Ably token request for the browser. **File:** `src/app/api/ably-token/route.ts` (new, session five)
- **Response:** an Ably `TokenRequest` object, consumed directly by the Ably client SDK's `authUrl` option.
- **Authorization:** none — anyone can request a token (mirrors the old Supabase anon-key model, where the realtime credential itself was already scoped-down and safe to hand out broadly). The raw `ABLY_API_KEY` never leaves the server.

### `POST /api/webhooks/clerk`
Clerk webhook receiver — auto-creates a `profiles` row on `user.created`. **File:** `src/app/api/webhooks/clerk/route.ts` (new, session five)
- **Auth:** verified via `verifyWebhook()` (`@clerk/nextjs/webhooks`), checked against `CLERK_WEBHOOK_SIGNING_SECRET`. Returns 400 on an invalid signature.
- **Behavior:** on `user.created`, derives a unique username (from the Clerk username or email prefix, de-duplicated with a numeric suffix loop) and inserts a `profiles` row (`onConflictDoNothing`). Other event types are acknowledged with `{ received: true }` and ignored.
- **Replaces:** the old Postgres `handle_new_user()` trigger. **Requires a Clerk Dashboard webhook endpoint to be configured** pointing at this route — see `DEPLOYMENT.md`. Never fired in this environment; entirely unverified end to end.

---

## External APIs used

| API | Used for | File | Auth | Rate limits observed by us |
|---|---|---|---|---|
| YouTube Data API v3 (`playlistItems`, `videos`) | Resolving a playlist URL into song metadata | `src/lib/youtube/resolve.ts` | `YOUTUBE_API_KEY` query param | None implemented client-side beyond our own 5/60s route limit; YouTube's own daily quota is the real constraint (not handled — no retry/backoff on 403 quota-exceeded) |
| YouTube iframe embed (`youtube-nocookie.com/embed/...`) | Actual clip playback | `src/components/game/youtube-player.tsx` | none (public embed) | n/a |
| Spotify Accounts + Web API (Client Credentials, `playlists/{id}/tracks`) | Resolving a playlist URL into song metadata + preview URLs | `src/lib/spotify/resolve.ts` (new) | `SPOTIFY_CLIENT_ID`/`SECRET` → cached bearer token | Same pattern as YouTube — our own 5/60s route limit only; no retry/backoff on Spotify rate-limit responses |
| Spotify preview clip (direct MP3 URL) | Actual clip playback when no YouTube video exists | `src/components/game/spotify-preview-player.tsx` (new, plain `<audio>` element) | none (public URL) | n/a |

## Webhooks

None exist — no webhook receivers anywhere in the codebase.
