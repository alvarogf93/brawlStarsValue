# Phase B Monetization v3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement monetization through dedicated subscribe page, 3-day trial, and referral system. Architectural split: `/analytics` (premium dashboard) + `/subscribe` (sales page).

**Architecture:** Two-page split replaces the previous single-page multi-view approach. Non-premium users are redirected from `/analytics` to `/subscribe`. Blur eliminated in favor of personalized hooks + static screenshots + pricing.

**Tech Stack:** React, Next.js 16, Supabase RPC, next-intl, Tailwind CSS, Vitest, PayPal

**Spec reference:** `docs/superpowers/specs/2026-04-09-monetization-phase-b-v3-design.md`

---

## What Was Eliminated from v2

| v2 Component | Why Removed |
|-------------|-------------|
| `useFreemiumAnalytics` hook | No blur = no need to compute analytics from 25 battles |
| `BattleInsert -> Battle` adapter | No `computeAdvancedAnalytics` call |
| View B (freemium blur) in analytics | Replaced by dedicated `/subscribe` page |
| Draft 3 free uses counter | Draft is premium-only (lives in `/analytics`) |
| PremiumGate on 6 tabs | No blur in analytics page |
| PersonalizedHook with AdvancedAnalytics | Simplified to use freeStats from `useBattlelog` |
| `computeAdvancedAnalytics` on 25 battles | Not needed |

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/analytics/detect-segment.ts` | Detect player segment from battlelog |
| Create | `src/__tests__/unit/lib/analytics-detect-segment.test.ts` | Tests for segment detection |
| Create | `src/app/[locale]/profile/[tag]/subscribe/page.tsx` | Subscribe sales page |
| Create | `src/components/premium/PersonalizedHook.tsx` | Personalized hook metric (uses freeStats) |
| Create | `src/components/premium/FeatureShowcase.tsx` | Static premium dashboard screenshots |
| Create | `supabase/migrations/007_protect_trial_fields.sql` | Security trigger |
| Modify | `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Simplify: redirect guard + clean premium dashboard |
| Modify | `src/components/auth/AuthProvider.tsx` | apply_referral RPC + collision handling + referrer notification |
| Modify | `src/components/auth/TagRequiredModal.tsx` | Sync referral code to localStorage before linkTag |
| Modify | `src/components/premium/TrialBanner.tsx` | Navigate to /subscribe + battle count on expired |
| Modify | `src/components/layout/Header.tsx` | Upgrade link -> /subscribe + referral code copy |
| Modify | `messages/es.json` (+ 12 locales) | Add `subscribe` namespace |

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

  it('returns "tilt" for empty battles array', () => {
    expect(detectSegment([], 20000)).toBe('tilt')
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
import type { BattleInsert } from '@/lib/supabase/types'

export type PlayerSegment = 'tilt' | 'main' | 'competitive' | 'explorer' | 'streak'

/**
 * Detect player segment from parsed battlelog (BattleInsert[] format) + trophies.
 * Used to select the personalized hook metric for non-premium users.
 * Priority: tilt > main > competitive > explorer > streak > default(tilt)
 */
export function detectSegment(battles: Pick<BattleInsert, 'result' | 'my_brawler' | 'mode'>[], trophies: number): PlayerSegment {
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

```bash
npx vitest run src/__tests__/unit/lib/analytics-detect-segment.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/detect-segment.ts src/__tests__/unit/lib/analytics-detect-segment.test.ts
git commit -m "feat: detect player segment for personalized subscribe hook"
```

---

### Task 2: Create Subscribe Page

**Files:**
- Create: `src/app/[locale]/profile/[tag]/subscribe/page.tsx`
- Create: `src/components/premium/PersonalizedHook.tsx`
- Create: `src/components/premium/FeatureShowcase.tsx`

This is the NEW sales page that replaces the old non-premium view in analytics.

- [ ] **Step 1: Create PersonalizedHook component**

```typescript
// src/components/premium/PersonalizedHook.tsx
'use client'

import { useTranslations } from 'next-intl'
import type { PlayerSegment } from '@/lib/analytics/detect-segment'
import { Crown } from 'lucide-react'

interface PersonalizedHookProps {
  segment: PlayerSegment
  freeStats: {
    winRate: number
    mostPlayedBrawler: string
    starPlayerPct: number
    modeWinRates: { mode: string }[]
  }
  trophies: number
}

export function PersonalizedHook({ segment, freeStats, trophies }: PersonalizedHookProps) {
  const t = useTranslations('premium')

  const messages: Record<PlayerSegment, string> = {
    tilt: t('hookTilt'),
    main: t('hookMastery', { name: freeStats.mostPlayedBrawler }),
    competitive: t('hookCompetitive', { trophies: trophies.toLocaleString() }),
    explorer: t('hookExplorer', { count: String(freeStats.modeWinRates.length) }),
    streak: t('hookClutch', { wr: String(freeStats.starPlayerPct) }),
  }

  return (
    <div className="brawl-card p-5 border-2 border-[#FFC91B]/30 bg-gradient-to-r from-[#FFC91B]/5 to-transparent">
      <div className="flex items-center gap-3">
        <Crown className="w-6 h-6 text-[#FFC91B] shrink-0" />
        <div>
          <p className="font-['Lilita_One'] text-lg text-[#FFC91B]">{messages[segment]}</p>
          <p className="text-sm text-slate-400 mt-0.5">{t('blurUnlock')}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create FeatureShowcase component**

```typescript
// src/components/premium/FeatureShowcase.tsx
'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'

const PREVIEWS = [
  { src: '/assets/premium-previews/overview.webp', captionKey: 'previewCaption1' },
  { src: '/assets/premium-previews/performance.webp', captionKey: 'previewCaption2' },
  { src: '/assets/premium-previews/matchups.webp', captionKey: 'previewCaption3' },
] as const

export function FeatureShowcase() {
  const t = useTranslations('subscribe')

  return (
    <div className="space-y-4">
      {PREVIEWS.map(({ src, captionKey }) => (
        <div key={captionKey} className="brawl-card-dark overflow-hidden border-[#090E17]">
          <div className="relative aspect-video w-full">
            <Image src={src} alt={t(captionKey)} fill className="object-cover" />
          </div>
          <p className="px-4 py-3 font-['Lilita_One'] text-sm text-slate-300">{t(captionKey)}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create the subscribe page**

```typescript
// src/app/[locale]/profile/[tag]/subscribe/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { useBattlelog } from '@/hooks/useBattlelog'
import { isPremium, isTrialExpired } from '@/lib/premium'
import { parseBattlelog } from '@/lib/battle-parser'
import { detectSegment } from '@/lib/analytics/detect-segment'
import type { Profile } from '@/lib/supabase/types'
import { FlaskConical, LogIn } from 'lucide-react'
import { AnalyticsSkeleton } from '@/components/ui/Skeleton'

import { UpgradeCard } from '@/components/premium/UpgradeCard'
import { ReferralCard } from '@/components/premium/ReferralCard'
import { TrialBanner } from '@/components/premium/TrialBanner'
import { PersonalizedHook } from '@/components/premium/PersonalizedHook'
import { FeatureShowcase } from '@/components/premium/FeatureShowcase'
import { AuthModal } from '@/components/auth/AuthModal'

export default function SubscribePage() {
  const params = useParams<{ tag: string; locale: string }>()
  const tag = decodeURIComponent(params.tag)
  const router = useRouter()
  const t = useTranslations('subscribe')
  const { user, profile, loading: authLoading } = useAuth()
  const hasPremium = isPremium(profile as Profile | null)
  const isLoggedIn = !!user
  const { data: freeStats, isLoading: freeLoading } = useBattlelog(tag)
  const [authOpen, setAuthOpen] = useState(false)

  // Redirect premium users to analytics
  if (!authLoading && hasPremium) {
    router.replace(`/${params.locale}/profile/${params.tag}/analytics`)
    return <AnalyticsSkeleton />
  }

  // Fetch player trophies for segment detection (competitive check)
  const [trophies, setTrophies] = useState(0)
  useEffect(() => {
    fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerTag: tag }),
    })
      .then(r => r.json())
      .then(d => setTrophies(d.player?.trophies ?? 0))
      .catch(() => {})
  }, [tag])

  // Detect player segment for PersonalizedHook
  const playerSegment = useMemo(() => {
    if (!freeStats?.battles || freeStats.battles.length === 0) return 'tilt' as const
    const parsed = parseBattlelog(freeStats.battles, tag)
    return detectSegment(parsed, trophies)
  }, [freeStats, tag, trophies])

  if (authLoading || freeLoading) return <AnalyticsSkeleton />

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Expired trial banner */}
      <TrialBanner />

      {/* Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#121A2F] border-4 border-[#FFC91B] rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_4px_0_0_#121A2F]">
            <FlaskConical className="w-8 h-8 text-[#FFC91B]" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">{t('title')}</h1>
            <p className="font-['Inter'] font-semibold text-[#FFC91B]">{t('subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Free preview stats — computed from 25 public battles */}
      {freeStats && (
        <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
          <h3 className="font-['Lilita_One'] text-lg text-white mb-4">{t('freePreviewTitle')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${freeStats.winRate >= 60 ? 'text-green-400' : freeStats.winRate >= 45 ? 'text-[#FFC91B]' : 'text-red-400'}`}>{freeStats.winRate.toFixed(1)}%</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('winRateLabel')}</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-2xl tabular-nums text-white">{freeStats.recentWins}W {freeStats.recentLosses}L</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('recordLabel')}</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA] truncate">{freeStats.mostPlayedBrawler}</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('favoriteLabel')}</p>
            </div>
            <div className="brawl-row rounded-xl p-4 text-center">
              <p className={`font-['Lilita_One'] text-2xl tabular-nums ${freeStats.trophyChange > 0 ? 'text-green-400' : freeStats.trophyChange < 0 ? 'text-red-400' : 'text-slate-500'}`}>{freeStats.trophyChange > 0 ? '+' : ''}{freeStats.trophyChange}</p>
              <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">{t('trophyChangeLabel')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Personalized hook — computed from 25 public battles */}
      {freeStats && (
        <PersonalizedHook
          segment={playerSegment}
          freeStats={freeStats}
          trophies={trophies}
        />
      )}

      {/* Feature showcase — static screenshots */}
      <FeatureShowcase />

      {/* Pricing + checkout */}
      <div id="upgrade-section">
        <UpgradeCard redirectTo={`/${params.locale}/profile/${params.tag}/analytics`} />
        <ReferralCard />
      </div>

      {/* Auth prompt for non-logged-in users */}
      {!isLoggedIn && (
        <>
          <div className="brawl-card-dark p-5 text-center border-[#090E17]">
            <p className="text-sm text-slate-400 mb-3">{t('trialCtaBody')}</p>
            <button onClick={() => setAuthOpen(true)} className="brawl-button px-5 py-2.5 text-sm">
              <span className="flex items-center gap-2"><LogIn className="w-4 h-4" /> {t('trialCta')}</span>
            </button>
          </div>
          <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} redirectTo={`/${params.locale}/profile/${params.tag}/subscribe`} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npx next build 2>&1 | grep -iE "(error|fail)" | head -5
```

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/profile/[tag]/subscribe/page.tsx src/components/premium/PersonalizedHook.tsx src/components/premium/FeatureShowcase.tsx
git commit -m "feat: subscribe page with personalized hooks + feature showcase + pricing"
```

---

### Task 3: Simplify Analytics Page

**Files:**
- Modify: `src/app/[locale]/profile/[tag]/analytics/page.tsx`

The analytics page becomes dramatically simpler. Remove ALL non-premium views and add redirect guard.

- [ ] **Step 1: Replace non-premium early return with redirect**

Remove the entire non-premium block (lines 127-213 in current code) which includes the `tagHasPremium` check, the sign-in prompt, and the free preview + UpgradeCard view. Replace with a single redirect:

Find and replace lines 127-214 (the `if (!authLoading && !hasPremium) {` block through its closing `}`) with:

```typescript
  // Redirect non-premium users to subscribe page
  if (!authLoading && !hasPremium) {
    router.replace(`/${params.locale}/profile/${params.tag}/subscribe`)
    return <AnalyticsSkeleton />
  }
```

- [ ] **Step 2: Add trial celebration modal**

Add imports at the top of the file:

```typescript
import { isOnTrial } from '@/lib/premium'
```

Note: `isOnTrial` is already imported on line 9. Verify before adding.

Add state and translation hook inside the component function, after the existing state declarations (after line 97):

```typescript
const tp = useTranslations('premium')
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

Add the celebration modal render inside the premium return JSX, right after the opening `<div className="animate-fade-in ...">`:

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

- [ ] **Step 3: Remove unused imports and state**

Remove these imports since they were only used in the non-premium view:

```typescript
// REMOVE these from imports:
import { FlaskConical, LogIn } from 'lucide-react'  // FlaskConical is still used in premium header — keep it. Remove only LogIn.
import { AuthModal } from '@/components/auth/AuthModal'
```

Specifically:
- Line 13: Change `import { FlaskConical, LogIn } from 'lucide-react'` to `import { FlaskConical } from 'lucide-react'`
- Line 21: Remove `import { AuthModal } from '@/components/auth/AuthModal'`

Remove unused state variables:

```typescript
// REMOVE these state declarations:
const [tagHasPremium, setTagHasPremium] = useState<boolean | null>(null)
const [authOpen, setAuthOpen] = useState(false)
```

Remove the `tagHasPremium` useEffect (lines 100-108 in current code):

```typescript
// REMOVE this entire useEffect:
useEffect(() => {
  if (authLoading || hasPremium) return
  const controller = new AbortController()
  fetch(`/api/profile/check-premium?tag=${encodeURIComponent(tag)}`, { signal: controller.signal })
    .then(r => r.json())
    .then(data => setTagHasPremium(data.hasPremium === true))
    .catch(err => { if (err.name !== 'AbortError') setTagHasPremium(false) })
  return () => controller.abort()
}, [tag, authLoading, hasPremium])
```

- [ ] **Step 4: Remove useBattlelog hook call**

The `useBattlelog` hook was only used in the non-premium view for free preview stats. The premium view uses `useAdvancedAnalytics`. Remove:

```typescript
// REMOVE:
import { useBattlelog } from '@/hooks/useBattlelog'
// REMOVE:
const { data: freeStats, isLoading: freeLoading } = useBattlelog(tag)
```

Also remove `PremiumGate` import since it is no longer used anywhere in this file:

```typescript
// REMOVE:
import { PremiumGate } from '@/components/premium/PremiumGate'
```

- [ ] **Step 5: Update UpgradeCard redirectTo in trial section**

The trial users' UpgradeCard at the bottom (lines 329-334) currently redirects to `/analytics` after checkout. Keep this — it's correct since after subscribing the user should land on analytics.

No change needed here.

- [ ] **Step 6: Verify the final analytics page compiles**

The simplified analytics page should now contain:
1. Security redirect (own-tag check) - KEEP
2. Non-premium redirect to `/subscribe` - NEW
3. Loading/error states - KEEP
4. Premium view with 6 tabs - KEEP
5. Trial celebration modal - NEW
6. TrialBanner + UpgradeCard + ReferralCard for trial users - KEEP

```bash
npx next build 2>&1 | grep -iE "(error|fail)" | head -5
```

- [ ] **Step 7: Commit**

```bash
git add src/app/[locale]/profile/[tag]/analytics/page.tsx
git commit -m "feat: simplify analytics page — redirect non-premium to /subscribe"
```

---

### Task 4: Integrate Referral Logic in linkTag

**Files:**
- Modify: `src/components/auth/AuthProvider.tsx`
- Modify: `src/components/auth/TagRequiredModal.tsx`

- [ ] **Step 1: Fix TagRequiredModal — write edited referral code to localStorage**

In `TagRequiredModal.tsx`, the user can EDIT the referral code input field, but `handleSubmit()` only calls `linkTag(tag)` without syncing the edited value back to localStorage. Fix: write the current `referralCode` state to localStorage BEFORE calling linkTag.

In `src/components/auth/TagRequiredModal.tsx`, inside `handleSubmit()`, add before line 44 (`const result = await linkTag(trimmed)`):

```typescript
// Sync edited referral code to localStorage before linkTag reads it
if (referralCode.trim()) {
  try { localStorage.setItem('brawlvalue:ref', referralCode.trim().toUpperCase()) }
  catch { /* ignore */ }
} else {
  try { localStorage.removeItem('brawlvalue:ref') } catch { /* ignore */ }
}
```

The full `handleSubmit` becomes:

```typescript
const handleSubmit = async () => {
  const trimmed = tag.trim()
  if (!PLAYER_TAG_REGEX.test(trimmed)) {
    setError(t('invalidTag'))
    return
  }

  setLoading(true)
  setError('')

  // Sync edited referral code to localStorage before linkTag reads it
  if (referralCode.trim()) {
    try { localStorage.setItem('brawlvalue:ref', referralCode.trim().toUpperCase()) }
    catch { /* ignore */ }
  } else {
    try { localStorage.removeItem('brawlvalue:ref') } catch { /* ignore */ }
  }

  const result = await linkTag(trimmed)
  setLoading(false)

  if (result.ok) {
    // Redirect to the player's profile
    router.push(`/${locale}/profile/${encodeURIComponent(trimmed)}`)
  } else {
    setError(result.error || t('tagNotFound'))
  }
}
```

- [ ] **Step 2: After profile creation in linkTag, apply referral + handle code collision**

In `src/components/auth/AuthProvider.tsx`, replace the profile insert block (lines 72-83) with collision-handling and referral application:

Replace:

```typescript
    // Create profile
    const { data: newProfile, error } = await supabase
      .from('profiles')
      .insert({ id: user.id, player_tag: trimmed })
      .select()
      .single()

    if (error || !newProfile) {
      return { ok: false, error: error?.message || 'Could not create profile' }
    }

    setProfile(newProfile as Profile)
    setNeedsTag(false)
    try { localStorage.setItem('brawlvalue:user', tag) } catch { /* ignore */ }

    // Notify admin of new signup (fire-and-forget)
    fetch('\api\notify\signup', { method: 'POST' }).catch(() => {})

    return { ok: true }
```

With:

```typescript
    // Profile insert with referral code collision retry (spec requirement)
    // The DB trigger auto-generates referral_code via md5(random()).
    // If unique constraint fails (extremely rare), retry once.
    let insertResult = await supabase
      .from('profiles')
      .insert({ id: user.id, player_tag: trimmed })
      .select()
      .single()

    if (insertResult.error?.code === '23505' && insertResult.error.message.includes('referral_code')) {
      // Collision on auto-generated referral code — retry once
      insertResult = await supabase
        .from('profiles')
        .insert({ id: user.id, player_tag: trimmed })
        .select()
        .single()
    }

    if (insertResult.error || !insertResult.data) {
      return { ok: false, error: insertResult.error?.message || 'Could not create profile' }
    }

    setProfile(insertResult.data as Profile)
    setNeedsTag(false)
    try { localStorage.setItem('brawlvalue:user', trimmed) } catch { /* ignore */ }

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

    // Notify admin of new signup (fire-and-forget)
    fetch('/api/notify/signup', { method: 'POST' }).catch(() => {})

    return { ok: true }
```

- [ ] **Step 3: Add referrer notification toast**

When someone uses a referral code, the referrer should see a toast. Uses `referral_count` + localStorage to detect new referrals without needing a new DB column.

In `src/components/auth/AuthProvider.tsx`, add a `useEffect` after the session fetch effect (around line 193), before the `value` declaration:

```typescript
// Check for pending referral notification
useEffect(() => {
  if (!profile?.id) return
  const p = profile as Profile
  if (!p.referral_count || p.referral_count <= 0) return
  const key = `brawlvalue:ref-notified-${p.referral_count}`
  try {
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    // Show toast notification
    const toast = document.createElement('div')
    toast.className = 'fixed top-4 right-4 z-50 bg-[#FFC91B] text-[#121A2F] px-4 py-3 rounded-xl font-bold shadow-lg animate-fade-in'
    toast.textContent = '🎉 Tu amigo se unio! +3 dias PRO'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 5000)
  } catch { /* ignore */ }
}, [profile])
```

- [ ] **Step 4: Verify build**

```bash
npx next build 2>&1 | grep -iE "(error|fail)" | head -5
```

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/AuthProvider.tsx src/components/auth/TagRequiredModal.tsx
git commit -m "feat: referral logic in linkTag + collision handling + referrer notification"
```

---

### Task 5: Referral Code in Header Dropdown

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add Gift import and referral state**

In `src/components/layout/Header.tsx`, update the lucide-react import (line 11):

Replace:
```typescript
import { Menu, LogOut, RefreshCw, User, Crown, Home } from 'lucide-react'
```

With:
```typescript
import { Menu, LogOut, RefreshCw, User, Crown, Home, Gift } from 'lucide-react'
```

Add state inside the component function (after existing state declarations):

```typescript
const [refCopied, setRefCopied] = useState(false)
const tp = useTranslations('premium')
```

- [ ] **Step 2: Change upgrade button link to /subscribe**

Replace lines 146-152 (the upgrade button Link):

Replace:
```typescript
          {!loading && user && profile && !isPremium(profile as Profile) && (
            <Link
              href={`/${locale}/profile/${encodeURIComponent(profile.player_tag)}/analytics`}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-slate-400 bg-white/5 hover:bg-white/10 hover:text-[#FFC91B] rounded-xl transition-colors border border-white/10 hover:border-[#FFC91B]/30"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{t('upgrade')}</span>
            </Link>
          )}
```

With:
```typescript
          {!loading && user && profile && !isPremium(profile as Profile) && (
            <Link
              href={`/${locale}/profile/${encodeURIComponent(profile.player_tag)}/subscribe`}
              className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm font-['Lilita_One'] text-slate-400 bg-white/5 hover:bg-white/10 hover:text-[#FFC91B] rounded-xl transition-colors border border-white/10 hover:border-[#FFC91B]/30"
            >
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">{t('upgrade')}</span>
            </Link>
          )}
```

Note: The only change is `analytics` -> `subscribe` in the href.

- [ ] **Step 3: Add referral item to dropdown**

Between the "Manage subscription" section (line 237 closing `</div>`) and the "Logout" button (line 239), add the referral code copy button:

```typescript
                  {/* Referral code copy */}
                  {(profile as Profile)?.referral_code && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`https://brawlvision.com/${locale}?ref=${(profile as Profile).referral_code}`)
                        setRefCopied(true)
                        setTimeout(() => setRefCopied(false), 2000)
                      }}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-[#FFC91B] transition-colors w-full"
                    >
                      <Gift className="w-4 h-4" />
                      {refCopied ? tp('referralCopied') : `${tp('referralTitle')} (${(profile as Profile).referral_code})`}
                    </button>
                  )}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: upgrade link to /subscribe + referral code copy in header dropdown"
```

---

### Task 6: Update TrialBanner — CTA to /subscribe + Battle Count

**Files:**
- Modify: `src/components/premium/TrialBanner.tsx`

- [ ] **Step 1: Add useParams import and locale extraction**

Add import at the top of `src/components/premium/TrialBanner.tsx`:

```typescript
import { useParams } from 'next/navigation'
```

Inside the component function, after `const t = useTranslations('premium')` (line 30), add:

```typescript
const { locale } = useParams<{ locale: string }>()
```

- [ ] **Step 2: Change subscribe button behavior in expired section**

Replace the expired section's button onClick handler (line 52):

Replace:
```typescript
          onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
```

With:
```typescript
          onClick={() => {
            const tag = (profile as Profile)?.player_tag
            if (tag) {
              window.location.href = `/${locale}/profile/${encodeURIComponent(tag)}/subscribe`
            }
          }}
```

- [ ] **Step 3: Change subscribe button behavior in active trial section**

Replace the active trial section's button onClick handler (line 76):

Replace:
```typescript
        onClick={() => document.getElementById('upgrade-section')?.scrollIntoView({ behavior: 'smooth' })}
```

With:
```typescript
        onClick={() => {
          // If #upgrade-section exists on current page, scroll to it; otherwise navigate
          const el = document.getElementById('upgrade-section')
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' })
          } else {
            const tag = (profile as Profile)?.player_tag
            if (tag) {
              window.location.href = `/${locale}/profile/${encodeURIComponent(tag)}/subscribe`
            }
          }
        }}
```

- [ ] **Step 4: Add battle count for expired state**

Add state for battle count inside the component, after the `onTrial`/`expired` checks (after line 41):

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

- [ ] **Step 5: Update expired banner JSX with battle count**

Replace the expired return block (lines 44-58) with:

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
          onClick={() => {
            const tag = (profile as Profile)?.player_tag
            if (tag) {
              window.location.href = `/${locale}/profile/${encodeURIComponent(tag)}/subscribe`
            }
          }}
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

- [ ] **Step 6: Verify build**

```bash
npx next build 2>&1 | grep -iE "(error|fail)" | head -5
```

- [ ] **Step 7: Commit**

```bash
git add src/components/premium/TrialBanner.tsx
git commit -m "feat: TrialBanner navigates to /subscribe + shows battle count on expired"
```

---

### Task 7: Security Migration — Protect Trial/Referral Columns

**Files:**
- Create: `supabase/migrations/007_protect_trial_fields.sql`

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

Verify the trigger allows service_role updates but blocks anon/authenticated user updates to protected columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_protect_trial_fields.sql
git commit -m "feat: security migration — protect trial/referral/payment columns"
```

---

### Task 8: Translation Keys + Verification

**Files:**
- Modify: `messages/es.json` (and all 12 other locale files)

- [ ] **Step 1: Add `subscribe` namespace keys to `messages/es.json`**

Add a new `"subscribe"` namespace after the `"premium"` namespace:

```json
"subscribe": {
  "title": "Premium Analytics",
  "subtitle": "Desbloquea el poder del analisis avanzado",
  "freePreviewTitle": "Tus ultimas 25 batallas",
  "winRateLabel": "Win Rate",
  "recordLabel": "Record",
  "favoriteLabel": "Favorito",
  "trophyChangeLabel": "Trofeos",
  "previewCaption1": "Detecta tu tilt y mejora tu juego",
  "previewCaption2": "Analiza tu rendimiento por brawler y mapa",
  "previewCaption3": "Descubre tus matchups y contrarresta",
  "trialCta": "Prueba 3 dias gratis",
  "trialCtaBody": "Vincula tu tag y accede a todas las analytics"
}
```

Also add the missing hook keys to the existing `"premium"` namespace (these are needed by PersonalizedHook but don't exist yet):

```json
"hookCompetitive": "Con {trophies}+ trofeos, descubre tus matchups",
"hookExplorer": "Juegas {count} modos — descubre donde dominas"
```

- [ ] **Step 2: Add `subscribe` namespace to all 12 other locale files**

For each locale file (`ar.json`, `de.json`, `en.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pl.json`, `pt.json`, `ru.json`, `tr.json`, `zh.json`), add the same `"subscribe"` namespace with English fallback text:

```json
"subscribe": {
  "title": "Premium Analytics",
  "subtitle": "Unlock the power of advanced analytics",
  "freePreviewTitle": "Your last 25 battles",
  "winRateLabel": "Win Rate",
  "recordLabel": "Record",
  "favoriteLabel": "Favorite",
  "trophyChangeLabel": "Trophies",
  "previewCaption1": "Detect your tilt and improve your game",
  "previewCaption2": "Analyze your performance by brawler and map",
  "previewCaption3": "Discover your matchups and counter-pick",
  "trialCta": "Try 3 days free",
  "trialCtaBody": "Link your tag and access all analytics"
}
```

Note: These are English placeholder translations. Proper localization for each language should be done in a follow-up pass, but having the keys prevents runtime errors from missing translations.

- [ ] **Step 3: Create placeholder premium preview images directory**

```bash
mkdir -p public/assets/premium-previews
```

Add placeholder images (will be replaced with real screenshots from a premium test account). Create three 1280x720 placeholder WebP files:

```bash
# Create minimal placeholder images so Image component doesn't 404
# These will be replaced with actual screenshots before launch
convert -size 1280x720 xc:'#0F172A' -gravity center -fill '#FFC91B' -pointsize 48 -annotate 0 'Overview Preview' public/assets/premium-previews/overview.webp 2>/dev/null || echo "Install imagemagick or add images manually"
convert -size 1280x720 xc:'#0F172A' -gravity center -fill '#FFC91B' -pointsize 48 -annotate 0 'Performance Preview' public/assets/premium-previews/performance.webp 2>/dev/null || echo "Install imagemagick or add images manually"
convert -size 1280x720 xc:'#0F172A' -gravity center -fill '#FFC91B' -pointsize 48 -annotate 0 'Matchups Preview' public/assets/premium-previews/matchups.webp 2>/dev/null || echo "Install imagemagick or add images manually"
```

If imagemagick is not available, take actual screenshots from a premium test account and save as:
- `public/assets/premium-previews/overview.webp`
- `public/assets/premium-previews/performance.webp`
- `public/assets/premium-previews/matchups.webp`

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 5: Run build**

```bash
npx next build
```

- [ ] **Step 6: Manual testing of all 6 user states**

| # | State | SQL to set | What to verify |
|---|-------|-----------|---------------|
| 1 | Anonymous | (incognito) | `/analytics` redirects to `/subscribe`. Subscribe shows auth CTA at bottom. |
| 2 | Free, logged in | `tier='free', trial_ends_at=NULL` | `/analytics` redirects to `/subscribe`. Subscribe shows PersonalizedHook + free preview stats + pricing. |
| 3 | Trial active | `tier='free', trial_ends_at=NOW()+3days` | `/analytics` shows full dashboard + TrialBanner + CTA navigates to `/subscribe`. Celebration modal on first visit. |
| 4 | Trial expired | `tier='free', trial_ends_at=NOW()-1day` | `/analytics` redirects to `/subscribe`. Subscribe shows expired banner with battle count + pricing. |
| 5 | Premium active | `tier='premium', ls_subscription_status='active'` | `/analytics` shows full dashboard. `/subscribe` redirects to `/analytics`. |
| 6 | Premium cancelled | `tier='premium', ls_subscription_status='cancelled'` | `/analytics` shows full dashboard (grace period). |

Additional checks:
- Header "Upgrade" button links to `/subscribe` (not `/analytics`)
- Header dropdown shows referral code copy button for premium users
- TrialBanner subscribe button navigates to `/subscribe`
- PersonalizedHook shows segment-appropriate message
- FeatureShowcase renders 3 preview images without errors

- [ ] **Step 7: Fix any issues found**
- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: translations + verification — monetization v3 complete"
```

---

## Execution Order

```
Task 1 (detect segment — TDD) ─── independent
Task 2 (subscribe page) ───────── depends on Task 1
Task 3 (simplify analytics) ────── independent of Task 2
Task 4 (referral in linkTag) ───── independent
Task 5 (referral in header) ────── independent
Task 6 (TrialBanner update) ────── independent
Task 7 (security migration) ────── independent
Task 8 (translations + verify) ─── after ALL others
```

Tasks 1, 3, 4, 5, 6, 7 can run in parallel.
Task 2 depends on Task 1 (needs `detectSegment`).
Task 8 runs last.

---

## Risk Mitigation

| Risk | Mitigation | Status |
|------|-----------|--------|
| Premium user hits `/subscribe` | Redirect guard in subscribe page sends to `/analytics` | Design |
| Non-premium user hits `/analytics` | Redirect guard sends to `/subscribe` | Design |
| Referral RPC fails silently | try/catch with best-effort pattern, doesn't block registration | Design |
| Trial timestamp manipulation | DB trigger on INSERT (migration 006) + UPDATE protection (migration 007 — Task 7) | Design |
| Manual referral code ignored | TagRequiredModal writes referralCode to localStorage before linkTag | Task 4 Step 1 |
| Referral code collision | Retry-once on unique constraint failure in profile insert | Task 4 Step 2 |
| Trial celebration modal fires repeatedly | localStorage flag `brawlvalue:trial-celebrated` prevents re-fire | Task 3 Step 2 |
| Missing preview images | Placeholder images created; real screenshots added before launch | Task 8 Step 3 |
| Missing translation keys | `subscribe` namespace added to all 13 locale files | Task 8 Steps 1-2 |
| Battle count API for expired users | Endpoint filters by player_tag from auth, not premium status | Task 6 Step 4 |
| TrialBanner scrolls to missing `#upgrade-section` | Smart fallback: scroll if exists, navigate to `/subscribe` otherwise | Task 6 Step 3 |
| `UpgradeCard.redirectTo` prop is dead code | Prop accepted but never sent to PayPal API (`/api/checkout/paypal` receives `{ interval, locale }` only). After checkout, PayPal confirms → redirects to `/profile/{tag}?upgraded=true` (hardcoded in `/api/checkout/paypal/confirm`). User lands on profile, not analytics. **Accepted for v1** — user clicks Analytics from profile. Fix in Phase C: wire `redirectTo` through checkout flow. | Known |

## Known Limitations (v1)

1. **Post-checkout redirect goes to profile, not analytics**: `UpgradeCard` has a `redirectTo` prop that is never used. After PayPal payment, `/api/checkout/paypal/confirm` hardcodes redirect to `/{locale}/profile/{tag}?upgraded=true`. The user lands on their profile overview, not `/analytics`. This is acceptable for v1 — user navigates to Analytics from their profile. Fixing this requires wiring `redirectTo` through the checkout API (scope: Phase C).

2. **Preview images are placeholders**: The `FeatureShowcase` component needs real screenshots from a premium test account. Placeholder images are created in Task 8 Step 3 but must be replaced with actual screenshots before public launch.
