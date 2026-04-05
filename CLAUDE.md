# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BrawlValue — Mobile-first web app that calculates the fictional USD value of a Brawl Stars account. Full specs in `docs/00-COMIENZA-AQUI.md`.

## Commands

```bash
npm run dev           # Dev server on localhost:3000
npm run build         # Turbopack production build
npm run start         # Run production build locally
npm run lint          # ESLint
npm run type-check    # TypeScript compile without emitting (strict)
npm run test          # Vitest watch mode
npm run test:ui       # Vitest with visual UI dashboard
npm run test:coverage # Coverage report (target: 80% all categories)
```

Run a single test file:
```bash
npx vitest src/__tests__/unit/lib/calculate.test.ts
```

## TDD — Mandatory

**Always write the failing test first.** Red → Green → Refactor. No code without a prior test that justifies it.

Tests live in `src/__tests__/unit/` and `src/__tests__/integration/`. Mock data for the Supercell API lives in `src/test/`.

## Architecture

Three-phase user flow: **Landing → Loading (4–5 s artificial delay) → Results**.

The artificial delay in the frontend is intentional — it creates the window for ad impressions. It is not a bug.

```
src/
  app/
    page.tsx              # Landing: input + CTA
    api/calculate/
      route.ts            # POST /api/calculate — validation, rate limit, Supercell fetch, formula
  components/
    ui/                   # shadcn/ui components (copy-pasted, not an npm dep)
    landing/              # InputForm, CTA
    results/              # ResultCard, Breakdown, ShareButton, LoadingState
    common/               # Header, Footer, ErrorBoundary
  lib/
    types.ts              # All TypeScript interfaces (PlayerData, CalculatedValue, ApiError)
    constants.ts          # PLAYER_TAG_REGEX, LOADING_MESSAGES, BRAWLER_RARITY map, coefficients
    calculate.ts          # Valuation formula — the core algorithm
    api.ts                # Supercell API client (server-only)
    ratelimit.ts          # Upstash sliding-window rate limiter (server-only)
    utils.ts              # isValidPlayerTag, formatCurrency, formatTrophies
  hooks/
    useCalculateValue.ts  # TanStack Query wrapper — returns mock data until real API is wired
    useShare.ts           # Web Share API with clipboard fallback for desktop
```

## Stack

- **Next.js 16.2** — App Router, Turbopack on by default, React Compiler stable
- **TypeScript 6.0** — strict mode, `noUnusedLocals`, `noImplicitReturns` all on
- **Tailwind CSS v4.1** — v4 syntax, not v3
- **shadcn/ui** — components copied into `src/components/ui/`, not installed as a package
- **TanStack Query v5** — `useSuspenseQuery` supported; DevTools available in dev
- **Upstash Redis** — HTTP-based, works in Vercel Edge; used only for rate limiting
- **Vitest + React Testing Library + Playwright** — unit, component, E2E

## Gotchas

**Tailwind v4 syntax differs from v3:**
- `bg-gradient-to-r` → `bg-linear-to-r`
- No `@tailwind base/components/utilities` — use `@import "tailwindcss"` only

**shadcn/ui is not a package.** Components are copied files. Updates from shadcn require manual re-copy.

**Supercell API does not expose brawler rarity.** The static rarity map in `lib/constants.ts` (`BRAWLER_RARITY`) must be updated manually when new brawlers are released.

**Supercell API requires IP whitelisting** at developer.brawlstars.com. The key will not work until Vercel's outbound IPs are added. Use mock data (`useCalculateValue` returns hardcoded values) until the key is configured.

**Ad space CLS:** Containers for AdSense banners must have `min-h-[250px]` even when empty. Without reserved space, ads cause layout shift → Google penalises rankings.

**Player tag regex:** `^#[0-9A-Z]{3,20}$` (case-insensitive). Validate both client-side (UX) and server-side (security).

## Environment Variables

See `.env.example`. Server-side vars (never expose to client):
- `BRAWLSTARS_API_KEY` — Supercell; requires IP whitelist
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate limiting
- `NEXT_PUBLIC_GA_ID` — GA4 Measurement ID (public, NEXT_PUBLIC_ prefix correct)

## Valuation Formula

```
totalValue =
  (trophies × 0.005) +
  (expLevel × 0.5) +
  (rareBrawlers × 1) + (superRareBrawlers × 2) + (epicBrawlers × 5) +
  (mythicBrawlers × 10) + (legendaryBrawlers × 20) +
  (3v3Victories × 0.01)
```

Breakdown components must sum exactly to `totalValue` — enforced by tests.

## API Route Contract

`POST /api/calculate` — body `{ playerTag: string }`

Returns `{ playerTag, playerName, totalValue, breakdown, timestamp, cached }` on 200.  
Returns `{ error }` with status 400 (bad format), 404 (player not found), 429 (rate limited), 500.
