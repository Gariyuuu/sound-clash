# Security Review

Defensive review only — no penetration testing, no attempts against
unauthorized systems, nothing destructive was run. Everything below is
based on reading the code; nothing has been exercised against a live
deployment (none exists). Rewritten 2026-08-06 for the Neon/Clerk/Ably
migration (`DECISIONS.md` D-013) — the authentication provider and the
database's defense-in-depth posture both changed materially.

## Authentication boundary

- Clerk (hosted sign-in/sign-up) for registered users; a parallel, entirely separate localStorage-based guest identity (`lib/guest.ts`) for unauthenticated play. These are unified only at the `room_players` row level via an intended-XOR pairing (`profile_id` or `guest_id`) — **application-enforced only, not a database CHECK constraint** (see `DATABASE.md` — this is a real, if narrow, regression from the old Supabase schema, which had one).
- **No session binding for guests at all** — a guest's "identity" is just a random `nanoid` stored in `localStorage`. Anyone who can read that value (e.g., via XSS, or by inspecting devtools/localStorage on a shared computer) can impersonate that guest in any room they were in. Accepted tradeoff of supporting no-signup party play, unchanged by the migration.
- `middleware.ts` uses `clerkMiddleware()` to attach session context to every non-static request — standard Clerk pattern, looks correct on read-through, never exercised against a real Clerk application in this environment.
- **The Clerk webhook (`user.created` → `profiles` row) has never fired.** Its signature verification (`verifyWebhook()` from `@clerk/nextjs/webhooks`) is trusted to correctly reject unsigned/forged requests — this is a well-known, actively-maintained Clerk SDK function, not custom crypto, but it has zero runtime verification in this environment.

## Authorization boundary

- **No RLS-equivalent exists anymore — this is the single biggest change from the pre-migration security posture.** Neon has no Row Level Security exercised here and no anon/service-role key split; the singleton Drizzle client (`src/lib/db/client.ts`) has unrestricted read/write access to every table. **The API routes are now the entire authorization boundary, with zero database-level backstop** — previously (`DECISIONS.md` D-002, superseded), RLS was "a second line of defense" even though permissive; now there is no second line at all.
- **Room/round mutations still trust a client-supplied `playerId`/`requesterPlayerId` as "who is asking"** — unchanged from before the migration, and still the same known gap: **knowing another player's `room_players.id` (a UUID) is sufficient to make requests "as" them.** Room-player IDs are returned in API responses to every client in the room (player roster, chat messages, buzz-lock events) — they are not secret. A malicious player in the same room could script a request to `/api/rounds/[roundId]/buzz` or `/answer` using another player's `id`. **This is a real gap, not just theoretical** — worth fixing before any public/non-trusted-friend-group deployment, e.g. by binding `room_players` rows to a signed, httpOnly cookie/session token set at join time.
- The one route family with real session-based auth is `/api/profiles/me` and `/api/profiles/me/settings`, which use Clerk's `auth()` to get a verified `userId` rather than trusting a body field — this is strictly stronger than the room/round routes and was true under Supabase Auth too.
- Host-only actions (settings, start, kick, control, hint, timeout, next-round) all correctly re-check `is_host` server-side per request — a non-host calling these directly gets a 403, this part is solid and unaffected by the migration.

## Protected routes

No route-level middleware protection exists beyond `clerkMiddleware()` attaching session context (it doesn't block anything by default in this config — no `auth.protect()` calls exist anywhere). All `/api/*` routes are reachable by anyone; their protection is entirely the per-route logic described above.

## Secret handling

- **`DATABASE_URL` is now the single most sensitive value in the system**, replacing `SUPABASE_SERVICE_ROLE_KEY` — full read/write access to every table, with zero RLS backstop if it were ever leaked. Confirmed only read from `src/lib/db/client.ts` (`import "server-only"`) and `scripts/seed.ts`/`drizzle.config.ts` (both standalone scripts, never bundled into the app).
- **`CLERK_SECRET_KEY`** — server-only, used by `middleware.ts` and any `auth()`/`currentUser()` call. Clerk's SDK is trusted to keep this out of client bundles by convention (not independently re-verified beyond reading that `middleware.ts` and API routes are the only importers).
- **`CLERK_WEBHOOK_SIGNING_SECRET`** — used only in `src/app/api/webhooks/clerk/route.ts` to verify incoming webhook signatures via `verifyWebhook()`. If this is ever misconfigured (wrong secret, or verification accidentally bypassed), the endpoint would accept forged `user.created` payloads and create arbitrary `profiles` rows — worth a deliberate test once a real Clerk app exists.
- **`ABLY_API_KEY`** — server-only, read only in `src/lib/ably/publish.ts` and `src/app/api/ably-token/route.ts` (both `import "server-only"` or route-handler-only). The browser only ever receives a short-lived **token**, minted by `/api/ably-token`, never the raw key — this is the correct Ably pattern and mirrors how the old Supabase anon-key model worked (a scoped, client-safe credential standing in for the powerful one).
- `YOUTUBE_API_KEY`, `SPOTIFY_CLIENT_ID`/`SECRET` — unchanged, server-only, read only in their respective resolver modules.
- `.env.example` contains only placeholder values, rewritten this session for the new stack. `.gitignore` excludes all `.env*` files. No `.env.local` exists in this environment, and no secret values were observed anywhere in the repository during this migration.
- **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** is intentionally client-exposed (that's what a publishable key is for) — correct Clerk usage, not a leak, directly analogous to the old `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Input validation

Unchanged by the migration: display name length caps, chat message length cap (280 chars), rate limits on the highest-abuse-potential routes. No schema validation library (no zod/yup) — request bodies are cast with `as` TypeScript type assertions, no runtime shape checking. Several routes (settings update, kick, start, control, hint, next-round) still have no rate limit at all.

## Output encoding / XSS

React's default JSX escaping handles the common case — unchanged, zero uses of `dangerouslySetInnerHTML` anywhere (verified via grep).

## SQL injection

**Materially improved by the migration.** All database access now goes through Drizzle's query builder with parameterized queries throughout — the old Supabase-era code had two spots that built a raw PostgREST filter string via `.join(",")` interpolation (`.not("id", "in", `(${nextExcluded.join(",")})`)`); the Drizzle rewrite (`src/app/api/rounds/[roundId]/answer/route.ts`, `.../timeout/route.ts`) uses `notInArray(room_players.id, nextExcluded)`, a properly parameterized array binding — that specific fragile pattern no longer exists anywhere in the codebase.

## CSRF

No CSRF tokens anywhere. Mitigating factors unchanged in kind, different provider: this is a same-origin fetch-based API (guest identity is a request body field, not a cookie), and the authenticated (Clerk) path relies on Clerk's own cookie/session handling, which sets its own cookie security attributes by default. Not independently verified against an actual cross-site request in this environment.

## File upload risks

None applicable — no file upload feature exists anywhere. Custom background upload (`DECISIONS.md` D-012) stores a `localStorage` data URL client-side and never touches the server/database — unaffected by the migration.

## Webhook verification

**New surface introduced by this migration** — `src/app/api/webhooks/clerk/route.ts` is the app's first-ever webhook endpoint. Verified via `verifyWebhook()` from `@clerk/nextjs/webhooks`, which checks the request against `CLERK_WEBHOOK_SIGNING_SECRET`. Never exercised against a real signed request in this environment — the correctness of the verification call (right import, right usage) was checked by reading the installed package's type definitions before writing the code, not by receiving a real webhook.

## Rate limiting

Unchanged — `src/lib/rate-limit.ts`, best-effort, in-memory, per-serverless-instance, explicitly documented as such. Same coverage gaps as before the migration.

## Admin access

No admin concept exists at all — unchanged.

## Database-level defense — summary (materially weaker than before this migration)

There is no RLS or equivalent anymore. See `DATABASE.md`'s "Authorization — no RLS, no database-level defense layer" section for the full comparison table. **The one policy that mattered most for game integrity under Supabase — `songs` having no public SELECT policy — has no Neon-side equivalent at all now.** The only thing preventing a player from reading the current round's answer is that no API route returns a raw `songs` row to the browser before reveal (`SECURITY.md`/`ARCHITECTURE.md`'s "Answer-secrecy design"). **Any new route or debug endpoint that queries `songs` and returns the result to a client-reachable response is a potential answer leak with zero backstop** — this needs to be caught in code review every time, not assumed safe by default the way it was when RLS enforced it structurally. See `DECISIONS.md` D-004 (superseded in mechanism, not in intent) and `CLAUDE.md`'s "DO NOT CHANGE WITHOUT REVIEW".

## Logging of sensitive data

No structured logging exists at all — unchanged.

## Dependency concerns

- `@base-ui/react` and the `base-nova`-style shadcn components — unchanged concern from before the migration (real, verified API-mismatch bugs found against them; not a security issue per se).
- **`ably`'s bundled builds required a source-patching webpack loader to compile at all** (`scripts/webpack/fix-ably-super.cjs`, `CLAUDE.md` "Current status") — not a security issue in itself, but worth flagging that this project now carries a build-time patch against a third-party package's shipped output, which needs re-verification on every `ably` version bump (see `ARCHITECTURE.md`'s "Major architectural risks" #4).
- No `npm audit` was run as part of this migration (out of scope, not requested) — recommend running it before any real deployment, especially given three new dependencies (`@clerk/nextjs`, `@neondatabase/serverless`, `ably`, `drizzle-orm`) were added this session.

## Production security gaps — prioritized

1. **No database-level defense layer at all** (new, introduced by this migration) — the answer-secrecy guarantee and every other invariant that used to have an RLS backstop is now enforced purely by API-route code review discipline. This is the top new risk to actively watch as the codebase grows.
2. **Player-identity spoofing within a room** (see "Authorization boundary" above) — unchanged from before the migration, still the biggest concrete *authorization* gap. Fix before any deployment beyond a fully-trusted friend group.
3. `profile_id`/`guest_id` XOR invariant has no database-level enforcement anymore (see `DATABASE.md`) — narrow but real regression.
4. Rate limiting is not distributed-safe and doesn't cover every mutating route — unchanged.
5. No request body schema validation (zod or similar) — unchanged, defense in depth against malformed/malicious payloads.
6. No CSRF tokens — unchanged, lower priority given the architecture.
7. `DATABASE_URL`/`CLERK_SECRET_KEY`/`ABLY_API_KEY` correctly isolated today via `import "server-only"` where applicable — the main way this repository could regress is a future contributor importing `lib/db/client.ts` or `lib/ably/publish.ts` from a Client Component; `import "server-only"` will throw a build error if this happens, a good safety net already in place.
