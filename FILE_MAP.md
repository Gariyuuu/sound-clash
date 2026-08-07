# File Map

Practical map of the repository, prioritized toward files a future agent is
likely to read or modify. Trivial generated files (individual `src/components/ui/*`
primitives, `next-env.d.ts`) are grouped rather than listed one by one.

## Entry points

| Path | Purpose | Imports (calls) | Imported by |
|---|---|---|---|
| `src/app/layout.tsx` | Root HTML shell, fonts, `ThemeProvider`/`AccessibilityProvider`/`TooltipProvider`/`Toaster` | `theme-provider.tsx`, `accessibility-provider.tsx`, `ui/tooltip`, `ui/sonner` | Next.js router (implicit root) |
| `src/app/page.tsx` | Landing page | `logo.tsx`, `create-room-button.tsx`, `join-room-card.tsx`, `nav-auth-links.tsx`, `ui/button` | Next.js router (`/`) |
| `src/app/room/[code]/page.tsx` | Thin server wrapper around the real app | `room-client.tsx` | Next.js router (`/room/[code]`) |
| `src/components/room/room-client.tsx` | **The orchestrator** — identity, join flow, realtime subscription, status-based view switch | `use-identity`, `use-room-realtime`, `api-client`, `name-gate`, `lobby-view`, `gameplay-view`, `results-view` | `room/[code]/page.tsx` |
| `src/app/{browse,leaderboards,profile,settings,patch-notes}/page.tsx` | Standalone client-component pages, each self-contained (fetch via `api-client.ts` on mount) | `api-client.ts` + a handful of `ui/*` components each | Next.js router |
| `src/middleware.ts` | Attaches Clerk session context (`clerkMiddleware()`) | `@clerk/nextjs/server` | Next.js (runs on every non-static request per `config.matcher`) |

## When to edit — by task

### Change navigation / add a page
Add a folder under `src/app/`. Follow the existing pattern: a thin `page.tsx` (Server Component if no interactivity needed) that renders a Client Component doing the real work, mirroring `room/[code]/page.tsx` → `room-client.tsx`. Update the landing page's nav/footer links in `src/app/page.tsx` if the new page should be discoverable (it currently links to `/leaderboards`, `/patch-notes`, `/settings` — all three currently 404, see `TASKS.md`).

### Add an API route
Create `route.ts` under `src/app/api/...`, follow the pattern in any existing route: import the singleton `db` from `lib/db/client.ts`, fetch-then-authorize-then-mutate, then **publish any Ably events a connected client needs** (`publish()` from `lib/ably/publish.ts` — there is no automatic realtime bridge anymore, see `CLAUDE.md`/`ARCHITECTURE.md`). **Also add a corresponding typed function to `src/lib/api-client.ts`** — nothing calls routes directly with `fetch()` elsewhere; that file is the single frontend-facing contract.

### Modify authentication
- Sign-in/sign-up UI: Clerk's own `<SignIn>`/`<SignUp>` components, wrapped in `src/app/sign-in/[[...sign-in]]/page.tsx` / `sign-up/[[...sign-up]]/page.tsx`.
- Session context: `src/middleware.ts` (`clerkMiddleware()`).
- Profile auto-creation: `src/app/api/webhooks/clerk/route.ts` (`user.created` webhook — requires a Clerk Dashboard endpoint configured, see `DEPLOYMENT.md`; not application-trigger-based anymore).
- Guest identity: `src/lib/guest.ts`.
- Unified identity resolution used by pages: `src/lib/hooks/use-identity.ts`.
- **Risk:** the `room_players`'s `profile_id`/`guest_id` XOR pairing is application-enforced only now (no database CHECK constraint — see `DATABASE.md`); changing the webhook or the join route's identity-assignment logic affects every join/leave/kick route — read `DATABASE.md` first.

### Change the database schema
Edit `src/lib/db/schema.ts` directly (Drizzle TypeScript, the schema source of truth — `supabase/migrations/0001_init.sql` is historical reference only, not applied anywhere). **Immediately after**, run `npm run db:push` against your target database and update `DATABASE.md`'s ER diagram/table notes. Row types are inferred automatically by Drizzle — there is no manual type-authoring step anymore.

### Add a feature (general)
1. Schema change if needed (above).
2. API route(s) under `src/app/api/`.
3. `src/lib/api-client.ts` entry.
4. Domain types in `src/lib/game/types.ts` if it's game-related, or `src/types/database.ts` if it's a raw row shape.
5. Realtime wiring in `use-room-realtime.ts`/`use-game-realtime.ts` if other players need to see the change live.
6. UI component(s) under `src/components/<area>/`.
7. Update `FEATURES.md` and `TASKS.md`.

### Change themes / visual design
- Design tokens (colors, radii): `src/app/globals.css` `:root`/`.dark` blocks and the `@theme inline` mapping at the top.
- Glass/neon utility classes: same file, `@layer components` block near the bottom.
- Logo/brand mark: `src/components/branding/logo.tsx` (also mirrored as static SVG in `src/app/icon.svg`, and as `next/og` `ImageResponse` JSX in `src/app/apple-icon.tsx` / `opengraph-image.tsx` — **if you change the logo, update all four places**, they are not derived from a single source).
- Theme switching (light/dark/system): `next-themes` is wired in `layout.tsx` but there is no UI control anywhere yet (see `TASKS.md`).

### Update deployment settings
`DEPLOYMENT.md` documents the (never-executed) intended process. There is no `vercel.json`; deployment would rely entirely on Vercel's Next.js zero-config detection plus environment variables set in the Vercel dashboard.

### Add an environment variable
Add it to `.env.example` with a comment explaining it, and reference it in `CLAUDE.md`'s environment table. If server-only, only read it from a file that either has `import "server-only"` or is itself a route handler / server component — never from a file imported by client components.

### Modify multiplayer / realtime behavior
`src/lib/hooks/use-room-realtime.ts` (lobby-level: players, room row, chat/reactions) and `use-game-realtime.ts` (round-level: round state, buzz locks, answer feed, pause). Both subscribe to Ably channels (`room:{roomId}`, `game:{gameId}`) — there is no automatic database-to-realtime bridge. If you add new state that needs live updates: (1) add a `publish(channel, eventName, payload)` call in `lib/ably/publish.ts`'s style from the mutating API route, (2) subscribe to that event name in the relevant hook, (3) document the new event in `CLAUDE.md`'s event-name contract table.

### Modify scoring
`src/lib/scoring/engine.ts`'s `computeScore()` is the single scoring implementation (point math for all correct categories in one submission, bonuses, steal multiplier, Chaos Mode modifiers — see `DECISIONS.md` D-007, resolved session four) and `xpForGame`/`levelForXp`. `src/lib/scoring/fuzzy-match.ts` handles answer matching. All three are pure functions — the highest-value, lowest-effort place to add tests (see `TESTING.md`). The call site in `src/app/api/rounds/[roundId]/answer/route.ts` builds the `ScoreContext` (which categories were correct, `isSteal`, `buzzRankThisRound`, `chaosRule`, etc.) and calls `computeScore()` directly — don't reintroduce an inline reimplementation here.

### Modify permissions / who-can-do-what
There is no roles system. "Host" is per-room (`room_players.is_host`). Look at any file in `src/app/api/rooms/[code]/` for the check-then-mutate pattern; there's nothing more centralized than that today.

## Key non-obvious file relationships

- `src/lib/game/round-service.ts`'s `createRoundForGame()` is called from **two** places: `.../rooms/[code]/start/route.ts` (round 1) and `.../rounds/[roundId]/next/route.ts` (round 2+). If you change its signature, update both call sites.
- `src/lib/game/round-payload.ts`'s `buildBroadcastPayload`/`buildRevealPayload`/`buildHint` are the **only** functions allowed to read a `songs` row and decide what's safe to expose — any new code path that needs to show round info to a client should go through these, not query `songs` directly and hand-pick fields inline.
- `src/lib/game/rules.ts` (`resolveTimerSeconds`, `resolveCategories`, `hintsAllowed`, `eliminatesOnWrongAnswer`, `isTeamMode`, `rollChaosRule`) is the single place per-mode behavior differences are centralized. `isTeamMode` currently has **no caller** (grep confirms) — Team Battle's actual team-assignment/shared-scoring was never built despite this helper existing.
- `src/lib/game/end-game.ts`'s `finishGame()` is called only from `.../rounds/[roundId]/next/route.ts` when advancing past the last round.

## The live gameplay screen and its pieces (built this session — previously orphaned)

`src/components/room/gameplay-view.tsx` now composes everything that used to sit unused:
- `src/components/game/buzzer-button.tsx`, `answer-panel.tsx`, `hints-panel.tsx`, `youtube-player.tsx` — pre-existing, now wired in.
- `src/components/game/floating-score-popups.tsx`, `scoreboard-sidebar.tsx`, `round-reveal-overlay.tsx` — new, built alongside `gameplay-view.tsx`.
- `src/components/room/results-view.tsx` — the results/podium screen, fetches `GET /api/match-history/[id]` (new route) and renders a podium + confetti (first use of the previously-unused `canvas-confetti` dependency).

No components are currently orphaned/unused (re-verified via grep at the time of this update). If a future session adds a new standalone component and doesn't immediately wire it into a page, note that here rather than letting it go undocumented.

## Config files

| File | Notes |
|---|---|
| `package.json` | See `CLAUDE.md`'s stack table for exact versions. No `engines` field. |
| `tsconfig.json` | Strict mode on, `@/*` → `src/*` path alias, standard Next.js 15 App Router `include` list. |
| `next.config.ts` | Bare default — no experimental flags, no image domain allowlist, no `typescript.ignoreBuildErrors`/`eslint.ignoreDuringBuilds` overrides (meaning both gates are fully active on `next build`). |
| `eslint.config.mjs` | **Currently broken** — see `TASKS.md` T-003. |
| `components.json` | shadcn CLI config — `"style": "base-nova"`, backed by `@base-ui/react`, not Radix. Governs what `npx shadcn add <name>` generates. |
| `postcss.config.mjs` | Tailwind v4's PostCSS plugin, default. |
| `.gitignore` | Standard `create-next-app` ignores plus `.env*`. |

## Public assets

`public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — unmodified `create-next-app` defaults, unused anywhere in the app (verified via grep), safe to delete. Real, in-use brand assets live in `src/app/` as code (`icon.svg`, `apple-icon.tsx`, `opengraph-image.tsx`), not as static files in `public/`.
