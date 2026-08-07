# Changelog

This file started as prose changelog entries written before the project had
real git history (no commits existed yet at the time — the repository's
`README.md` was, until then, still the unedited `create-next-app`
boilerplate). **Correction (2026-08-07 checkpoint pass):** the project now
has its own git repository, pushed to `https://github.com/Gariyuuu/sound-clash.git`
(see `PROJECT_STATE.md`'s "Git state") — the "no git commits" framing below
describes a past state, not the current one. `git log --oneline` is now the
authoritative commit history; this file remains a human-readable summary
layered on top of it, but is not fully caught up with the five real commits
that now exist — see `PROJECT_STATE.md`'s "Documentation gap" for the four
most recent, undocumented-here commits (Career Mode, genre filtering,
background expansion, scoreboard fix).

## [Unreleased] — 2026-08-06 — Backend migrated: Supabase → Neon + Drizzle + Clerk + Ably

### Changed
- **Database:** Supabase Postgres → Neon, accessed via Drizzle ORM. Schema source of truth moved from `supabase/migrations/0001_init.sql` to `src/lib/db/schema.ts`.
- **Auth:** Supabase Auth → Clerk. Profile auto-creation moved from a Postgres trigger to a Clerk webhook (`/api/webhooks/clerk`).
- **Realtime:** Supabase Realtime (Postgres Changes) → Ably (token-authenticated pub/sub). Every mutating API route now explicitly publishes its own realtime events — see `ARCHITECTURE.md`.
- Every API route rewritten from Supabase's PostgREST query builder to Drizzle.

### Added
- `src/lib/db/{schema,client}.ts`, `drizzle.config.ts`, `scripts/seed.ts` (replaces `supabase/seed.sql`), `db:push`/`db:generate`/`db:studio`/`db:seed` npm scripts.
- `src/lib/ably/{client,publish}.ts`, `GET /api/ably-token`.
- `POST /api/webhooks/clerk`, `/sign-in`, `/sign-up` pages.
- `scripts/webpack/fix-ably-super.cjs` + `next.config.ts` config — works around a genuine parser bug in `ably`'s bundled output under Next.js 15.5.22's SWC (see `DECISIONS.md` D-013).

### Removed
- `src/app/(auth)/`, `src/app/auth/` (Supabase OAuth callback), `src/components/auth/`, `src/lib/supabase/`.

### Fixed
- N/A — this was a migration, not a bug-fix pass. No behavior change was intended at the product level; see `PROJECT_STATE.md` for what remains unverified as a result.

### Notes
- Reason for the migration: the user is rate/account-limited on Supabase across their other, unrelated projects — not a technical issue with Sound Clash's prior Supabase usage. See `DECISIONS.md` D-013 for full reasoning and consequences, including a real reduction in defense-in-depth (no RLS-equivalent exists on Neon) that is now purely code-discipline-enforced — see `SECURITY.md`.
- Nothing above has been run against real Neon/Clerk/Ably infrastructure or a real dev server — see `PROJECT_STATE.md`.

## [Unreleased] — 2026-08-06 — Full spec feature surface implemented

### Added
- `/browse`, `/leaderboards`, `/profile`, `/settings`, `/patch-notes` pages.
- `GET /api/leaderboards`, `GET /api/profiles/[username]`, `POST /api/profiles/me/settings`, `POST /api/rooms/[code]/team`, `POST /api/rooms/[code]/ready`, `POST /api/playlists/import-spotify`.
- Achievement unlock logic (`src/lib/game/achievements.ts`), wired into end-of-game processing; three new `profiles` columns to support it.
- Team Battle: team assignment UI and shared team scoring.
- Spotify song source: playlist import, preview-clip playback, an honest warning when tracks lack a preview.
- Public room browsing, a room name/public-private toggle, a ready-status toggle, and a typing indicator (via Realtime Broadcast).
- Synthesized sound effects (Web Audio API — buzz, correct, incorrect, countdown tick, victory) — no bundled audio assets.
- Real, functional visual theme backgrounds for all 14 presets plus custom image upload.
- Sign-out control.

### Fixed
- Chaos Mode's point modifiers now actually apply (scoring logic reconciled into a single implementation — was previously duplicated, with the live path silently skipping Chaos modifiers).
- The host-disconnect-mid-round timer stall during a steal phase (a new server-authoritative `phase_started_at` column lets a reconnecting client or newly-promoted host resume the correct countdown).

### Changed
- `README.md` rewritten from `create-next-app` boilerplate into a real project README.
- Deleted the five unused default Next.js SVGs from `public/`.

### Not done
- Nothing above has been run against a live Supabase project or a real dev server — see `PROJECT_STATE.md`. The admin dashboard and true audio manipulation (Instrumental/Reverse Intro modes) remain out of scope — see `DECISIONS.md`/`ROADMAP.md`.

## [Unreleased] — 2026-08-06 — Gameplay screen built; app builds cleanly for the first time

### Added
- `src/components/room/gameplay-view.tsx` — the full live gameplay screen (buzzer, answer panel, hints, steal rounds, host controls, host-authoritative countdown timer, floating score popups, round-reveal overlay).
- `src/components/room/results-view.tsx` — results/podium screen with standings and a confetti celebration.
- `src/components/game/floating-score-popups.tsx`, `scoreboard-sidebar.tsx`, `round-reveal-overlay.tsx`.
- `GET /api/match-history/[id]` route.

### Fixed
- **The app now builds.** Fixed all four previously-blocking bugs: missing `gameplay-view`/`results-view` modules; the `Database` type resolving every Supabase call to `never` (two distinct root causes, see `DECISIONS.md` D-006); a broken `eslint.config.mjs` (needed `FlatCompat`, not just corrected import paths); and several Base UI/shadcn prop mismatches (`asChild` → `render`, `delayDuration` → `delay`, `onValueCommit` → `onValueCommitted`).
- A `next build` `metadataBase` warning.

### Changed
- `src/lib/stores/game-store.ts` / `use-game-realtime.ts` — added steal-timer, excluded-player, and chaos-rule tracking to support the new gameplay screen.

### Verified
- `npx tsc --noEmit`: 0 errors (was 218). `npm run lint`: exit 0 (was crashing). `npx next build`: exit 0, all 14 routes (was failing at the webpack stage).

### Not done
- Nothing above has been run against a live Supabase project or a real dev server — see `PROJECT_STATE.md`.

## [Unreleased] — 2026-08-06 — Documentation & handoff audit

This entry documents a **documentation-only** session — no product code was
added, removed, or behaviorally changed. Its purpose was to make the
repository self-sufficient as a source of truth for a new AI coding session
with no access to prior conversation history.

### Added
- `CLAUDE.md` — primary AI operating manual (rewritten from a one-line `@AGENTS.md` import into a full project manual; the `@AGENTS.md` import itself was preserved since it's auto-regenerated tooling, not project content).
- `PROJECT_STATE.md` — exact point-in-time development snapshot.
- `TASKS.md` — active task queue, including four newly-identified P0/P1 bugs (see below).
- `ARCHITECTURE.md` — system diagram (Mermaid) and request-lifecycle walkthrough.
- `FILE_MAP.md` — practical file-by-file map and "where to make common changes" guide.
- `FEATURES.md` — every spec'd feature classified against actual implementation status.
- `ROADMAP.md` — milestone plan with no invented time estimates.
- `DECISIONS.md` — 8-entry architectural decision log, reconstructed from code comments and structure (each entry labeled verified vs. inferred).
- `DATABASE.md` — full schema documentation with a Mermaid ER diagram.
- `API_REFERENCE.md` — every API route documented (request/response shapes, auth, side effects, rate limits).
- `UI_SYSTEM.md` — design system, theming, and component-library documentation, including the `base-nova`/Base UI gotcha discovered during verification.
- `SECURITY.md` — defensive review, including a newly-identified player-identity-spoofing gap.
- `TESTING.md` — proposed test strategy (no tests existed before or after this session).
- `DEPLOYMENT.md` — deployment plan and checklist (nothing has ever actually been deployed).
- `SESSION_LOG.md` — chronological session log, seeded with this audit as the first entry.
- `HANDOFF.md` — onboarding document for the next AI session, with a copy-ready starter prompt.
- This file.

### Changed
- Nothing in `src/`, `supabase/`, or any config file was modified.

### Fixed
- Nothing was fixed — bugs found during verification were documented (`TASKS.md` T-001–T-004) but deliberately left unfixed, per this session's explicit scope (documentation/audit only, no feature or bugfix work).

### Significant problems discovered (see `TASKS.md`/`PROJECT_STATE.md` for full detail)
- `next build` fails (missing `gameplay-view.tsx`/`results-view.tsx`).
- `npx tsc --noEmit` reports 218 errors, ~200 of them from a single root cause: `src/types/database.ts`'s hand-authored type doesn't satisfy `@supabase/supabase-js`'s generic constraints, so every database call resolves to `never`.
- `npm run lint` crashes outright (`eslint.config.mjs` import path bug).
- Several component prop mismatches against the actual installed (`base-nova`/Base UI) shadcn component set.
- Multiple features that appear complete by file existence (Spotify source, Team Battle mode, achievements, leaderboards) are actually UI-only, schema-only, or entirely unimplemented — see `FEATURES.md`.

No prior release history exists to preserve beyond what's captured here.
