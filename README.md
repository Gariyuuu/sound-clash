# Sound Clash

A real-time multiplayer music-guessing party game. Buzz in first, name the
song, steal points off wrong answers. Built with Next.js 15, Neon (Postgres)
+ Drizzle ORM, Clerk (auth), Ably (realtime), and Tailwind CSS — designed to
run entirely on free-tier hosting (Vercel + Neon + Clerk + Ably).

Create a room, share the code, drop in a YouTube or Spotify playlist, and
race your friends to name the song first across 12 game modes.

## Features

- **Buzzer gameplay** — first to buzz locks everyone else out, then has 10 seconds to answer.
- **Steal rounds** — a wrong answer opens the floor for everyone else at 80% points.
- **12 game modes** — Classic, Speed Round, Artist Rush, Album Rush, Chorus Challenge, Instrumental, Reverse Intro, One Second, Hard Mode, Sudden Death, Team Battle, Chaos.
- **YouTube and Spotify** song sources — import any public playlist by URL.
- **Hints, scoring bonuses, XP/levels, and achievements.**
- **Live lobby** — chat, emoji reactions, typing indicators, ready status, host controls (kick/ban/pause/skip).
- **Leaderboards, profiles, match results with a podium.**
- **Public and private rooms**, spectator mode, 2–20 players.
- **Accessibility** — colorblind-safe palette, high contrast, font scaling, reduced motion.
- **Custom theme backgrounds** (14 presets) plus your own uploaded image.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Neon/Clerk/Ably (see below)
npm run db:push               # create tables from src/lib/db/schema.ts
npm run db:seed                 # demo playlist + achievement catalog
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Neon setup

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string into `DATABASE_URL` in `.env.local`.
3. Run `npm run db:push` to create all tables from `src/lib/db/schema.ts` (the schema source of truth — there's no separate SQL migration file to run manually).
4. Run `npm run db:seed` for a demo playlist (8 real songs) plus the achievement catalog, so you can host a game immediately without any external API keys.

## Clerk setup

1. Create a free application at [clerk.com](https://clerk.com).
2. Copy the publishable key and secret key into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` in `.env.local`.
3. In the Clerk Dashboard, add a webhook endpoint pointing at `<your-url>/api/webhooks/clerk`, subscribed to at least `user.created`, and copy its signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. **Without this, new sign-ups won't get a `profiles` row.**

## Ably setup

1. Create a free application at [ably.com](https://ably.com).
2. Copy an API key into `ABLY_API_KEY` in `.env.local`. This key stays server-only — the browser authenticates via a short-lived token minted by `/api/ably-token`.

## YouTube API setup (optional — the seeded demo playlist works without it)

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com), enable the **YouTube Data API v3**.
2. Create an API key (Credentials → Create Credentials → API key).
3. Set `YOUTUBE_API_KEY` in `.env.local`.
4. In the app, use "Import playlist" in the host settings panel with any public YouTube playlist URL.

## Spotify API setup (optional)

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Copy the Client ID and Client Secret into `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` in `.env.local`. This uses the Client Credentials flow (no user login needed) to read public playlist data.
3. **Caveat:** Spotify no longer guarantees a 30-second preview clip on every track — some imported songs may have no playable preview. Prefer YouTube or "mixed" source for full playlist coverage.

## Environment variables

See `.env.example` for the full list with descriptions. At minimum you need `DATABASE_URL`, the two Clerk keys, and `ABLY_API_KEY` for anything to work.

## Scripts

```bash
npm run dev       # start the dev server
npm run build     # production build
npm run start     # run a production build
npm run lint      # eslint
npx tsc --noEmit  # type-check
npm run db:push   # sync src/lib/db/schema.ts to DATABASE_URL
npm run db:seed   # demo playlist + achievement catalog
npm run db:studio # visual DB browser
```

## Project documentation

This repository is documented in depth beyond this README — start with
[`CLAUDE.md`](./CLAUDE.md) for a full technical overview, or jump to:

| Doc | Contents |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System diagram, request lifecycle, realtime design |
| [`DATABASE.md`](./DATABASE.md) | Schema, ER diagram |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | Every API route documented |
| [`FEATURES.md`](./FEATURES.md) | Feature-by-feature implementation status |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Deployment checklist for Vercel |
| [`TESTING.md`](./TESTING.md) | Manual smoke-test checklist |
| [`SECURITY.md`](./SECURITY.md) | Threat model and known gaps |
| [`DECISIONS.md`](./DECISIONS.md) | Architectural decision log |
| [`TASKS.md`](./TASKS.md) | Active task queue |

## Deployment

Deploy to [Vercel](https://vercel.com) — connect the repo, set the environment
variables from `.env.example` in the project settings, and deploy. See
[`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full checklist, including a couple
of Vercel-specific gotchas (new projects default to an SSO wall that needs
disabling for players to reach the game).

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui (Base UI) · Framer Motion · Zustand · Neon (Postgres) + Drizzle ORM ·
Clerk (Auth) · Ably (Realtime) · canvas-confetti.

## License

Not specified.
