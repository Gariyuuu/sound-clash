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
