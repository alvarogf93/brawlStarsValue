# BrawlVision — Integral Improvement & New Analytics Spec

**Date:** 2026-04-07  
**Scope:** Page improvements, new analytics metrics, SEO, and quality-of-life upgrades  
**Goal:** Make every page robust, add high-value analytics, and make the app discoverable

---

## 1. New Analytics Metrics

### 1.1 Metrics Derived from Existing Battle Data (No Schema Changes)

All 53+ battles already contain sufficient data. New compute functions in `src/lib/analytics/compute.ts`.

#### A. **Clutch Factor** (Star Player correlation)
- **What:** Win rate when you ARE star player vs when you're NOT
- **Formula:** `clutchWR = winsAsStarPlayer / totalAsStarPlayer` vs `normalWR`
- **Value:** Shows if you carry games or benefit from team
- **Fields:** `is_star_player`, `result`
- **Minimum data:** 10 battles (5+ as star player)

#### B. **Opponent Strength Index**
- **What:** Average opponent trophy level in your battles
- **Formula:** `avgOpponentTrophies = mean(opponents[].brawler.trophies)` per battle
- **Value:** Context for win rate — 60% WR vs strong opponents > 60% vs weak
- **Fields:** `opponents[].brawler.trophies`, `result`
- **Display:** Win rate segmented by opponent strength (low/medium/high trophies)

#### C. **Brawler Comfort Score**
- **What:** Combined metric of play frequency + win rate + consistency
- **Formula:** `comfort = (wilsonScore * 0.6) + (gamesPlayed / maxGames * 0.3) + (1 - stdDev(results) * 0.1)`
- **Value:** Single number "how good are you with this brawler" that's not just WR
- **Fields:** `my_brawler.id`, `result`
- **Display:** Top 5 comfort brawlers badge on profile

#### D. **Power Level Impact**
- **What:** Does your brawler's power level predict wins?
- **Formula:** Group battles by `my_brawler.power`, calculate WR per level
- **Value:** Shows if player is under-leveled for their matchmaking bracket
- **Fields:** `my_brawler.power`, `result`
- **Insight:** "Your WR at power 9 is 45% but at power 11 is 62% — upgrade matters"

#### E. **Session Optimization**
- **What:** Optimal session length for trophy climbing
- **Formula:** For each session, compute `trophies_per_game = trophy_change / games`
- **Value:** "Your best sessions are 5-8 games. After 12 games, your WR drops 15%"
- **Fields:** Sessions (from existing computation), `trophy_change`
- **Display:** Chart of efficiency by session length

#### F. **Warm-Up Index**
- **What:** Performance in first N games vs rest of session
- **Formula:** WR in games 1-2 of session vs games 3+
- **Value:** "You need 2 warm-up games before peak performance"
- **Fields:** Session battles (positional), `result`

#### G. **Carry Rate** (Team Dependency)
- **What:** How often you win when your team is weaker (lower trophies)
- **Formula:** `carryWR = wins / total` WHERE `avg(teammates.trophies) < avg(opponents.trophies)`
- **Value:** Distinguishes "good player" from "good team"
- **Fields:** `teammates[].brawler.trophies`, `opponents[].brawler.trophies`, `result`

#### H. **Gadget/Star Power Win Rate Impact**
- **What:** WR with specific gadgets/star powers equipped vs without
- **Formula:** Group by `my_brawler.gadgets.length > 0` and `starPowers.length > 0`
- **Value:** Shows which upgrades actually affect outcomes
- **Fields:** `my_brawler.gadgets`, `my_brawler.starPowers`, `result`

#### I. **Recovery Speed**
- **What:** After a losing streak (3+), how many games to break even on trophies?
- **Formula:** Track trophy balance after tilt episode, count games until cumulative >= 0
- **Value:** "After tilting, you typically need 5 games to recover"
- **Fields:** Tilt episodes (existing), `trophy_change`

#### J. **Weekly Pattern**
- **What:** Win rate by day of week
- **Formula:** Group battles by dayOfWeek(battle_time), calculate WR per day
- **Value:** "You play best on Saturdays (65% WR) and worst on Mondays (42%)"
- **Fields:** `battle_time`, `result`

### 1.2 Improvements to Existing Metrics

#### Matchup Matrix
- **Problem:** MIN_GAMES = 1 shows unreliable single-battle data
- **Fix:** Show entries with <3 games grayed out with "Low confidence" badge
- **Add:** Time decay — battles older than 30 days weighted at 50%

#### Tilt Analysis
- **Problem:** 3-loss threshold and 15% stop recommendation are arbitrary
- **Fix:** Calculate player-specific thresholds based on their data: if their normal WR variance is high, tilt threshold should be higher
- **Add:** "Optimal stop point" — the exact losing streak length where WR drops statistically significantly (player-specific, not hardcoded 3)

#### Brawler Mastery
- **Problem:** Shows all brawlers with 1+ games (noise)
- **Fix:** Only show brawlers with 5+ games. Add confidence band around cumulative WR line.

#### Synergy Analysis
- **Problem:** Can't distinguish synergy from both players being good
- **Fix:** Show "uplift" — how much WR improves WITH this teammate vs your baseline

---

## 2. Page Improvements

### 2.1 Overview Page (`/profile/[tag]`)

| Issue | Fix |
|-------|-----|
| Confetti fires on every navigation | Only fire on first visit per session (sessionStorage flag) |
| No retry on error | Add "Retry" button in error state |
| No loading skeleton | Replace pulse animation with skeleton matching final layout |
| Missing cosmetics explanation | Add tooltip explaining grand total = verified + user-classified |

### 2.2 Stats Page (`/profile/[tag]/stats`)

| Issue | Fix |
|-------|-----|
| Table columns compressed on mobile | Horizontal scroll with sticky first column (brawler name) |
| Gem costs hardcoded without version info | Add "Last updated: Season X" note |
| No export | Add "Download CSV" button for gem breakdown |

### 2.3 Brawlers Page (`/profile/[tag]/brawlers`)

| Issue | Fix |
|-------|-----|
| No lazy loading for images | Add `loading="lazy"` + placeholder gradient |
| Sort/filter not persisted | Use URL search params (`?sort=gems&rarity=legendary`) |
| No image fallback | Show brawler name initial in colored circle if CDN fails |

### 2.4 Battles Page (`/profile/[tag]/battles`)

| Issue | Fix |
|-------|-----|
| No battle detail view | Click battle row → expandable panel showing full team compositions |
| Battle list not virtualized | Use virtualization for 100+ battles |
| Mode names not localized | Use i18n keys for mode labels |
| No retry button | Add retry on error |

### 2.5 Club Page (`/profile/[tag]/club`)

| Issue | Fix |
|-------|-----|
| Multiple parallel loads cause jank | Sequential loading with skeleton: club info → members → enrichment |
| Leaderboard columns collapse on mobile | 2-column card layout on mobile instead of table |
| Members with failed enrichment stuck loading | Show fallback data (name + trophies only) after 10s timeout |

### 2.6 Analytics Page (`/profile/[tag]/analytics`)

| Issue | Fix |
|-------|-----|
| Tab state not persisted | Use URL hash (`#overview`, `#matchups`) |
| No date range picker | Add "Last 7 days / 30 days / All time" filter |
| Events API not cached | Cache in state, refetch only on tab switch to "Tools" |
| No error handling per tab | Each tab gets its own error boundary with retry |

### 2.7 Compare Page (`/profile/[tag]/compare`)

| Issue | Fix |
|-------|-----|
| No caching of opponent data | Cache last 3 compared players in sessionStorage |
| Self-comparison check only on submit | Check as user types and disable submit |
| Trophy chart lines hard to distinguish | Use patterns (solid vs dashed) + thicker lines |

### 2.8 Share Page (`/profile/[tag]/share`)

| Issue | Fix |
|-------|-----|
| Download fails silently | Show toast on success/failure |
| Card is static | Allow choosing "featured brawler" to include in card |

### 2.9 Leaderboard Page (`/leaderboard`)

| Issue | Fix |
|-------|-----|
| Only Spain + Global filter | Add top 10 countries with Brawl Stars playerbase |
| No player links | Click player → navigate to their profile |
| No search | Add search by player name in loaded results |
| No pagination | Virtual scroll or "Load more" for 200 entries |

### 2.10 Landing Page

| Issue | Fix |
|-------|-----|
| InputForm lacks validation feedback | Show inline error with "Player not found" if API returns 404 |
| Heavy animations on load | Defer BrawlerParade and confetti to after first paint |

---

## 3. SEO Improvements

### 3.1 Dynamic Sitemap with Player Profiles
```
// sitemap.ts — add popular profiles
const { data: topProfiles } = await supabase
  .from('profiles')
  .select('player_tag')
  .order('last_sync', { ascending: false })
  .limit(500)

for (const profile of topProfiles) {
  for (const locale of LOCALES) {
    entries.push({
      url: `${BASE_URL}/${locale}/profile/${encodeURIComponent(profile.player_tag)}`,
      changeFrequency: 'daily',
      priority: 0.7,
    })
  }
}
```

### 3.2 SSR Metadata for Profile Pages
The profile layout already generates metadata server-side — but it's generic ("Player #TAG Stats"). Improve:
- Fetch player name + trophy count server-side for metadata
- Title: "PLAYER_NAME (#TAG) — 45,000 Trophies | BrawlVision"
- Description: "Combat analytics for PLAYER_NAME in Brawl Stars. 80 brawlers, 12,500 gems invested."

### 3.3 Google Search Console
- Register `brawlvision.com` in Search Console
- Submit sitemap URL
- Monitor indexing status

### 3.4 Content Pages (Future — Low Priority)
- `/guides` — Brawler tier lists, mode guides
- `/blog` — Meta updates, balance change analysis
- These attract organic search traffic from informational queries

---

## 4. Cross-Cutting Quality Improvements

### 4.1 Error Handling
- **Global error boundary** in root layout → fallback UI with "Reload" button
- **Per-page error boundaries** for profile sub-pages
- **API retry logic**: auto-retry once on 5xx, show retry button on persistent failure
- **Offline detection**: show banner when network is lost

### 4.2 Loading States
- Replace all pulse animations with **skeleton loaders** matching final layout
- Add **stale-while-revalidate** pattern: show cached data immediately, refetch in background

### 4.3 Mobile UX
- **Touch targets**: minimum 44px for all interactive elements
- **Bottom sheets**: replace dropdowns with bottom sheets on mobile
- **Horizontal scroll indicators**: show scroll hint arrow on tables

### 4.4 Accessibility
- **ARIA labels** on all icon-only buttons
- **Color + icon** for win/loss indicators (not color-only)
- **Keyboard navigation** for dropdowns and modals
- **Focus management** on modal open/close

---

## 5. Implementation Phases

### Phase 1: New Analytics Engine (3-4 days)
1. Implement 10 new metrics in `analytics/compute.ts`
2. Add types in `analytics/types.ts`
3. Unit test each new metric
4. Wire into `/api/analytics` response

### Phase 2: Analytics UI (2-3 days)
5. New components for new metrics (ComfortScore, SessionOptimizer, WeeklyPattern, etc.)
6. Integrate into analytics page tabs
7. Add date range filter

### Phase 3: Page Fixes (3-4 days)
8. Overview: skeleton, retry, confetti fix
9. Brawlers: lazy images, persisted filters
10. Battles: detail view, virtualization
11. Club: sequential loading, mobile layout
12. Compare: caching, chart improvements
13. Leaderboard: country selector, player links

### Phase 4: SEO (1-2 days)
14. Dynamic sitemap with player profiles
15. SSR metadata enrichment for profiles
16. Google Search Console setup

### Phase 5: Cross-Cutting Quality (2-3 days)
17. Error boundaries (global + per-page)
18. Skeleton loaders across all pages
19. Mobile UX fixes (touch targets, bottom sheets)
20. Accessibility audit and fixes

---

## 6. Success Criteria

- [ ] 10 new analytics metrics implemented and tested
- [ ] Existing metrics improved (confidence badges, time decay, player-specific thresholds)
- [ ] All 12 pages have proper error states with retry
- [ ] All pages have skeleton loaders (not pulse animations)
- [ ] Sitemap includes top 500 player profiles
- [ ] Profile page metadata includes real player data
- [ ] Google Search Console active and sitemap submitted
- [ ] All interactive elements have 44px+ touch targets
- [ ] All icon-only buttons have ARIA labels
- [ ] Date range filter on analytics page
- [ ] Leaderboard supports 10+ countries
