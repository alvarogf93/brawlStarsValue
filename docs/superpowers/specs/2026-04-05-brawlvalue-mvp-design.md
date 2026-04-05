# BrawlValue MVP — Design Spec (v2)

**Date:** 2026-04-05  
**Status:** Approved — Ready for implementation  
**Revision:** v2 — Added i18n, dashboard layout with header+sidebar, multi-page profile

---

## Goal

Build a mobile-first, multi-language web app where a user enters their Brawl Stars Player Tag and enters a **profile dashboard** that shows their account's **Gem Equivalent Power Score**, brawler breakdown, and more — all designed to maximize page views (and thus ad impressions) through rich, explorable sections.

## Non-Goals (MVP)

- No real Supercell API calls (mock data — API key requires Vercel IP whitelist)
- No AdSense integration (requires site approval)
- No CMP / consent popup
- No user authentication (tag = session)
- No database / leaderboard

## Architecture

**Three zones:**

```
┌─────────────────────────────────────────────────┐
│  HEADER (logo, locale switcher, tag display)     │
├──────────┬──────────────────────────────────────┤
│ SIDEBAR  │  MAIN CONTENT                        │
│ (nav)    │  (page-specific content)             │
│          │                                      │
│ Overview │  [Current section rendered here]     │
│ Brawlers │                                      │
│ Stats    │                                      │
│ Share    │                                      │
│          │                                      │
├──────────┴──────────────────────────────────────┤
│  FOOTER (Supercell disclaimer)                   │
└─────────────────────────────────────────────────┘
```

**Mobile:** Sidebar collapses to hamburger menu. Header stays.

**Flow:**
1. Landing (`/[locale]`) — Input form. No sidebar. Clean entry point.
2. Dashboard (`/[locale]/profile/[tag]/*`) — Header + Sidebar + Content. Each section is a separate route = separate page view = ad opportunity.

## i18n Strategy

- **Library:** `next-intl` (fully compatible with Next.js 16 App Router)
- **Languages:** Spanish (default), English
- **Structure:** `messages/es.json`, `messages/en.json`
- **Routing:** `/es/`, `/en/` prefixes via middleware
- **All user-facing text** lives in message files, never hardcoded

## Routes

| Route | Purpose | Sidebar? |
|-------|---------|----------|
| `/[locale]` | Landing — enter tag | No |
| `/[locale]/profile/[tag]` | Overview — hero gem score + summary | Yes |
| `/[locale]/profile/[tag]/brawlers` | Brawler list with rarity, level, prestige | Yes |
| `/[locale]/profile/[tag]/stats` | Detailed stats breakdown (4 vectors) | Yes |
| `/[locale]/profile/[tag]/share` | Share card + Web Share API | Yes |

Each route is a page view. Ads can be placed in each section.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Language | TypeScript 6.0 (strict) |
| i18n | next-intl |
| CSS | Tailwind v4.1 |
| UI | shadcn/ui (copy-paste) |
| Animation | Motion (framer-motion) 12.x |
| State | TanStack Query v5 |
| Rate limit | Upstash Redis (future) |
| Test | Vitest + RTL + Playwright |

## Data Model

### Input
```typescript
{ playerTag: string }  // "#2P0Q8C2C0"
```

### Output (GemScore) — unchanged from v1
```typescript
{
  playerTag: string
  playerName: string
  gemEquivalent: number
  totalScore: number
  breakdown: {
    base:    { trophies: number; victories3vs3: number; value: number }
    assets:  { brawlerCount: number; value: number }
    enhance: { gadgets: number; starPowers: number; hypercharges: number; buffies: number; value: number }
    elite:   { prestige1: number; prestige2: number; prestige3: number; value: number }
  }
  timestamp: string
  cached: boolean
}
```

## Algorithm — unchanged

4-vector engine: V_base + V_assets + V_enhance + V_elite → Gem Equivalent.  
Full spec: `docs/05-algoritmo-valoracion.md`

## API Contract — unchanged

`POST /api/calculate` → GemScore JSON.  
Error codes: 400, 403, 404, 429, 500, 503.

## Legal Constraints — unchanged

1. NO USD/fiat currency
2. Supercell disclaimer in footer
3. Domain must not contain "Brawl" / "Supercell"
4. No artificial delays

## File Map (v2)

```
messages/
  es.json                           — Spanish translations
  en.json                           — English translations
src/
  i18n/
    request.ts                      — next-intl getRequestConfig
    routing.ts                      — locale routing config
  middleware.ts                     — next-intl locale detection middleware
  lib/
    types.ts                        — All interfaces
    constants.ts                    — Algorithm constants
    utils.ts                        — Validation, formatting
    calculate.ts                    — 4-vector engine
  app/
    [locale]/
      layout.tsx                    — Root layout with NextIntlClientProvider
      page.tsx                      — Landing page (no sidebar)
      profile/
        [tag]/
          layout.tsx                — Dashboard layout (header + sidebar + main)
          page.tsx                  — Overview (hero gem score)
          brawlers/page.tsx         — Brawler list
          stats/page.tsx            — Detailed stats breakdown
          share/page.tsx            — Share card
    api/
      calculate/route.ts            — POST handler
  components/
    layout/
      Header.tsx                    — Top bar: logo + locale switcher + tag
      Sidebar.tsx                   — Left nav (desktop: always visible, mobile: hamburger)
      MobileNav.tsx                 — Mobile hamburger overlay
    landing/
      InputForm.tsx                 — Player tag input
    profile/
      GemScoreHero.tsx              — Big number display
      BreakdownGrid.tsx             — 4-vector breakdown cards
      BrawlerCard.tsx               — Individual brawler display
      ShareCard.tsx                 — Share preview + buttons
    common/
      Footer.tsx                    — Supercell disclaimer
      LocaleSwitcher.tsx            — ES/EN toggle
  hooks/
    useCalculateValue.ts            — TanStack Query mutation
    useShare.ts                     — Web Share API + clipboard
  test/
    setup.ts
    mocks.ts
  __tests__/
    unit/lib/calculate.test.ts
    unit/lib/utils.test.ts
    integration/api/calculate.test.ts
```

## Sidebar Navigation Items

| Icon | Label (es) | Label (en) | Route |
|------|-----------|-----------|-------|
| Star | Vista General | Overview | `/profile/[tag]` |
| Users | Brawlers | Brawlers | `/profile/[tag]/brawlers` |
| BarChart | Estadísticas | Stats | `/profile/[tag]/stats` |
| Share2 | Compartir | Share | `/profile/[tag]/share` |

Extensible: future sections (history, comparison, leaderboard) are just new items + routes.

## Responsive Behavior

- **Mobile (< 768px):** No sidebar visible. Hamburger icon in header opens slide-over nav. Content is full-width.
- **Tablet (768px-1024px):** Sidebar collapsed to icons only (48px wide). Hover/click expands.
- **Desktop (> 1024px):** Sidebar fully expanded (240px). Main content fills remaining space.
