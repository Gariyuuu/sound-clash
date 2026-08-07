# Roadmap

No dates/time estimates are given anywhere in the repository, so none are
invented here. Priorities below are inferred from what's structurally
closest to done (per `FEATURES.md`) and what blocks everything else.

## Completed milestone: Get the app building and running

- **Status: Done, 2026-08-06 (session three).** All four blocking bugs (`TASKS.md` T-001–T-004) fixed; `npx tsc --noEmit`, `npm run lint`, and `npx next build` all exit 0.

## Completed milestone: A playable end-to-end Classic-mode game (in code)

- **Status: Done in code, 2026-08-06 (session three).** `gameplay-view.tsx`/`results-view.tsx` built and composed; floating score popups, steal-round banner, round-reveal overlay, podium/confetti all implemented.

## Completed milestone: The full spec'd feature surface (in code)

- **Objective:** Implement everything from the original product brief that was still missing or non-functional as of session three — leaderboards, profile, settings, patch notes, achievements, Team Battle, Spotify, public room browsing, ready-status, typing indicators, sound effects — plus fix the two known bugs (scoring-duplication, host-disconnect timer gap) that had been carried since the original audit.
- **Status: Done in code, 2026-08-06 (session four).** See `TASKS.md`'s "Recently completed" for the full itemized list. `npx tsc --noEmit`, `npm run lint`, and `npx next build` all still exit 0 (22 routes, up from 14).
- **Not done from this milestone's implied scope:** the admin dashboard and true audio manipulation for Instrumental/Reverse Intro modes were explicitly judged new ground / infeasible respectively, not "missing gap-fills" — see "Explicitly out of scope" below.

## Completed milestone: Backend migration to Neon + Drizzle + Clerk + Ably

- **Objective:** Replace Supabase (Postgres + Auth + Realtime) entirely, at the user's explicit request — they hit Supabase account/rate limits across their *other* concurrent projects, not a technical problem with this one.
- **Status: Done in code, 2026-08-06 (session five).** Every API route, every game-logic module, auth, and realtime rewired. See `DECISIONS.md` D-013, `TASKS.md`'s "Recently completed." `npx tsc --noEmit`, `npm run lint`, and `npx next build` all exit 0 (40 routes, up from 22).
- **Not part of this milestone's scope:** re-adding a database-level defense layer equivalent to RLS (none exists for Neon and none was built as a replacement — see `SECURITY.md`) or re-adding the `profile_id`/`guest_id` XOR CHECK constraint (dropped during the schema rewrite) — both flagged in `TASKS.md`, neither blocking.

## Current milestone: Runtime-verify everything against real infrastructure

- **Objective:** Provision a real Neon project, a Clerk application (with its webhook configured), and an Ably application; apply the schema + seed data; and play a full 2+ player game start to finish — including a Team Battle match, a Chaos Mode round, a Spotify-sourced playlist, and enough games to observe an achievement unlock — per `TESTING.md`'s manual checklist.
- **Priority:** Highest — nothing built across any of the five sessions has ever been executed against a live database or a running dev server, on either the old or new backend. This is now even more urgent than before, since session five changed every I/O boundary (database, auth, realtime) simultaneously.
- **Status:** Not done — blocked only on the user provisioning real infrastructure (no further code work is believed to be a prerequisite).
- **Dependencies:** A Neon project, a Clerk application, an Ably application, and `.env.local`.
- **Difficulty:** Low to set up; unknown how much real-bug-fixing effort surfaces once actually run — likely higher than usual given the scope of session five's mechanical rewrite (any single route could have a transcription error that still type-checks, e.g. a missed `publish()` call).
- **Risk:** High — every mutating route was rewritten this session; treat all of them as equally unexercised, not just the historically-tricky spots (Team Battle, achievements, Spotify).
- **Definition of done:** a 2+ player game played start to finish with visible live scores (delivered via Ably, not polling), at least one steal round, a working results screen, an achievement unlocking, a sign-up that actually creates a `profiles` row via the Clerk webhook, and (separately) a Team Battle game showing pooled scoring — against real deployed-or-local Neon/Clerk/Ably infrastructure.

## Post-MVP (polish, not gap-fills)

- Achievement-unlock UI feedback (toast/animation) — the data layer and a synthesized sound effect (`sfx.achievement()`) already exist, nothing calls them from a visible moment yet.
- Match history *list* + round-by-round replay/timeline viewer (the single-game results/podium screen exists; browsing historical games or scrubbing a past game's `timeline` JSON does not).
- Statistics graphs (needs a charting library choice — none installed; `/profile` currently shows key stats as tiles, not charts).
- Presence/ping measurement for the lobby (spec'd, entirely unbuilt).
- Reconcile `lib/game/rules.ts`'s now-dead `isTeamMode()` helper with the inline `settings.mode === "team_battle"` check added this session (see `DECISIONS.md` D-008).

## Long-term ideas (from the original spec, no implementation groundwork yet)

- Admin dashboard (needs a roles/permissions concept added to the schema first — none exists today; this is new ground, not a fix to something partially built).
- XP-unlockable cosmetics (avatars, borders, badges, titles, emotes) beyond the raw `xp`/`level` numbers and the 9 achievements that already exist.
- Real recorded sound effects (synthesized Web Audio API tones exist today — see `DECISIONS.md` D-011 — as a deliberate, honest substitute).
- Cross-device custom background persistence via real file/blob storage (currently a per-browser `localStorage` data URL — see `DECISIONS.md` D-012).
- Friends-only and time-windowed (weekly/monthly) leaderboards (only a global, all-time leaderboard per metric exists).

## Explicitly out of scope (documented limitations, not just "not done yet")

- **True audio manipulation** (Instrumental Mode's vocal removal, Reverse Intro's reversed playback) against a plain YouTube iframe embed or Spotify preview `<audio>` element — would require downloading and reprocessing audio server-side (e.g. source separation), which doesn't fit a free-tier serverless deployment target. See `youtube-player.tsx`'s comment and `FEATURES.md`.
- **A standalone realtime/game server** (Socket.io or similar) — deliberately replaced with a managed pub/sub service (Ably, previously Supabase Postgres Changes) to fit free-tier Vercel hosting. See `DECISIONS.md` `D-013` (supersedes `D-001`). Revisiting this would be a full realtime-layer rewrite, not a small change.
- **Reintroducing Supabase** — explicitly ruled out; the user moved off it due to account-level rate limits across their other projects. See `DECISIONS.md` `D-013`.
- **A server-side round-timer clock** — deliberately replaced with host-browser timing authority for the same free-tier-serverless reason. See `DECISIONS.md` `D-003` (the host-transfer edge case within this design was fixed in session four; the overall architectural choice remains).
