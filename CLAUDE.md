@AGENTS.md

# Sound Clash — Claude Code Operating Manual

This file is the primary manual for any AI agent (or human) picking up this
repository. It was rewritten on **2026-08-06** for the **Neon + Clerk + Ably
migration** (see `DECISIONS.md` D-013) — every claim below reflects the
current code, not chat history. Where something could not be verified, it's
labeled `(Unverified)` or `(Unknown)`.

Read this file, then `PROJECT_STATE.md`, then `TASKS.md`, before touching code.

---

## Project identity

- **Name:** Sound Clash
- **One-line description:** A real-time multiplayer music-guessing party game (SongPop/Kahoot/Jackbox-style) — buzz in first, name the song, steal points off wrong answers.
- **Detailed summary:** Hosts create a room, get a 5-character join code, configure a playlist/game mode/scoring rules, and up to 20 friends join from their phones or laptops. A song clip plays for everyone in sync; the first player to hit the buzzer locks out everyone else and gets a few seconds to answer; wrong answers open a "steal" round for everyone else at reduced points. Designed around 12 selectable game-mode rule variants, hints, XP/profiles, and match history.
- **Target audience:** Friend groups doing a shared-screen or same-room party game night; secondarily, strangers in public rooms.
- **Main user problem solved:** Existing tools (Kahoot, generic YouTube-guessing streams) don't have a purpose-built buzzer race + steal-round scoring system for music trivia.
- **Current development stage: pre-alpha, backend rewritten and deployed, partially runtime-verified.** The full product surface from the original spec is implemented, the app builds cleanly, and it's live at https://sound-clash-nu.vercel.app with real infrastructure — but a full human-played, two-device game has not happened yet. See "Current status" below.
- **Production status: LIVE at https://sound-clash-nu.vercel.app** (deployed 2026-08-07, sixth session). Real Neon, Clerk, and Ably infrastructure backs it — provisioned via the Vercel CLI's marketplace-integration commands. Room creation/joining verified against the live URL via direct API calls. See `DEPLOYMENT.md` for exactly how this was provisioned and `PROJECT_STATE.md` for what's still unverified (a real two-device game hasn't been played yet).
- **Repository type:** Single Next.js App Router application. It lives at `~/Projects/sound-clash/`, which is itself an untracked subfolder of a larger `~/Projects` git working tree (see "Git state" — this project has **no git history of its own**, and no commits exist anywhere in the parent tree either).

---

## Current status

Read `PROJECT_STATE.md` for the exact point-in-time snapshot. Summary:

- **The backend was fully migrated off Supabase this session**, at the user's explicit request ("im not using supabase im using neon and clerk... im limit blocked on supabase for more porjects"). New stack: **Neon (Postgres) + Drizzle ORM** for the database, **Clerk** for auth, **Ably** for realtime pub/sub. See `DECISIONS.md` D-013 for the full reasoning and consequences.
- **The app builds cleanly on the new stack.** `npx tsc --noEmit` → 0 errors, `npm run lint` → 0 findings, `npx next build` → 0 errors, 40 routes generated (dummy env vars, no live Neon/Clerk/Ably project). See "Current status" caveats below on what that does and doesn't prove.
- **The full product surface from the original spec remains implemented** — live gameplay screen, results/podium, leaderboards, profile, settings, patch notes, achievements, Team Battle, Spotify integration, public room browsing, ready-status, typing indicators, synthesized sound effects. Nothing was removed or descoped by the migration; every route was rewired in place, same request/response shapes, same frontend.
- **Real Neon/Clerk/Ably infrastructure is now provisioned and deployed** (2026-08-07) — see `DEPLOYMENT.md`. Room creation/joining verified via direct API calls against the live URL, including a real Ably `publish()` call succeeding. **Still open:** no human has played a full two-device game yet (buzz race, steal round, results screen, an actual received realtime event on a second client), and the Clerk webhook isn't registered yet (guest play unaffected). This remains THE highest-priority next step (`TASKS.md`).
- **A genuine third-party build bug was found and worked around this session**, not just a config tweak: `ably`'s bundled browser/Node builds contain a syntax pattern (`super()` called from inside an arrow function nested in a class constructor — valid ES2015+, but a real parser bug in the SWC version Next.js 15.5.22 ships) that fails to compile under Next's webpack pipeline. Fixed via a custom `enforce: "pre"` webpack loader (`scripts/webpack/fix-ably-super.cjs`) that rewrites the offending pattern in `ably`'s source before SWC parses it, plus `serverExternalPackages: ["ably"]` in `next.config.ts` to skip bundling it server-side entirely. **Do not remove either without understanding why they're there** — see "DO NOT CHANGE WITHOUT REVIEW".
- **Deliberately still not done, with reasons:** admin dashboard (no roles/permissions concept exists — new ground, not a gap-fix), true audio manipulation for Instrumental/Reverse Intro modes (infeasible against the playback stack), real recorded sound effects (synthesized Web Audio API tones were built instead, deliberately).

---

## Technology stack

All versions below are read directly from `package.json` / installed `node_modules`, not assumed.

| Layer | Choice | Version (verified) |
|---|---|---|
| Framework | Next.js (App Router) | `15.5.22` (package.json says `^15.5.22`) |
| UI runtime | React / React DOM | `^19.2.8` |
| Language | TypeScript | `^5` (strict mode on, see `tsconfig.json`) |
| Styling | Tailwind CSS | `^4` (CSS-based config, no `tailwind.config.js` — see `src/app/globals.css`) |
| Component library | shadcn/ui CLI `^4.16.1`, style **`base-nova`** | Backed by **`@base-ui/react` `^1.7.0`**, **not Radix**. See "Coding conventions" below — this is a load-bearing gotcha. |
| Animation | Framer Motion | `^13.0.0` |
| State management | Zustand | `^5.0.14` |
| Icons | lucide-react | `^1.28.0` |
| Theme | next-themes | `^0.4.6` (wired in `layout.tsx`) |
| Backend | Next.js API Routes (no separate server) | — |
| **Database** | **Neon (serverless Postgres)** | `@neondatabase/serverless ^1.1.0` |
| **ORM** | **Drizzle ORM** (`drizzle-orm/neon-http` driver) | `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10` |
| **Auth** | **Clerk** | `@clerk/nextjs ^7.7.0` |
| **Realtime** | **Ably** (token-authenticated pub/sub) | `ably ^2.26.0` — see `DECISIONS.md` D-013 for why (was Supabase Realtime, D-001, now superseded) |
| ID generation | App-generated via `crypto.randomUUID()` (see `src/lib/db/schema.ts`), plus nanoid for guest ids | `nanoid ^6.0.1` |
| Audio FX library | howler | `^2.2.4` — **installed, zero usage anywhere in `src/`** (verified via grep; synthesized effects are used instead, see D-011) |
| Confetti | canvas-confetti | `^1.9.4` — used in `src/components/room/results-view.tsx` (podium celebration) |
| Hosting target | Vercel (free tier) | Not yet deployed |
| Testing | **None configured** — no vitest/jest/playwright in `package.json`, no test files anywhere | — |
| CI/CD | **None** — no `.github/` directory | — |
| Package manager | npm (`package-lock.json` present; no yarn/pnpm/bun lockfiles) | — |
| Node version | Unpinned — no `engines` field in `package.json`. | — |

**Do not guess versions not listed here.** If you need a version not in this table, check `package.json` / `node_modules/<pkg>/package.json` yourself.

---

## Essential commands

All commands run from the repository root (`~/Projects/sound-clash/` — this is a single-app repo, not a monorepo).

```bash
npm install              # install dependencies
npm run dev               # next dev — starts local dev server on :3000
npm run build              # next build
npm run start                # next start — requires a successful build first
npm run lint                   # eslint
npx tsc --noEmit                 # standalone type-check (use this over `next build` while debugging types — faster feedback)

# --- Database (Neon + Drizzle) ---
npm run db:push               # drizzle-kit push — applies src/lib/db/schema.ts directly to DATABASE_URL (no migration files; fine for a project with no live users yet)
npm run db:generate            # drizzle-kit generate — emits SQL migration files under ./drizzle (not currently used, no migrations exist)
npm run db:studio               # drizzle-kit studio — visual DB browser against DATABASE_URL
npm run db:seed                  # tsx --env-file=.env.local scripts/seed.ts — seeds the achievement catalog + one demo YouTube playlist (8 songs)
```

There is no test runner and no `codegen` script. Database schema is TypeScript-first: edit `src/lib/db/schema.ts`, then `npm run db:push`. There is no `supabase gen types` equivalent needed — Drizzle infers row types directly from the schema file (`ProfileRow`, `RoomRow`, etc., re-exported via `src/types/database.ts`).

---

## Repository structure

```
src/
  app/                      # Next.js App Router routes
    sign-in/[[...sign-in]], sign-up/[[...sign-up]]/  # Clerk's <SignIn>/<SignUp> components, wrapped with branding
    api/                    # all backend logic lives here — see API_REFERENCE.md
      rooms/                # room CRUD, join/leave/kick, settings, start, control, chat, ready, team, per-room game state
      rounds/                # per-round gameplay: buzz, answer, hint, timeout, next
      playlists/               # playlist browsing + YouTube/Spotify import
      profiles/                 # /me (Clerk-session-derived), /me/settings, /[username] (public)
      leaderboards/              # GET-only, sortable by 6 metrics
      match-history/[id]/         # fetch a single completed game's stored result
      ably-token/                  # mints a short-lived Ably token request for the browser (GET)
      webhooks/clerk/                # Clerk `user.created` webhook — provisions the `profiles` row (replaces the old Postgres trigger)
    room/[code]/                   # THE main game route — renders <RoomClient> which switches between lobby/gameplay/results based on room.status
    browse/, leaderboards/, profile/, settings/, patch-notes/  # standalone pages, all client components fetching via api-client.ts
    icon.svg, apple-icon.tsx, opengraph-image.tsx  # branding — real assets
    layout.tsx, globals.css, loading.tsx           # root shell (wrapped in <ClerkProvider>), theme tokens, global splash screen
  components/
    ui/                     # shadcn-generated primitives — DO NOT hand-edit unless you mean to fork them; regenerate via `npx shadcn add <name>` instead
    branding/                # logo (inline SVG React component), splash screen
    home/                     # landing-page CTA buttons, NavAuthLinks (sign-in/profile-dropdown/sign-out via Clerk's useClerk().signOut())
    room/                      # lobby-side components: RoomClient (orchestrator), LobbyView, PlayerList, HostSettingsPanel, PlaylistPicker, RoomChat, NameGate; plus GameplayView and ResultsView
    game/                       # gameplay pieces: BuzzerButton, AnswerPanel, HintsPanel, YoutubePlayer, SpotifyPreviewPlayer, ScoreboardSidebar, FloatingScorePopups, RoundRevealOverlay
    providers/                   # ThemeProvider (next-themes wrapper), AccessibilityProvider, BackgroundLayer
  lib/
    db/                     # schema.ts (Drizzle table defs, the schema source of truth), client.ts (singleton `db`, server-only)
    ably/                    # publish.ts (server-side `publish()` helper via Ably REST), client.ts (browser singleton via `ably/modular`)
    game/                     # domain types (types.ts), scoring rules per mode (rules.ts), round-creation service (round-service.ts), sanitized-payload builder (round-payload.ts), end-of-game aggregation (end-game.ts), achievement unlock logic (achievements.ts)
    scoring/                    # pure scoring math (engine.ts) + fuzzy answer matching (fuzzy-match.ts)
    sound/synth.ts                # synthesized sound effects via the native Web Audio API
    spotify/resolve.ts               # Spotify Client Credentials playlist resolver
    youtube/resolve.ts               # YouTube Data API v3 playlist resolver
    theme-backgrounds.ts               # CSS gradient definitions for the 14 named background presets
    stores/                      # Zustand stores: room-store, game-store, settings-store (settings-store is the only one with `persist` middleware)
    hooks/                         # use-identity (Clerk session / guest resolution), use-room-realtime (Ably subscribe, returns sendTyping), use-game-realtime (Ably subscribe), use-countdown
    api-client.ts                     # typed fetch wrapper the frontend uses to call the API routes — THIS is the contract between frontend and backend
    rate-limit.ts                      # best-effort in-memory rate limiter (explicitly NOT distributed-safe)
    guest.ts                            # localStorage-based guest identity for unauthenticated play
  types/
    database.ts                          # thin re-export shim: `export * from "@/types/game"` (pure domain types) + Drizzle-inferred row types from `@/lib/db/schema` (`ProfileRow`, `RoomRow`, etc.) — kept as one import path so ~30 files didn't need their imports rewritten during the migration
    game.ts                               # the actual domain types (RoomSettings, GameModeKey, AnswerCategory, MatchHistory* snapshot types, etc.)
  middleware.ts                          # `clerkMiddleware()` — attaches Clerk session context to every request
scripts/
  seed.ts                                 # demo playlist (8 verified YouTube songs) + achievement catalog seed — run via `npm run db:seed`
  webpack/fix-ably-super.cjs               # raw-source patch for a real ably build bug — see "Current status" and DECISIONS.md D-013
drizzle.config.ts                           # drizzle-kit config, points at src/lib/db/schema.ts and DATABASE_URL
next.config.ts                               # serverExternalPackages + the ably webpack patch — do not remove without reading the comments in the file
supabase/
  migrations/0001_init.sql, seed.sql          # HISTORICAL REFERENCE ONLY — the pre-migration Supabase schema/seed. Never applied, no longer the source of truth. `src/lib/db/schema.ts` is the current schema. Kept only so the RLS-design reasoning (answer secrecy, etc.) has a citable original source; do not resurrect or apply this.
public/                                     # empty — the unused default create-next-app SVGs were deleted
```

**What should NOT go where:**
- Don't put database queries directly in components — every DB write goes through an `/api/*` route using the singleton `db` client from `src/lib/db/client.ts`. There is no RLS-equivalent defense layer anymore (Neon has no anon/service-role split) — **the API routes are the entire authorization boundary**, full stop. See `DECISIONS.md` D-013 and `SECURITY.md`.
- Don't add new shadcn primitives by hand-writing them — this project uses the `base-nova` style (`@base-ui/react`), and hand-written components will not match its API surface (see "Coding conventions").
- Don't add a second realtime mechanism (raw WebSocket, Socket.io, Pusher, Supabase Realtime) — the whole game-state design assumes Ably pub/sub is the only transport, with every mutating route explicitly publishing its own events (see "Architecture summary").
- Don't import `ably`'s default export (`import { Realtime } from "ably"`) in browser code — use `getAblyClient()` from `src/lib/ably/client.ts`, which uses `ably/modular` deliberately (see "Current status" for why).

---

## Architecture summary

See `ARCHITECTURE.md` for the full diagram and request-lifecycle walkthrough. Key points every session needs up front:

- **No standalone realtime/game server.** All state lives in Neon Postgres. Unlike Supabase's Postgres Changes (the old design), **Ably has no automatic database-to-realtime bridge** — every mutating API route must explicitly call `publish(channelName, eventName, payload)` (from `src/lib/ably/publish.ts`) after each write. The event-name contract is:
  - `room:{roomId}` channel: `player_upsert`, `room_update`, `message`, `typing`
  - `game:{gameId}` channel: `round_insert`, `round_update`, `lock_insert`, `answer_insert`, `game_update`
  
  If you add a new mutating route or a new field that needs to appear live, you must add the matching `publish()` call yourself — there's no way for this to happen automatically anymore.
- **Buzz-race arbitration is a database compare-and-swap**, not application logic: `round_locks` has primary key `(round_id, phase)`; the buzz endpoint does `db.insert(round_locks).values(...).onConflictDoNothing({ target: [round_locks.round_id, round_locks.phase] }).returning()` and checks whether the row it gets back belongs to the caller. Whoever's insert wins the unique-constraint race gets the buzzer.
- **The host's browser is the timing authority.** There is no server-side timer. The host's client calls `/api/rounds/[roundId]/timeout` when its local countdown reaches zero, and `/api/rounds/[roundId]/next` to advance. Deliberate tradeoff for a free-tier serverless deployment (see `DECISIONS.md` `D-003`).
- **Songs' answer fields are never sent to the client before reveal.** There is no RLS anymore to enforce this at the database layer (Neon has none) — the *only* thing preventing a client from reading the answer is that no API route ever returns a raw `songs` row to the browser before reveal. `game_rounds.broadcast_payload` (pre-reveal) and `reveal_payload` (post-reveal) are sanitized JSON blobs built server-side in `lib/game/round-payload.ts` — see `SECURITY.md`. **This is now entirely a discipline-based guarantee, not a database-enforced one** — a bigger deal than it was under Supabase/RLS. Be careful adding any new route that touches `songs`.
- **Scoring is 100% server-computed** in `/api/rounds/[roundId]/answer` and `/api/rounds/[roundId]/timeout`, using `lib/scoring/engine.ts` + `lib/scoring/fuzzy-match.ts`. The client never sends a point value, only a category + guess string.

---

## Coding conventions

Everything below is **verified from the actual code**, not aspirational.

- **shadcn components are Base UI, not Radix.** `components.json` has `"style": "base-nova"`, and `@base-ui/react` is a dependency while no `@radix-ui/*` package is installed. **There is no `asChild` prop** — Base UI uses a **`render` prop** instead: `<Button render={<Link href="/" />}>Text</Button>`. Other differences already found and fixed: `TooltipProvider`'s delay prop is `delay` not `delayDuration`; `Slider`'s commit callback is `onValueCommitted` not `onValueCommit`, and its value union is `number | readonly number[]` even for single-thumb sliders. **Rule going forward: before using any prop on a `src/components/ui/*` component that you recall from prior shadcn/Radix experience, open that component's source file (and, if needed, its underlying `@base-ui/react/*` type definition in `node_modules`) first and confirm the prop exists.**
- **Drizzle schema naming — deliberately non-idiomatic, read this before touching `src/lib/db/schema.ts`.** Every column is declared with a **snake_case JS property name matching the Postgres column name exactly** (e.g. `avatar_emoji: text("avatar_emoji")`), not Drizzle's usual camelCase convention. This was a deliberate migration-speed tradeoff: ~40 frontend files already destructure snake_case fields (`.avatar_emoji`, `.room_id`, `.is_host`) from the old Supabase row shape, and matching that exactly meant zero frontend files needed touching. **Follow this convention for any new column** — do not introduce camelCase fields into this schema, it would silently break nothing at the type level but would be inconsistent with every existing field and confusing to read.
- **All `timestamp` columns must use `{ withTimezone: true, mode: "string" }`.** Drizzle's default `timestamp()` mode returns JS `Date` objects, but the entire app (Zustand stores, components, Ably JSON payloads) expects ISO date **strings**, matching the old Supabase row shape. Forgetting `mode: "string"` on a new timestamp column will type-check fine locally in isolation but break wherever that value flows into a component or gets JSON-serialized for an Ably publish — this bit the initial migration pass and was fixed via a blanket `sed` across all 17 existing timestamp columns.
- **IDs are app-generated**, not database-generated: `const genId = () => crypto.randomUUID();` used as `.$defaultFn(genId)` on every `uuid` primary key in `schema.ts`. This avoids needing the `pgcrypto` extension enabled on the Neon project. Follow this pattern for any new table.
- **No RLS-equivalent exists.** Every table is reachable by the single trusted server-side Drizzle connection (`src/lib/db/client.ts`, `import "server-only"`). API routes are the entire authorization boundary — see `SECURITY.md`. Do not assume any database-level defense exists when adding a new route.
- **Realtime is manual, per-route.** See "Architecture summary" above for the event-name contract. When adding a new mutating route, decide whether any connected client needs to see the result live, and if so add the matching `publish()` call — nothing does this for you.
- **Routes:** every API route is `route.ts` under `src/app/api/...`, using the Next.js 15 App Router convention where dynamic segment `params` is a `Promise` (`{ params }: { params: Promise<{ code: string }> }`, always `await`ed).
- **Auth boundary:** `auth()`/`currentUser()` from `@clerk/nextjs/server` (server-only, session-derived) is used in exactly one route family — `/api/profiles/me` and `/api/profiles/me/settings` — where the caller's identity must come from a real session, not a client-supplied id. Every other mutating route (rooms, rounds) intentionally still trusts a client-supplied `playerId`/`requesterPlayerId`, because guest play has no Clerk session at all — this was true under Supabase too and is unchanged by the migration. See `CLAUDE.md`'s "DO NOT CHANGE WITHOUT REVIEW" and `SECURITY.md`.
- **Frontend never calls the database directly for game mutations** — it calls `src/lib/api-client.ts`'s `api.*` functions, which hit the `/api/*` routes. Realtime *reads* go direct-to-Ably from the browser via `lib/hooks/use-room-realtime.ts` / `use-game-realtime.ts`, authenticated via a short-lived token minted by `/api/ably-token` (the Ably API key itself never reaches the browser).
- **State:** Zustand stores are plain (no persist) except `settings-store.ts`, which persists to `localStorage` under key `sound-clash-settings`.
- **Types:** `src/types/database.ts` is a thin re-export shim (see "Repository structure" above) — do not hand-write row types here anymore. Row types come from Drizzle's type inference on `src/lib/db/schema.ts`; domain types (round payloads, scoring breakdowns, chat messages, `RoomSettings`) live in `src/types/game.ts`.
- **Naming:** kebab-case filenames, PascalCase component exports, camelCase functions/variables (except Drizzle schema fields, see above) — consistent throughout.
- **Comments:** sparse by design, used only to explain non-obvious constraints. This matches the intended style — keep following it.

---

## UI and design system

See `UI_SYSTEM.md` for full detail. Unaffected by the backend migration — quick reference:

- **Design language:** "Spotify-inspired glassmorphism with neon accents" — `.glass` / `.glass-strong` / `.neon-text` / `.neon-glow-green` / `.neon-glow-violet` utility classes in `src/app/globals.css`.
- **Theme tokens:** CSS custom properties (`:root` for light, `.dark` for dark), OKLCH colors, Tailwind v4's CSS-based `@theme inline` block — no separate `tailwind.config.js`.
- **Branding assets are real, not placeholders:** `src/components/branding/logo.tsx`, `src/app/icon.svg`, `apple-icon.tsx`/`opengraph-image.tsx` (both `next/og` `ImageResponse`).

---

## Environment setup

See `.env.example` (rewritten this session for the new stack) and `DEPLOYMENT.md`. Summary table:

| Variable | Required? | Client/Server | Used in |
|---|---|---|---|
| `DATABASE_URL` | Required | **Server only** | `src/lib/db/client.ts`, `scripts/seed.ts`, `drizzle.config.ts` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required | Client + Server | Clerk SDK bootstrap (`layout.tsx`'s `<ClerkProvider>`) |
| `CLERK_SECRET_KEY` | Required | **Server only** | `middleware.ts`, `auth()`/`currentUser()` calls |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Required for profile auto-creation to work | **Server only** | `src/app/api/webhooks/clerk/route.ts` |
| `ABLY_API_KEY` | Required | **Server only** | `src/lib/ably/publish.ts`, `src/app/api/ably-token/route.ts` — never sent to the browser; the browser gets a short-lived token instead |
| `YOUTUBE_API_KEY` | Required to import YouTube playlists | Server only | `lib/youtube/resolve.ts` |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Required to import Spotify playlists | Server only | `lib/spotify/resolve.ts` (Client Credentials flow) |
| `NEXT_PUBLIC_SITE_URL` | Optional | Client (build-time) | `src/app/layout.tsx`'s `metadataBase` |

**Status update (2026-08-07):** `.env.local` now contains real, live values for `DATABASE_URL`, the two Clerk keys, and `ABLY_API_KEY` — confirmed working via `db:push`/`db:seed`, a booted `next dev` server, and a live Vercel deployment (see `DEPLOYMENT.md`). `CLERK_WEBHOOK_SIGNING_SECRET` is still a placeholder — the webhook hasn't been registered in the Clerk Dashboard yet. **Never commit real values** — `.gitignore` already excludes all `.env*` files, and this file must never quote actual credential values.

---

## Database summary

Full detail in `DATABASE.md`. **Schema source of truth is `src/lib/db/schema.ts`** (Drizzle table definitions), not SQL. It has never been applied to a live Neon database — treat every claim about runtime behavior as "should work per the schema as written," not "verified against a running Postgres instance." `supabase/migrations/0001_init.sql` is kept only as historical reference for the original RLS-design reasoning; it is not applied anywhere and is not the current schema.

---

## Authentication and authorization

- **Provider:** Clerk (`@clerk/nextjs`). Sign-in/sign-up pages at `/sign-in`, `/sign-up` wrap Clerk's `<SignIn>`/`<SignUp>` components.
- **Profile auto-creation:** `src/app/api/webhooks/clerk/route.ts` handles the `user.created` webhook event (verified via `verifyWebhook()` from `@clerk/nextjs/webhooks`) and inserts a `profiles` row, deriving a unique username the same way the old Postgres trigger did (username or email prefix, de-duplicated with a numeric suffix loop). **This requires a Clerk Dashboard webhook endpoint to actually be configured** (pointing at `/api/webhooks/clerk`, subscribed to `user.created`) — without it, signing up via Clerk will authenticate the user but never create their `profiles` row, and anything reading `profiles` for that user will 404. Not yet configured/tested in this environment.
- **Guest play:** unchanged from before — a `localStorage`-backed guest identity (`lib/guest.ts`), no Clerk session at all. Guests and authed users are unified at the `room_players` table via either `profile_id` or `guest_id` (exactly one is set — this is enforced at the application layer now, not a database CHECK constraint, since Neon has no RLS/constraint-authoring session in place yet; see `DATABASE.md`).
- **Sign-out UI:** `src/components/home/nav-auth-links.tsx`, uses `useClerk().signOut({ redirectUrl: "/" })`.
- **No roles/permissions system** — no `is_admin` column, no role-gated routes. "Host" is a per-room boolean (`room_players.is_host`), not a global permission.
- **Authorization pattern:** every mutating room/round API route fetches the requester's `room_players` row by the `requesterPlayerId` the client sends and checks `is_host` (or lock ownership, for buzz/answer) before proceeding — same pattern as before the migration, now enforced entirely in the route handler with no RLS backstop. The one exception is `/api/profiles/me*`, which uses a real Clerk session via `auth()`.

---

## DO NOT CHANGE WITHOUT REVIEW

- **`src/lib/db/schema.ts`** — the schema source of truth. Any edit needs a matching `npm run db:push` against the target database, and must follow the existing snake_case-field / `mode: "string"` timestamp / `genId` conventions described in "Coding conventions" above — deviating silently breaks either the ~40 files consuming these row shapes or Ably JSON serialization.
- **`round_locks` primary key `(round_id, phase)`** and the `onConflictDoNothing` pattern in `src/app/api/rounds/[roundId]/buzz/route.ts` — this is the entire anti-cheat mechanism for "only one buzz wins." Changing it to any non-atomic check-then-insert pattern reintroduces a race condition.
- **`src/lib/db/client.ts`** and anything importing `DATABASE_URL` — must stay server-only (`import "server-only"` is load-bearing, don't remove it).
- **`src/lib/ably/publish.ts`** and anything importing `ABLY_API_KEY` — must stay server-only. The browser must only ever get a token via `/api/ably-token`, never the raw key.
- **`next.config.ts`'s `serverExternalPackages: ["ably"]` and the `fix-ably-super.cjs` webpack rule** — both work around a real, verified parser bug in `ably`'s bundled builds under this Next.js/SWC version (see "Current status"). Removing either will very likely reintroduce a hard build failure ("'super' keyword outside a method"). If a future `ably` upgrade fixes the bug upstream, verify with a clean build before removing the workaround, don't remove it preemptively.
- **`src/lib/api-client.ts`** — is the single contract between frontend and backend. Renaming or reshaping a route without updating this file (and vice versa) will silently break the UI with no type error.
- **The songs-answer-secrecy design** (`songs` rows are never returned to the client pre-reveal — see `DATABASE.md`/`SECURITY.md`) — this is now a pure application-logic guarantee with no database backstop (Neon has no RLS). Don't "simplify" by ever returning a raw `songs` row from an API route reachable before a round resolves.
- **The Next.js major version (currently pinned to the 15.x line, resolved `15.5.22`)** — explicit user requirement in the original product brief, not a technical default. Do not upgrade the Next.js major version without checking with the user first. See `DECISIONS.md` D-009.
- **Do not introduce Firebase for anything** — "No Firebase" was an explicit constraint in the original product brief. See `DECISIONS.md` D-010.
- **Do not reintroduce Supabase** — the user explicitly moved off it due to being rate/account-limited across their other projects (`DECISIONS.md` D-013). `supabase/` in the repo root is historical reference only.

---

## AI working instructions

1. Read `CLAUDE.md` (this file).
2. Read `PROJECT_STATE.md`.
3. Read `TASKS.md`.
4. Read whichever of `ARCHITECTURE.md` / `FEATURES.md` / `API_REFERENCE.md` / `DATABASE.md` is relevant to the task.
5. Inspect the affected code before changing it — don't trust this doc's file/line references blindly for anything beyond a few days old; re-grep to confirm.
6. Check `git status` before modifying files (this repo has no commit history yet, so "check git status" mostly means "check for uncommitted work from a previous session").
7. Avoid overwriting unrelated work.
8. Make small, reviewable changes.
9. Run `npx tsc --noEmit` (fast) and `npm run build` (authoritative) after changes touching types or routes.
10. Update `PROJECT_STATE.md`, `TASKS.md`, and `SESSION_LOG.md` after meaningful work — see "Permanent rules" below.
11. Never claim something works without running it.
12. Never expose secrets — `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `ABLY_API_KEY` especially.
13. Never modify production data without explicit permission (moot today — nothing is deployed).
14. Never perform destructive database operations without explicit permission.
15. Never silently replace the realtime architecture (Ably) or the host-timing-authority pattern with something else without updating `DECISIONS.md` and getting explicit sign-off.
16. Never remove a dependency without checking usages first — `howler` is unused today but reserved for future sound effects.
17. Never change authentication, database schema, deployment config, or security rules casually — these are exactly the "DO NOT CHANGE WITHOUT REVIEW" items above.
18. Record unresolved uncertainty in `PROJECT_STATE.md` rather than guessing.

### Permanent rules — after every meaningful coding task

1. Update `PROJECT_STATE.md` with the new exact stopping point.
2. Update `TASKS.md` (move completed tasks, add newly discovered ones).
3. Append an entry to `SESSION_LOG.md` (don't overwrite prior entries).
4. Update whichever of `FEATURES.md` / `ARCHITECTURE.md` / `API_REFERENCE.md` / `DATABASE.md` / `TESTING.md` / `DEPLOYMENT.md` / `SECURITY.md` your change affects.
5. Remove or correct stale information you find, even if unrelated to your task.
6. Record meaningful architectural decisions in `DECISIONS.md`.
7. Run relevant verification (`tsc --noEmit` at minimum; `npm run build` before considering anything "done").
8. Clearly record anything not verified.
9. Treat this repository's `.md` files as the permanent memory system — there is no other persistence to rely on.

### Recognizing documentation-only / account-switch checkpoint requests

The user has previously (2026-08-06) explicitly asked for pure documentation/handoff passes with no product code changes, framed as "prepare this repo for a handoff" or "account-switch checkpoint." If a future request is phrased similarly ("checkpoint," "handoff," "prepare for a new account/session," "audit the repo," "update your memory files"), default to inspect-and-document only; do not touch `src/`, `supabase/`, or config files unless separately and explicitly asked to fix something. This session's request ("rewire the backend") was explicitly the opposite — a real, permitted implementation task — so it's not an example of that pattern, just a reminder of how to recognize the pattern when it recurs.
