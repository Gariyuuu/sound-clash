# Testing

## Current state: no test infrastructure exists

Verified: no `vitest`, `jest`, `@playwright/test`, `cypress`, or any other test
runner appears in `package.json`. No `*.test.ts`, `*.spec.ts`, or `__tests__/`
directory exists anywhere in `src/`. No `test`/`test:e2e` script exists in
`package.json`. This is a from-scratch testing setup for whoever picks this up.

## Recommended test strategy (proposed, not yet implemented)

1. **Unit tests for pure logic first** — highest value per effort, zero mocking needed:
   - `src/lib/scoring/engine.ts` — `computeScore()`, `computeIncorrectPenalty()`, `xpForGame()`, `levelForXp()`. Note per `DECISIONS.md` D-007: `computeScore()` currently has no production callers, so tests here would validate logic that isn't live yet — write them anyway (it's the intended shared implementation) but don't confuse "tested" with "exercised in production."
   - `src/lib/scoring/fuzzy-match.ts` — `normalizeAnswer()`, `fuzzyMatch()`. This one **is** the live implementation. Good candidate test cases straight from the spec: `"The Weeknd"` / `"Weeknd"` / `"the weeknd"` should all match; accented characters, punctuation, extra whitespace should normalize away.
   - `src/lib/game/rules.ts` — `resolveTimerSeconds`, `resolveCategories`, `hintsAllowed`, `eliminatesOnWrongAnswer`, `rollChaosRule` (the last is non-deterministic, so test it returns a value in the valid set, not an exact value).
   - `src/lib/game/room-code.ts` — sanity check on alphabet/length.
2. **Integration tests for API routes** — needs a real (or locally-run) Neon/Postgres instance, since the routes use the actual Drizzle client rather than a mockable data layer. Highest-value targets given the codebase's own biggest risk areas:
   - The buzz race (`POST /api/rounds/[roundId]/buzz`) — specifically, fire concurrent requests for the same round/phase and assert exactly one wins. This is the single most important behavior to have a regression test for, since it's the entire anti-cheat mechanism.
   - The steal-round flow end to end: wrong answer → excluded_player_ids grows → phase increments → correct steal answer gets 80% points → round resolves.
   - Host-only authorization checks (settings/start/kick/control/hint/next-round all reject non-host callers).
3. **End-to-end tests** (Playwright, not yet installed) — now that `gameplay-view.tsx` exists, a two-browser-context test (host + one player) driving a full room create → join → start → buzz → answer → next-round → results loop would be the highest-value E2E test in the whole project, given that's the entire product.

## Manual testing steps (what a human should do right now, since no automation exists)

**The app now builds cleanly** (`tsc`/`lint`/`build` all pass — see `PROJECT_STATE.md`) and the full spec'd feature surface is implemented in code on the Neon/Clerk/Ably stack (migrated from Supabase in session five, see `DECISIONS.md` D-013), but none of it has ever been run against real infrastructure, on either backend. This is now the single highest-priority next step (see `TASKS.md`), more urgently than before since session five touched every I/O boundary at once:

1. Provision a Neon project, a Clerk application (with its `user.created` webhook configured), and an Ably application. Run `npm run db:push && npm run db:seed`, set `.env.local`.
2. `npm run dev`, open two browser windows (or one normal + one incognito, to get distinct localStorage guest IDs) — sign up via Clerk in at least one window (guest play won't exercise achievements/leaderboards/profile) and confirm a `profiles` row actually appears (via `npm run db:studio` or the Neon dashboard) — this is the first real test of the Clerk webhook.
3. Window A: create a room, note the code, select a playlist (use the seeded demo playlist, or test importing a YouTube/Spotify playlist if you have API keys configured), pick Classic mode.
4. Window B: join with the code, confirm you see Window A's player appear/disappear live if they leave. Toggle "Ready" in each window and confirm both see it update.
5. Send a chat message and start typing in the input without sending — confirm the other window shows a typing indicator, then confirm it clears.
6. Send a chat message and an emoji reaction from each window, confirm both see it.
7. Window A (host): start the game.
8. Confirm both windows see the same round start at roughly the same time, buzz from one window, confirm the other window immediately shows it locked out (and hear the buzz sound effect), submit a (wrong, then correct-on-steal) answer, confirm scores update live in both windows via `FloatingScorePopups`/`ScoreboardSidebar`, and that correct/incorrect sound effects play.
9. Play through to the last round, confirm the results/podium screen appears with confetti and a victory sound.
10. **Repeat with Team Battle mode:** assign both players to the same team in the lobby before starting, confirm a correct answer adds points to both team members' scores.
11. **Repeat with Chaos Mode:** confirm the "Chaos: <rule>" badge appears each round and that, e.g., a "Double Points" round genuinely awards double.
12. **If Spotify is configured:** import a Spotify playlist, confirm the warning about tracks with no preview shows when applicable, and that a Spotify-sourced round plays via the `<audio>`-based player.
13. Play enough games (or manipulate profile stats directly via the SQL editor) to trigger at least one achievement unlock, then check the `/profile` page shows it unlocked and `/leaderboards` reflects updated stats.
14. Kick/ban a player from the host window, confirm they're removed live from the other window.
15. Close the host's tab mid-round (or navigate away) and confirm host status transfers to the remaining player — **specifically test this during a steal phase** (not just the initial listening phase) to exercise the `phase_started_at` timer-resume fix from session four; confirm the countdown resumes from roughly the right remaining time rather than restarting.
16. Visit `/settings`, change the theme, background, and a volume slider; confirm they persist across a refresh; visit `/browse` and confirm a public room (toggle "Public room" in host settings first) appears in the list.

## Test data / fixtures

`scripts/seed.ts` (run via `npm run db:seed`) is the closest thing to a fixture — one demo playlist, 8 real (web-search-verified at time of writing) YouTube-backed songs, plus the achievement catalog, safe to use for manual testing without needing `YOUTUBE_API_KEY` configured. No fixtures exist for `profiles`/auth — creating test accounts would require actually signing up through Clerk (no seeded test users).

## Test environment variables

None specific to testing exist (no `.env.test`). Whatever `TESTING.md`-driven work happens later would presumably need its own Neon project (a Neon "branch" is the natural equivalent of a disposable test database) plus Clerk/Ably test-mode credentials — not currently set up in this repo.

## Known flaky tests

None — there are no tests to be flaky.

## Coverage gaps (i.e., everything)

100% of the codebase is currently untested. If forced to prioritize given limited time, in order: the buzz-race atomicity, the fuzzy-match function, the steal-round scoring math, and host-authorization checks — in that order, matching where a silent regression would be most damaging to the actual game (cheating/scoring correctness) versus most visible to a developer anyway (auth 403s are easy to notice manually).

## Pre-release checklist (proposed — nothing here has been executed)

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] Schema (`src/lib/db/schema.ts`) pushed to a real Neon project without error (`npm run db:push`)
- [ ] Manual smoke test (above) completed with 2+ real browser sessions
- [ ] Buzz-race tested with genuinely concurrent clicks from 2+ devices (not just 2 tabs on one machine, which may not exercise real network-race timing)
- [ ] Host-disconnect-mid-round behavior observed at least once
- [ ] `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and `ABLY_API_KEY` confirmed absent from any client bundle (`next build`'s output / browser devtools Network tab, search for the key values)
