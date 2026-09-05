# UI System

## Layout system

No shared app-shell layout beyond `src/app/layout.tsx` (fonts, providers, toaster) and `src/app/(auth)/layout.tsx` (centered card with logo, used by sign-in/sign-up). The `/room/[code]` route has no persistent chrome — `RoomClient` renders full-bleed views (`LobbyView`, `GameplayView`, `ResultsView`) with their own internal `max-w-*` containers rather than a shared page shell.

## Navigation

Still minimal, but no longer has dead links: the landing page header (`src/app/page.tsx`) has Leaderboards/Patch Notes links (both now real pages) and `NavAuthLinks` (new — shows "Sign in" when signed out, or an avatar dropdown with Profile/Sign out when signed in). There is still no persistent nav bar inside `/room/[code]` or on the standalone pages (`/browse`, `/leaderboards`, `/profile`, `/settings`, `/patch-notes`) — each has its own minimal header with a "Home" back-link instead of a shared shell.

## Page structure (what exists)

| Route | Component | Status |
|---|---|---|
| `/` | `src/app/page.tsx` | Complete |
| `/sign-in`, `/sign-up` | `(auth)/[route]/page.tsx` + `AuthForm` | Complete |
| `/auth/callback` | route handler, no UI | Complete |
| `/room/[code]` | `RoomClient` → `LobbyView` \| `GameplayView` \| `ResultsView` | Complete in code, unverified at runtime |
| `/browse` | Public room list | Complete in code, unverified at runtime (new, session four) |
| `/leaderboards` | Global leaderboard, 6 sortable metrics | Complete in code, unverified at runtime (new, session four) |
| `/profile` | Own profile, stats, achievements grid | Complete in code, unverified at runtime (new, session four) |
| `/settings` | Theme/background/volume/accessibility controls | Complete in code, unverified at runtime (new, session four) |
| `/patch-notes` | Static version history | Complete (new, session four) |

## Component hierarchy (room flow)

```
RoomClient
├── NameGate                (shown until a display name is set)
├── LobbyView                (room.status === "lobby")
│   ├── HostSettingsPanel      (host only)
│   │   └── PlaylistPicker
│   ├── PlayerList
│   └── RoomChat
├── GameplayView              (room.status === "playing")
│   ├── YoutubePlayer
│   ├── HintsPanel
│   ├── BuzzerButton | AnswerPanel   (mutually exclusive per buzz-phase)
│   ├── ScoreboardSidebar
│   ├── FloatingScorePopups
│   └── RoundRevealOverlay            (shown when phase === "resolved")
└── ResultsView                (room.status === "finished")
    (fetches match_history, renders a podium + standings list, fires canvas-confetti)
```

## Themes

- **Token source:** `src/app/globals.css`. Tailwind v4's CSS-based config — there is no `tailwind.config.js`; the `@theme inline` block at the top of `globals.css` maps CSS custom properties to Tailwind color utilities.
- **Light mode (`:root`):** OKLCH-based palette, green primary (`oklch(0.72 0.19 149)` ≈ Spotify green), violet accent (`oklch(0.62 0.22 300)`).
- **Dark mode (`.dark`):** darker background/card OKLCH values, same green/violet primary/accent hues carried through for brand consistency.
- **Switching mechanism:** `next-themes`' `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) toggles the `.dark` class on `<html>`. `/settings` (new, session four) now has a real theme-mode `Select` calling `useTheme()`'s `setTheme`.
- **Custom named backgrounds (Cyberpunk, Galaxy, Neon, etc.):** originally modeled as a 15-value union type in `settings-store.ts` (`ThemeBackground`), **now implemented (session four)** via `src/lib/theme-backgrounds.ts`, which maps each preset to a CSS gradient string (pure-CSS approximations, no bundled images), rendered by `src/components/providers/background-layer.tsx` (mounted in the root layout) as a fixed full-viewport layer behind all content. **Expanded in a later, not-fully-documented session (see `PROJECT_STATE.md`'s "Documentation gap") from 14 to 20 presets** (added Aurora, Desert, Midnight City, Sakura, Volcano, Frost) plus a procedural grain overlay, and the `/settings` picker was replaced from a swatch-grid with a circular "theme wheel" (`src/components/settings/theme-wheel.tsx`, trig-positioned swatches with a spring-animated selection). Custom-image upload still works the same way (stored as a `localStorage` data URL — see `DECISIONS.md` D-012 for why not real file/blob storage).

## Colors

Semantic tokens only (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, plus `chart-1..5` and `sidebar-*` — the latter two groups are shadcn CLI defaults, unused by any actual chart or sidebar component in this app). Brand-specific extras: `--color-clash-green` / `--color-clash-violet` / `--color-clash-pink` (declared in the `@theme inline` block, used ad hoc as raw hex in a few places like `logo.tsx`'s SVG gradients rather than consistently through the token).

## Typography

`next/font/google`'s Geist (sans) and Geist Mono, loaded in `layout.tsx` as CSS variables (`--font-geist-sans`, `--font-geist-mono`). No separate heading font (`--font-heading` in `globals.css` just aliases `--font-sans`). Room codes use `font-mono` explicitly for readability (`LobbyView`, `JoinRoomCard`).

## Spacing, radius, shadows

Standard Tailwind v4 spacing scale, no custom overrides found. Radius is token-driven (`--radius` base value with `sm`/`md`/`lg`/`xl`/`2xl`/`3xl`/`4xl` derived via `calc()` in the `@theme inline` block) — components generally lean toward the larger end (`rounded-2xl`/`rounded-3xl`) for the "premium/rounded" look the spec asked for. Custom shadow/glass utilities: `.glass`, `.glass-strong`, `.neon-ring`, `.neon-glow-green`, `.neon-glow-violet`, `.neon-text` — all defined in `globals.css`'s `@layer components` block, used throughout the room/landing components.

## Breakpoints

Tailwind defaults (`sm`/`md`/`lg`/`xl`), used inconsistently-but-present across `page.tsx`, `lobby-view.tsx`, `player-list.tsx` (e.g. `grid sm:grid-cols-2 lg:grid-cols-3` patterns). No dedicated mobile-only or tablet-only components exist — it's all responsive-class-driven, unverified on a real device/viewport (no dev server has been run in this environment).

## Animation system

Framer Motion, used directly per-component (no shared animation-variants file). Notable uses: `PlayerList`'s `AnimatePresence`/`layout` for join/leave transitions, `SplashScreen`'s pulsing logo + staggered equalizer bars, `BuzzerButton`'s pulsing glow + tap-scale (component exists but is not yet rendered anywhere — see `FEATURES.md`). `tw-animate-css` is also installed (adds Tailwind animation utility classes) but not obviously used beyond whatever shadcn's generated components rely on internally.

## Icon system

`lucide-react` throughout, imported per-component as needed (no icon registry/wrapper).

## Image assets

No `next/image` usage anywhere in the app code (only the auto-generated `favicon.ico` and the `next/og`-based `apple-icon.tsx`/`opengraph-image.tsx` produce raster images). The one remote-image use case (YouTube playlist thumbnails in `PlaylistPicker`) deliberately uses a raw `<img>` tag with an inline `eslint-disable @next/next/no-img-element` comment, avoiding the need to configure `next.config.ts`'s remote image allowlist. `public/` still contains the five default `create-next-app` SVGs, entirely unused.

## Reusable components (`src/components/ui/`)

Generated via the shadcn CLI (`base-nova` style, Base UI-backed — see `CLAUDE.md`'s "Coding conventions" for the specific API differences from classic Radix-based shadcn this caused). Present: `avatar`, `badge`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `progress`, `select`, `separator`, `sheet`, `slider`, `sonner`, `switch`, `tabs`, `tooltip`. **Do not hand-edit these to add missing props** (e.g. don't patch `Button` to accept `asChild` by hand) — either find the correct current API by reading the component's own source, or regenerate/update via `npx shadcn add <name> --overwrite` if the installed version is genuinely outdated relative to the CLI's current output.

## Modals / notifications

`Dialog` (shadcn) used for the YouTube-playlist-import flow in `PlaylistPicker`. `sonner` (`Toaster` mounted in root `layout.tsx`) used for all transient feedback (errors, "copied to clipboard," "playlist imported"). No custom modal patterns beyond these.

## Forms

Plain controlled React state + native `<form onSubmit>`, no form library (no react-hook-form/zod in `package.json`). Validation is minimal and mostly server-side (API routes reject malformed input); client-side validation is limited to `required`/`minLength`/`maxLength` HTML attributes (see `AuthForm`, `HostSettingsPanel`'s category toggle needing at least one category selected).

## Loading / empty / error states

- **Global loading:** `src/app/loading.tsx` renders `<SplashScreen>` (Next.js App Router's automatic Suspense boundary for route transitions).
- **Per-flow loading:** `RoomClient` has an explicit `status` state machine (`loading | needs-name | joining | ready | not-found`) with its own `<SplashScreen label="Joining room..." />` for the joining state.
- **Empty states:** `RoomChat` shows "Say hi to the room 👋" when empty; `PlaylistPicker` shows a message pointing at `npm run db:seed` when no playlists exist.
- **Error states:** `sonner` toasts on any caught `Error` from `src/lib/api-client.ts`; `RoomClient` has a dedicated "Room not found" full-page state.
- **Not covered:** no error boundary component exists anywhere (a thrown render error in, say, `LobbyView` would hit Next.js's default error UI, not a branded one) — no `error.tsx` file exists under `src/app/`.

## Accessibility

See `FEATURES.md`'s Accessibility entry — CSS/state plumbing exists (colorblind palette swap, high-contrast, font-scale, reduced-motion, all via `html[data-*]` attributes in `globals.css`), but there is no dedicated audit, no explicit ARIA-attribute work beyond component-library defaults, and no keyboard-navigation-specific testing performed.

## Browser support

Not specified anywhere (no `browserslist` config in `package.json`). Relies on Tailwind v4 / Next.js 15 / React 19's own baseline support targets.

## Known visual inconsistencies

- The brand mark exists in three independently-maintained forms (`logo.tsx` React component, `icon.svg` static file, `apple-icon.tsx`/`opengraph-image.tsx` `next/og` JSX) — see `FILE_MAP.md`'s warning that changing the logo requires updating all of them, since none is generated from a shared source.
- `--color-clash-green`/`-violet`/`-pink` tokens are declared but inconsistently used — some components reference them, others (like `logo.tsx`) hardcode the same hex values directly in SVG gradient stops.

---

## Game-loop layer (portfolio group W4) — added 2026-09-05

`src/app/design-system/game-loop.css` is a **vendored copy** of
`~/Projects/.design-system/GAME-LOOP.css` v1.0, the shared surface language for
the eleven competitive/social games in the portfolio's W4 overhaul group. It is
imported in `globals.css` immediately after `master.css`.

**Never patch the vendored copy.** Fix the canonical file and re-vendor; the
copy carries a header saying so, and `md5` against the source detects drift.

It supplies four primitives this app previously hand-rolled or lacked:

| Primitive | Classes | Where it lands here |
|---|---|---|
| Seat / lobby list | `.gl-seat`, `.gl-seat-name`, `data-you`, `data-seat="empty\|absent"` | `PlayerList` — filled seats, the disconnected (dotted) state, and the open seat |
| Turn feedback | `.gl-turn[data-turn="you\|them\|idle"]` | the readout strip in `GameplayView`, and the buzz-holder row in `ScoreboardSidebar` |
| Outcome motion | `.gl-outcome[data-outcome="win\|lose\|draw"]`, `.gl-outcome-detail`, `.gl-burst` | `ResultsView`'s heading |
| Spectator readout | `.gl-readout`, `.gl-phase`, `.gl-score` | the strip above the player/scoreboard grid in `GameplayView` |

The token slots (`--gl-win`, `--gl-lose`, `--gl-draw`, `--gl-turn-you`,
`--gl-turn-them`, `--gl-outcome-ink`, `--gl-seat-line`) are bound to this app's
semantic tokens in `:root`, so `.dark` and `html[data-colorblind="true"]`
re-tint the whole layer without restating a single game value.

### `.seat-surface`, and why `.glass` is not used on a seat

`.glass` paints its own border. A seat's entire non-colour channel *is* its
border — dashed means empty, dotted means absent, 2px means you — and `.glass`
is defined later in the same cascade layer, so it silently wins and erases all
three. `.seat-surface` is `.glass` minus the border: fill and shadow only.

### Reduced motion has two gates here, and the layer only ships one

`GAME-LOOP.css` guards itself with an OS `prefers-reduced-motion` media query.
This app has a **second, independent gate** — the in-app Settings toggle, which
sets `html[data-reduced-motion="true"]` — and that one collapses animation
durations rather than cancelling animations. Collapsing resolves an element to
its *last* keyframe, which is safe for every `gl-*` animation except two:

- `.gl-burst` ends at `opacity .12 / scale 1.35`, so it would leave a permanent
  faint glow over the outcome card instead of disappearing.
- `.gl-turn` breathe ends at `opacity .68`, leaving the "your turn" badge
  stuck dimmed.

Both are restated for the in-app gate at the bottom of `globals.css`. Verified
by reading computed styles in a real browser in all three states (no reduce, OS
reduce, in-app toggle) — not by reading the keyframes.

### JavaScript motion is not covered by either gate

`useMotionOff()` (`src/lib/hooks/use-motion-off.ts`) returns true when *either*
source asks for reduced motion. Framer Motion `animate` props and
`canvas-confetti` never touch the CSS properties the two gates collapse, so
anything driven from JS must ask the hook itself. Currently used by the buzzer's
pulse, the results confetti/fanfare, and the podium entrance.

## Known defect: the light theme is not designed (found 2026-09-05, NOT fixed)

`/settings` offers Light / Dark / System and defaults to System, so a player on
a light-mode OS gets the light token set. `BackgroundLayer` then paints the
chosen preset as a `fixed inset-0` layer behind all content **in both schemes**,
and 19 of the 20 presets are dark (the default, `neon`, is `#0a0e17`). The
result is the light scheme's near-black text (`--foreground: oklch(0.18 …)`)
rendered on a near-black gradient. Verified in a browser at 1280×720: the
"Room name", "Songs per game", "Game mode" and "Buzz timer" labels on
`/room/[code]` are effectively unreadable.

This is app-wide, predates this pass, and is **not** a game-loop issue. Fixing
it properly means light variants for `.glass`/`.glass-strong`/`.neon-*` and
converting the 46 hardcoded `white/<alpha>` utilities across 15 files to a
token — a light-theme design pass, out of scope for a W4 adoption.

It has one direct consequence recorded in `globals.css`: the outcome colours
are deliberately **not** re-tuned per scheme. Measured against `--background`
the light values fail AA (2.18:1 win, 2.73:1 lose) and a darkened pair was
briefly written to fix that — but `--background` is not what a player sees.
Against the preset that actually paints, the semantic tokens measure 8.43:1 and
6.71:1, and darkening them would have made the biggest word in the game worse.
