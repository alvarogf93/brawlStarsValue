@AGENTS.md

# BrawlVision -- Project Guide

## What is this?
Brawl Stars combat analytics platform. 13 locales, premium subscriptions via PayPal, Supabase backend.

## Tech Stack
- Next.js 16 (App Router, client components)
- TypeScript (strict mode)
- Tailwind CSS v4
- Supabase (auth, database, RLS)
- PayPal (subscriptions)
- next-intl (13 locales, default: es)
- Vitest (358+ tests)
- Vercel (deployment)

## Key Architecture
- `/src/app/[locale]/profile/[tag]/` -- private profile pages (DashboardLayoutClient)
- `/src/app/[locale]/brawler/[brawlerId]/` -- public brawler pages (no layout)
- `/src/app/api/` -- 23 API routes
- `/src/lib/analytics/compute.ts` -- heavy computation (800+ lines, pure functions)
- `/src/lib/draft/` -- draft simulator, meta aggregation
- `/src/hooks/` -- 11 data-fetching hooks with localStorage cache

## Design System
- Font: Lilita_One (headings), Inter (body)
- Cards: .brawl-card (white dots), .brawl-card-dark (dark)
- Buttons: .brawl-button (gold, 3D shadow)
- Chips: DottedChip component (colored bg with dot pattern)
- Text: .text-stroke-brawl (white text, dark border)

## Data Pipeline
- Supercell API -> battle-parser -> battles table (premium only)
- Cron sync -> processBattleForMeta -> meta_stats/meta_matchups (aggregated)
- Meta-poll -> pro player polling -> meta_stats source='global'

## Premium Model
- Free: last 25 battles from API, basic stats
- Trial: 3 days PRO on sign-up (auto-activated)
- Premium: unlimited battle history, advanced analytics, meta PRO

## Important Decisions
- event_id NOT used as aggregation key (108 collisions in BrawlAPI)
- map+mode strings as meta_stats key (correct, not ideal but works)
- useMapImages hook for map image resolution (by name)
- last_sync as cursor for meta aggregation dedup
