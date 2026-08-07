# Architecture

## System overview

Sound Clash is a single Next.js 15 App Router application deployed (in theory
— not yet deployed) to Vercel. There is no standalone backend server, no
message queue, no separate realtime server process. Persistent state lives in
**Neon Postgres** (via Drizzle ORM); realtime fan-out is a **separate**
service, **Ably**, since Neon has no built-in pub/sub the way Supabase did.
Auth is **Clerk**. Next.js API Routes are the only place business logic runs
server-side.

```mermaid
flowchart TB
    subgraph Browser["Player's Browser"]
        UI["React UI (App Router pages)"]
        ZS["Zustand stores (room-store, game-store, settings-store)"]
        RT["Realtime hooks (use-room-realtime, use-game-realtime)"]
        ABLYC["Ably browser client (ably/modular, token auth)"]
    end

    subgraph Vercel["Vercel (Next.js serverless functions)"]
        API["/api/rooms/*  /api/rounds/*  /api/playlists/*"]
        MW["middleware.ts (clerkMiddleware)"]
        TOKEN["/api/ably-token (mints Ably token requests)"]
        WEBHOOK["/api/webhooks/clerk (user.created -> profiles insert)"]
    end

    subgraph Neon["Neon Postgres"]
        PG[("rooms, room_players, games, game_rounds,\nround_locks, round_answers, songs,\nplaylists, profiles, match_history, room_messages")]
    end

    subgraph Clerk["Clerk"]
        AUTH["Clerk session / user management"]
    end

    subgraph AblyCloud["Ably"]
        PUBSUB["Pub/sub channels: room:{id}, game:{id}"]
    end

    subgraph External["External APIs"]
        YT["YouTube Data API v3\n(playlist import only)"]
        YTEMBED["YouTube iframe embed\n(clip playback)"]
    end

    UI -->|api-client.ts fetch calls| API
    API -->|Drizzle, single trusted connection| PG
    API -->|resolve playlist| YT
    API -->|publish() after each write| PUBSUB
    ABLYC -->|subscribe| PUBSUB
    ABLYC --> RT
    RT --> ZS
    ZS --> UI
    UI -->|GET, mints token| TOKEN
    TOKEN -->|token request| ABLYC
    UI -->|embed clip| YTEMBED
    Browser <-->|session cookie| MW
    MW <--> AUTH
    UI -.->|sign up / sign in| AUTH
    AUTH -.->|user.created webhook| WEBHOOK
    WEBHOOK --> PG
```

## Frontend structure

- **App Router, no `pages/` directory.** `/sign-in`, `/sign-up` wrap Clerk's own components; plain segments for everything else.
- **The one real "app" route is `/room/[code]`**, rendering `<RoomClient code={...} />` (`src/components/room/room-client.tsx`), a client component that:
  1. Resolves identity (`useIdentity()` — Clerk session via `useUser()`, or localStorage guest).
  2. Joins the room via the API (`api.joinRoom`), idempotently (safe to call again on refresh).
  3. Subscribes to room-level realtime (`useRoomRealtime(room.id)` — Ably, not Postgres Changes).
  4. Branches render on `room.status`: `"lobby"` → `<LobbyView>`, `"playing"` → `<GameplayView>`, anything else → `<ResultsView>`.
- **Rendering strategy:** everything under `room/[code]` and the interactive parts of the landing page are Client Components (`"use client"`) because they need browser APIs (localStorage, the Ably WebSocket client) and interactive state. Static shell pieces (root `layout.tsx`, icon/opengraph generators) are Server Components / edge functions.
- **State management:** three Zustand stores (`src/lib/stores/`), unchanged by the migration:
  - `room-store.ts` — room row, player roster, chat, reactions, typing indicators, `selfPlayerId`.
  - `game-store.ts` — current round payload, buzz phase, buzz holder, hints revealed, floating score popups, pause state.
  - `settings-store.ts` — the only store with `persist` middleware (localStorage key `sound-clash-settings`).
  - Stores are updated from two places only: realtime hook callbacks (`use-room-realtime.ts`, `use-game-realtime.ts`) and direct component code right after a successful `api.*` call. There is no central reducer/dispatcher.

## Backend structure

Every route lives under `src/app/api/` and follows the same shape: a `route.ts` exporting `GET`/`POST` handlers, importing the singleton `db` (Drizzle client) from `src/lib/db/client.ts`. See `API_REFERENCE.md` for the full endpoint list.

The consistent authorization pattern (present in every mutating room/round route):
1. Look up the target row(s) by an ID supplied in the URL/body (room code, round id).
2. Look up the *requester's* `room_players` row by a `requesterPlayerId`/`playerId` the client sends in the body.
3. Check a permission field on that row (`is_host`, or — for buzz/answer — whether the requester currently holds `round_locks` for the round's `current_phase`).
4. Only then mutate.
5. **Publish an Ably event on whichever channel(s) a connected client would need to see the result** — this step didn't exist under Supabase (Postgres Changes did it automatically); every route author must now remember it explicitly. See "Real-time communication" below for the event contract.

The one exception to step 2 is `/api/profiles/me*`, which uses a real Clerk session via `auth()` instead of a client-supplied id.

This means **the client-supplied player id is trusted as "who is asking," but never trusted for "what they're allowed to do."** That's the actual security boundary — see `SECURITY.md`.

## Server/client boundaries

| File | Boundary | Notes |
|---|---|---|
| `src/lib/db/client.ts` | **Server only**, `import "server-only"` | singleton Drizzle client over Neon's HTTP driver; every `/api/*` route imports this directly — there is no anon/admin split anymore, just one trusted connection |
| `src/lib/ably/client.ts` | Browser | token-authenticated (via `/api/ably-token`), used by the realtime hooks; deliberately imports from `ably/modular`, not the default `ably` export — see `CLAUDE.md` "Current status" for why |
| `src/lib/ably/publish.ts` | **Server only**, `import "server-only"` | wraps Ably's REST client with the raw `ABLY_API_KEY`; every mutating route calls `publish()` from here after a write |
| `src/app/api/ably-token/route.ts` | Server (route handler) | mints a short-lived Ably token request for the browser — this is the only place the raw Ably key is used to authenticate anything reachable from the client |
| `src/middleware.ts` | Edge middleware | `clerkMiddleware()` — attaches session context to every non-static request |

## Request lifecycle — worked example: buzzing in

1. Round starts: host's client (having called `api.startGame` or `api.nextRound`) triggers `createRoundForGame()` (`src/lib/game/round-service.ts`) server-side, which inserts the `game_rounds` row **and itself calls `publish(gameChannel(game.id), "round_insert", round)`**. Every client subscribed to that game's Ably channel receives the same event at the same time (that's the "everyone hears music at identical timestamps" requirement — approximated by everyone receiving the same `serverStartedAt` and computing their own playback offset from it).
2. A player taps the buzzer button → `api.buzz(roundId, { playerId })` → `POST /api/rounds/[roundId]/buzz`.
3. That route does an atomic Drizzle insert into `round_locks` with `.onConflictDoNothing({ target: [round_locks.round_id, round_locks.phase] }).returning()`. Postgres's unique constraint on `(round_id, phase)` guarantees exactly one caller's row is actually inserted; everyone else's insert is a no-op and gets an empty array back.
4. The winning insert triggers the route to call `publish(gameChannel(game.id), "lock_insert", lock)` — **this publish call is now explicit application code**, not a side effect of the database write the way Postgres Changes was. Every subscribed client's `use-game-realtime.ts` handles this event and calls `gameStore.lockBuzz(...)`, so everyone's UI locks out simultaneously off the same Ably event, not off the HTTP response.
5. The winning player's client shows `<AnswerPanel>` (gated on `buzzHolderId === selfPlayerId`).
6. They submit → `api.submitAnswer` → `POST /api/rounds/[roundId]/answer`, which re-checks lock ownership server-side, fuzzy-matches the guess against the real song row (which the client never received), computes points via `lib/scoring/engine.ts`, writes `round_answers` + updates `room_players.score`, and either resolves the round (`game_rounds.status = 'resolved'`, `reveal_payload` populated) or opens a steal phase (`status = 'steal'`, `current_phase += 1`) — publishing `answer_insert` and `round_update` events for each.
7. Those events propagate to every client via Ably — nobody polls.

## Data flow summary

Single direction, no client-side "optimistic mutation → reconcile" pattern beyond immediate UI feedback: **client calls API → API mutates Postgres via Drizzle → API explicitly publishes to Ably → every client's realtime hook updates its own store → React re-renders.** The HTTP response to the original caller is used only for immediate error handling (e.g., "you don't hold the buzzer" 403), not as the source of truth for game state. **The explicit-publish step is the load-bearing difference from the pre-migration architecture** — a route that forgets to publish will still correctly mutate the database but silently fail to update any connected client in real time, with no error surfaced anywhere.

## Authentication flow

See `CLAUDE.md` → "Authentication and authorization" and `API_REFERENCE.md`. Short version: Clerk-hosted sign-in/sign-up, a webhook (`/api/webhooks/clerk`, `user.created`) auto-creates the `profiles` row (this used to be a Postgres trigger — now it's an HTTP webhook, which means it can silently not fire if the Clerk Dashboard endpoint isn't configured, unlike a database trigger which fires unconditionally on insert), `middleware.ts` attaches the Clerk session via `clerkMiddleware()`, and unauthenticated players get a parallel localStorage-based guest identity treated equivalently at the `room_players` level (`profile_id` XOR `guest_id`, application-enforced — see `DATABASE.md`).

## Authorization flow

Per-route, imperative checks against `room_players.is_host` or `round_locks` ownership — same as before the migration. **The difference is there is no RLS backstop anymore at all** — see "Backend structure" above and `SECURITY.md`.

## Real-time communication / multiplayer architecture

**This is the architectural piece most changed by the migration — see `DECISIONS.md` D-013 (supersedes D-001).** Ably is a pure pub/sub service with no knowledge of the database — there is no equivalent to Supabase's Postgres Changes (CDC over the WAL). Concretely:

- Every mutating route explicitly calls `publish(channelName, eventName, payload)` from `src/lib/ably/publish.ts`. The two channels and their event names:
  - `room:{roomId}` — `player_upsert` (join/leave/kick/ready/team changes), `room_update` (settings/status changes), `message` (chat/system messages), `typing` (published directly from the browser via `sendTyping()`, not through an API route — the only client-side publish in the app)
  - `game:{gameId}` — `round_insert`, `round_update`, `lock_insert`, `answer_insert`, `game_update`
- **If you add a new mutating route or a new piece of state that should update live, you must add the matching `publish()` call yourself.** Nothing enforces this at compile time or discovers it automatically — this is the single biggest new source of "silent realtime gaps" risk introduced by the migration, and worth specifically testing for when a new route is added.
- Buzz-race arbitration (who "won" the buzzer) is still not application code — it's a Postgres unique-constraint race (`round_locks` primary key `(round_id, phase)`), decided entirely inside the database, same as before. The *notification* of who won is now an explicit `publish()` call rather than an automatic side effect.
- **No presence channel is implemented**, same as before the migration — no ping/latency measurement anywhere in the code. Connection status is a plain enum column updated only by explicit API calls (`join`, `leave`, `kick`).
- **Ably auth:** the browser never sees `ABLY_API_KEY`. `getAblyClient()` (`src/lib/ably/client.ts`) constructs a client with `authUrl: "/api/ably-token"`, which mints a short-lived token request server-side using the real key.

## Host-as-timing-authority (round pacing)

**Unchanged by the migration — see `DECISIONS.md` D-003.** There is no server-side timer/cron. The host's browser runs its own countdown, calls `POST /api/rounds/[roundId]/timeout` when it expires, and `POST /api/rounds/[roundId]/next` to advance. Every one of those endpoints re-validates `requesterPlayerId` is the current host server-side. If the host disconnects, `POST /api/rooms/[code]/leave` promotes a new host; `game_rounds.phase_started_at` (a server-authoritative timestamp) lets the newly-promoted host's client resume the correct countdown rather than restarting one.

## Answer-secrecy design

**This is the piece most weakened in rigor by the migration, worth reading carefully.** Under Supabase, `songs` had no public RLS SELECT policy at all — the database itself refused to return a `songs` row to any client-side query, regardless of what application code did. Under Neon, **there is no such backstop.** The only thing preventing a player from reading the current round's answer is that no API route ever returns a raw `songs` row to the browser before reveal — `game_rounds.broadcast_payload` (pre-reveal, no answer fields) and `.reveal_payload` (post-reveal, populated by the server only after the round resolves) are sanitized JSON blobs built by `src/lib/game/round-payload.ts`, called only from server-side API routes. **This guarantee is now 100% code-review discipline, not database enforcement** — see `SECURITY.md` for the concrete implication and `CLAUDE.md`'s "DO NOT CHANGE WITHOUT REVIEW".

## Caching

None implemented — unchanged by the migration.

## Error handling

API routes return `{ error: string }` with an appropriate HTTP status (400/403/404/409/429/500) on failure; `src/lib/api-client.ts`'s `request()` helper throws an `Error` with that message on any non-2xx response, and calling components catch it and show a `sonner` toast. Unchanged by the migration. There is no centralized error boundary or logging integration.

## Logging

None beyond whatever Next.js/Vercel does by default.

## Background/scheduled jobs

None exist.

## Deployment architecture

Intended: Vercel free tier hosting the Next.js app (serverless functions for `/api/*`), pointed at a Neon free-tier project for Postgres, a Clerk application for auth, and an Ably application for realtime. See `DEPLOYMENT.md`.

## Scaling considerations

Explicitly not designed for scale beyond a friend-group party game:
- `src/lib/rate-limit.ts` is in-memory, per-serverless-instance — unchanged, still does not enforce a global limit across Vercel's multiple concurrent function instances/regions.
- Neon's HTTP driver (`@neondatabase/serverless`, used via `drizzle-orm/neon-http`) opens one connection per query rather than pooling a persistent connection — appropriate for serverless but worth knowing if per-request DB latency becomes a concern; Neon's own pooled connection string could be substituted in `DATABASE_URL` if so.
- 20-player room cap is enforced in `POST /api/rooms/[code]/join`, not at the database level.
- Ably's free tier has its own message/connection limits — not sized against this project's expected usage, since nothing has been deployed yet.

## Major architectural risks

1. **No RLS-equivalent defense layer** (see "Answer-secrecy design" and `SECURITY.md`) — the single biggest structural risk introduced by this migration. A future route that carelessly returns a `songs` row (e.g., a debug endpoint, a "song info" admin page) has no database-level backstop preventing an answer leak, unlike before.
2. **Realtime gaps are silent** — a route that forgets a `publish()` call will work correctly from the mutating client's perspective (the HTTP response is fine) while silently failing to update everyone else's UI. There's no test coverage or lint rule catching this.
3. **The Clerk webhook has never fired** — profile auto-creation on sign-up is entirely unverified; if the Dashboard endpoint isn't configured correctly, users can sign in via Clerk but never get a `profiles` row, and every route reading `profiles` for them will 404 or need defensive handling that doesn't currently exist everywhere.
4. **A real third-party build bug was patched, not avoided** — the `ably`-parsing webpack workaround (`CLAUDE.md` "Current status", `DECISIONS.md` D-013) is a source-patching loader keyed to `ably`'s current bundled output. An `ably` version upgrade could change the exact source pattern being patched and either stop needing the workaround (fine) or shift the bug to a location the current regex doesn't match (silent reintroduction of the build failure) — re-verify with a clean build after any `ably` version bump.
5. **Unexecuted schema** — `src/lib/db/schema.ts` has never been pushed to a real Neon instance (`npm run db:push` never run). Column types, defaults, and constraints are believed correct on read-through but unverified.
6. **No tests anywhere** — any refactor of the scoring/buzz logic has no safety net.
