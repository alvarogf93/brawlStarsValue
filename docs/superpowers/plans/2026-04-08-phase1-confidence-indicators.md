# Phase 1: Confidence Indicators — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visual confidence indicators (green/yellow/red dots) across all analytics components that display win rates, so users understand when data is statistically reliable vs insufficient.

**Architecture:** Create a reusable `ConfidenceBadge` component that wraps the existing `getConfidence()` function from `types.ts`. Integrate it into every analytics component that shows win rates. Add translations for confidence tooltips in all 13 locales.

**Tech Stack:** React, next-intl, Tailwind CSS, Vitest

**Spec reference:** `docs/superpowers/specs/2026-04-08-counter-pick-meta-design.md` Section 4

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/components/ui/ConfidenceBadge.tsx` | Reusable dot + tooltip component |
| Create | `src/__tests__/unit/components/ConfidenceBadge.test.tsx` | Unit tests for badge rendering |
| Modify | `messages/*.json` (×13) | Add confidence tooltip translations |
| Modify | `src/components/analytics/MatchupMatrix.tsx` | Replace inline `confidenceDot` with shared component |
| Modify | `src/components/analytics/BrawlerMapHeatmap.tsx` | Add confidence badge to win rate entries |
| Modify | `src/components/analytics/TeamSynergyView.tsx` | Add confidence badge to synergy entries |
| Modify | `src/components/analytics/PlayNowDashboard.tsx` | Add confidence badge to recommendations |
| Modify | `src/components/analytics/BrawlerComfortList.tsx` | Add confidence badge to comfort scores |
| Modify | `src/components/analytics/OpponentStrengthCard.tsx` | Add confidence badge to strength tiers |

---

### Task 1: Create ConfidenceBadge Component

**Files:**
- Create: `src/components/ui/ConfidenceBadge.tsx`
- Create: `src/__tests__/unit/components/ConfidenceBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/unit/components/ConfidenceBadge.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      confidenceHigh: 'Dato fiable (10+ partidas)',
      confidenceMedium: 'Dato limitado (3-9 partidas)',
      confidenceLow: 'Dato insuficiente (1-2 partidas)',
    }
    return map[key] ?? key
  },
}))

describe('ConfidenceBadge', () => {
  it('renders green dot for high confidence (≥10 games)', () => {
    const { container } = render(<ConfidenceBadge total={15} />)
    const dot = container.querySelector('[data-confidence="high"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-green-400')
  })

  it('renders yellow dot for medium confidence (3-9 games)', () => {
    const { container } = render(<ConfidenceBadge total={5} />)
    const dot = container.querySelector('[data-confidence="medium"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-amber-400')
  })

  it('renders red dot for low confidence (1-2 games)', () => {
    const { container } = render(<ConfidenceBadge total={1} />)
    const dot = container.querySelector('[data-confidence="low"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-slate-600')
  })

  it('renders nothing for 0 games', () => {
    const { container } = render(<ConfidenceBadge total={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('applies opacity class for low confidence', () => {
    const { container } = render(<ConfidenceBadge total={2} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper?.className).toContain('opacity-50')
  })

  it('does not apply opacity for high confidence', () => {
    const { container } = render(<ConfidenceBadge total={12} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper?.className).not.toContain('opacity-50')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/components/ConfidenceBadge.test.tsx`
Expected: FAIL — module `@/components/ui/ConfidenceBadge` not found

- [ ] **Step 3: Implement ConfidenceBadge**

```typescript
// src/components/ui/ConfidenceBadge.tsx
'use client'

import { useTranslations } from 'next-intl'
import { getConfidence, type Confidence } from '@/lib/analytics/types'

const DOT_COLORS: Record<Confidence, string> = {
  high: 'bg-green-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-600',
}

const TOOLTIP_KEYS: Record<Confidence, string> = {
  high: 'confidenceHigh',
  medium: 'confidenceMedium',
  low: 'confidenceLow',
}

interface Props {
  total: number
  className?: string
}

export function ConfidenceBadge({ total, className = '' }: Props) {
  const t = useTranslations('advancedAnalytics')

  if (total === 0) return null

  const confidence = getConfidence(total)
  const isLow = confidence === 'low'

  return (
    <span
      className={`inline-flex items-center ${isLow ? 'opacity-50' : ''} ${className}`}
      title={t(TOOLTIP_KEYS[confidence])}
    >
      <span
        data-confidence={confidence}
        className={`w-2 h-2 rounded-full ${DOT_COLORS[confidence]} inline-block shrink-0`}
      />
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/components/ConfidenceBadge.test.tsx`
Expected: ALL PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ConfidenceBadge.tsx src/__tests__/unit/components/ConfidenceBadge.test.tsx
git commit -m "feat: add ConfidenceBadge component with tests

Reusable green/yellow/red dot indicating statistical confidence.
High (≥10 games), Medium (3-9), Low (1-2), hidden for 0."
```

---

### Task 2: Add Confidence Translations to All 13 Locales

**Files:**
- Modify: `messages/*.json` (×13 files)

- [ ] **Step 1: Add translations via script**

```bash
node -e "
const fs = require('fs');
const translations = {
  es: { confidenceHigh: 'Dato fiable (10+ partidas)', confidenceMedium: 'Dato limitado (3-9 partidas)', confidenceLow: 'Dato insuficiente (1-2 partidas)' },
  en: { confidenceHigh: 'Reliable data (10+ matches)', confidenceMedium: 'Limited data (3-9 matches)', confidenceLow: 'Insufficient data (1-2 matches)' },
  fr: { confidenceHigh: 'Donnée fiable (10+ matchs)', confidenceMedium: 'Donnée limitée (3-9 matchs)', confidenceLow: 'Donnée insuffisante (1-2 matchs)' },
  pt: { confidenceHigh: 'Dado confiável (10+ partidas)', confidenceMedium: 'Dado limitado (3-9 partidas)', confidenceLow: 'Dado insuficiente (1-2 partidas)' },
  de: { confidenceHigh: 'Zuverlässig (10+ Spiele)', confidenceMedium: 'Begrenzt (3-9 Spiele)', confidenceLow: 'Unzureichend (1-2 Spiele)' },
  it: { confidenceHigh: 'Dato affidabile (10+ partite)', confidenceMedium: 'Dato limitato (3-9 partite)', confidenceLow: 'Dato insufficiente (1-2 partite)' },
  ru: { confidenceHigh: 'Надёжные данные (10+ матчей)', confidenceMedium: 'Ограниченные данные (3-9 матчей)', confidenceLow: 'Недостаточно данных (1-2 матча)' },
  tr: { confidenceHigh: 'Güvenilir veri (10+ maç)', confidenceMedium: 'Sınırlı veri (3-9 maç)', confidenceLow: 'Yetersiz veri (1-2 maç)' },
  pl: { confidenceHigh: 'Wiarygodne dane (10+ meczów)', confidenceMedium: 'Ograniczone dane (3-9 meczów)', confidenceLow: 'Niewystarczające dane (1-2 mecze)' },
  ar: { confidenceHigh: 'بيانات موثوقة (10+ مباريات)', confidenceMedium: 'بيانات محدودة (3-9 مباريات)', confidenceLow: 'بيانات غير كافية (1-2 مباراة)' },
  ko: { confidenceHigh: '신뢰할 수 있는 데이터 (10+ 경기)', confidenceMedium: '제한된 데이터 (3-9 ���기)', confidenceLow: '부족한 데이터 (1-2 경기)' },
  ja: { confidenceHigh: '信頼できるデータ (10+試合)', confidenceMedium: '限定データ (3-9試合)', confidenceLow: '不十分なデータ (1-2試合)' },
  zh: { confidenceHigh: '可靠数据 (10+场)', confidenceMedium: '有限数据 (3-9场)', confidenceLow: '数据不足 (1-2场)' },
};
for (const [locale, texts] of Object.entries(translations)) {
  const path = 'messages/' + locale + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  Object.assign(data.advancedAnalytics, texts);
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log('Updated ' + locale);
}
"
```

- [ ] **Step 2: Verify a locale has the new keys**

Run: `node -e "const d=JSON.parse(require('fs').readFileSync('messages/es.json','utf8')); console.log(d.advancedAnalytics.confidenceHigh, d.advancedAnalytics.confidenceMedium, d.advancedAnalytics.confidenceLow)"`
Expected: `Dato fiable (10+ partidas) Dato limitado (3-9 partidas) Dato insuficiente (1-2 partidas)`

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "i18n: add confidence indicator translations for all 13 locales"
```

---

### Task 3: Integrate into MatchupMatrix (Replace Inline Implementation)

**Files:**
- Modify: `src/components/analytics/MatchupMatrix.tsx`

- [ ] **Step 1: Replace inline `confidenceDot` and `confidenceOpacity` with ConfidenceBadge**

In `src/components/analytics/MatchupMatrix.tsx`:

1. Add import at top:
```typescript
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

2. Remove the inline `confidenceDot()` function (lines 28-37) and `confidenceOpacity()` function (lines 39-41).

3. Find all usages of `confidenceDot(d.confidence)` and `confidenceOpacity(d.confidence)` in the JSX and replace with `<ConfidenceBadge total={d.total} />`. The ConfidenceBadge handles both the dot color and the opacity internally.

Specifically, each matchup row that currently shows:
```tsx
<span className={`w-2 h-2 rounded-full ${confidenceDot(d.confidence)}`} />
```
Replace with:
```tsx
<ConfidenceBadge total={d.total} />
```

And wrapper elements with `className={confidenceOpacity(d.confidence)}` should use `className={d.total < 3 ? 'opacity-50' : ''}` since ConfidenceBadge handles its own opacity but the row text might also need it.

- [ ] **Step 2: Run build to verify no errors**

Run: `npx next build 2>&1 | grep -iE "(error|fail)" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/MatchupMatrix.tsx
git commit -m "refactor: replace MatchupMatrix inline confidence dots with ConfidenceBadge"
```

---

### Task 4: Integrate into BrawlerMapHeatmap

**Files:**
- Modify: `src/components/analytics/BrawlerMapHeatmap.tsx`

- [ ] **Step 1: Add ConfidenceBadge to heatmap entries**

In `src/components/analytics/BrawlerMapHeatmap.tsx`:

1. Add import:
```typescript
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

2. In each heatmap entry row where win rate is displayed, add `<ConfidenceBadge total={entry.total} className="ml-1" />` next to the win rate text.

- [ ] **Step 2: Run build to verify no errors**

Run: `npx next build 2>&1 | grep -iE "(error|fail)" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/BrawlerMapHeatmap.tsx
git commit -m "feat: add confidence indicators to BrawlerMapHeatmap"
```

---

### Task 5: Integrate into TeamSynergyView

**Files:**
- Modify: `src/components/analytics/TeamSynergyView.tsx`

- [ ] **Step 1: Add ConfidenceBadge to synergy entries**

In `src/components/analytics/TeamSynergyView.tsx`:

1. Add import:
```typescript
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

2. In each synergy entry where win rate is displayed alongside game count, add `<ConfidenceBadge total={entry.total} className="ml-1" />` next to the win rate.

- [ ] **Step 2: Run build to verify no errors**

Run: `npx next build 2>&1 | grep -iE "(error|fail)" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/TeamSynergyView.tsx
git commit -m "feat: add confidence indicators to TeamSynergyView"
```

---

### Task 6: Integrate into PlayNowDashboard

**Files:**
- Modify: `src/components/analytics/PlayNowDashboard.tsx`

- [ ] **Step 1: Add ConfidenceBadge to recommendation entries**

In `src/components/analytics/PlayNowDashboard.tsx`:

1. Add import:
```typescript
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

2. In each recommendation brawler entry, add `<ConfidenceBadge total={rec.gamesPlayed} className="ml-1" />` next to the win rate display.

- [ ] **Step 2: Run build to verify no errors**

Run: `npx next build 2>&1 | grep -iE "(error|fail)" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/PlayNowDashboard.tsx
git commit -m "feat: add confidence indicators to PlayNowDashboard"
```

---

### Task 7: Integrate into BrawlerComfortList and OpponentStrengthCard

**Files:**
- Modify: `src/components/analytics/BrawlerComfortList.tsx`
- Modify: `src/components/analytics/OpponentStrengthCard.tsx`

- [ ] **Step 1: Add ConfidenceBadge to BrawlerComfortList**

In `src/components/analytics/BrawlerComfortList.tsx`:

1. Add import:
```typescript
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

2. Each comfort entry has a `total` field. Add `<ConfidenceBadge total={entry.total} className="ml-1" />` next to the comfort score or win rate display.

- [ ] **Step 2: Add ConfidenceBadge to OpponentStrengthCard**

In `src/components/analytics/OpponentStrengthCard.tsx`:

1. Add import:
```typescript
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'
```

2. Each strength tier (weak/even/strong) has a game count. Add `<ConfidenceBadge total={tier.total} className="ml-1" />` next to the win rate.

- [ ] **Step 3: Run build to verify no errors**

Run: `npx next build 2>&1 | grep -iE "(error|fail)" | head -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/analytics/BrawlerComfortList.tsx src/components/analytics/OpponentStrengthCard.tsx
git commit -m "feat: add confidence indicators to BrawlerComfortList and OpponentStrengthCard"
```

---

### Task 8: Run Full Test Suite and Build Verification

- [ ] **Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run full build**

Run: `npx next build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Final commit if any fixes needed**

If tests or build revealed issues, fix them and commit:
```bash
git add -A
git commit -m "fix: resolve Phase 1 review issues"
```
