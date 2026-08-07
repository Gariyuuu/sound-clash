# Features

Every feature from the original product spec, classified against what's
actually in the repository. Status definitions match `CLAUDE.md`'s Phase 2
classification list. Nothing here is marked "complete" on the basis of a
filename alone — each entry states what layer(s) actually exist.

---

## Room creation & join by code

- **Status: Partially implemented** (fully written, unverified, blocked by the P0 build errors).
- **Frontend:** `create-room-button.tsx`, `join-room-card.tsx`, `room-client.tsx`, `name-gate.tsx`.
- **Backend:** `POST /api/rooms`, `POST /api/rooms/[code]/join`, `POST /api/rooms/[code]/leave`.
- **Database:** `rooms`, `room_players`.
- **Validation:** display name required, 20-player cap, banned-player rejection, idempotent rejoin.
- **Edge cases handled:** guest vs. authed identity (XOR constraint), rejoining after refresh, joining a mid-game room as a spectator.
- **Edge cases NOT handled:** no code-format validation beyond length on the client (`join-room-card.tsx` just uppercases and checks length ≥4); no "room full" pre-check before showing the join form.
- **Loading/empty states:** a `SplashScreen` covers the loading gap; no explicit empty state needed (single-purpose form).
- **Tests:** none.
- **Remaining work:** none structurally — this is essentially done pending the global build fix.

## Private / public rooms, spectator mode

- **Status: Complete (as of the fourth session); unverified at runtime.**
- `HostSettingsPanel` now has a public/private `Switch` (writes `rooms.is_public` via `POST /api/rooms/[code]/settings`), and a `/browse` page (new) lists public lobby-status rooms via `GET /api/rooms`, which now also returns a live player count per room (`room_players(count)` embedded select).
- Spectator mode: fully wired — join-as-spectator flow, `is_spectator` flag respected in player counts, scoring exclusion, and UI badges (`PlayerList`).

## Host configuration (song count, source, mode, timer, hints, scoring)

- **Status: Complete UI + backend; unverified at runtime.**
- **Frontend:** `HostSettingsPanel` — room name + public/private toggle (new), song count (10/20/30/50/100), source (YouTube/Spotify/Mixed — **both sources now functional**, see below), all 12 modes (including a team-size selector and, in `PlayerList`, per-player team assignment for Team Battle — new), timer slider, category toggles, hints on/off, steal on/off. The `Slider` Base UI prop mismatch (T-004) is fixed.
- **Backend:** `POST /api/rooms/[code]/settings`, plus new `POST /api/rooms/[code]/team`.
- **Still not exposed in UI:** steal penalty amount (schema field `stealPenalty` exists, no slider/input for it), hint *type* selection (schema has `hintTypes: string[]`, but the UI's hint toggle is a single on/off switch, not a per-hint-type picker as the original spec described).

## YouTube song source

- **Status: Complete; unverified at runtime** (no `YOUTUBE_API_KEY` configured anywhere in this environment, never executed end-to-end).
- **Frontend:** `PlaylistPicker` (browse existing + import dialog, now with a source toggle alongside Spotify).
- **Backend:** `POST /api/playlists/import-youtube`, `lib/youtube/resolve.ts`.
- **Validation:** requires a non-empty name and URL; server throws a descriptive error if `YOUTUBE_API_KEY` is unset.
- **Known limitation:** artist/title splitting is a heuristic based on common `"Artist - Title"` video-title conventions; will mislabel any video that doesn't follow it (falls back to `"Unknown Artist"`).
- **Playback:** `youtube-player.tsx` is now composed into `GameplayView` (no longer orphaned).

## Spotify song source

- **Status: Complete (as of the fourth session); unverified at runtime** (no `SPOTIFY_CLIENT_ID`/`SECRET` configured anywhere in this environment).
- **Backend:** `src/lib/spotify/resolve.ts` (Client Credentials flow — no user login needed — with a module-scope cached access token), `POST /api/playlists/import-spotify`.
- **Frontend:** `PlaylistPicker`'s import dialog now has a YouTube/Spotify source toggle; `SpotifyPreviewPlayer` (a plain `<audio>` element — Spotify preview URLs are direct MP3 links, no SDK needed) plays the clip in `GameplayView` when a round's song has no YouTube video id.
- **Known, honestly-surfaced limitation:** Spotify no longer guarantees a 30-second preview clip on every track. The import route reports how many imported tracks lack a preview (`songsWithPreview`/`warning` in the response, surfaced as a toast), and a song with neither a YouTube video nor a Spotify preview shows an explicit "No playable clip" message in `GameplayView` rather than failing silently. Hosts should prefer YouTube or "mixed" source for full playlist coverage.
- This closes the "real trap for a host" gap flagged in the original audit — selecting Spotify now works, with honest warnings about partial coverage rather than silent failure.

## Multiplayer buzz system (buzzer button, lockout, timer)

- **Status: End-to-end wired (backend + frontend); unverified at runtime.**
- **Backend:** `POST /api/rounds/[roundId]/buzz` — atomic race via `round_locks` unique constraint. See `ARCHITECTURE.md`/`DATABASE.md` for the mechanism; this is the single most carefully-implemented piece of the whole codebase.
- **Frontend:** `BuzzerButton` is now composed into `src/components/room/gameplay-view.tsx`, which also renders a live countdown (`useCountdown`, deadline computed per phase) and calls `api.timeout` when it expires **only if the local player is host** (host-timing-authority pattern, see `ARCHITECTURE.md` D-003).
- **"10 second timer"** from the original spec: implemented as `ANSWER_WINDOW_MS = 10_000` in `gameplay-view.tsx`, anchored to the buzz lock's `buzzed_at` timestamp. **"Dramatic sound effect"** is now built — `sfx.buzz()` (`src/lib/sound/synth.ts`, a synthesized Web Audio API tone, not a recorded sample) fires for every client the instant `buzzHolderId` transitions, off the shared realtime store state. **"Animated spotlight"** is still not built — no spotlight visual.
- **Not yet runtime-verified** — this has only passed `tsc`/`build`, never been played against real Neon/Clerk/Ably infrastructure.

## Steal mechanic

- **Status: End-to-end wired (backend + frontend); unverified at runtime.**
- **Backend:** fully implemented in `/api/rounds/[roundId]/answer` and `/timeout` — wrong answer excludes the player (`game_rounds.excluded_player_ids`), opens `current_phase + 1`, applies the ×0.8 steal multiplier on a subsequent correct answer, applies a penalty on a subsequent wrong steal attempt, and auto-resolves the round unsolved once every eligible player has been excluded.
- **Frontend:** `gameplay-view.tsx` renders a "Steal Round!" banner when `game-store`'s phase is `"steal"`, tracks `excludedPlayerIds` (from `use-game-realtime.ts`, sourced off `game_rounds.excluded_player_ids`) to disable the buzzer for players who already answered wrong this round, and anchors a fresh countdown to `stealStartedAt`. Still no dedicated "dramatic countdown" animation beyond the reused buzz timer display.

## Scoring (per-category points + bonuses)

- **Status: Complete, single implementation (as of the fourth session).**
- **Database:** `round_answers.points`, `room_players.score`.
- **Backend:** `.../rounds/[roundId]/answer/route.ts` now calls the shared `lib/scoring/engine.ts`'s `computeScore()` for all point math (category base points, fastest-buzz/first-try/no-hint/perfect bonuses, steal multiplier, **and Chaos Mode's double-points/reverse-scoring/mystery-bonus modifiers, which now actually apply** — see `DECISIONS.md` D-007, resolved). The inline reimplementation that used to skip Chaos Mode's modifiers has been removed.
- **Floating score animations:** now built — `src/components/game/floating-score-popups.tsx` renders `game-store.ts`'s `popups` array as auto-dismissing toasts, composed into `gameplay-view.tsx`.
- **Perfect Answer Bonus / Fastest Buzz / First Try / No Hint bonuses:** implemented per the spec's point values (`lib/game/types.ts`'s `SCORE_VALUES`) in the inline answer-route logic.

## Accepted answers (fuzzy matching)

- **Status: Verified complete as pure logic; unverified at runtime.**
- `lib/scoring/fuzzy-match.ts` (JS, used live) — normalizes accents/case/punctuation, checks exact match, substring containment (handles "the Weeknd" vs "Weeknd"), and Levenshtein-based similarity above a 0.72 threshold.
- A parallel SQL implementation (`normalize_answer`/`fuzzy_match` functions in the migration) exists but is **not called by the live scoring path** — see `DECISIONS.md` `D-005`.
- No unit tests exist for either implementation.

## Hint system

- **Status: End-to-end wired for all 9 hint types; unverified at runtime.**
- **Backend:** `POST /api/rounds/[roundId]/hint`, `lib/game/round-payload.ts`'s `buildHint()` implements all 9 spec'd hint kinds (first/last letter, year, genre, duration, cover blur, random letters, artist silhouette, word count).
- **Frontend:** `HintsPanel` is now composed into `gameplay-view.tsx` (host reveal buttons shown only while `phase === "listening"`, revealed-hint chips visible to everyone). `usedHint` (whether any hint was revealed this round) is passed through to `api.submitAnswer` to correctly gate the "No Hint Bonus."
- **Rules:** hints disabled entirely for `hard_mode`/`sudden_death` (`lib/game/rules.ts`) — enforced server-side; `gameplay-view.tsx` doesn't separately hide the host controls for those modes, so a host would see the reveal buttons and get a rejected-request toast rather than the buttons being absent. Minor UX polish gap, not a functional bug.

## Game modes (12 total)

- **Status: Rule differences implemented for scoring/timer/hints/elimination; audio-manipulation modes are honest rule-only approximations.**
- Centralized in `lib/game/rules.ts`: `resolveTimerSeconds` (Speed Round/Hard Mode/Sudden Death get shorter timers), `resolveCategories` (Speed/Artist Rush/Album Rush/Chorus Challenge force a single category), `hintsAllowed`, `eliminatesOnWrongAnswer` (Sudden Death), `rollChaosRule` (Chaos Mode).
- **Classic, Speed Round, Artist Rush, Album Rush, Chorus Challenge, Hard Mode, Sudden Death:** rule logic present end-to-end (creation → scoring). Not runtime-verified.
- **Instrumental Mode, Reverse Intro, One Second Challenge:** `round-payload.ts` sets `clipDurationSeconds`/`clipStartSeconds` per mode (One Second → 1s clip; the others get shorter/normal clips), but **Instrumental Mode does not remove vocals and Reverse Intro does not reverse audio** — explicitly documented as infeasible against a plain YouTube iframe embed or Spotify preview `<audio>` element (see the comment in `youtube-player.tsx`). These are honest rule-flavor implementations, not the literal audio effect. This remains a deliberate, out-of-scope limitation (see `TASKS.md` "Deferred"), not a gap that was missed.
- **Team Battle:** **Now functional (as of the fourth session).** Host assigns players to Team A/B in `PlayerList` (visible only in the lobby, for the host, in this mode — `POST /api/rooms/[code]/team`). When a team member answers correctly, the answer route now applies the same point total to every teammate's score too (wrong-answer penalties stay individual, so one miss doesn't punish the whole team — a deliberate design choice, see the code comment in the answer route). `lib/game/rules.ts`'s `isTeamMode()` still has no callers — it was superseded by checking `settings.mode === "team_battle"` directly at the point-sharing call site rather than being routed through that helper; worth reconciling if `isTeamMode()` is meant to be the canonical check.
- **Chaos Mode:** rule-rolling (`rollChaosRule`) picks a random rule per round and stores it on `game_rounds.chaos_rule`; `gameplay-view.tsx` displays the rolled rule as a "Chaos: <rule>" badge. **The modifier math now actually applies to points** (see Scoring above, D-007 resolved) — this badge is no longer cosmetic-only.

## Lobby (avatars, host badge, ready status, chat, reactions, join/leave animation)

- **Status: Complete (as of the fourth session); unverified at runtime.**
- **Frontend:** `PlayerList` (avatars/host crown/spectator icon/connection status, Framer Motion enter/exit animation, host kick/ban menu, ready-status toggle and indicator — new, team assignment for Team Battle — new), `RoomChat` (message list, quick-reaction emoji bar, floating reaction overlay, typing indicator — new).
- **Ready status:** `PlayerList` now has a toggle button (`POST /api/rooms/[code]/ready`) and shows a checkmark next to ready players.
- **Typing indicator:** implemented via a `typing` event published directly to the room's Ably channel from the browser (not a DB write, and not routed through an API route — the one client-side `publish()` call in the app — `useRoomRealtime` now returns a `sendTyping` function, threaded through `LobbyView` to `RoomChat`, which debounces on input change and shows "X is typing..." below the message list).
- **Still missing:** "Ping" — no presence/latency measurement exists at all (see `ARCHITECTURE.md`); this remains unbuilt.

## Profiles (username, avatar, XP, level, title, badges, stats)

- **Status: Complete (as of the fourth session); unverified at runtime.**
- **Database:** `profiles` has every field the spec lists, plus three new columns added this session (`albums_correct`, `fastest_buzz_wins`, `game_win_streak`) to support achievement thresholds.
- **Backend:** `lib/game/end-game.ts` updates all of these after every game. `fastest_buzz_ms` **is now actually computed and written** (previously hardcoded `null`) — derived from `round_locks.buzzed_at` vs. the round's `started_at`.
- **Frontend:** `/profile` page (new) — avatar, title, level/XP progress bar, wins/games/accuracy/streak stat tiles, and an achievement grid (locked achievements shown grayed out).
- **Still not implemented:** `favorite_genre` is never computed/written anywhere. **Badges/profile borders/emotes** (spec'd XP-unlock cosmetics beyond achievements): schema has `profile_border` but no unlock catalog or UI.

## Statistics (graphs, buzz time, accuracy, weakest genres)

- **Status: Partial — key stats shown as tiles, no graphs.** The `/profile` page (new) shows wins, games played, accuracy %, and longest streak as stat tiles. No charting library is installed and no graphs exist; "average buzz time" and "weakest genres" specifically are still not computed anywhere.

## Leaderboards (global/friends/weekly/monthly/per-genre/etc.)

- **Status: Complete for a global leaderboard across 6 metrics (as of the fourth session); unverified at runtime.**
- **Backend:** `GET /api/leaderboards?type=...` — sortable by XP, total score, wins, fastest buzz, steals, or longest streak, backed directly by indexed `profiles` columns.
- **Frontend:** `/leaderboards` page (new) — tab-style metric switcher, ranked list with avatar/title/level and a crown for #1.
- **Not implemented:** friends-only, weekly/monthly time-windowed, and per-genre leaderboards from the original spec — only a global, all-time leaderboard per metric exists. Time-windowed/friends leaderboards would need additional schema (a friends-graph table, and either periodic snapshotting or timestamp-filtered aggregation) not built here.

## Match history & results/podium screen

- **Status: Complete for a single post-game results screen; full historical list + replay-timeline viewer still not built.**
- **Database + backend:** `match_history` table, populated by `finishGame()` in `end-game.ts` with `players` (per-player snapshot incl. placement/accuracy/steals) and `timeline` (per-round buzz winner/correct/points/was-steal). `GET /api/match-history/[id]` route fetches a single row by id.
- **Frontend:** `src/components/room/results-view.tsx` fetches the game's `matchHistoryId` via `GET /api/rooms/[code]/game` then the full row via the match-history route, renders a 3-place podium (animated) plus a full standings list, fires `canvas-confetti` and a synthesized victory chime (`sfx.victory()`) on load.
- **Still missing:** no page to list a player's *historical* match history across multiple games (this screen only shows the just-finished game), and no round-by-round replay/timeline scrubber UI reading the captured `timeline` JSON.

## Achievements

- **Status: Complete — catalog, unlock logic, and profile display all implemented (as of the fourth session); unverified at runtime.**
- **Database:** `achievements` table pre-seeded with all 9 spec'd achievements, a `profile_achievements` join table, plus three new `profiles` columns (`albums_correct`, `fastest_buzz_wins`, `game_win_streak`) added specifically to support threshold checks that had no existing counter.
- **Backend:** `src/lib/game/achievements.ts`'s `checkAndUnlockAchievements()`, called from `end-game.ts` after every game's profile-stat update. Each of the 8 non-meta achievements has a concrete threshold check (e.g. Perfect Ear = a correct answer within 1 second of buzzing, computed per-game from `round_locks`/`round_answers` timestamps); the 9th, Collector, is a meta-achievement unlocked once 10 others are (checked via a count query after the others are evaluated). Unlocks are atomic per-key (`upsert` + `ignoreDuplicates`), so re-running the check for an already-unlocked achievement is a safe no-op.
- **Frontend:** the `/profile` page renders all 9 as a grid, greying out locked ones.
- **Not implemented:** no unlock-moment UI feedback (toast/animation) when an achievement unlocks — `checkAndUnlockAchievements()` returns the newly-unlocked keys and a synthesized `sfx.achievement()` chime already exists, but nothing calls either from a visible moment yet (see `TASKS.md`).

## XP system & cosmetic unlocks

- **Status: XP math implemented and profile-visible; unlock catalog not implemented.**
- `xpForGame`/`levelForXp` compute and persist XP/level; `/profile` shows a progress bar toward the next level. No system exists for unlocking avatars/borders/badges/titles/emotes at specific levels — no unlock-rule table, no UI.

## Theme selector (14 presets + custom upload + light/dark/system)

- **Status: Complete (as of the fourth session); unverified at runtime.**
- `/settings` page (new) provides a real control surface: a theme-mode selector (light/dark/system, via `next-themes`' `useTheme`), a grid of all 14 named background presets rendered as actual gradient swatches (`src/lib/theme-backgrounds.ts` + `BackgroundLayer`, a fixed full-viewport layer in the root layout — closes the "not implemented as actual visual backgrounds" gap from the original audit), and a custom-image upload (stored as a `localStorage` data URL, since no file/blob storage is configured — an honest, documented tradeoff, not a full asset-hosting solution).
- Volume sliders and accessibility toggles (colorblind/high-contrast/font-scale/reduced-motion) are also on this page, each optionally synced to `profiles.settings` server-side for signed-in users via the new `POST /api/profiles/me/settings` route (best-effort, fire-and-forget — guests only get the localStorage-backed version).

## Audio (music/UI/effects volume sliders, sound effects)

- **Status: State layer complete; zero playback wiring, zero assets.**
- `settings-store.ts` models `volumeMusic`/`volumeUi`/`volumeEffects` (0–100 each), now with a real control surface on `/settings` (see Theme selector above). `youtube-player.tsx` reads `volumeMusic` only to decide `mute=0|1` on the embed (binary, not a real volume level — YouTube's iframe API doesn't expose a simple volume param via URL without the postMessage-based IFrame Player API, not implemented). `SpotifyPreviewPlayer`'s plain `<audio>` element does set a real `.volume` from `volumeMusic`, so Spotify-sourced clips get proper volume control where YouTube-sourced ones don't.
- **Sound effects: now implemented (as of the fourth session)**, via `src/lib/sound/synth.ts` — synthesized Web Audio API tones (oscillators + gain envelopes), not recorded samples, since no audio assets are bundled with this repo. Covers buzz, correct, incorrect, countdown-tick (last 3 seconds), victory, and achievement (built but not yet triggered from a UI moment — see Achievements above). `howler` remains installed and unused; this was a deliberate substitute given no real audio assets exist, not a partial howler integration.

## Accessibility (keyboard, screen reader, colorblind, high contrast, font scale)

- **Status: Complete control surface (as of the fourth session); no dedicated accessibility audit performed.**
- `settings-store.ts` + `AccessibilityProvider` + `globals.css` `html[data-*]` selectors implement colorblind-safe palette swap, high-contrast border/muted-foreground overrides, font-scale (three steps), and reduced-motion (both a media-query fallback and an explicit opt-in data attribute). The `/settings` page now provides a real control surface for all of these (see Theme selector above).
- No explicit keyboard-navigation work beyond whatever Base UI's primitives provide by default; no screen-reader-specific ARIA work beyond component-library defaults; not audited.

## Admin dashboard

- **Status: Not started.** No routes, no role/permission concept (`profiles` has no `is_admin` or similar column), no admin UI anywhere.

## Security (server-side scoring, rate limiting, tamper prevention)

- **Status: Mostly complete for the threats it targets; see `SECURITY.md` for full detail.**
- Server-authoritative scoring: yes (client never sends a point value).
- Duplicate-buzz prevention: yes, via the `round_locks` unique-constraint race (see `ARCHITECTURE.md`).
- Rate limiting: yes, but explicitly best-effort/in-memory/single-instance (`rate-limit.ts`'s own comment) — not applied to every route (see `API_REFERENCE.md`'s rate-limit table).
- Packet tampering: mitigated by re-validating lock ownership and host status server-side on every mutating call; not mitigated against a client that simply skips the UI and calls routes directly with a stolen/guessed `playerId` for a room they're already a legitimate member of (there is no per-request signature/session token binding a request to "this browser," only the room-scoped `player.id` the client is trusted to send — see `SECURITY.md` for the full threat-model discussion).

## Patch notes page

- **Status: Complete (as of the fourth session).** `/patch-notes` page — hardcoded array of version entries (Added/Changed/Fixed/Known Issues), sourced from this project's own real session history rather than placeholder content. No CMS/database-backed versioning — adding a new entry means editing the page's source array directly.

## Performance (lazy loading, code splitting, caching, instant joins)

- **Status: Whatever Next.js App Router provides by default; nothing custom.** No explicit `dynamic()` imports, no `revalidate`/cache tuning, no image optimization usage (the one remote image, YouTube thumbnails in `PlaylistPicker`, deliberately uses a raw `<img>` with an eslint-disable comment rather than `next/image`, avoiding the need for a `next.config.ts` remote-image allowlist — a reasonable, if unstated, tradeoff).

## Mobile responsiveness

- **Status: Unverified.** Tailwind responsive classes (`sm:`, `lg:`) are used throughout the lobby/landing components, suggesting responsive intent, but no device/viewport testing has been performed (no dev server has been run in this environment at all).

## Deployment readiness

- **Status: Builds cleanly; not deployment-ready.** See `DEPLOYMENT.md` — `tsc`/`lint`/`build` all pass (40 routes as of the fifth session, backend migrated to Neon+Clerk+Ably — see `DECISIONS.md` D-013), but no Neon/Clerk/Ably project exists, no Vercel project exists, and nothing has ever been runtime-verified.
