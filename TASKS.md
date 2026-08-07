# Tasks

Active execution queue. IDs are stable — reference them in commits/`SESSION_LOG.md`
entries. Update this file whenever a task's status changes.

---

## Current task

**None actively in progress.** As of 2026-08-07 (checkpoint/verification pass), re-verified the repo against real code and fixed cross-doc contradictions — no product features were added this pass. Before this checkpoint, the seventh session (also 2026-08-07) fixed a Clerk sign-in/sign-up routing bug, added sign-out access to every standalone page (was landing-page-only), built a circular "theme wheel" background picker for `/settings`, and added a full Play-vs-AI mode (a synthetic `room_players` bot that buzzes in and answers on its own, difficulty-configurable). Deployed to production. See `SESSION_LOG.md`'s latest entry for full detail on that session.

**Important — documentation debt found by this checkpoint:** `git log` shows **four more commits after the seventh session that have no `SESSION_LOG.md` entry and no `FEATURES.md`/`UI_SYSTEM.md`/`API_REFERENCE.md` write-up**: a Career Mode entry point + 10-genre filtering (`src/app/career/`, `src/lib/game/career.ts`), a YouTube-overlay answer-leak fix, background presets expanded 14→20 + AI-opponent timing softened + buzz timer default/max raised (10s→20s/20s→30s), and a scoreboard live-update bug fix + redesign + mid-game timer control. The code is real, committed, and passes `tsc`/`lint`/`build` — it's just undocumented. See `PROJECT_STATE.md`'s "Documentation gap" section for exact commit hashes. **This is now higher priority than more feature work** — see "High priority" below.

## Next up

1. **Write up the four undocumented commits** in `SESSION_LOG.md` (as a proper entry, or several) and update `FEATURES.md` (add a Career Mode section), `UI_SYSTEM.md` (background count already corrected this pass, but Career Mode's UI isn't described anywhere), and `API_REFERENCE.md` (no career/genre-filter endpoints documented). See `PROJECT_STATE.md`'s "Documentation gap" for what to cover.
2. **Play a real game through the actual UI in a browser** — still the one thing unverified across every recent session. The AI opponent specifically has only been tested via direct API calls simulating what the host's browser does (`POST .../ai-turn`), not through a real rendered `gameplay-view.tsx` — confirm the bot visibly buzzes in and answers within the UI, not just that the endpoint works. Also still open: a real two-device human game, and registering the Clerk webhook (optional — guest play and AI-mode both work without it).

## Blocked

None.

## Recently completed (this session, 2026-08-06, fifth session — backend migration)

Full Supabase → Neon/Clerk/Ably migration:
- **Database:** `src/lib/db/schema.ts` (Drizzle schema, all 13 tables) + `src/lib/db/client.ts` (singleton Neon HTTP-driver client) replace `supabase/migrations/0001_init.sql` + the three Supabase client constructors. `drizzle.config.ts` added; `db:push`/`db:generate`/`db:studio`/`db:seed` npm scripts added.
- **Auth:** `@clerk/nextjs` replaces `@supabase/ssr`+`@supabase/supabase-js`'s auth usage. `src/middleware.ts` now `clerkMiddleware()`. `/sign-in`, `/sign-up` wrap Clerk's own components (old `(auth)` route group + `AuthForm` component deleted). `src/app/api/webhooks/clerk/route.ts` (new) replaces the old `handle_new_user()` Postgres trigger for `profiles` row auto-creation. `use-identity.ts` rewritten around `useUser()`.
- **Realtime:** Ably (`ably` package) replaces Supabase Realtime. `src/lib/ably/client.ts` (browser singleton, token-authenticated, deliberately uses `ably/modular` not the default export — see below), `src/lib/ably/publish.ts` (server-side publish helper), `src/app/api/ably-token/route.ts` (mints browser tokens). Every mutating API route now explicitly calls `publish()` after each write — see `ARCHITECTURE.md` for the full event contract (`room:{id}`: `player_upsert`/`room_update`/`message`/`typing`; `game:{id}`: `round_insert`/`round_update`/`lock_insert`/`answer_insert`/`game_update`). `use-room-realtime.ts`/`use-game-realtime.ts` rewritten to subscribe via Ably channels instead of Postgres Changes.
- **Every API route rewritten to Drizzle:** all of `rooms/*` (create/list/get/join/leave/kick/ready/team/settings/start/control/messages/game), `rounds/*` (buzz/answer/hint/timeout/next), `playlists/*` (list/songs/import-youtube/import-spotify), `profiles/[username]`, `leaderboards`, `match-history/[id]`.
- **Game-logic modules rewritten:** `lib/game/round-service.ts`, `end-game.ts`, `achievements.ts` dropped their `SupabaseClient` parameter in favor of the singleton Drizzle `db`; `round-service.ts` and `end-game.ts` now publish their own Ably events (`round_insert`, `game_update`, `room_update`) rather than relying on automatic DB-change propagation.
- **A real third-party build bug found and fixed:** `ably`'s bundled builds (both `ably` default export and `ably/modular`) contain a `super()`-inside-arrow-function-inside-constructor pattern (valid ES2015+) that Next 15.5.22's SWC parser fails to parse. Fixed via `serverExternalPackages: ["ably"]` + a custom `enforce: "pre"` webpack loader (`scripts/webpack/fix-ably-super.cjs`) in `next.config.ts` that patches the pattern in raw source before SWC sees it.
- `.env.example` rewritten for the new stack. `scripts/seed.ts` written (replaces `supabase/seed.sql` — seeds the achievement catalog + demo playlist, run via `npm run db:seed`).
- `supabase/` directory left in place as historical reference only (per `DECISIONS.md` D-013) — not deleted, not applied anywhere, not the current schema.

All of the above passed `npx tsc --noEmit` (0 errors), `npm run lint` (0 findings), and `npx next build` (0 errors, 40 routes) at the end of this session.

## High priority

- **Document the four undecided/undocumented commits** (Career Mode, genre filtering, background expansion, scoreboard fix — see "Current task"/"Next up" above and `PROJECT_STATE.md`'s "Documentation gap"). Low risk, high value — the code already works, this is pure catch-up so the next account doesn't have to re-discover it via `git log`.
- **Play a real two-device game against https://sound-clash-nu.vercel.app** (see "Next up" above) — the last unverified piece. Infrastructure is confirmed live and individually working; a receiving-end realtime test (does a second browser actually see the buzz/score/chat events) has not happened yet.
- **Configure the Clerk webhook** — `/api/webhooks/clerk` has never received a real request. Not blocking gameplay (guest play works fine without it), but needed before any signed-in account gets a `profiles` row / persistent XP / leaderboard entry.
- **Ably `publish()` calls confirmed to succeed server-side** (no error) via the `join` route on both local dev and production — still need to confirm a subscribed client actually *receives and renders* one of these events correctly (buzz lock, round transition, chat, typing).
- ~~Verify the `ably` build patch also works under `next dev`~~ — **done**, `next dev` booted and served real API traffic successfully this session.

## Medium priority

- **Re-add a database-level CHECK constraint** for `room_players.profile_id`/`guest_id` XOR (dropped during the migration — see `DATABASE.md`). Not currently enforced at the schema level, only by application code.
- None else carried over from before — everything previously listed here (achievements, Team Battle, Spotify, public rooms, ready/typing, sound effects) was completed in the prior session and is unaffected by this one.

## Low priority

- Consider adding an "achievement unlocked!" toast/animation in the UI — unchanged from before this session.
- Consider a round-by-round replay/timeline scrubber UI for `match_history.timeline` — unchanged.
- Pin a Node version via `engines` in `package.json` (still unset).
- Consider switching from `drizzle-kit push` to versioned `drizzle-kit generate` migrations before any real production data exists (see `DEPLOYMENT.md`).

## Bugs

None newly discovered from static analysis this session (everything passed type-checking, lint, and build cleanly). **This is a much weaker signal than usual** given the scope of this session's changes — a wrong Drizzle `where` clause, wrong column reference, or missed `publish()` call would all still type-check and build successfully. See "Next up."

## Deferred (explicitly, with reasons)

- **Admin dashboard** — unchanged, still zero implementation, still new ground rather than a gap-fix.
- **Full 12-game-mode audio manipulation** — unchanged, still infeasible against the current playback stack.
- **Real recorded sound effects** — unchanged, synthesized tones remain the deliberate choice.
- **Achievement-unlock UI feedback** — unchanged, see "Low priority."
- **Match replay timeline scrubber** — unchanged, see "Low priority."
- **Versioned Drizzle migrations** — deferred until real production data exists (see "Low priority" above); `db:push` is fine for a pre-launch project.

## Technical debt

- **No RLS-equivalent defense layer** (new this session) — every table is reachable by the single trusted `db` connection with no database-level backstop. See `SECURITY.md`'s "Production security gaps."
- `room_players.profile_id`/`guest_id` XOR invariant is application-enforced only (new this session, see "Medium priority" above).
- No tests exist anywhere — unchanged, and now arguably more urgently needed given the scope of this session's rewrite had zero automated regression coverage.
- `rate-limit.ts` remains best-effort/in-memory — unchanged.
- The Spotify resolver's access-token cache remains module-scope, per-serverless-instance — unchanged.
- The `ably` webpack patch (`scripts/webpack/fix-ably-super.cjs`) is keyed to `ably`'s current bundled output — an `ably` version bump could shift or remove the pattern it targets; re-verify with a clean build after any upgrade.

## Testing needed

Everything — see `TESTING.md`. Still no automated test runner configured. The manual checklist needs updating to reflect the new stack (Clerk sign-up instead of email/password, Ably connection status instead of Supabase Realtime, etc.) — not yet done this session; flagged for the next session that touches `TESTING.md`.

## Documentation needed

(Historical, fifth session:) All memory files were updated then to reflect the new stack (`CLAUDE.md`, `PROJECT_STATE.md`, `TASKS.md`, `DATABASE.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `DECISIONS.md`, `SESSION_LOG.md`). `API_REFERENCE.md`, `FEATURES.md`, `FILE_MAP.md`, `HANDOFF.md`, `README.md`, `ROADMAP.md`, `TESTING.md`, `UI_SYSTEM.md`, `CHANGELOG.md` had their Supabase-specific mentions updated in place without a full rewrite.

**Currently needed (found by the 2026-08-07 checkpoint pass):** `FEATURES.md` needs a Career Mode section (doesn't exist at all today), `API_REFERENCE.md` needs entries for whatever Career Mode's data-fetching uses plus the genre-filter query params on the playlist picker, `SESSION_LOG.md` needs an entry (or several) covering the four undocumented commits described in "Current task" above. `TESTING.md`'s manual checklist still needs updating for the Clerk/Ably stack (flagged since the fifth session, still not done) and now also for Career Mode/AI opponent/theme wheel.

## Rejected ideas

None recorded — no repository evidence of an idea being explicitly tried and reverted.
