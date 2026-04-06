# Production Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all hardcoded strings, fix broken i18n, polish the UI to production quality, and add proper error/404 pages.

**Architecture:** All user-facing text lives in 13 locale files (es, en, fr, pt, de, it, ru, tr, pl, ar, ko, ja, zh). Components use `useTranslations()` exclusively. New namespaces: `brawlers`, `stats`, `notFound`, `errorPage`. New keys in: `battles`, `share`, `profile`.

**Tech Stack:** Next.js 16.2.2, next-intl 4.9.0, React 19, Tailwind CSS, TypeScript

---

## File Map

| Status | File | Change |
|--------|------|--------|
| Modify ×13 | `messages/*.json` | Add new namespaces + keys |
| Modify | `src/app/[locale]/profile/[tag]/brawlers/page.tsx` | Replace all hardcoded strings |
| Modify | `src/app/[locale]/profile/[tag]/stats/page.tsx` | Replace all hardcoded strings |
| Modify | `src/app/[locale]/profile/[tag]/share/page.tsx` | Replace hardcoded strings |
| Modify | `src/app/[locale]/profile/[tag]/battles/page.tsx` | Replace hardcoded strings + translate results |
| Modify | `src/app/[locale]/profile/[tag]/page.tsx` | Fix hardcoded error |
| Modify | `src/components/layout/Sidebar.tsx` | Remove "Auth. OS" → BrawlValue brand |
| Modify | `src/components/layout/Header.tsx` | "RANKING" → `t('nav.leaderboard')` |
| Modify | `src/components/profile/BreakdownGrid.tsx` | Redesign layout: 3-col grid + better air |
| Create | `src/app/[locale]/not-found.tsx` | 404 page with i18n |
| Create | `src/app/[locale]/error.tsx` | Error boundary page with i18n |
| Modify | `public/manifest.json` | Fix start_url, English description |

---

## Task 1: Add new i18n keys to all 13 locale files

**Files:** `messages/es.json`, `messages/en.json`, and all 11 others

New namespaces to add at the end of each file (before closing `}`):

- `brawlers`: loading, error, searchPlaceholder, noResults, filterAll, sortGemValue, sortTrophies, sortPowerLevel, sortNameAZ, sortRank, valueLabel, bestTrophies
- `stats`: loading, error, gemScore, trophyRoad, highestLabel, gemBreakdown, columnConcept, columnCount, columnGems, details, soloWins, duoWins, threeVsThreeWins, timePlayedTooltip
- `notFound`: subtitle, description, backHome
- `errorPage`: title, description, retry, backHome

New keys in existing namespaces:
- `battles`: loading, error, resultVictory, resultDefeat, resultDraw
- `share`: loading, error, flexTitle, flexSubtitle
- `profile`: loadError

- [ ] **Step 1: Update `messages/es.json`** — add all new keys (Spanish)
- [ ] **Step 2: Update `messages/en.json`** — add all new keys (English)
- [ ] **Step 3: Update `messages/fr.json`** through `messages/zh.json`** — add all new keys
- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add brawlers, stats, notFound, errorPage namespaces to all 13 locales"
```

---

## Task 2: Fix `brawlers/page.tsx`

**Files:** `src/app/[locale]/profile/[tag]/brawlers/page.tsx`

- [ ] **Step 1: Change `useTranslations` from `'profile'` to `'brawlers'`** (use separate namespace)
- [ ] **Step 2: Replace `SORT_OPTIONS` labels** with `t()` calls
- [ ] **Step 3: Replace loading/error states** with `t('loading')` / `t('error')`
- [ ] **Step 4: Replace `placeholder`, `"All"`, `"No brawlers found"`, `"Value"`, `"Best:"` ** with `t()` calls
- [ ] **Step 5: Commit**

---

## Task 3: Fix `stats/page.tsx`

**Files:** `src/app/[locale]/profile/[tag]/stats/page.tsx`

- [ ] **Step 1: Add `useTranslations('stats')`**
- [ ] **Step 2: Replace all Spanish hardcoded text**: "DETALLES", "Concepto", "Cantidad", "Gemas", "TOTAL GEMAS REALES"
- [ ] **Step 3: Replace English hardcoded text**: "GEM SCORE", "TROPHY ROAD", "Highest:", "3v3 Wins", "Solo Wins", "Duo Wins", "Time Played", "GEM BREAKDOWN"
- [ ] **Step 4: Replace Spanish tooltip on time played card**
- [ ] **Step 5: Commit**

---

## Task 4: Fix `share/page.tsx`

**Files:** `src/app/[locale]/profile/[tag]/share/page.tsx`

- [ ] **Step 1: Add `useTranslations('share')` keys for loading/error**
- [ ] **Step 2: Replace "FLEX YOUR SCORE" + subtitle** with `t('flexTitle')` / `t('flexSubtitle')`
- [ ] **Step 3: Replace mini-stat labels** ("🏆 Trophies" → `tProfile('trophies')`, etc.)
- [ ] **Step 4: Commit**

---

## Task 5: Fix `battles/page.tsx` and `profile/[tag]/page.tsx`

- [ ] **Step 1: `battles/page.tsx`** — replace loading/error strings, translate result labels (victory/defeat/draw)
- [ ] **Step 2: `profile/[tag]/page.tsx`** — replace hardcoded Spanish error message with `t('loadError')`
- [ ] **Step 3: Commit**

---

## Task 6: Fix Sidebar and Header

- [ ] **Step 1: `Sidebar.tsx`** — remove "Auth. OS" card, replace with BrawlValue branding footer (brand name + tagline)
- [ ] **Step 2: `Header.tsx`** — add `useTranslations('nav')`, replace `"RANKING"` with `t('leaderboard')`
- [ ] **Step 3: Commit**

---

## Task 7: Add `not-found.tsx` and `error.tsx`

Per Next.js 16 docs:
- `not-found.tsx` is a server component, no props. Use `getTranslations()` from next-intl server API.
- `error.tsx` MUST be `'use client'`. Props: `error: Error & { digest?: string }` and `unstable_retry: () => void`.

- [ ] **Step 1: Create `src/app/[locale]/not-found.tsx`**
- [ ] **Step 2: Create `src/app/[locale]/error.tsx`**
- [ ] **Step 3: Commit**

---

## Task 8: Fix `manifest.json`

- [ ] **Step 1: Update `start_url` to `"/"` and description to English**
- [ ] **Step 2: Commit**

---

## Task 9: Redesign `BreakdownGrid.tsx` for more air

Current: `lg:grid-cols-7` crams 7 tiny cards in one line.

New design:
- Gem cards: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` with larger padding
- Section header label above gem cards
- Stats row: `grid-cols-2 md:grid-cols-3 lg:grid-cols-5` with more padding
- Remove hardcoded "skins + pins" text → use `t('cosmetics')`

- [ ] **Step 1: Redesign BreakdownGrid component**
- [ ] **Step 2: Commit + push**
