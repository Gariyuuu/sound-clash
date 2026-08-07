# Handoff

Short, high-signal onboarding for whoever (human or AI) picks this project up next.

## What is this project?

**Sound Clash** — a real-time multiplayer music-guessing party game (buzz in first, name the song, steal points off wrong answers). Next.js 15 App Router frontend, **Neon (Postgres) + Drizzle ORM + Clerk (auth) + Ably (realtime)** backend, no standalone server. **It's live: https://sound-clash-nu.vercel.app.** The entire spec'd feature surface is implemented in code, the app builds cleanly, and real infrastructure backs the live deployment — but no human has played a full two-device game yet. See below.

## What should I read first?

In this order: `CLAUDE.md` (full operating manual) → `PROJECT_STATE.md` (exact current snapshot) → `TASKS.md` (what to do next). Then whichever of `ARCHITECTURE.md` / `FEATURES.md` / `API_REFERENCE.md` / `DATABASE.md` is relevant to what you're about to touch.

## What is the current task?

None actively in progress. Six sessions happened across 2026-08-06/07. The fifth migrated the entire backend off Supabase onto Neon + Drizzle + Clerk + Ably, at the user's explicit request (they hit Supabase account limits across their *other* projects — not a problem with this one specifically). The sixth (most recent) **provisioned real infrastructure and deployed to production**: Neon + Clerk via the Vercel CLI's marketplace-integration commands (`vercel integration add neon`/`clerk`), Ably via a manually-supplied key, then `db:push` + `db:seed` + `vercel --prod`. The app is now live at https://sound-clash-nu.vercel.app, with room creation/joining verified against it via direct API calls. The single remaining priority is: **play a real two-device game against that URL** — see `TASKS.md`'s "Next up." Every individual piece has been verified (DB writes persist, Ably token minting works, a `publish()` call succeeds), but nothing has confirmed a second browser actually *receives and renders* a realtime event yet.

## What was the previous agent doing?

Six sessions across 2026-08-06/07, in order:
1. Built most of the product, paused mid-way through wiring the live gameplay screen for a documentation audit.
2. A documentation-only "account-switch checkpoint" session — no product code changed.
3. Resumed feature work: fixed four build-blocking bugs and built the full live gameplay screen and results/podium screen.
4. Implemented leaderboards, profile, settings, patch notes, achievement unlock logic, Team Battle, Spotify integration, public room browsing, ready-status, typing indicators, and synthesized sound effects — plus fixed two real bugs.
5. Full backend migration: Supabase → Neon (Postgres via Drizzle ORM), Supabase Auth → Clerk, Supabase Realtime → Ably. Every API route, every game-logic module, auth, and realtime were rewritten. Found and fixed a genuine third-party build bug in `ably`'s bundled output (see `DECISIONS.md` D-013).
6. **This most recent session** — provisioned real Neon/Clerk/Ably infrastructure via the Vercel CLI's marketplace-integration commands, ran `db:push`/`db:seed`, and deployed to production. Verified room creation/joining and Ably token-minting/publishing against the live URL via direct API calls.

## What works right now?

Everything compiles, type-checks, lints cleanly, and is now confirmed working against **real, live infrastructure**, not just static analysis: the app is deployed at https://sound-clash-nu.vercel.app, a real room was created and persisted via the live API, and a real Ably `publish()` call succeeded server-side. **What's not yet confirmed:** an actual human playing a two-device game — nothing has verified that a realtime event published by one client is correctly *received and rendered* by another client's browser. That's the next real gap, not "does the backend work at all" (which is now settled).

## What is broken?

Nothing known — `tsc`/`lint`/`build` are all clean, and the live deployment responds correctly to every request tested so far. What's still genuinely missing (not broken, just not built, deliberately): the admin dashboard, true audio manipulation for two game modes, real recorded sound effects, an achievement-unlock UI moment, a match-history replay-timeline viewer. Known gaps from the migration: no database-level defense layer (RLS-equivalent) exists anymore, the `room_players.profile_id`/`guest_id` XOR invariant is no longer a database CHECK constraint, and the Clerk webhook (`profiles` row auto-creation on sign-up) isn't registered yet — guest play is unaffected by that last one.

## What should I do next?

1. **Play a real two-device game** against https://sound-clash-nu.vercel.app — create a room on one device, join from another, go through a full round. This is the one thing that's still purely theoretical.
2. Register the Clerk webhook (`https://sound-clash-nu.vercel.app/api/webhooks/clerk`, subscribed to `user.created`) in the Clerk Dashboard, so signed-in accounts start getting profiles/XP/leaderboard entries. Optional, not blocking.
3. Fix whatever the two-device test surfaces. Given the prior session rewrote the entire backend mechanically, treat every route as at-risk, not just the historically-tricky spots.
4. If everything checks out, re-add a database-level CHECK constraint for the `profile_id`/`guest_id` XOR invariant (see `TASKS.md`), then move to the "Post-MVP" polish items in `ROADMAP.md`.

## Which files are most important?

- `src/components/room/room-client.tsx` — the orchestrator; switches between `LobbyView`/`GameplayView`/`ResultsView` based on `room.status`.
- `src/lib/db/schema.ts` — the schema source of truth (Drizzle, not SQL). Read `CLAUDE.md`'s "Coding conventions" before editing — snake_case field names, `mode: "string"` timestamps, and app-generated UUIDs are all deliberate, non-default choices.
- `src/lib/ably/publish.ts` / `src/lib/ably/client.ts` — the entire realtime layer. Every mutating route must call `publish()` explicitly; there's no automatic bridge.
- `src/lib/api-client.ts` — the frontend/backend contract; if you add or rename an API route, this is the other file that must change with it.
- `src/lib/scoring/engine.ts` — the single scoring implementation (see `DECISIONS.md` D-007) — don't reintroduce a parallel inline version in the answer route.
- `src/lib/game/achievements.ts`, `src/lib/game/end-game.ts`, `src/lib/game/round-service.ts` — game-logic modules, all rewritten this session to use the singleton Drizzle `db` instead of a passed-in Supabase client.
- `next.config.ts` / `scripts/webpack/fix-ably-super.cjs` — a real build-bug workaround for `ably`, see `CLAUDE.md` "Current status." Don't remove without understanding why it's there.

## Which areas are dangerous to modify?

See `CLAUDE.md`'s "DO NOT CHANGE WITHOUT REVIEW" section verbatim — short version: the `round_locks` unique-constraint buzz-race mechanism, the songs-answer-secrecy design (now a pure code-discipline guarantee with no database backstop — see `SECURITY.md`), anything importing `DATABASE_URL`/`ABLY_API_KEY`, the `api-client.ts` ↔ API-route contract, the `next.config.ts` ably workaround, and `src/lib/db/schema.ts`'s naming/timestamp/ID-generation conventions. Also: **don't upgrade the Next.js major version past 15.x, don't introduce Firebase, and don't reintroduce Supabase** — all three are explicit user requirements (`DECISIONS.md` D-009/D-010/D-013).

## Which commands should I run first?

```bash
cd /Users/gariyuu/Projects/sound-clash && pwd   # confirm cwd — has reset between sessions before
git status                 # confirm no uncommitted work from elsewhere gets clobbered
npx tsc --noEmit            # should be 0 errors
npm run build                 # should exit 0 — matches what Vercel would do (needs dummy DATABASE_URL/Clerk/Ably env vars if none are set — see PROJECT_STATE.md for the exact set used to verify this)
```

## How do I verify the app still works?

`npx tsc --noEmit`, `npm run lint`, and `npm run build` should all exit 0 — re-run them yourself first, since this doc could be stale by the time you read it. Beyond that: the app is live at https://sound-clash-nu.vercel.app with real Neon/Clerk/Ably infrastructure — hit it directly, or run `npm run dev` locally (`.env.local` already has real credentials). Follow `TESTING.md`'s manual smoke-test checklist for the one thing still unverified: an actual two-device game.

---

## Prompt for the next Claude Code account

```
Read CLAUDE.md, PROJECT_STATE.md, and TASKS.md in full before doing anything
else. Then run `cd /Users/gariyuu/Projects/sound-clash && pwd`, `git status`,
`npx tsc --noEmit`, `npm run lint`, and `npm run build` yourself to verify
the documented current state is still accurate — as of this writing all four
are clean, with ~40 routes generated. `.env.local` has real, live Neon/
Clerk/Ably credentials (confirmed working, not placeholders), and the app is
deployed at https://sound-clash-nu.vercel.app.

Summarize your understanding of the project and its current state back to
me before making any edits. If you find the documentation is stale or
contradicts what you observe in the code or command output, say so
explicitly rather than silently trusting either source.

The backend was migrated from Supabase to Neon + Drizzle + Clerk + Ably
(user's explicit request, rate-limited on Supabase across other projects),
then real infrastructure was provisioned via the Vercel CLI's marketplace-
integration commands and deployed to production. Room creation/joining and
Ably publish/token-minting were verified against the live URL via direct API
calls — but NO ONE HAS PLAYED AN ACTUAL TWO-DEVICE GAME YET. That is the
single most important next action: open the live URL on two devices, create
a room, join it, and play a full round (buzz, answer, steal, results),
confirming realtime events published by one client are actually received
and rendered by the other. Everything else — the entire spec'd feature
surface (buzzer gameplay, steal rounds, 12 modes, YouTube/Spotify, hints,
achievements, XP/levels, leaderboards, profile, settings, patch notes,
public rooms, ready-status, typing, sound effects) — is implemented and
passes tsc/lint/build, and the backend is confirmed live, but this one
verification step has never happened.

Secondary, non-blocking: the Clerk webhook isn't registered yet, so signed-
in accounts don't get profiles/leaderboard entries (guest play is fine).

Do not redo work that's already done, do not refactor unrelated code, and
do not change the realtime architecture (Ably, with explicit publish()
calls per mutating route), the host-timing-authority design, the
songs-answer-secrecy design (now code-discipline-only, no RLS backstop —
see SECURITY.md), the Drizzle schema's naming/timestamp/ID conventions in
src/lib/db/schema.ts, the single scoring implementation in
lib/scoring/engine.ts, the Next.js version pin, the ably build-bug
workaround in next.config.ts, or reintroduce Firebase or Supabase, without
flagging it to me first — all of these are deliberate, documented decisions
(see DECISIONS.md, especially D-013), not oversights.

After completing each task, update PROJECT_STATE.md, TASKS.md, and append an
entry to SESSION_LOG.md, per the "Permanent rules" in CLAUDE.md.
```
