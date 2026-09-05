# Project State

**Last updated:** 2026-09-05 (W4 game-loop overhaul — UI/interaction only; the 2026-08-07 checkpoint content below is unchanged and still current)

## Most recent pass: W4 game-loop overhaul (2026-09-05)

Presentation and interaction only. No gameplay, scoring, realtime, schema or API
behaviour was changed; the one non-UI edit is `MAX_PLAYERS` moving from a literal
in the join route to `src/lib/game/types.ts` so three call sites agree.

Adopted the portfolio's shared `GAME-LOOP.css` v1.0 layer (vendored to
`src/app/design-system/game-loop.css`) and fixed five defects it surfaced — the
results screen congratulating every player regardless of placement being the
largest. Full detail in `SESSION_LOG.md`; the design mapping is in `UI_SYSTEM.md`.

`tsc`/`lint`/`build` clean. Verified in a real browser against `next start` with
the live Neon/Ably env, including a real room created via the API. The full
buzz → answer → results loop still has not been played by a human (unchanged
gap, see below), so the three outcome states were verified as computed CSS in
all three motion settings rather than by finishing a match.

**One defect was found and deliberately not fixed:** the light theme is not
designed — see `UI_SYSTEM.md`'s "Known defect" and the new top item in
`TASKS.md`'s High priority.

This file is a point-in-time snapshot. It will go stale the moment more work
happens — update it every session (see `CLAUDE.md` → "Permanent rules").

---

## Documentation gap — read this before trusting anything below labeled "sixth session"

`git log` (see "Git state" below) proves more work happened after the sixth-session snapshot this file used to describe as current, and after the seventh session that `TASKS.md`/`SESSION_LOG.md` do cover. **Four commits exist with no corresponding `SESSION_LOG.md` entry and no `FEATURES.md`/`UI_SYSTEM.md`/`API_REFERENCE.md` updates:**

1. `c2c6c9c` — Hide YouTube video overlay during gameplay (fixed an answer-leak: the embed showed title/channel even with `controls=0`), add Career Mode entry point (`src/app/career/page.tsx`, wired to the homepage).
2. `8c1c4f7` — Add genre filtering to Career Mode (10 genres: Pop, Hip-Hop, Rock, R&B, Country, Electronic, K-Pop, Latin, Indie, Oldies) and to the room lobby's playlist picker, plus a genre tag field on playlist import.
3. `34a189e` — Soften AI opponent buzz timing (widened per-difficulty delay windows), raise buzz timer default/max (10s→20s / 20s→30s), expand background presets 14→20 (added Aurora, Desert, Midnight City, Sakura, Volcano, Frost, each with a 5-color palette) plus a procedural grain overlay.
4. `d17c6c8` — Fix a real bug: several score/streak/spectator changes (timeout penalties especially) either published to the wrong Ably channel/event or never published at all, so the scoreboard only updated on refresh. Also a scoreboard visual redesign (medal ranks, live relative-score bars, flash/slide animation on change) and a mid-game buzz-timer adjustment control for the host.

This checkpoint pass verified the **code compiles/lints/builds** (which covers this work, since it's already committed) and fixed the clearest cross-doc factual errors this gap caused (background count, git-state claims — see below), but did **not** write full `FEATURES.md`/`UI_SYSTEM.md`/`API_REFERENCE.md` entries for Career Mode, genre filtering, or the scoreboard redesign — that's real, scoped work for whoever picks this up next. Until then, treat `FEATURES.md`'s feature list as **incomplete** (missing Career Mode entirely) rather than wrong-but-otherwise-trustworthy.

---

## Infrastructure is live — the "Next up" item from every prior session is now done

Real Neon, Clerk, and Ably resources were provisioned this session (via the Vercel CLI's marketplace-integration commands — `vercel integration add neon` / `vercel integration add clerk`, plus a manually-obtained Ably key), the app was deployed to Vercel, and the deployment was verified against real traffic, not just static analysis:

- **Live URL:** https://sound-clash-nu.vercel.app — publicly reachable (`200`), no SSO wall.
- **Neon:** `npm run db:push` applied the full schema; `npm run db:seed` loaded the achievement catalog + demo playlist; a real room was created via `POST /api/rooms` against both the local dev server and the live production URL and persisted correctly (confirmed via the API response, not just an assumed success).
- **Clerk:** real publishable/secret keys wired in (via Vercel's Clerk marketplace integration); the homepage and middleware no longer crash (previously threw `Publishable key not valid.` with a placeholder key).
- **Ably:** real root API key wired in (server + all three Vercel environments); `/api/ably-token` confirmed minting a real, correctly-signed token (`200`, real `keyName`/`mac`); a live `publish()` call was exercised via `POST /api/rooms/[code]/join` and succeeded (that route has no try/catch around `publish()`, so a `200` response proves the Ably write actually succeeded, not just that the HTTP handler ran).

**Still not done:** the Clerk webhook (`/api/webhooks/clerk`) is not yet registered in the Clerk Dashboard — new sign-ups authenticate but won't get a `profiles` row until that's configured against the live URL above. Guest play is fully unaffected by this. A full **two-human, two-device** game (buzz race, steal round, results screen, achievement unlock) has still not been played — only single-session API-level checks have been run so far. See "Next three recommended actions" below.

---

## Git state

**Corrected 2026-08-07 (checkpoint pass) — this section was wrong as of every prior session's write-up.** `sound-clash` now has its own independent git repository and has had one since sometime after the sixth session's docs were written; the "no git repo anywhere" claim in `CLAUDE.md`/`DEPLOYMENT.md`/`CHANGELOG.md`/earlier `SESSION_LOG.md` entries reflected reality *at the time* but is stale.

- **Repository root for git purposes:** `~/Projects/sound-clash` itself — it has its own `.git`, independent of the parent `~/Projects` tree.
- **Remote:** `origin` → `https://github.com/Gariyuuu/sound-clash.git` (both fetch and push).
- **Current branch:** `main`, up to date with `origin/main` (verified via `git fetch origin` — no divergence).
- **Latest commits (`git log --oneline -5`):**
  ```
  d17c6c8 Fix live scoreboard not updating, redesign scoreboard, add live timer control
  34a189e Soften AI bot timing, extend buzz timer, expand backgrounds to 20
  8c1c4f7 Add genre filtering to Career Mode and playlist picker
  c2c6c9c Hide YouTube video overlay during gameplay, add Career Mode entry point
  ed88dd2 Initial commit: Sound Clash
  ```
- **Working tree:** clean, 0 uncommitted changes, 0 ahead/behind `origin/main` (as of this checkpoint pass).
- **Whether Vercel's git integration (auto-deploy-on-push) is connected is unconfirmed** — `.vercel/project.json` exists (see `DEPLOYMENT.md`) but this checkpoint did not run `vercel git connect`/inspect dashboard settings. Don't assume either way; verify with `vercel git ls` or the dashboard before relying on push-to-deploy.
- **Reminder:** always `cd /Users/gariyuu/Projects/sound-clash && pwd && git status` to confirm at the start of a session.

## What changed this session

The user stated: **"im not using supabase im using neon and clerk so rewire the backend if u have to, im limit blocked on supabase for more porjects"** — an explicit request to fully migrate off Supabase because the user is rate/account-limited on Supabase across their other concurrent projects, with explicit permission to rewire whatever was necessary. This was **not** a documentation-only checkpoint request (unlike the two prior sessions) — full implementation work was expected and performed.

**Full backend migration, in place, same frontend:**
- **Database:** Supabase Postgres → **Neon** (serverless Postgres), accessed via **Drizzle ORM** (`drizzle-orm/neon-http`). New schema source of truth: `src/lib/db/schema.ts` (replaces `supabase/migrations/0001_init.sql`, kept only as historical reference).
- **Auth:** Supabase Auth → **Clerk** (`@clerk/nextjs`). Profile auto-creation moved from a Postgres trigger to a Clerk webhook (`/api/webhooks/clerk`, `user.created` event).
- **Realtime:** Supabase Realtime (Postgres Changes) → **Ably** (token-authenticated pub/sub). Since Ably has no automatic database-to-realtime bridge, every mutating API route now explicitly calls a `publish()` helper after each write — see `ARCHITECTURE.md` for the full event-name contract.
- Every API route under `src/app/api/rooms/`, `src/app/api/rounds/`, `src/app/api/playlists/`, `src/app/api/profiles/`, `src/app/api/leaderboards/`, `src/app/api/match-history/` was rewritten from Supabase's PostgREST query builder to Drizzle.
- `src/lib/game/round-service.ts`, `end-game.ts`, `achievements.ts` (the shared game-logic modules) were rewritten to drop their `SupabaseClient` parameter and use the singleton Drizzle `db` directly, and `end-game.ts`/`round-service.ts` now publish their own Ably events (`round_insert`, `game_update`, `room_update`) rather than relying on callers or automatic DB-change propagation.
- `src/lib/hooks/use-identity.ts`, `use-room-realtime.ts`, `use-game-realtime.ts` rewritten for Clerk (`useUser()`) and Ably (`getAblyClient()`) respectively.
- `src/middleware.ts` rewritten to `clerkMiddleware()`. `src/app/layout.tsx` wrapped in `<ClerkProvider>`.
- Deleted: `src/app/(auth)/`, `src/app/auth/` (Supabase OAuth callback), `src/components/auth/`, `src/lib/supabase/` (all three client constructors). Added: `src/app/sign-in/[[...sign-in]]/`, `src/app/sign-up/[[...sign-up]]/` (Clerk components), `src/app/api/webhooks/clerk/`, `src/app/api/ably-token/`, `src/lib/ably/` (`client.ts`, `publish.ts`), `src/lib/db/` (`schema.ts`, `client.ts`), `drizzle.config.ts`, `scripts/seed.ts`.
- `.env.example` rewritten for the new stack (`DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `ABLY_API_KEY`, YouTube/Spotify vars unchanged).
- **A real third-party build bug was found and fixed**, not just config: `ably`'s bundled builds (both the default `ably` export and the tree-shakable `ably/modular` variant) contain a syntax pattern that Next.js 15.5.22's SWC parser fails on (`'super' keyword outside a method` — a valid ES2015+ pattern, genuinely a parser bug, confirmed by testing both module variants and finding the identical failure in both). Fixed via `next.config.ts`'s `serverExternalPackages: ["ably"]` (skips bundling for server code) plus a custom `enforce: "pre"` webpack loader, `scripts/webpack/fix-ably-super.cjs`, that patches the offending pattern in the raw source before SWC parses it (used for the browser bundle, which must still be webpacked).

See `DECISIONS.md` D-013 for the full reasoning and consequences of this migration.

## Current build status — verified, not assumed

```
npx tsc --noEmit   → exit 0, 0 errors
npm run lint        → exit 0, 0 findings
npx next build       → exit 0, 40 routes generated (originally: using dummy DATABASE_URL/Clerk/Ably env vars, no live project existed in this environment)
```

Re-run and confirmed clean immediately before writing this update, after all changes described above. **The Vercel production build (`vercel --prod`) also succeeded against the real infrastructure** — same 40-ish routes, deployed and serving real traffic at the live URL above.

**Re-verified 2026-08-07 (checkpoint pass, against the current tree including the four undocumented commits above):** `npx tsc --noEmit` → exit 0, 0 errors. `npm run lint` → exit 0, 0 findings. `npm run build` → exit 0, 44 routes generated (up from 40 — the new `/career` page and the AI-opponent routes account for the growth). The `ably`/SWC build workaround (`next.config.ts`'s `serverExternalPackages: ["ably"]` + `scripts/webpack/fix-ably-super.cjs`) is still in place, unmodified, and the build still succeeds with it — the underlying `ably`-bundle parser bug has **not** been fixed upstream and the workaround is still required; do not remove it. Neon (`@neondatabase/serverless` in `src/lib/db/client.ts`), Drizzle (`src/lib/db/schema.ts`), Clerk (`@clerk/nextjs` in `src/middleware.ts` + 9 other files), and Ably (`ably` package, used in 21 files across API routes, hooks, and `lib/ably/`, `lib/game/`) are all genuinely wired into the code, not just declared as dependencies — confirmed via `grep -rl` across `src/`, not just `package.json`.

## What still has NOT been verified

The stack is now provisioned and individually verified at the API level (see "Infrastructure is live" above), but a **full multiplayer game has not been played by a human yet**. Specifically still open:
- The Clerk webhook (`user.created` → `profiles` row) has never fired — no webhook endpoint is registered in the Clerk Dashboard yet, so this is still entirely unverified end to end. Guest play is unaffected.
- Ably `publish()` calls have been confirmed to succeed (no error) from the `join` route, but **no client has actually subscribed and received one of these events yet** — the buzz race, round transitions, chat, and typing indicator all still need a real two-browser/two-device test to confirm they render correctly on the *receiving* end, not just that the server-side write didn't error.
- `next dev`'s incremental-compilation path was exercised this session (dev server booted and served real API responses successfully) — the `ably` build-patch webpack loader is now confirmed working in both `next dev` and `next build`/Vercel production builds.
- No achievement has ever actually unlocked, no Team Battle/Chaos Mode round has been played, no host-disconnect/reconnect scenario has been exercised.

## Schema changes this session

Full schema rewrite from SQL to Drizzle TypeScript (`src/lib/db/schema.ts`) — table/column shapes are intended to be equivalent to `supabase/migrations/0001_init.sql`, with two deliberate structural differences documented in `DATABASE.md`:
1. `profiles.id` is now `text` (a Clerk user id), not `uuid`.
2. The `room_players.profile_id`/`guest_id` XOR invariant is no longer a database CHECK constraint (dropped during the migration, not yet re-added) — application-enforced only.

## Current feature completeness snapshot

Unchanged from before this migration — see `FEATURES.md`. This session was a backend rewrite, not a feature-completeness change; no product feature was added, removed, or altered in behavior (as observed via static analysis — see "verification required" below for the obvious caveat that this hasn't been runtime-confirmed).

## Known gaps carried forward

- Everything listed in the previous session's `PROJECT_STATE.md` (achievement-unlock UI feedback, match replay timeline scrubber, no automated tests) — unchanged, out of scope for this session's backend-only migration.
- **New gap introduced by this migration:** no RLS-equivalent database defense layer exists anymore — see `SECURITY.md`'s "Production security gaps — prioritized" #1.
- **New gap:** `room_players`'s identity XOR invariant has no database-level enforcement (see "Schema changes" above).

## Assumptions currently in effect (documented, updated this session)

- Realtime = Ably token-authenticated pub/sub with explicit per-route `publish()` calls, **not** Supabase Postgres Changes (`DECISIONS.md` D-013, supersedes D-001).
- Database = Neon Postgres via Drizzle ORM, **not** Supabase (`DECISIONS.md` D-013).
- Auth = Clerk, **not** Supabase Auth (`DECISIONS.md` D-013).
- Host's browser is still the round-timing authority, unchanged (`DECISIONS.md` D-003).
- `songs`/`game_rounds` answer-secrecy is now purely code-discipline-based, no database backstop (`DATABASE.md`, `SECURITY.md`) — was previously RLS-enforced (`DECISIONS.md` D-004, mechanism superseded).
- Next.js pinned to 15.x; Firebase must never be introduced (`DECISIONS.md` D-009/D-010) — untouched this session.
- Supabase must not be reintroduced anywhere (`DECISIONS.md` D-013) — a new, explicit constraint as of this session, same category as the Firebase constraint.

## Next three recommended actions

1. **Play a real two-device game** against https://sound-clash-nu.vercel.app — create a room on one device, join from another, and go through a full round (buzz, answer, steal, results). This is the one thing that's still purely theoretical: every piece has been verified individually (DB writes persist, Ably token minting works, a publish call succeeds) but nothing has confirmed the receiving end of a realtime event actually renders correctly in a browser yet.
2. **Register the Clerk webhook** against the live URL (`https://sound-clash-nu.vercel.app/api/webhooks/clerk`, subscribed to `user.created`) so signed-in accounts start getting persistent profiles/XP/leaderboard entries. Not blocking — guest play works today without it.
3. Given the volume of routes rewritten in the migration session, treat the full rewrite as still-somewhat-unproven beyond the specific paths exercised so far (room create/join, ably-token) — any single route could have a transcription error not caught by `tsc`/`build`. Re-add a database-level `CHECK` constraint for the `profile_id`/`guest_id` XOR invariant (dropped during the migration — see "Schema changes" above) once the above is confirmed working.

## Verification required before continuing any further feature work

**Full runtime verification is now the single blocking item**, more urgently than in any prior session, because this session changed every I/O boundary in the app (database driver, auth provider, realtime transport) simultaneously. Static analysis (`tsc`/`lint`/`build`) passing is a necessary but very weak signal here — it cannot catch a wrong Drizzle `where` clause that still type-checks, a missing `publish()` call, or a Clerk webhook that's misconfigured. Do not layer new features on top of this migration until at least one real game has been played end to end against live Neon/Clerk/Ably infrastructure.
