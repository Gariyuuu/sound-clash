# Deployment

**This app is deployed and live: https://sound-clash-nu.vercel.app** — deployed 2026-08-07 (sixth session). Real Neon, Clerk, and Ably resources back it, provisioned via the Vercel CLI's marketplace-integration commands (`vercel integration add neon`, `vercel integration add clerk`). Room creation and joining were verified against the live URL via direct API calls. What's below documents how this was done and what's still unverified beyond that (see "Post-deployment verification" for exactly what's confirmed vs. not).

## How it was actually provisioned (this project's real history, not just the generic instructions below)

1. `vercel link --yes` — created/linked a Vercel project named `sound-clash` under the `garywangsmes-8349s-projects` team.
2. `vercel integration add neon --name sound-clash-db --plan free_v3 -e production -e preview -e development` — this team already had the Neon marketplace integration installed (from other projects — engo, dramabrief, etc.), so this provisioned a brand-new Neon project non-interactively and auto-synced `DATABASE_URL` (+ several `POSTGRES_*`/`PG*` variants) into all three Vercel environments, then pulled them into `.env.local`.
3. `vercel integration add clerk --name sound-clash-auth --plan hobby_2025_08 -e production -e preview -e development` — Clerk was a *new* integration for this team, so the first attempt returned `action_required: integration_terms_acceptance_required` with a `verification_uri` to open in a browser. After the user accepted the marketplace terms there, re-running the identical command succeeded and synced `CLERK_SECRET_KEY`/`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. Ably has no Vercel marketplace integration used here — the user supplied a real Ably API key manually (the **root** key specifically, not a subscribe-only key, since the server needs publish + token-issuing capability). Added via `vercel env add ABLY_API_KEY <env>` for all three environments, and manually into `.env.local`.
5. `npm run db:push` then `npm run db:seed` against the real `DATABASE_URL`.
6. `vercel --prod` — production build succeeded, deployed, and auto-aliased to `sound-clash-nu.vercel.app`.
7. Verified with `curl`: homepage `200`, `/api/ably-token` returns a real signed token, `POST /api/rooms` against the live URL actually created and returned a persisted room row.

**Note for future provisioning on this Vercel team specifically:** `drizzle-kit push`/`generate`/`studio` don't auto-load `.env.local` the way `tsx --env-file=.env.local` (used by `db:seed`) does — this bit the first `db:push` attempt (`Either connection "url" or "host"... are required`). Fixed by changing `package.json`'s `db:push`/`db:generate`/`db:studio` scripts to `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs <cmd>` instead of the plain `drizzle-kit <cmd>` binary invocation.

## Hosting platform

Vercel (free/Hobby tier), chosen specifically because the whole realtime/timing architecture (`DECISIONS.md` D-003, D-013) was designed around serverless-function constraints rather than requiring an always-on process. Neon (serverless Postgres, HTTP driver) and Ably (managed pub/sub) were both chosen partly *because* they fit this same serverless-first constraint — no persistent connection pool or long-lived socket server to run yourself.

## Prerequisites — status

1. ✅ **Neon project** — provisioned (`sound-clash-db`, via Vercel's Neon marketplace integration). `DATABASE_URL` is real and live.
2. ✅ **Clerk application** — provisioned (`sound-clash-auth`, via Vercel's Clerk marketplace integration). `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`/`CLERK_SECRET_KEY` are real. ⬜ **Still open:** the webhook endpoint (`<deployed-url>/api/webhooks/clerk`, subscribed to `user.created`) is not registered in the Clerk Dashboard yet — `CLERK_WEBHOOK_SIGNING_SECRET` is still a placeholder. Without it, sign-ups authenticate but never get a `profiles` row (see `DATABASE.md`). Not blocking guest play.
3. ✅ **Ably application** — real root API key in place (server + all three Vercel environments).
4. ✅ `npm run db:push` run against the real `DATABASE_URL` — all tables created.
5. ✅ `npm run db:seed` run — achievement catalog + demo playlist loaded.
6. ⬜ YouTube/Spotify API keys — not configured, optional (the seeded demo playlist works without them).

## Environment variables to configure (Vercel project settings)

See `CLAUDE.md`'s environment table / `.env.example` for the full list. At minimum for anything to function: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `ABLY_API_KEY`. Add `YOUTUBE_API_KEY` if playlist import is needed. `SPOTIFY_CLIENT_ID`/`SECRET`/`NEXT_PUBLIC_SITE_URL` can be set or omitted.

## Build command / output

Standard Next.js App Router defaults — no custom `vercel.json` exists, so Vercel's zero-config Next.js detection applies: build command `next build`, no custom output directory override. **`next.config.ts` now contains non-default config that must survive into the Vercel build** — `serverExternalPackages: ["ably"]` and a custom webpack rule patching `ably`'s bundled source (see `CLAUDE.md` "Current status", `scripts/webpack/fix-ably-super.cjs`). This is checked into the repo and requires no special Vercel configuration to take effect, but if `next.config.ts` is ever regenerated/replaced, this must be re-added or the build will fail the same way it did locally before the fix.

## Runtime version

No `engines` field in `package.json` — Vercel will use its own default Node runtime for the detected Next.js version unless explicitly pinned. Recommend adding an `engines.node` field before first deploy.

## Database deployment / migration order

No versioned migration files exist — the project uses `drizzle-kit push` (direct schema sync from `src/lib/db/schema.ts`), not a tracked migration history:
1. `npm run db:push` (schema)
2. `npm run db:seed` (optional, demo data — requires `.env.local` locally, or run once against the production `DATABASE_URL` directly)

If the schema changes in the future with real production data already in it, switch to `drizzle-kit generate` (versioned SQL migration files under `./drizzle`) + a proper migration-apply step in the deploy pipeline, rather than continuing to `db:push` directly against production — `db:push` can be destructive for certain column-type changes since it diffs and reconciles the live schema on the fly.

## Domain configuration

No custom domain — the app is live on its Vercel-assigned domain, https://sound-clash-nu.vercel.app. No custom domain has been discussed or configured.

## Operator's known Vercel gotchas (from this user's established cross-project pattern — not discoverable from this repo's code, carried over from how their other projects were deployed)

- **New Vercel projects default to an SSO/auth wall on preview and sometimes production URLs.** This must be explicitly disabled in the Vercel project's settings after creation, or the deployed game will be unreachable by players who aren't logged into the owner's Vercel team.
- If this project is ever restructured into a pnpm-workspace monorepo (it is not one today), setting the correct "Root Directory" in Vercel's project settings has previously required a raw Vercel API call for this user's other monorepo projects. Not applicable to Sound Clash as currently structured.

## Preview deployments

Vercel's standard PR-preview-deployment behavior would apply automatically once the project is connected to a Git remote — recall from `PROJECT_STATE.md` that this project has no git history and no remote yet, so this isn't available today either.

## Storage setup

Not needed — no file/blob storage of any kind is used by any implemented feature.

## Scheduled jobs / webhooks

**One webhook now exists** — `/api/webhooks/clerk`, must be registered in the Clerk Dashboard pointed at the deployed URL (see "Prerequisites" above). No scheduled/cron jobs exist.

## Known deployment-blocking issues (as of this audit)

**None remaining that actually block usage.** Historical list, now resolved:

1. ~~No live Neon project, Clerk application, or Ably application to point at~~ — **resolved**, all three are live (see above).
2. **The Clerk webhook has never been configured or fired anywhere** — profile auto-provisioning on sign-up is still entirely unverified. Not blocking (guest play works without it), but still open.
3. `src/lib/rate-limit.ts`'s in-memory limiter will behave inconsistently across Vercel's multiple serverless instances — not a hard blocker, but worth knowing before treating rate limits as a real guarantee in production (see `SECURITY.md`). Unchanged.
4. ~~`npm run db:push` has never been run against any real database~~ — **resolved**, ran successfully against the live Neon project.

## Runtime limitations (by design, not bugs — see `DECISIONS.md`)

- No server-side round timer — the host's browser must stay open and connected for a game to progress at the expected pace.
- No true audio manipulation for Instrumental/Reverse Intro modes.
- No database-level defense layer (RLS-equivalent) — see `SECURITY.md`.

## Rollback procedure

Standard Vercel rollback (redeploy a previous successful build from the dashboard, or `vercel rollback`) applies now that a first deployment exists.

## Health checks

None implemented — no `/api/health` or similar endpoint exists.

## Post-deployment verification — actual results

1. ✅ Landing page renders, `200`, at https://sound-clash-nu.vercel.app.
2. ⬜ Sign up via Clerk on the live URL → confirm a `profiles` row is created. **Not yet done** — the Clerk webhook isn't registered yet, so this would currently fail (auth would succeed, no profile row would appear). Do this after registering the webhook.
3. ✅ Confirmed via direct API call (not yet via a real browser session): `POST /api/rooms` against the live URL created and returned a real, persisted room. `/api/ably-token` returns a valid signed token request (`200`).
4. ⬜ Not yet explicitly checked — confirm `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and `ABLY_API_KEY` never appear in any client-side JS bundle (Network tab / view-source on the deployed site). Expected to pass given `import "server-only"` guards, but not independently re-verified against the live deployment's actual served JS.
5. ⬜ The full manual smoke-test checklist in `TESTING.md` (a real two-device game) has not been run yet — this is the top remaining item, see `PROJECT_STATE.md`/`TASKS.md`.

## Deployment checklist

- [x] `next build` succeeds locally
- [x] Neon project created, `npm run db:push` + `npm run db:seed` run against it
- [ ] Clerk application created ✅, webhook endpoint configured and pointed at the deployed URL ⬜ (not done yet)
- [x] Ably application created
- [x] All required env vars set in Vercel project settings (`DATABASE_URL`, Clerk keys, `ABLY_API_KEY` — `CLERK_WEBHOOK_SIGNING_SECRET` still pending, see above)
- [ ] Vercel project connected to a Git remote — still not done; this repo has no git history (see `PROJECT_STATE.md`'s git-state note), so the current deployment was pushed via `vercel --prod` directly from the local directory, not via a Git-triggered deploy. Fine for now, but means no automatic redeploy-on-push and no preview deployments per branch.
- [x] First deploy succeeds — live at https://sound-clash-nu.vercel.app
- [ ] Post-deployment verification steps above fully completed (2/5 done — see above)
