# Architectural Decision Log

All decisions below are **inferred** from code comments and structure — there
is no commit history or design doc to confirm original intent, so each entry
is marked with how confident the inference is. Where the code itself
contains an explicit comment explaining the reasoning, that's marked
"Verified from code comment"; otherwise it's "Inferred from structure."

---

## D-001: Use Supabase Realtime (Postgres Changes) instead of Socket.io

- **Status: SUPERSEDED by D-013, session five (2026-08-06).** The project no longer uses Supabase at all — realtime is now Ably. Kept below for historical context on the "why not Socket.io" reasoning, which still applies (Ably was chosen for the same free-tier-serverless reason Supabase Realtime originally was).
- **Context:** The original product spec explicitly names "Socket.io (or equivalent WebSocket solution)" and requires the app to be "optimized to deploy on the free Vercel tier."
- **Decision:** Use Supabase Realtime's Postgres Changes (CDC over the Postgres WAL) as the entire realtime transport — no standalone Socket.io/WebSocket server.
- **Reasoning (verified from code comment, `src/lib/game/types.ts` header):** Socket.io requires a long-lived server process, which does not fit Vercel's serverless function model on the free tier. Supabase Realtime is explicitly named in the spec's own tech stack as an "equivalent" acceptable option.
- **Alternatives considered (inferred, not confirmed in writing anywhere):** Pusher, Ably, or a separate always-on Node process on a different host — all would add either cost or an extra deployment target, contradicting the "single free-tier deployment" goal.
- **Consequences:** All game-state mutations must go through Postgres (via API routes) rather than being broadcast directly — see D-003 for the follow-on consequence (no server-side timer). Also means tables that need live updates must be explicitly added to the `supabase_realtime` publication and have a public RLS SELECT policy, which shaped the whole RLS design (see D-002, D-004).
- **Affected files:** `supabase/migrations/0001_init.sql` (publication list), `src/lib/hooks/use-room-realtime.ts`, `use-game-realtime.ts`, every mutating API route.
- **Verified or inferred:** Verified (explicit code comment) for the "why not Socket.io" reasoning; the specific alternatives-considered list is inferred.

## D-002: Permissive RLS write policies, with the real authorization boundary in API routes

- **Status: PARTIALLY SUPERSEDED by D-013, session five (2026-08-06).** Neon has no RLS at all, so the "RLS as permissive second line of defense" half of this decision no longer applies — there is no second line anymore, API routes are the *only* boundary now (see `SECURITY.md`). Kept below because the API-route authorization pattern itself is unchanged and still the load-bearing mechanism.
- **Context:** Rooms must be joinable by guests with no Supabase Auth session at all (the game explicitly supports unauthenticated "guest" play via `lib/guest.ts`). Standard Supabase RLS patterns (`auth.uid() = owner_id`) can't express "any anonymous visitor with a valid room code and a client-generated guest id may write a `room_players` row for themselves."
- **Decision:** Make most write policies on gameplay tables (`rooms`, `room_players`, `games`, `game_rounds`, `round_locks`, `round_answers`, `match_history`, `room_messages`) permissive (`using (true)` / `with check (true)`), and put the actual authorization logic (host checks, buzz-lock ownership checks) in the Next.js API routes, which use the service-role key and bypass RLS entirely.
- **Reasoning:** Verified from the explicit comment block at the bottom of `0001_init.sql` ("Because rooms are joinable by short code without Supabase Auth... the real authorization boundary is the Next.js API routes...").
- **Consequences:** Anyone with the anon key (i.e., anyone — it's a public, client-exposed key) could, in principle, write directly to these tables via the Supabase client library, bypassing the API routes' authorization checks entirely, **if they chose to bypass the normal app UI and script it themselves.** This is a real, accepted tradeoff, not an oversight — see `SECURITY.md` for the full threat-model discussion of what this does and doesn't expose.
- **Affected files:** `supabase/migrations/0001_init.sql` (RLS policy section), every API route under `src/app/api/`.
- **Verified or inferred:** Verified (explicit code comment).

## D-003: The host's browser is the round-timing authority (no server-side clock)

- **Status:** Accepted (implemented). The host-transfer timer gap noted below was **fixed in session four**.
- **Context:** Round pacing (when the buzz-in window closes, when to advance to the next round) needs *something* to own a wall clock. Vercel serverless functions are not long-running processes and there's no cron/queue infrastructure in this project.
- **Decision:** The host's client runs the countdown locally and calls `POST /api/rounds/[roundId]/timeout` and `.../next` when it expires, rather than a server-side timer driving these transitions.
- **Reasoning:** Verified from the explicit comment block at the top of `src/lib/game/types.ts` and repeated in `ARCHITECTURE.md`'s worked example — same free-tier-serverless constraint as D-001.
- **Consequences:** If the host's tab is closed/backgrounded/loses network mid-round, nothing advances the game until host-transfer logic in `.../leave/route.ts` promotes a new host. **Previously**, even then, the newly promoted host had no code path to resume the existing round's timer from its actual start time. **Fixed in session four** by adding `game_rounds.phase_started_at` (a server-authoritative timestamp, updated whenever a steal phase begins), which `gameplay-view.tsx`'s hydration path and `use-game-realtime.ts`'s realtime handler both read when calling `startSteal()` — a reconnecting client or newly-promoted host now resumes the correct remaining countdown instead of restarting a full one. The round's initial `listening` phase never had this problem, since its deadline was already derived from `broadcast_payload.serverStartedAt`, itself DB-adjacent.
- **Residual risk:** host-transfer still depends on `beforeunload`'s `sendBeacon` actually firing (not guaranteed for a crashed tab or lost network) before the leave route's promotion logic runs at all — this is a smaller, different risk than the one this decision originally flagged.
- **Affected files:** `src/lib/game/types.ts`, `.../rounds/[roundId]/timeout/route.ts`, `.../answer/route.ts`, `.../next/route.ts`, `.../rooms/[code]/leave/route.ts`, `src/components/room/gameplay-view.tsx`, `src/lib/hooks/use-game-realtime.ts`, `src/lib/stores/game-store.ts`.
- **Verified or inferred:** Verified (explicit code comment) for the core decision; the fix was implemented and passed `tsc`/`build` but has not been runtime-tested against an actual host disconnect/reconnect scenario.

## D-004: `songs` (and transitively the useful parts of `game_rounds`) have no public RLS SELECT policy

- **Status: MECHANISM SUPERSEDED by D-013, session five (2026-08-06) — the intent still stands, but the enforcement no longer does.** Neon has no RLS, so there is no database-level policy enforcing this anymore. The answer-secrecy *goal* is unchanged and just as important, but it is now enforced entirely by API-route code discipline (no route may ever return a raw `songs` row pre-reveal) with zero database backstop. See `DATABASE.md`/`SECURITY.md` for the full implication — treat this as a live, ongoing risk to watch in code review, not a solved problem anymore.
- **Context:** A player's browser could otherwise query the current round's `songs` row directly via the Supabase anon-key client (since `game_rounds.song_id` is a visible, public foreign key) and read the answer before buzzing — a trivial and very tempting cheat in a buzzer game.
- **Decision:** No public SELECT policy on `songs` at all. Clients only ever see round information via `game_rounds.broadcast_payload` (pre-reveal, sanitized) and `.reveal_payload` (post-reveal, populated only after resolution), both built server-side.
- **Reasoning:** Verified from the explicit comment block in the RLS section of `0001_init.sql`.
- **Consequences:** Any future feature that wants to show song metadata to a client (e.g., a "playlist preview" page, a leaderboard of "most-played songs") must go through a server-side API route using the admin client and hand-pick safe fields, exactly like `GET /api/playlists/[id]/songs` already does for pre-game browsing — it cannot just relax the RLS policy, or the answer-secrecy guarantee breaks.
- **Affected files:** `supabase/migrations/0001_init.sql`, `src/lib/game/round-payload.ts`, `GET /api/playlists/[id]/songs`.
- **Verified or inferred:** Verified (explicit code comment).

## D-005: A JS mirror of the SQL fuzzy-matching functions is the one actually used for live scoring

- **Status:** Accepted, but arguably worth reconciling (see note below).
- **Context:** `supabase/migrations/0001_init.sql` defines `normalize_answer()` and `fuzzy_match()` as Postgres functions (using `unaccent`/`pg_trgm`), callable via RPC. `src/lib/scoring/fuzzy-match.ts` independently reimplements equivalent logic in TypeScript (Levenshtein-based similarity instead of trigram similarity).
- **Decision (inferred, not explicitly stated in a comment):** The live scoring path (`.../rounds/[roundId]/answer/route.ts`) imports and calls the TypeScript version, not the SQL RPC.
- **Reasoning (inferred):** Likely avoids an extra network round-trip per category per answer (calling a Postgres RPC vs. running JS already in the same server-side request), and keeps the matching logic co-located with the rest of the already-server-side, already-trusted API route code.
- **Consequences:** Two implementations of "fuzzy match" now exist and can silently drift (different similarity algorithms — trigram vs. Levenshtein — will accept/reject slightly different sets of typos). The SQL version is presently unused dead code from the running app's perspective (though still potentially useful for ad hoc admin SQL queries).
- **Recommendation for a future session:** either delete the SQL functions if they'll never be called, or add a comment in the migration explicitly marking them as "kept for admin/ad hoc use, not used by the live scoring API" (something close to this framing was already added to `src/lib/scoring/fuzzy-match.ts`'s own comment, but the SQL side doesn't reciprocally note it).
- **Affected files:** `supabase/migrations/0001_init.sql`, `src/lib/scoring/fuzzy-match.ts`.
- **Verified or inferred:** Inferred — the "why JS not RPC" reasoning is plausible but not stated anywhere in the code.

## D-006: Hand-authored `Database` type instead of `supabase gen types` output

- **Status: MOOT as of session five (2026-08-06) — superseded by D-013.** The project no longer uses Supabase or PostgREST at all; row types now come from Drizzle's native type inference on `src/lib/db/schema.ts`, which has none of the structural problems described below (no `never`-collapse risk, no `WithIndex<T>` workaround needed). `src/types/database.ts` is now a thin re-export shim, not a hand-authored type. Kept below entirely as historical record of a real, hard-won debugging finding — the underlying TypeScript/generic-constraint lesson (a plain interface doesn't structurally satisfy `Record<string, unknown>`) may still be useful if a similar pattern is ever hand-authored elsewhere.
- **Prior status (superseded): RESOLVED, 2026-08-06** (was "actively broken" — see history below). No real Supabase project exists yet, so the hand-patch path was taken rather than codegen.
- **Context:** No live Supabase project existed while the schema/types were being written, so `supabase gen types typescript` (which requires a live or linked project) wasn't available.
- **Decision:** Hand-author `src/types/database.ts` to mirror the SQL migration.
- **What was actually wrong, and the fix (both verified empirically, not just read from docs):**
  1. The schema object needs `Tables`, `Views`, and `Functions` to structurally satisfy `GenericSchema` (confirmed by reading `node_modules/@supabase/postgrest-js`'s shipped type definitions). Fixed by adding `Views: { [_ in never]: never }` and `Functions: { [_ in never]: never }` — this specific mapped-type idiom (not a plain `{}`) is what `supabase gen types typescript` itself emits for "no views/functions," chosen deliberately because it's what reliably satisfies the constraint.
  2. **A second, more subtle problem that the original audit missed:** even with `Views`/`Functions`/`Relationships` added, every `.from(table)` call still resolved to `never`. Root-caused by writing a minimal reproduction and testing it directly with `tsc`: `GenericTable`'s `Row`/`Insert`/`Update` fields are typed as `Record<string, unknown>`, and a plain named `interface` (e.g. `ProfileRow`) does **not** structurally satisfy that on its own — `interface Foo { a: string } extends Record<string, unknown>` evaluates to `false` in this TypeScript version, because `Record<string, T>` requires an index signature that a specific-properties-only interface doesn't have. This silently collapsed the entire `Schema` generic parameter to `never` via `SupabaseClient`'s own conditional-type defaults. Fixed by intersecting every Row/Insert/Update type with `Record<string, unknown>` (a `WithIndex<T>` helper) — the intersection satisfies the structural check while still preserving specific property types (`row.id` still comes back as `string`, not `unknown`).
  3. Also discovered and fixed in the same pass: the `room_messages` table was entirely missing from the `Database` type despite being a real, actively-used table (four different API routes insert into it) — this had been contributing its own `never`-typed call sites, separate from the two structural issues above.
- **Consequences (now resolved):** `npx tsc --noEmit` went from 218 errors to 0.
- **Recommendation, still standing:** regenerate via `supabase gen types typescript` the moment a real Supabase project exists — it will also catch drift the hand-authored version can't, and would have avoided needing to discover fix #2 above the hard way. Until then, add new tables via the `Table<Row, Insert, Update>` helper already in the file, not by hand-writing a new shape — see `CLAUDE.md`'s "DO NOT CHANGE WITHOUT REVIEW."
- **Affected files:** `src/types/database.ts`.
- **Verified or inferred:** Verified — both structural issues were confirmed with isolated `tsc` reproductions (not just read from documentation), and the final fix was confirmed by re-running `tsc --noEmit` and observing 0 errors.

## D-007: Scoring logic duplicated between `lib/scoring/engine.ts` and the inline answer-route implementation

- **Status: RESOLVED, session four.**
- **Original context:** `lib/scoring/engine.ts`'s `computeScore()` was a fuller, pure implementation including Chaos Mode's point modifiers (double points, reverse scoring, mystery bonus). The live route, `.../rounds/[roundId]/answer/route.ts`, implemented its own inline version of the category/bonus/steal math and did **not** call `computeScore()` — so Chaos Mode's modifiers were defined but never actually applied.
- **Fix:** `computeScore()`'s signature was changed from taking a single `category` to a `correctCategories: AnswerCategory[]` array (matching what the route actually needed — a round can require more than one category correct in one submission, and the old signature couldn't represent that without either duplicating bonus logic per category or the route working around it inline, which is exactly how the duplication happened in the first place). The answer route now calls `computeScore()` directly for all point math, passing `chaosRule: round.chaos_rule`, and the inline reimplementation was deleted.
- **Consequences (now resolved):** Chaos Mode's rolled rule (shown via `chaosLabel` in the UI) now actually changes the points awarded, matching what the badge implies.
- **Affected files:** `src/lib/scoring/engine.ts`, `src/app/api/rounds/[roundId]/answer/route.ts`.
- **Verified or inferred:** Verified — `npx tsc --noEmit` confirmed clean after the refactor; not yet runtime-tested (no live game has been played with Chaos Mode selected).

## D-008: Team Battle mode shipped as schema/settings only, no actual team logic

- **Status: RESOLVED, session four.**
- **Original context:** `RoomSettings.teamSize` and `room_players.team` existed, and `lib/game/rules.ts` had an `isTeamMode()` helper, but nothing assigned players to teams or pooled their scores — selecting "Team Battle" behaved like Classic mode with a cosmetic team-size selector.
- **Fix:** `PlayerList` gained a host-only team-assignment control (A/B buttons per player, visible only in the lobby when `settings.mode === "team_battle"`), backed by a new `POST /api/rooms/[code]/team` route. The answer route now checks `settings.mode === "team_battle" && player.team` directly (not via `isTeamMode()`, which still has no callers — worth reconciling if that helper is meant to be the canonical check) and, on a correct answer, applies the same point total to every other `room_players` row in the room with a matching `team`. Wrong-answer penalties deliberately stay individual (a design choice, not an oversight — see the code comment in the route) so one teammate's miss doesn't punish the whole team.
- **Consequences (now resolved):** Team Battle mode now does what its name implies.
- **Remaining minor inconsistency:** `lib/game/rules.ts`'s `isTeamMode()` helper is now effectively dead code / a parallel check that isn't used at the actual point-sharing call site — a future cleanup could route through it instead of the inline `settings.mode === "team_battle"` check, for a single source of truth.
- **Affected files:** `src/lib/game/rules.ts`, `src/components/room/player-list.tsx`, `src/app/api/rooms/[code]/team/route.ts`, `src/app/api/rounds/[roundId]/answer/route.ts`.
- **Verified or inferred:** Verified — `npx tsc --noEmit` confirmed clean; not yet runtime-tested with an actual 2v2+ game.

## D-009: Next.js pinned to the 15.x line, not upgraded to 16

- **Status:** Accepted (implemented) — **this is a user-specified requirement, not a technical judgment call, and is not discoverable from the code alone.**
- **Context:** The original product brief explicitly specified "Next.js 15 (App Router)" in its tech-stack section. `create-next-app@latest` at the time of scaffolding installed Next.js 16 by default (the then-current "latest").
- **Decision:** Immediately after scaffolding, `next`/`eslint-config-next`/`react`/`react-dom` were reinstalled pinned to the 15.x line (resolved to `15.5.22`), overriding what `create-next-app@latest` had just installed.
- **Reasoning:** Direct compliance with the explicit spec line, not a technical preference — Next.js 16 was, at the time, the newer/default option and would otherwise have been left in place.
- **Consequences:** A future session (or `npm update`) might reasonably "helpfully" upgrade to Next.js 16 without knowing this was deliberate. **Do not upgrade the Next.js major version without checking with the user first** — see `CLAUDE.md`'s "DO NOT CHANGE WITHOUT REVIEW".
- **Affected files:** `package.json` (`next`, `eslint-config-next`, `react`, `react-dom` versions).
- **Verified or inferred:** Verified — this was an explicit, direct instruction in the original request, not inferred from code.

## D-010: No Firebase, anywhere, for anything

- **Status:** Accepted (implemented — no Firebase dependency exists anywhere in `package.json` or code) — **another explicit user requirement not discoverable from the code alone** (the absence of something is invisible to a code read-through; a future session has no way to know this was a deliberate exclusion rather than simply "never came up").
- **Context:** The original product brief explicitly stated "No Firebase" as a constraint, alongside naming Supabase for Auth/Database/Realtime.
- **Decision:** All persistence, auth, and realtime functionality uses Supabase exclusively. No Firebase SDK, Firestore, Firebase Auth, or Firebase Hosting is used or should be introduced.
- **Reasoning:** Direct compliance with the explicit constraint.
- **Consequences:** If a future feature seems to call for something Firebase is commonly used for (e.g., push notifications, a realtime database pattern, hosting static assets), the correct move is to find or build a Supabase-native (or otherwise non-Firebase) equivalent, not to reach for Firebase as a quick fix.
- **Affected files:** N/A (constraint on what NOT to add).
- **Verified or inferred:** Verified — explicit instruction in the original request.

## D-011: Synthesized Web Audio API sound effects instead of recorded samples via howler

- **Status:** Accepted (implemented, session four).
- **Context:** The original spec called for buzz/correct/incorrect/countdown/victory/achievement sound effects. `howler` was installed from the start of the project for exactly this, but no audio asset files exist anywhere in the repo, and this environment has no way to source, record, or license real sound effects.
- **Decision:** Build `src/lib/sound/synth.ts` — short synthesized tones (oscillators + gain envelopes) generated at runtime via the native Web Audio API, gated by the existing `settingsStore.volumeEffects` slider. `howler` remains installed and unused.
- **Reasoning:** A synthesized placeholder that's honestly a placeholder (simple beeps/chimes, clearly not trying to sound like a "real" game's sound design) was judged better than either shipping silence or fabricating/mislabeling something as real sound design. It's also zero-dependency and zero-asset — no bundle size or licensing concerns.
- **Consequences:** The sound effects are functional but simple (pure tones, not sampled instruments or SFX). If real sound design is ever sourced, `howler` is already installed and ready to play actual files — `synth.ts`'s call sites (`sfx.buzz()`, `.correct()`, etc.) would just need their implementations swapped, not their call sites.
- **Affected files:** `src/lib/sound/synth.ts`, `src/components/room/gameplay-view.tsx`, `src/components/room/results-view.tsx`.
- **Verified or inferred:** This decision's reasoning is the implementer's judgment call in the moment (session four), not derived from an explicit user instruction — marked here as a design choice made under the constraint of "no real audio assets available," not verified against user preference.

## D-012: Custom background upload stored as a localStorage data URL, not Supabase Storage

- **Status:** Accepted (implemented, session four).
- **Context:** The original spec asked for custom PNG background upload. No Supabase Storage bucket is configured anywhere in this project (`DATABASE.md` — "Storage buckets: None configured").
- **Decision:** `/settings`'s file upload reads the chosen image via `FileReader.readAsDataURL()` and stores the resulting data URL directly in `settingsStore.customBackgroundUrl` (persisted to `localStorage` like the rest of that store).
- **Reasoning:** Delivers the visible feature (you can upload an image and see it as your background) without requiring new infrastructure (a Storage bucket, upload endpoint, RLS policies for it) that wasn't in scope to stand up this session.
- **Consequences:** The custom background is **local to one browser** — it does not sync across devices or persist if `localStorage` is cleared, and very large images will bloat `localStorage` (no size validation/compression is implemented). This is a real, honestly-scoped-down version of the spec'd feature, not a full asset-hosting solution.
- **Recommendation if revisited:** add a Supabase Storage bucket + upload route + `profiles.custom_background_url` (column already exists) if cross-device persistence matters.
- **Affected files:** `src/app/settings/page.tsx`, `src/lib/stores/settings-store.ts`, `src/components/providers/background-layer.tsx`.
- **Verified or inferred:** Implementer's judgment call (session four) given the no-Storage-bucket constraint; not derived from an explicit user instruction.

## D-013: Full backend migration from Supabase to Neon + Drizzle + Clerk + Ably

- **Status:** Accepted (implemented, session five, 2026-08-06). **Supersedes D-001 (Supabase Realtime) in mechanism, and changes the practical implications of D-002/D-004 (RLS-based security) without a mechanism to replace them.**
- **Context:** The user stated, verbatim: *"ok im not using supabase im using neon and clerk so rewire the bakcend ifu. have to, im limit blocked on supabase for more porjects."* This is an explicit, direct instruction — not inferred — driven by the user hitting Supabase account/rate limits across their *other*, unrelated projects (they run many concurrent side projects under one Supabase account, per `github_account` memory), not a technical problem with Sound Clash's use of Supabase specifically.
- **Decision:** Replace all three Supabase-provided services with independent, purpose-specific providers:
  1. **Database:** Supabase Postgres → **Neon** (serverless Postgres), accessed via **Drizzle ORM** (`drizzle-orm/neon-http` driver, chosen over a raw query builder because Neon has no PostgREST-equivalent query layer built in — the user was asked and chose Drizzle explicitly via an `AskUserQuestion` prompt).
  2. **Auth:** Supabase Auth → **Clerk** (the user named this explicitly in their instruction).
  3. **Realtime:** Supabase Realtime (Postgres Changes) → **Ably** (Neon has no realtime/CDC feature at all; the user was asked and chose Ably explicitly via an `AskUserQuestion` prompt, over alternatives like Pusher).
- **Reasoning:** Direct compliance with an explicit user instruction, not a technical judgment call about which stack is "better" — the user's stated reason (Supabase account-level limits blocking *other* projects) is about their Supabase account as a shared resource across projects, not this project's requirements.
- **Consequences — several are structural, not just "swap the import statements":**
  1. **No RLS-equivalent exists.** Neon has no anon/service-role key split and no Row Level Security exercised here. The single trusted server-side Drizzle connection can read/write every table. The old "RLS is a second line of defense, API routes are the first" framing (D-002) is gone — **API routes are now the only line.** This is a genuine reduction in defense-in-depth, most concretely for the songs-answer-secrecy guarantee (D-004) — see `DATABASE.md`/`SECURITY.md` for the full implication. Nothing was done to compensate for this beyond documenting it prominently; it's an accepted tradeoff of the instruction, not an oversight.
  2. **Realtime requires explicit, manual `publish()` calls in every mutating route.** Ably has no CDC/WAL-based automatic bridge the way Supabase's Postgres Changes did. Every route that used to get realtime fan-out "for free" as a side effect of writing to Postgres now needs its author to remember to call `publish(channel, event, payload)`. This is the single biggest new maintenance-burden risk introduced by the migration (see `ARCHITECTURE.md`'s "Major architectural risks").
  3. **`profiles.id` changed type** from `uuid` (mirroring `auth.users.id`) to `text` (a Clerk user id string). Every foreign key referencing it changed type too. This is a mixed-type schema (some `uuid` PKs, some `text` PKs) by necessity, not by choice.
  4. **Profile auto-creation changed from a database trigger to an HTTP webhook** (`/api/webhooks/clerk`, `user.created`). A trigger fires unconditionally on insert; a webhook depends on an external dashboard configuration step that can be forgotten or misconfigured, with no natural database-level fallback if it is.
  5. **A genuine, unrelated third-party bug was uncovered as a side effect of adding Ably**: its bundled builds (`ably` default export and `ably/modular`) contain a `super()`-called-from-an-arrow-function-inside-a-constructor pattern (valid ES2015+, but a real parser bug in the SWC version Next.js 15.5.22 ships) that fails to compile. Verified by testing both the default and modular builds and finding the identical failure at the identical logical location (`ErrorInfo`/`PartialErrorInfo` classes) in both, ruling out an ESM-vs-CJS explanation. Fixed via `serverExternalPackages: ["ably"]` (skip bundling server-side, let Node's own `require` parse it, since V8 has no such bug) plus a custom `enforce: "pre"` webpack loader (`scripts/webpack/fix-ably-super.cjs`) that rewrites the exact pattern in raw source before SWC ever parses it (needed for the client bundle, which must be webpacked for the browser regardless). This fix is coupled to `ably`'s *current* bundled output — an `ably` version upgrade should be re-verified with a clean build rather than assumed safe.
  6. The `room_players.profile_id`/`guest_id` XOR invariant, previously a Postgres `CHECK` constraint, was not ported over during the schema rewrite and is currently application-enforced only (a narrow regression, flagged in `TASKS.md` as medium priority to re-add).
  7. **Nothing about the frontend changed.** Every component, store, and page continues to consume the exact same row shapes (deliberately — see the Drizzle snake-case-naming decision folded into this same migration, documented in `CLAUDE.md`'s "Coding conventions" rather than as its own decision entry) — this was a pure backend swap with an unchanged contract at the `api-client.ts` boundary.
- **Alternatives considered:** Staying on Supabase and requesting a plan upgrade or separate project/account per side-project — rejected implicitly by the user's framing ("im limit blocked... for more porjects," i.e., the constraint is about Supabase account limits across *all* their projects, not solvable by anything scoped to this one repo).
- **Affected files:** Essentially the entire `src/app/api/` tree, `src/lib/game/{round-service,end-game,achievements}.ts`, `src/lib/hooks/{use-identity,use-room-realtime,use-game-realtime}.ts`, `src/middleware.ts`, `src/app/layout.tsx`, all of `src/lib/db/`, `src/lib/ably/`, `.env.example`, `next.config.ts`, `package.json`, `scripts/seed.ts` (new), `scripts/webpack/fix-ably-super.cjs` (new). Full list in `PROJECT_STATE.md`/`TASKS.md`'s "Recently completed" for session five.
- **Verified or inferred:** Verified — the instruction to migrate is a direct, explicit user quote; the choice of Drizzle and Ably specifically were confirmed via direct `AskUserQuestion` prompts to the user (both times the recommended/first-listed option was selected); `npx tsc --noEmit`, `npm run lint`, and `npx next build` all passed cleanly after the full rewrite. **Not yet verified:** any of this has never been runtime-tested against real Neon/Clerk/Ably infrastructure — see `PROJECT_STATE.md`.
