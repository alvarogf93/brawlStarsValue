# Phase B Monetization v2 — Implementation Plan

> **⛔ DEPRECATED (2026-04-09):** This plan has been superseded by **v3** at `docs/superpowers/plans/2026-04-09-monetization-phase-b-v3.md`. Key change: blur approach eliminated, analytics page split into `/analytics` (premium-only) + `/subscribe` (sales page). Do NOT implement this plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ~~Complete the three monetization features (freemium blur, trial, referrals) that are partially implemented, fixing all UX gaps identified during testing.~~

**Architecture:** Build on existing components (PremiumGate, TrialBanner, ReferralCard, RefCapture) that are deployed but not fully integrated. The analytics page needs a structural redesign to support the freemium view.

**Tech Stack:** React, Next.js 16, Supabase RPC, next-intl, Tailwind CSS, Vitest

**Spec reference:** `docs/superpowers/specs/2026-04-08-monetization-phase-b-design.md`

---

## Pre-Implementation Analysis

### What's Already Deployed & Working
- `isPremium()` checks trial_ends_at ✅
- `isOnTrial()` and `isTrialExpired()` helpers ✅
- `PremiumGate` component (blur + overlay) ✅ — created but NOT integrated in analytics
- `TrialBanner` component (countdown + subscribe button) ✅
- `ReferralCard` component (code display + copy) ✅
- `RefCapture` component (captures ?ref= from URL) ✅
- `TagRequiredModal` has referral code input field ✅
- DB migration 006: trial_ends_at, referral_code, referred_by, referral_count ✅
- DB trigger: auto-sets trial + generates referral code on new profile ✅
- DB RPC: apply_referral() atomic function ✅
- `/api/maps` endpoint for consistent map images ✅
- `useMapImages()` hook ✅

### What Failed During First Integration (Root Causes)
1. **PremiumGate on tabs crashed**: analytics data is null for non-premium users (hook doesn't fetch). Tabs rendered with PremiumGate accessed `analytics.overview` → TypeError.
2. **TrialBanner subscribe button went nowhere**: `#upgrade-section` div only existed in non-premium view, but trial users saw premium view.
3. **Structural issue**: the analytics page has a binary split (premium view vs non-premium view) that makes hybrid states (trial, freemium blur) impossible.

### The Real Problem to Solve
The analytics page needs THREE views, not two:

| View | When | What shows |
|------|------|-----------|
| **A) Subscription** | Not premium, no trial, not logged in OR logged in free | Free preview + UpgradeCard + login prompt |
| **B) Freemium** | Logged in, free, no trial (future: after blur implementation) | Free preview + tabs with blur + UpgradeCard |
| **C) Premium** | Premium (subscription OR trial) | Full analytics + TrialBanner (if trial) + UpgradeCard (if trial) |

Currently only A and C exist. B is the missing piece. But B requires analytics data to blur — and the API returns 403 for non-premium users.

### Solution: Compute Limited Analytics Client-Side

Instead of calling `/api/analytics` (which requires premium), compute analytics from the PUBLIC battlelog (25 battles) using the SAME `computeAdvancedAnalytics()` function. The output is identical in structure — just with less data.

This means:
- The `useBattlelog` hook already fetches 25 public battles
- We pass those battles to `computeAdvancedAnalytics()` client-side
- The result has the exact same type as the premium analytics
- Components render normally but with less data → blur makes it tantalizing

No API changes needed. No security risk. The data is already public.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/hooks/useFreemiumAnalytics.ts` | Compute analytics from 25 public battles (client-side) |
| Create | `src/lib/analytics/detect-segment.ts` | Detect player segment for personalized hook metric |
| Create | `src/components/premium/PersonalizedHook.tsx` | Render personalized visible metric by player segment |
| Create | `src/__tests__/unit/lib/analytics-detect-segment.test.ts` | Tests for segment detection |
| Create | `src/__tests__/unit/hooks/useFreemiumAnalytics.test.ts` | Tests for limited analytics |
| Create | `supabase/migrations/007_protect_trial_fields.sql` | Security: prevent client-side manipulation of trial/referral/tier columns |
| Modify | `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Restructure: 3 views (subscription/freemium/premium) |
| Modify | `src/components/auth/AuthProvider.tsx` | Call apply_referral RPC after linkTag with referral code |
| Modify | `src/components/auth/TagRequiredModal.tsx` | Write edited referral code back to localStorage before linkTag |
| Modify | `src/components/draft/DraftSimulator.tsx` | Add 3-use counter with localStorage tracking |
| Modify | `src/components/premium/TrialBanner.tsx` | Show battle count in post-trial message |
| Modify | `src/components/layout/Header.tsx` | Add referral code to avatar dropdown for premium users |

---

### Task 1: Detect Player Segment (TDD)

**Files:**
- Create: `src/lib/analytics/detect-segment.ts`
- Create: `src/__tests__/unit/lib/analytics-detect-segment.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/__tests__/unit/lib/analytics-detect-segment.test.ts
import { describe, it, expect } from 'vitest'
import { detectSegment, type PlayerSegment } from '@/lib/analytics/detect-segment'

describe('detectSegment', () => {
  it('returns "tilt" for 3+ consecutive losses', () => {
    const battles = [
      { result: 'defeat' }, { result: 'defeat' }, { result: 'defeat' },
      { result: 'victory' }, { result: 'victory' },
    ]
    expect(detectSegment(battles as any, 20000)).toBe('tilt')
  })

  it('returns "main" when 60%+ games with same brawler', () => {
    const battles = Array.from({ length: 10 }, (_, i) => ({
      result: 'victory',
      my_brawler: { id: i < 7 ? 16000000 : 16000001, name: i < 7 ? 'SHELLY' : 'COLT' },
    }))
    expect(detectSegment(battles as any, 20000)).toBe('main')
  })

  it('returns "competitive" for >25K trophies', () => {
    const battles = [{ result: 'victory', my_brawler: { id: 1, name: 'A' } }]
    expect(detectSegment(battles as any, 30000)).toBe('competitive')
  })

  it('returns "explorer" for 3+ different modes', () => {
    const battles = [
      { result: 'victory', mode: 'gemGrab' },
      { result: 'victory', mode: 'brawlBall' },
      { result: 'victory', mode: 'knockout' },
      { result: 'victory', mode: 'heist' },
    ]
    expect(detectSegment(battles as any, 15000)).toBe('explorer')
  })

  it('returns "streak" for 3+ consecutive wins', () => {
    const battles = [
      { result: 'victory' }, { result: 'victory' }, { result: 'victory' },
      { result: 'defeat' },
    ]
    expect(detectSegment(battles as any, 15000)).toBe('streak')
  })

  it('returns "tilt" as default when no clear signal', () => {
    const battles = [{ result: 'victory' }, { result: 'defeat' }]
    expect(detectSegment(battles as any, 15000)).toBe('tilt')
  })
})
```

- [ ] **Step 2: Run tests — should FAIL**

```bash
npx vitest run src/__tests__/unit/lib/analytics-detect-segment.test.ts
```

- [ ] **Step 3: Implement detect-segment**

```typescript
// src/lib/analytics/detect-segment.ts
import type { Battle } from '@/lib/supabase/types'

export type PlayerSegment = 'tilt' | 'main' | 'competitive' | 'explorer' | 'streak'

/**
 * Detect player segment from public battlelog (25 battles) + trophies.
 * Used to select the personalized hook metric for non-premium users.
 * Priority: tilt > main > competitive > explorer > streak > default(tilt)
 */
export function detectSegment(battles: Pick<Battle, 'result' | 'my_brawler' | 'mode'>[], trophies: number): PlayerSegment {
  if (battles.length === 0) return 'tilt'

  // Check for tilt (3+ consecutive recent losses)
  let consecutiveLosses = 0
  for (const b of battles) {
    if (b.result === 'defeat') { consecutiveLosses++; if (consecutiveLosses >= 3) return 'tilt' }
    else break
  }

  // Check for one-trick/main (60%+ games with same brawler)
  const brawlerCounts = new Map<number, number>()
  for (const b of battles) {
    const id = (b.my_brawler as { id: number })?.id ?? 0
    brawlerCounts.set(id, (brawlerCounts.get(id) ?? 0) + 1)
  }
  const maxBrawlerPct = Math.max(...brawlerCounts.values()) / battles.length
  if (maxBrawlerPct >= 0.6) return 'main'

  // Check for competitive (high trophies)
  if (trophies > 25000) return 'competitive'

  // Check for explorer (3+ different modes)
  const uniqueModes = new Set(battles.map(b => b.mode).filter(Boolean))
  if (uniqueModes.size >= 3) return 'explorer'

  // Check for win streak (3+ consecutive wins)
  let consecutiveWins = 0
  for (const b of battles) {
    if (b.result === 'victory') { consecutiveWins++; if (consecutiveWins >= 3) return 'streak' }
    else break
  }

  return 'tilt' // Default — universal hook
}
```

- [ ] **Step 4: Run tests — should PASS**
- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/detect-segment.ts src/__tests__/unit/lib/analytics-detect-segment.test.ts
git commit -m "feat: detect player segment for personalized freemium hook"
```

---

### Task 2: Compute Freemium Analytics from Public Battlelog

**Files:**
- Create: `src/hooks/useFreemiumAnalytics.ts`

- [ ] **Step 1: Create the hook**

This hook takes the raw battlelog entries (25 public battles), parses them into Battle format, and runs `computeAdvancedAnalytics()` to produce the same data structure as the premium analytics.

```typescript
// src/hooks/useFreemiumAnalytics.ts
'use client'

import { useMemo } from 'react'
import { computeAdvancedAnalytics } from '@/lib/analytics/compute'
import { parseBattlelog } from '@/lib/battle-parser'
import type { AdvancedAnalytics } from '@/lib/analytics/types'
import type { Battle } from '@/lib/supabase/types'
import type { BattlelogEntry } from '@/lib/api'

/**
 * Compute analytics from public battlelog entries (25 battles).
 * Same output as premium analytics but with less data.
 * Used for freemium blur — real data behind blur, limited sample.
 *
 * NOTE: parseBattlelog() returns BattleInsert[] (no id/created_at).
 * computeAdvancedAnalytics() expects Battle[] (has id/created_at).
 * Verified: computeAdvancedAnalytics never reads id or created_at,
 * so adding dummy values is safe.
 */
export function useFreemiumAnalytics(
  entries: BattlelogEntry[] | null,
  playerTag: string,
): AdvancedAnalytics | null {
  return useMemo(() => {
    if (!entries || entries.length === 0) return null
    try {
      const parsed = parseBattlelog(entries, playerTag)
      if (parsed.length === 0) return null
      // Adapter: BattleInsert → Battle (add dummy id + created_at)
      // Safe because computeAdvancedAnalytics never reads these fields
      const battles: Battle[] = parsed.map((b, i) => ({
        ...b,
        id: i,
        created_at: new Date().toISOString(),
      }))
      return computeAdvancedAnalytics(battles)
    } catch {
      return null
    }
  }, [entries, playerTag])
}
```

- [ ] **Step 2: Verify build compiles**

```bash
npx next build 2>&1 | grep -iE "(error|fail)" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useFreemiumAnalytics.ts
git commit -m "feat: useFreemiumAnalytics — compute analytics from 25 public battles"
```

---

### Task 3: Restructure Analytics Page (The Critical Task)

**Files:**
- Modify: `src/app/[locale]/profile/[tag]/analytics/page.tsx`

This is the most complex task. The page needs to handle three views cleanly.

- [ ] **Step 1: Add imports and freemium state**

Add at the top:
```typescript
import { useFreemiumAnalytics } from '@/hooks/useFreemiumAnalytics'
import { detectSegment } from '@/lib/analytics/detect-segment'
import { isOnTrial } from '@/lib/premium'
```

After the existing `useBattlelog` hook, add:
```typescript
// Freemium: compute limited analytics from public battlelog for blur content
// useBattlelog already returns raw entries in freeStats.battles (BattlelogEntry[])
const freemiumAnalytics = useFreemiumAnalytics(
  freeStats?.battles ?? null,
  tag
)

// detectSegment needs BattleInsert format (flat result/mode/my_brawler),
// not BattlelogEntry (nested battle.result). useFreemiumAnalytics already
// runs parseBattlelog internally, so we parse here too for detectSegment.
const playerSegment = useMemo(() => {
  if (!freeStats?.battles || freeStats.battles.length === 0) return 'tilt' as const
  const trophies = data?.player?.trophies ?? 0
  const parsed = parseBattlelog(freeStats.battles, tag)
  return detectSegment(parsed, trophies)
}, [freeStats, data, tag])
```

Note: `useBattlelog` already returns `data.battles: BattlelogEntry[]` — no modification needed. The existing destructure `{ data: freeStats }` gives access via `freeStats.battles`.

- [ ] **Step 2: Implement three-view structure**

Replace the current binary (premium/non-premium) with:

```
View A (Subscription): !hasPremium && (tagHasPremium → sign in | default → UpgradeCard)
  → KEEP the current early-return logic (it works)

View B (Freemium): !hasPremium && isLoggedIn && freemiumAnalytics
  → NEW: tabs with PremiumGate blur using freemiumAnalytics data
  → Personalized hook metric visible in overview
  → UpgradeCard + ReferralCard at bottom

View C (Premium): hasPremium
  → KEEP current tab view
  → Add TrialBanner if isOnTrial
  → Add UpgradeCard at bottom if isOnTrial
```

The key difference from the failed first attempt: View B uses `freemiumAnalytics` (computed client-side from public data), NOT `analytics` (which is null because the API returned 403). This prevents the null reference crashes.

- [ ] **Step 3: Implement View B (freemium) in the early return**

After the existing subscription view early return (line ~213), BEFORE the loading/error checks, insert this new early return:

```typescript
// View B: Freemium — logged in free user with computed analytics for blur
if (!authLoading && !hasPremium && isLoggedIn && freemiumAnalytics) {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      <TrialBanner />

      {/* Header — same style as subscription view */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#121A2F] border-4 border-[#FFC91B] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
            <FlaskConical className="w-8 h-8 text-[#FFC91B]" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">{t('title')}</h1>
            <p className="font-['Inter'] font-semibold text-[#FFC91B]">{t('premiumOnly')}</p>
          </div>
        </div>
      </div>

      {/* Personalized hook metric — VISIBLE, no blur */}
      <PersonalizedHook segment={playerSegment} analytics={freemiumAnalytics} />

      {/* Tab navigation — identical to premium view */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TAB_IDS.map(id => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-['Lilita_One'] text-sm whitespace-nowrap transition-all border-2 ${
              activeTab === id
                ? 'bg-[#FFC91B]/20 text-[#FFC91B] border-[#FFC91B]/40 shadow-[0_0_12px_rgba(255,201,27,0.15)]'
                : 'bg-[#0F172A] text-slate-400 border-[#1E293B] hover:bg-[#1E293B] hover:text-white'
            }`}
          >
            {TAB_IMAGE_ICONS[id] ? (
              <img src={TAB_IMAGE_ICONS[id]} alt="" className="w-5 h-5" width={20} height={20} />
            ) : (
              <span>{TAB_ICONS[id]}</span>
            )}
            <span>{ta(TAB_KEYS[id])}</span>
          </button>
        ))}
      </div>

      {/* Tab content — overview visible, all others behind PremiumGate blur */}
      {/* PlayNowDashboard OMITTED: needs event API + full analytics, not viable for 25 battles */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <OverviewStats overview={freemiumAnalytics.overview} />
          <PremiumGate blur>
            <TiltDetector tilt={freemiumAnalytics.tilt} sessions={freemiumAnalytics.sessions} />
          </PremiumGate>
        </div>
      )}

      {activeTab === 'performance' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <BrawlerMapHeatmap data={freemiumAnalytics.brawlerMapMatrix} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <TimeOfDayChart data={freemiumAnalytics.byHour} />
              <WeeklyPatternChart data={freemiumAnalytics.weeklyPattern} />
            </div>
            <PowerLevelChart data={freemiumAnalytics.powerLevelImpact} />
            <GadgetImpactCard data={freemiumAnalytics.gadgetImpact} />
            <BrawlerComfortList data={freemiumAnalytics.brawlerComfort} />
          </div>
        </PremiumGate>
      )}

      {activeTab === 'matchups' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <MatchupMatrix data={freemiumAnalytics.matchups} />
            <OpponentStrengthCard data={freemiumAnalytics.opponentStrength} />
          </div>
        </PremiumGate>
      )}

      {activeTab === 'team' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <TeamSynergyView
              brawlerSynergy={freemiumAnalytics.brawlerSynergy}
              teammateSynergy={freemiumAnalytics.teammateSynergy}
            />
            <CarryCard data={freemiumAnalytics.carry} />
          </div>
        </PremiumGate>
      )}

      {activeTab === 'trends' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <TrendsChart dailyTrend={freemiumAnalytics.dailyTrend} />
            <MasteryChart data={freemiumAnalytics.brawlerMastery} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SessionEfficiencyCard data={freemiumAnalytics.sessionEfficiency} />
              <RecoveryCard data={freemiumAnalytics.recovery} />
            </div>
          </div>
        </PremiumGate>
      )}

      {activeTab === 'draft' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <DraftSimulator />
          </div>
        </PremiumGate>
      )}

      <div id="upgrade-section">
        <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
        <ReferralCard />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify all three views work**

Test each state:
1. Anonymous/free without login → View A (subscription packages)
2. Logged in, free, no trial → View B (freemium blur) — NEW
3. Premium or trial → View C (full analytics)

- [ ] **Step 5: Create PersonalizedHook component**

Create `src/components/premium/PersonalizedHook.tsx`:

```typescript
'use client'

import { useTranslations } from 'next-intl'
import type { PlayerSegment } from '@/lib/analytics/detect-segment'
import type { AdvancedAnalytics } from '@/lib/analytics/types'
import { Crown } from 'lucide-react'

const MIN_BATTLES = 3

interface PersonalizedHookProps {
  segment: PlayerSegment
  analytics: AdvancedAnalytics
}

/** Try each segment in priority order until one has enough data */
function resolveSegment(
  segment: PlayerSegment,
  analytics: AdvancedAnalytics,
): { segment: PlayerSegment; valid: boolean } {
  const order: PlayerSegment[] = [segment, 'tilt', 'main', 'competitive', 'explorer', 'streak']
  const seen = new Set<PlayerSegment>()
  for (const s of order) {
    if (seen.has(s)) continue
    seen.add(s)
    if (hasEnoughData(s, analytics)) return { segment: s, valid: true }
  }
  return { segment: 'tilt', valid: false }
}

function hasEnoughData(seg: PlayerSegment, a: AdvancedAnalytics): boolean {
  switch (seg) {
    case 'tilt': return a.tilt.tiltEpisodes >= 1       // TiltAnalysis.tiltEpisodes
    case 'main': return (a.byBrawler[0]?.total ?? 0) >= MIN_BATTLES  // BrawlerPerformance.total
    case 'competitive': return a.matchups.length >= MIN_BATTLES       // MatchupEntry[]
    case 'explorer': return a.byMap.length >= MIN_BATTLES             // MapPerformance[]
    case 'streak': return a.clutch.starGames >= 1                     // ClutchAnalysis.starGames
  }
}

export function PersonalizedHook({ segment, analytics }: PersonalizedHookProps) {
  const t = useTranslations('premium')
  const { segment: resolved, valid } = resolveSegment(segment, analytics)

  if (!valid) {
    return (
      <div className="brawl-card-dark p-5 border-[#090E17] text-center">
        <Crown className="w-8 h-8 text-[#FFC91B] mx-auto mb-2" />
        <p className="font-['Lilita_One'] text-lg text-white">Descubre tus estadísticas avanzadas</p>
        <p className="text-sm text-slate-400 mt-1">{t('trialBannerSubscribe')}</p>
      </div>
    )
  }

  const hookMessages: Record<PlayerSegment, string> = {
    tilt: t('hookTilt'),
    main: t('hookMastery', { name: analytics.byBrawler[0]?.brawlerName ?? '?' }),
    competitive: (() => {
      const worst = [...analytics.matchups].sort((a, b) => a.winRate - b.winRate)[0]
      return t('hookMatchup', { wr: String(Math.round(100 - worst.winRate)), name: worst.opponentBrawlerName })
    })(),
    explorer: (() => {
      const best = [...analytics.byMap].sort((a, b) => b.winRate - a.winRate)[0]
      return t('hookMap', { map: best.map, wr: String(Math.round(best.winRate)) })
    })(),
    streak: t('hookClutch', { wr: String(Math.round(analytics.clutch.wrAsStar ?? 0)) }),
  }

  return (
    <div className="brawl-card p-5 border-2 border-[#FFC91B]/30 bg-gradient-to-r from-[#FFC91B]/5 to-transparent">
      <p className="font-['Lilita_One'] text-lg text-[#FFC91B]">{hookMessages[resolved]}</p>
      <p className="text-sm text-slate-400 mt-1">{t('blurUnlock')}</p>
    </div>
  )
}
```

- [ ] **Step 6: Add trial celebration modal in analytics page**

In the analytics page, add celebration logic inside View C (premium view), at the top of the return:

```typescript
// Trial celebration — show confetti once on first premium visit after trial activation
const [showCelebration, setShowCelebration] = useState(false)
useEffect(() => {
  if (!isOnTrial(profile as Profile)) return
  const key = 'brawlvalue:trial-celebrated'
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    setShowCelebration(true)
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#FFC91B', '#4EC0FA', '#FF5733', '#28A745'] })
    })
  } catch { /* ignore */ }
}, [profile])
```

And render the celebration modal (dismissible):

```typescript
{showCelebration && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowCelebration(false)}>
    <div className="brawl-card p-8 max-w-sm text-center space-y-4" onClick={e => e.stopPropagation()}>
      <p className="text-5xl">🎉</p>
      <h2 className="font-['Lilita_One'] text-2xl text-[#FFC91B]">{tp('trialWelcome')}</h2>
      <p className="text-slate-300">{tp('trialWelcomeBody')}</p>
      <button onClick={() => setShowCelebration(false)} className="brawl-button px-6 py-2">OK</button>
    </div>
  </div>
)}
```

Note: `tp` is `useTranslations('premium')` — add this import alongside existing `t` (analytics) and `ta` (advancedAnalytics).

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: three-view analytics page — subscription/freemium/premium"
```

---

### Task 4: Integrate Referral Logic in linkTag

**Files:**
- Modify: `src/components/auth/AuthProvider.tsx`
- Modify: `src/components/auth/TagRequiredModal.tsx`

- [ ] **Step 1: Fix TagRequiredModal — write edited referral code to localStorage**

In `TagRequiredModal.tsx`, the user can EDIT the referral code input field, but `handleSubmit()` only calls `linkTag(tag)` without syncing the edited value back to localStorage. Fix: write the current `referralCode` state to localStorage BEFORE calling linkTag.

```typescript
// In handleSubmit(), before calling linkTag():
if (referralCode.trim()) {
  try { localStorage.setItem('brawlvalue:ref', referralCode.trim().toUpperCase()) }
  catch { /* ignore */ }
} else {
  try { localStorage.removeItem('brawlvalue:ref') } catch { /* ignore */ }
}
const result = await linkTag(trimmed)
```

This ensures that if the user manually types a referral code (not from URL), or edits the auto-filled one, the correct value is in localStorage when linkTag reads it.

- [ ] **Step 2: After profile creation in linkTag, apply referral + handle code collision**

In `linkTag()` in AuthProvider.tsx, wrap the profile insert in collision-handling logic and add referral application:

```typescript
// Profile insert with referral code collision retry (spec requirement)
// The DB trigger auto-generates referral_code via md5(random()).
// If unique constraint fails (extremely rare), retry once.
let insertResult = await supabase.from('profiles').insert({
  id: user.id,
  player_tag: trimmed,
}).select().single()

if (insertResult.error?.code === '23505' && insertResult.error.message.includes('referral_code')) {
  // Collision on auto-generated referral code — retry once
  insertResult = await supabase.from('profiles').insert({
    id: user.id,
    player_tag: trimmed,
  }).select().single()
}

if (insertResult.error) return { ok: false, error: insertResult.error.message }

// Apply referral code (best-effort, non-blocking)
const refCode = (() => { try { return localStorage.getItem('brawlvalue:ref') } catch { return null } })()
if (refCode) {
  try {
    await supabase.rpc('apply_referral', {
      p_new_user_id: user.id,
      p_referral_code: refCode,
    })
    localStorage.removeItem('brawlvalue:ref')
  } catch { /* referral is best-effort */ }
}
```

- [ ] **Step 3: Add referrer notification toast (spec requirement)**

When someone uses a referral code, the referrer should see a toast next time they load the app. The `apply_referral` RPC updates the referrer's profile. We need a way to notify them.

Approach: After `apply_referral` succeeds, store the new user's tag in a Supabase `referral_notifications` table (or a simple column on profiles). On app load, check for pending notifications.

Simpler v1 approach — store in referrer's profile a `pending_referral_notification` text field (set by `apply_referral` RPC), and check it on AuthProvider load:

In `AuthProvider.tsx`, inside the session fetch (where profile is loaded):

```typescript
// Check for pending referral notification
useEffect(() => {
  if (!profile?.id) return
  const key = `brawlvalue:ref-notified-${profile.referral_count}`
  try {
    if (profile.referral_count > 0 && !localStorage.getItem(key)) {
      localStorage.setItem(key, '1')
      // Show toast — using a simple approach (can use a toast library later)
      const toast = document.createElement('div')
      toast.className = 'fixed top-4 right-4 z-50 bg-[#FFC91B] text-[#121A2F] px-4 py-3 rounded-xl font-bold shadow-lg animate-fade-in'
      toast.textContent = tp('referralSuccess')
      document.body.appendChild(toast)
      setTimeout(() => toast.remove(), 5000)
    }
  } catch { /* ignore */ }
}, [profile])
```

This approach uses `referral_count` + localStorage to detect new referrals without needing a new DB column. It fires when the count increases beyond what was previously acknowledged.

- [ ] **Step 4: Verify build + test manually**
- [ ] **Step 5: Commit**

```bash
git add src/components/auth/AuthProvider.tsx src/components/auth/TagRequiredModal.tsx
git commit -m "feat: referral logic in linkTag + collision handling + referrer notification"
```

---

### Task 5: Draft 3 Free Uses Counter

**Files:**
- Modify: `src/components/draft/DraftSimulator.tsx`

- [ ] **Step 1: Add premium check and counter logic**

At the top of DraftSimulator, add imports and premium state:

```typescript
import { useAuth } from '@/hooks/useAuth'
import { isPremium } from '@/lib/premium'
import { PremiumGate } from '@/components/premium/PremiumGate'
import type { Profile } from '@/lib/supabase/types'
import { useTranslations } from 'next-intl'
```

Inside the component function, add:

```typescript
const { profile } = useAuth()
const hasPremium = isPremium(profile as Profile | null)
const tp = useTranslations('premium')

const LS_DRAFT_USES = 'brawlvalue:draft-uses'
function getDraftUses(): number {
  try { return parseInt(localStorage.getItem(LS_DRAFT_USES) ?? '0', 10) }
  catch { return 0 }
}
function incrementDraftUses(): void {
  try { localStorage.setItem(LS_DRAFT_USES, String(getDraftUses() + 1)) }
  catch { /* ignore */ }
}
```

- [ ] **Step 2: Increment on COMPLETE, block after 3 uses**

Add useEffect for counting:
```typescript
const [draftUses, setDraftUses] = useState(getDraftUses)
useEffect(() => {
  if (state.phase === 'COMPLETE' && !hasPremium) {
    incrementDraftUses()
    setDraftUses(getDraftUses())
  }
}, [state.phase, hasPremium])
```

Add early return BEFORE the main render:
```typescript
if (!hasPremium && draftUses >= 3) {
  return (
    <PremiumGate blur>
      <div className="text-center py-12">
        <p className="font-['Lilita_One'] text-lg text-white">{tp('draftUsesExhausted')}</p>
      </div>
    </PremiumGate>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/draft/DraftSimulator.tsx
git commit -m "feat: draft 3 free uses counter with PremiumGate"
```

---

### Task 6: Referral Code in Header Dropdown

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add Gift import and referral state**

Add to the lucide-react import at the top of Header.tsx:

```typescript
import { Gift } from 'lucide-react'  // add Gift to existing import
```

Add state for copy feedback inside the component:

```typescript
const [refCopied, setRefCopied] = useState(false)
const tp = useTranslations('premium')
```

- [ ] **Step 2: Add referral item to dropdown**

Between "Manage subscription" and "Logout" items in the avatar dropdown, add:

```typescript
{profile?.referral_code && (
  <button
    onClick={() => {
      navigator.clipboard.writeText(`https://brawlvision.com/${locale}?ref=${profile.referral_code}`)
      setRefCopied(true)
      setTimeout(() => setRefCopied(false), 2000)
    }}
    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-[#FFC91B] transition-colors w-full"
  >
    <Gift className="w-4 h-4" />
    {refCopied ? tp('referralCopied') : `${tp('referralTitle')} (${profile.referral_code})`}
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: referral code copy button in header dropdown"
```

---

### Task 7: Security Migration — Protect Trial/Referral Columns

**Files:**
- Create: `supabase/migrations/007_protect_trial_fields.sql`

> **AUDIT NOTE (2026-04-09):** Original Task 7 was "Expose Raw Battlelog Entries from useBattlelog". This was REMOVED because `useBattlelog` already returns raw `BattlelogEntry[]` via `data.battles` (see `src/hooks/useBattlelog.ts:26,164`). No modification needed. This task was replaced with the critical security migration that was documented in the plan's "Additional Security" section but had no implementation task.

- [ ] **Step 1: Create migration file**

```sql
-- 007_protect_trial_fields.sql
-- Prevent client-side manipulation of trial/referral/payment fields.
-- Only service_role can modify these columns.

CREATE OR REPLACE FUNCTION protect_trial_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' != 'service_role' THEN
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by;
    NEW.referral_count := OLD.referral_count;
    NEW.tier := OLD.tier;
    NEW.ls_subscription_status := OLD.ls_subscription_status;
    NEW.ls_subscription_id := OLD.ls_subscription_id;
    NEW.ls_customer_id := OLD.ls_customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_trial ON profiles;
CREATE TRIGGER tr_protect_trial
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_trial_fields();
```

- [ ] **Step 2: Test locally with Supabase CLI**

```bash
supabase db reset
```

Verify the trigger allows service_role updates but blocks anon/authenticated user updates.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_protect_trial_fields.sql
git commit -m "feat: security migration — protect trial/referral/payment columns"
```

---

### Task 8: Post-Trial Battle Count Message

**Files:**
- Modify: `src/components/premium/TrialBanner.tsx`

- [ ] **Step 1: Add battle count state and fetch**

Inside the `TrialBanner` component, after the existing `onTrial`/`expired` checks (line ~40), add:

```typescript
const [battleCount, setBattleCount] = useState(0)
useEffect(() => {
  if (!expired || !profile?.player_tag) return
  fetch(`/api/battles?tag=${encodeURIComponent(profile.player_tag)}&aggregate=true`)
    .then(r => r.json())
    .then(d => setBattleCount(d.total ?? 0))
    .catch(() => {})
}, [expired, profile])
```

- [ ] **Step 2: Replace expired banner JSX with battle count message**

Replace the existing expired return block (lines 44-58) with:

```typescript
if (expired) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-red-400 shrink-0" />
          <p className="font-['Lilita_One'] text-sm text-red-300">{t('trialExpired')}</p>
        </div>
        <button
          onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="shrink-0 px-3 py-1.5 bg-[#FFC91B] text-[#121A2F] font-['Lilita_One'] text-xs rounded-lg hover:bg-[#FFD84D] transition-colors"
        >
          {t('trialBannerSubscribe')}
        </button>
      </div>
      {battleCount > 0 && (
        <p className="text-xs text-red-300/70 pl-6">
          {t('trialExpiredBody', { battles: String(battleCount), days: '30' })}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify the `/api/battles` endpoint works for expired trial users**

An expired trial user IS authenticated (Google login) but NOT premium. The endpoint should return battles the user OWNS (by player_tag). If the endpoint requires premium status, it needs a small fix to allow aggregate-only queries for authenticated users viewing their own battles.

- [ ] **Step 4: Commit**

```bash
git add src/components/premium/TrialBanner.tsx
git commit -m "feat: post-trial expired banner shows stored battle count"
```

---

### Task 9: Full Test Suite + Build Verification

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 2: Run build**

```bash
npx next build
```

- [ ] **Step 3: Manual testing of all 6 user states**

| # | State | SQL to set | What to verify |
|---|-------|-----------|---------------|
| 1 | Premium (subscription) | `tier='premium', ls_subscription_status='active'` | Full analytics, no blur, no trial banner |
| 2 | Trial active | `tier='free', ls_subscription_status=null, trial_ends_at=NOW()+3days` | Full analytics + trial banner + UpgradeCard at bottom |
| 3 | Free, logged in | `tier='free', ls_subscription_status=null, trial_ends_at=null` | Freemium blur view with tabs + personalized hook |
| 4 | Trial expired | `tier='free', trial_ends_at=NOW()-1day` | Expired message with battle count + UpgradeCard |
| 5 | Anonymous | (use incognito) | Subscription packages or sign-in prompt |
| 6 | Premium cancelled | `tier='premium', ls_subscription_status='cancelled'` | Full analytics (grace period) |

- [ ] **Step 4: Fix any issues found**
- [ ] **Step 5: Final commit + merge to main**

---

## Execution Order

```
Task 1 (detect segment — TDD) ─┐
                                ├─ Task 3 (restructure analytics page) ─┐
Task 2 (freemium analytics)   ─┘                                       │
                                                                        ├─ Task 9 (verification)
Task 4 (referral logic + TagRequiredModal fix) ─────────────────────────┤
Task 5 (draft 3 uses) ─────────────────────────────────────────────────┤
Task 6 (referral in header) ───────────────────────────────────────────┤
Task 7 (security migration) ───────────────────────────────────────────┤
Task 8 (post-trial battle count) ──────────────────────────────────────┘
```

- Tasks 1 and 2 are independent and can run in parallel
- Task 3 depends on Tasks 1 and 2 (needs detectSegment + useFreemiumAnalytics)
- Tasks 4, 5, 6, 7, 8 are independent of each other and of Task 3
- Task 9 runs last after all others

> **AUDIT NOTE:** Original Task 7 ("Expose raw entries from useBattlelog") was eliminated. `useBattlelog` already returns `data.battles: BattlelogEntry[]`. Task 7 is now the security migration (protect_trial_fields trigger).

---

## Issues Found in Self-Review (Fixed)

1. **PersonalizedHook component missing** — ✅ RESOLVED: Added as Task 3 Step 5. Creates `src/components/premium/PersonalizedHook.tsx` with segment-based switch, minimum threshold (≥3 battles), and fallback chain.

2. **`as any` cast in useFreemiumAnalytics** — ✅ RESOLVED: Task 2 now uses explicit typed adapter: `parsed.map((b, i) => ({ ...b, id: i, created_at: new Date().toISOString() }))`. Verified: `computeAdvancedAnalytics` never reads `id` or `created_at` fields (confirmed by full function body audit).

3. **Referral code passing** — ✅ RESOLVED: Task 4 Step 1 now fixes TagRequiredModal to write edited `referralCode` state back to localStorage BEFORE calling `linkTag()`. This ensures manually entered or edited codes are preserved.

4. **useBattlelog raw entries** — ✅ RESOLVED: `useBattlelog` already returns `data.battles: BattlelogEntry[]` (`src/hooks/useBattlelog.ts:26,164`). Original Task 7 was eliminated. Access via `freeStats.battles`.

5. **Battle count for expired trial** — PENDING verification during Task 8. The `/api/battles` endpoint uses `createClient()` (user auth). An expired trial user IS authenticated (has Google login) but NOT premium. Verify during implementation.

6. **useFreemiumAnalytics test** — Add to Task 2: test that the hook returns valid AdvancedAnalytics shape from sample battlelog entries, and returns null for empty input.

7. **Referrer notification toast** — ✅ RESOLVED: Added as Task 4 Step 3. Uses referral_count + localStorage to detect new referrals and show one-time toast. No new DB column needed.

8. **Referral code collision handling** — ✅ RESOLVED: Added to Task 4 Step 2. Retries profile insert once if unique constraint fails on auto-generated referral_code.

## Risk Mitigation

| Risk | Mitigation | Status |
|------|-----------|--------|
| Analytics page crash (null data) | freemiumAnalytics computed from public data, never null when logged in | Design |
| useBattlelog raw entries unavailable | Already available via `data.battles` — no modification needed | ✅ Resolved |
| Referral RPC fails silently | try/catch with best-effort pattern, doesn't block registration | Design |
| Draft uses counter cheatable (localStorage) | Acceptable for v1 — honest users won't clear localStorage | Accepted |
| Trial timestamp manipulation | DB trigger on INSERT (migration 006) + UPDATE protection (migration 007 — Task 7) | ✅ Task 7 |
| parseBattlelog → computeAdvanced type mismatch | Typed adapter adds `id: i` + `created_at` dummy fields. Safe: function never reads them. | ✅ Task 2 |
| Battle count API for expired users | Endpoint filters by player_tag from auth, not premium status. Verify in Task 8. | Pending |
| Manual referral code ignored | TagRequiredModal writes referralCode to localStorage before linkTag | ✅ Task 4 Step 1 |
| Trial celebration modal missing | Added as Task 3 Step 6. Uses existing `canvas-confetti` library. | ✅ Task 3 |
| PlayNowDashboard in freemium view | Omitted from View B in v1. Would need event API + full analytics. Low value for 25 battles. | Accepted |

## Additional Security: Protect trial/referral columns

> ✅ Now implemented as **Task 7** (`supabase/migrations/007_protect_trial_fields.sql`). See Task 7 for full SQL.

This trigger ensures that even if RLS allows UPDATE, the sensitive fields (trial_ends_at, referral_code, referred_by, referral_count, tier, ls_subscription_status, ls_subscription_id, ls_customer_id) cannot be changed by authenticated users directly — only service_role can modify them.

## Review Pass 4: Data Quality + Integration

11. **Freemium analytics data is VERY sparse (25 battles)** — Most matchups have 1 battle. Mastery has no curve. Synergy has no repeated pairs. The blur hides this, BUT the PersonalizedHook (visible metric) MUST have a minimum threshold: ≥3 battles for the specific data point. If not met, fall back to next segment or show generic message "Descubre tus estadísticas avanzadas". ✅ Addressed in Task 3 Step 5.

12. **PlayNowDashboard in freemium overview** — ✅ RESOLVED: Omitted from View B in v1. It needs event API + full analytics data. Not worth the complexity for 25 battles — users behind the blur won't benefit from "Play Now" recommendations.

13. **Variable naming** — ✅ RESOLVED: All references corrected to use `freeStats.battles` (from `const { data: freeStats } = useBattlelog(tag)`). No useBattlelog modification needed.

14. **PersonalizedHook fallback chain** — If detected segment's data is empty, try next segment in priority order: tilt → main → competitive → explorer → streak → generic. Never show an empty hook card. ✅ Addressed in Task 3 Step 5.

---

## Audit Log (2026-04-09)

Full plan audit against actual codebase state. All findings verified with file paths and line numbers.

| # | Finding | Severity | Resolution |
|---|---------|----------|-----------|
| 1 | Task 7 (expose raw entries) was unnecessary — `useBattlelog` already returns `data.battles: BattlelogEntry[]` (`src/hooks/useBattlelog.ts:26,164`) | Medium | Task 7 replaced with security migration |
| 2 | `computeAdvancedAnalytics` expects `Battle[]` but receives `BattleInsert[]` from `parseBattlelog` — verified function NEVER reads `id` or `created_at` | High | Explicit typed adapter in Task 2 (no more `as any`) |
| 3 | PersonalizedHook component referenced but never defined | High | Added as Task 3 Step 5 with props, fallback chain, minimum threshold |
| 4 | Trial celebration modal in spec (line 263) but no implementation task | Low | Added as Task 3 Step 6, reuses existing `canvas-confetti` library |
| 5 | `protect_trial_fields` trigger documented but not in any migration | High | New Task 7 creates `007_protect_trial_fields.sql` |
| 6 | `detectSegment` in analytics page received `BattlelogEntry[]` (nested `battle.result`) instead of `BattleInsert[]` (flat `result`) | High | Task 3 Step 1 now calls `parseBattlelog` before `detectSegment` |
| 7 | PlayNowDashboard needs event API + full analytics, not feasible for 25-battle View B | Low | Omitted from View B in v1 |
| 8 | TagRequiredModal captures referral code in state but doesn't sync back to localStorage before `linkTag()` | Medium | Task 4 Step 1 adds localStorage write in handleSubmit |
| 9 | Spec `referralSuccess` had `{tag}` interpolation but translation doesn't use it | Low | Spec updated to match implemented translation |
| 10 | Variable naming: plan referenced `freeData?.rawEntries` but code uses `freeStats.battles` | Medium | All references corrected throughout plan |

### Quality Review Pass (writing-plans self-review)

| # | Issue | Type | Resolution |
|---|-------|------|-----------|
| Q1 | Task 3 View B had 4 placeholder comments `{/* ... */}` instead of real code | Placeholder | Replaced with complete View B code — all 6 tabs, all components, all props |
| Q2 | PersonalizedHook (Task 3 Step 5) was description-only, no implementation code | Placeholder | Full component code with fallback chain, minimum threshold, and hook messages |
| Q3 | Celebration modal (Task 3 Step 6) was description-only | Placeholder | Full implementation with confetti, localStorage flag, dismissible modal |
| Q4 | Referrer notification toast missing from plan (spec section 7.3) | Spec gap | Added as Task 4 Step 3 using referral_count + localStorage |
| Q5 | Referral code collision handling missing (spec section 6.3) | Spec gap | Added to Task 4 Step 2 with retry-once on unique constraint failure |
| Q6 | Task 5 didn't show how DraftSimulator gets `hasPremium` | Placeholder | Added full import list and useAuth/isPremium setup |
| Q7 | Task 6 Step 2 had no code for Gift import or copy feedback | Placeholder | Added useState for copy feedback, Gift import, and full button JSX |
| Q8 | Task 8 had no JSX for updated expired banner | Placeholder | Full replacement JSX with battle count conditional rendering |
