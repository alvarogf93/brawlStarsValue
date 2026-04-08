# Phase B Monetization v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the three monetization features (freemium blur, trial, referrals) that are partially implemented, fixing all UX gaps identified during testing.

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
| Create | `src/__tests__/unit/lib/analytics-detect-segment.test.ts` | Tests for segment detection |
| Create | `src/__tests__/unit/hooks/useFreemiumAnalytics.test.ts` | Tests for limited analytics |
| Modify | `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Restructure: 3 views (subscription/freemium/premium) |
| Modify | `src/components/auth/AuthProvider.tsx` | Call apply_referral RPC after linkTag with referral code |
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
import type { BattlelogEntry } from '@/lib/api'

/**
 * Compute analytics from public battlelog entries (25 battles).
 * Same output as premium analytics but with less data.
 * Used for freemium blur — real data behind blur, limited sample.
 */
export function useFreemiumAnalytics(
  entries: BattlelogEntry[] | null,
  playerTag: string,
): AdvancedAnalytics | null {
  return useMemo(() => {
    if (!entries || entries.length === 0) return null
    try {
      const battles = parseBattlelog(entries, playerTag)
      if (battles.length === 0) return null
      return computeAdvancedAnalytics(battles as any)
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
const freemiumAnalytics = useFreemiumAnalytics(
  freeData?.rawEntries ?? null, // Need to expose raw entries from useBattlelog
  tag
)
const playerSegment = useMemo(() => {
  if (!freeData?.rawEntries) return 'tilt'
  const trophies = data?.player?.trophies ?? 0
  return detectSegment(freeData.rawEntries as any, trophies)
}, [freeData, data])
```

Note: `useBattlelog` currently returns processed stats. We need it to also expose raw `BattlelogEntry[]` for `useFreemiumAnalytics`. Check and modify useBattlelog if needed.

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

After the subscription package view, before the premium view, add:

```typescript
// View B: Freemium — logged in free user with computed analytics for blur
if (!authLoading && !hasPremium && isLoggedIn && freemiumAnalytics) {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      <TrialBanner />
      {/* Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B] to-[#121A2F]">
        {/* ... same header as subscription view ... */}
      </div>

      {/* Personalized hook metric — VISIBLE, no blur */}
      <PersonalizedHook segment={playerSegment} analytics={freemiumAnalytics} />

      {/* Tab navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {/* ... same tabs ... */}
      </div>

      {/* Tab content — ALL with PremiumGate blur using freemiumAnalytics */}
      {activeTab === 'overview' && (
        <OverviewStats overview={freemiumAnalytics.overview} />
      )}
      {activeTab === 'performance' && (
        <PremiumGate blur>
          <div className="space-y-6">
            <BrawlerMapHeatmap data={freemiumAnalytics.brawlerMapMatrix} />
            {/* ... rest ... */}
          </div>
        </PremiumGate>
      )}
      {/* ... other tabs with PremiumGate ... */}

      <div id="upgrade-section">
        <UpgradeCard redirectTo={...} />
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

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: three-view analytics page — subscription/freemium/premium"
```

---

### Task 4: Integrate Referral Logic in linkTag

**Files:**
- Modify: `src/components/auth/AuthProvider.tsx`

- [ ] **Step 1: After profile creation in linkTag, apply referral if code provided**

In `linkTag()`, after the profile insert succeeds, check localStorage for referral code and call the RPC:

```typescript
// After profile creation succeeds
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

- [ ] **Step 2: Verify build + test manually**
- [ ] **Step 3: Commit**

---

### Task 5: Draft 3 Free Uses Counter

**Files:**
- Modify: `src/components/draft/DraftSimulator.tsx`

- [ ] **Step 1: Add use counter logic**

```typescript
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

- [ ] **Step 2: Check uses on COMPLETE phase, show PremiumGate when exhausted**

In the DraftSimulator, when `state.phase === 'COMPLETE'`:
```typescript
// After draft completes, increment counter
useEffect(() => {
  if (state.phase === 'COMPLETE' && !hasPremium) incrementDraftUses()
}, [state.phase])
```

Before rendering the draft content:
```typescript
const draftUses = getDraftUses()
if (!hasPremium && draftUses >= 3) {
  return (
    <PremiumGate blur>
      <div className="text-center py-12">
        <p className="font-['Lilita_One'] text-lg text-white">{t('draftUsesExhausted')}</p>
      </div>
    </PremiumGate>
  )
}
```

- [ ] **Step 3: Commit**

---

### Task 6: Referral Code in Header Dropdown

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add referral item to dropdown**

Between "Manage subscription" and "Logout", add:

```typescript
{profile?.referral_code && (
  <button
    onClick={() => {
      navigator.clipboard.writeText(`https://brawlvision.com/${locale}?ref=${profile.referral_code}`)
      // Show toast or change button text briefly
    }}
    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-[#FFC91B] transition-colors w-full"
  >
    <Gift className="w-4 h-4" />
    {t('referralTitle')} ({profile.referral_code})
  </button>
)}
```

- [ ] **Step 2: Add Gift to lucide imports + referralTitle to nav translations**
- [ ] **Step 3: Commit**

---

### Task 7: Expose Raw Battlelog Entries from useBattlelog

**Files:**
- Modify: `src/hooks/useBattlelog.ts`

Task 3 depends on this. The `useBattlelog` hook currently processes entries into stats. We need it to also return the raw entries for `useFreemiumAnalytics`.

- [ ] **Step 1: Add rawEntries to return type**

```typescript
interface BattleStats {
  // ... existing fields ...
  rawEntries: BattlelogEntry[] // ADD THIS
}
```

In the fetch logic, store the raw entries alongside the processed stats.

- [ ] **Step 2: Verify build**
- [ ] **Step 3: Commit**

---

### Task 8: Post-Trial Battle Count Message

**Files:**
- Modify: `src/components/premium/TrialBanner.tsx`

- [ ] **Step 1: Query battle count for expired trial users**

When `isTrialExpired`, fetch the battle count:
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

Show in the expired message:
```
"Tu trial terminó. Tienes {battleCount} batallas guardadas. Suscríbete para conservarlas."
```

- [ ] **Step 2: Commit**

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
Task 7 (expose raw entries) — dependency for Task 3
Task 1 (detect segment) — TDD, independent
Task 2 (freemium analytics hook) — depends on Task 7
Task 3 (restructure analytics page) — depends on Tasks 1, 2, 7
Task 4 (referral logic in linkTag) — independent
Task 5 (draft 3 uses) — independent
Task 6 (referral in header) — independent
Task 8 (post-trial battle count) — independent
Task 9 (verification) — after all others
```

Tasks 4, 5, 6, 8 can run in parallel after Task 3 is done.

---

## Issues Found in Self-Review (Fixed)

1. **PersonalizedHook component missing** — Add Task 3.5: create a small component that renders the right metric card based on segment. Uses a switch on `playerSegment` to render TiltDetector, MasteryChart, MatchupMatrix (first entry), BrawlerMapHeatmap (best map), or ClutchCard — all with real freemiumAnalytics data, NO blur.

2. **`as any` cast in useFreemiumAnalytics** — `parseBattlelog()` returns `BattleInsert[]`. `computeAdvancedAnalytics()` expects `Battle[]`. Both use the same JSONB fields (`my_brawler`, `opponents`, `result`, `mode`, `map`). The only missing field is `id` (auto-generated DB int). Fix: add `id: 0` to each parsed entry, or cast with a typed adapter.

3. **Referral code passing** — `linkTag()` in AuthProvider will read `localStorage.getItem('brawlvalue:ref')` directly after profile insert. No need to change the `linkTag(tag)` signature. The TagRequiredModal's input field is for DISPLAY (auto-filled from localStorage) — the actual application happens server-side via linkTag → apply_referral RPC.

4. **useBattlelog raw entries** — Task 7 MUST run before Task 2/3. The hook currently discards raw entries after processing. Fix: store `items` array in state alongside processed stats.

5. **Battle count for expired trial** — The `/api/battles` endpoint uses `createClient()` (user auth). An expired trial user IS authenticated (has Google login) but NOT premium. The endpoint should return battles the user OWNS (their player_tag). Check: does the endpoint filter by auth user's player_tag? If so, it should work regardless of premium status. Verify during Task 8.

6. **useFreemiumAnalytics test** — Add to Task 2: test that the hook returns valid AdvancedAnalytics shape from sample battlelog entries, and returns null for empty input.

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Analytics page crash (null data) | freemiumAnalytics computed from public data, never null when logged in |
| useBattlelog raw entries unavailable | Task 7 ensures they're exposed before Task 3 needs them |
| Referral RPC fails silently | try/catch with best-effort pattern, doesn't block registration |
| Draft uses counter cheatable (localStorage) | Acceptable for v1 — honest users won't clear localStorage |
| Trial timestamp manipulation | Set by DB trigger, not client-side |
| parseBattlelog → computeAdvanced type mismatch | Adapter adds missing `id: 0` field |
| Battle count API for expired users | Endpoint filters by player_tag from auth, not premium status |
