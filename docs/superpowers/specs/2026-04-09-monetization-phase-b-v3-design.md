# Phase B v3: Monetization — Subscribe Page, Trial, Referrals

> **Supersedes**: blur-related sections of `2026-04-08-monetization-phase-b-design.md` (v2).
> Trial, referral, and security sections remain valid from v2.

## Goal

Convert visitors into premium subscribers through: dedicated subscribe page with personalized hooks, risk-free 3-day trial on tag linking, and viral referral system. Architectural split replaces the previous blur approach for cleaner separation of concerns.

---

## Architecture: Page Split

Two separate pages instead of one multi-view page.

### `/profile/[tag]/analytics` — Premium Dashboard

- **Access**: Only `isPremium()` users (subscription OR active trial)
- **Non-premium redirect**: If `!isPremium()`, redirect to `/profile/[tag]/subscribe`
- **Content**: Full 6-tab analytics dashboard (overview, performance, matchups, team, trends, draft)
- **Trial users**: See full dashboard + `TrialBanner` with countdown + CTA button linking to `/subscribe`
- **Premium users**: Clean dashboard, no banners, no CTAs
- **Trial + premium cancelled**: `TrialBanner` shows appropriate state

This page becomes dramatically simpler — ONE view, ONE responsibility. The current binary/ternary conditional logic is replaced by a single redirect guard.

### `/profile/[tag]/subscribe` — Subscription Sales Page

- **Access**: Anyone (logged in or not)
- **Purpose**: Convert visitors to subscribers
- **Sections (top to bottom)**:
  1. **Header**: Title + subtitle explaining premium analytics
  2. **Free Preview Stats**: Grid showing win rate, W/L record, favorite brawler, trophy change from 25 public battles. Personalizes the page and demonstrates data availability.
  3. **PersonalizedHook**: ONE personalized metric computed from 25 public battles (freeStats). Visible, not blurred. Shows a compelling data point specific to the player's profile. Player trophies fetched via `/api/calculate` for the `competitive` segment.
  4. **FeatureShowcase**: 2-3 static screenshots/mockups of the premium dashboard showing rich, real analytics data (not the user's sparse 25-battle data). Captions explain each feature.
  5. **UpgradeCard**: 3 pricing tiers (Monthly, Quarterly, Yearly) with PayPal checkout. Already exists as component.
  6. **ReferralCard**: Referral code display + share button. Already exists.
  7. **Auth prompt**: If not logged in, show sign-in CTA with AuthModal.
- **If user is already premium**: Redirect to `/profile/[tag]/analytics`
- **If user has expired trial**: Show `TrialBanner` (expired state) at top, then normal subscribe content

### Navigation Changes

- Sidebar "Analytics" link → always points to `/profile/[tag]/analytics` (redirect handles the rest)
- Header "Upgrade" button → points to `/profile/[tag]/subscribe` directly (skip the redirect)
- PremiumGate blur overlay click → No longer exists in analytics page. If used elsewhere, navigate to `/subscribe`
- Landing page CTAs → Redirect to subscribe page after auth

---

## PersonalizedHook (Simplified)

### How it works

Uses data already available from `useBattlelog` hook (freeStats) — NO `computeAdvancedAnalytics` needed.

`detectSegment()` still runs on parsed battle data to detect the player segment. Then hook messages use simple data from `freeStats`:

| Segment | Detection | Hook Message | Data Source |
|---------|-----------|-------------|-------------|
| tilt | 3+ consecutive losses | "Estás en tilt y no lo sabías" | detectSegment (from parsed battles) |
| main | 60%+ games with same brawler | "Juegas {brawler} en el {pct}% de tus partidas" | freeStats.mostPlayedBrawler + compute pct from battles |
| competitive | >25K trophies | "Con {trophies}+ trofeos, descubre tus matchups" | Player trophies fetched via `/api/calculate` (POST with playerTag) |
| explorer | 3+ different modes | "Juegas {count} modos — descubre dónde dominas" | freeStats.modeWinRates.length |
| streak | 3+ consecutive wins | "Llevas racha — como Star Player ganas un {pct}%" | freeStats.starPlayerPct |
| default | No clear signal | "Descubre tus estadísticas avanzadas" | Generic fallback |

### detectSegment stays the same

The function from the v2 plan remains: `detectSegment(battles: Pick<BattleInsert, 'result' | 'my_brawler' | 'mode'>[], trophies): PlayerSegment`. Called after `parseBattlelog()` converts raw `BattlelogEntry[]` to `BattleInsert[]`.

### What was eliminated

- `useFreemiumAnalytics` hook — no longer needed
- `computeAdvancedAnalytics` on 25 battles — no longer needed
- `BattleInsert → Battle` adapter hack — eliminated
- AdvancedAnalytics dependency in PersonalizedHook — eliminated
- Minimum threshold / fallback chain for sparse analytics — no longer applicable (freeStats always has data)

---

## Draft Counter — Removed

In v2, the DraftSimulator had 3 free uses for non-premium users. With the page split, free users never see the DraftSimulator (it lives in `/analytics` which redirects non-premium users). The draft counter is removed. Draft is premium-only.

---

## FeatureShowcase Component

New component for the subscribe page. Shows static preview images of the premium dashboard.

- 2-3 screenshots of the real premium dashboard with rich data (taken from a demo/test account with hundreds of battles)
- Each screenshot has a caption explaining the feature
- Images stored in `/public/assets/premium-previews/`
- Responsive: full width on mobile, side-by-side on desktop
- Suggested screenshots:
  1. Overview tab showing TiltDetector + ClutchCard + WarmUpCard
  2. Performance tab showing BrawlerMapHeatmap (dense, colorful)
  3. Matchups tab showing MatchupMatrix (many entries)

---

## Trial (unchanged from v2 spec)

See `docs/superpowers/specs/2026-04-08-monetization-phase-b-design.md` sections 2, 6, 7 for trial activation, security, UX details. Key points:

- Trial activates on `linkTag()` via DB trigger (3 days)
- `isPremium()` returns true during active trial
- TrialBanner shows countdown, CTA button → `/subscribe`
- Celebration modal with confetti on first trial visit
- Post-trial: expired banner with battle count

---

## Referral System (unchanged from v2 spec)

See v2 spec sections 3, 4, 6. Key points:

- Code format: `BV-XXXXX`, generated on profile creation
- `apply_referral()` RPC: atomic, both parties +3 days, max 5
- RefCapture on landing page captures `?ref=` param
- TagRequiredModal syncs referral code to localStorage before linkTag
- Referrer notification toast via referral_count + localStorage

---

## Database (unchanged from v2 spec)

- Migration 006: trial_ends_at, referral_code, referred_by, referral_count
- Migration 007: protect_trial_fields trigger (security)

---

## Testing Strategy

### Test User States

6 states to test, managed via SQL scripts against the test Supabase project:

| # | State | How to Set | What to Verify |
|---|-------|-----------|---------------|
| 1 | Anonymous | Use incognito / no auth | `/analytics` → redirect to `/subscribe`. Subscribe page shows auth CTA. |
| 2 | Free, logged in | `tier='free', trial_ends_at=NULL, ls_subscription_status=NULL` | `/analytics` → redirect to `/subscribe`. Subscribe page shows PersonalizedHook + pricing. |
| 3 | Trial active | `tier='free', trial_ends_at=NOW()+3days` | `/analytics` → full dashboard + TrialBanner with countdown + CTA → `/subscribe`. |
| 4 | Trial expired | `tier='free', trial_ends_at=NOW()-1day` | `/analytics` → redirect to `/subscribe`. Subscribe shows expired banner + battle count + pricing. |
| 5 | Premium active | `tier='premium', ls_subscription_status='active'` | `/analytics` → full dashboard, no banners. `/subscribe` → redirect to `/analytics`. |
| 6 | Premium cancelled | `tier='premium', ls_subscription_status='cancelled'` | `/analytics` → full dashboard (grace period). |

### SQL Setup Script

```sql
-- Test user setup (run against test Supabase project)
-- Replace {USER_ID} with actual test user UUID from Supabase Auth

-- State 2: Free, logged in
UPDATE profiles SET tier='free', trial_ends_at=NULL, ls_subscription_status=NULL, ls_subscription_id=NULL WHERE id='{USER_ID}';

-- State 3: Trial active
UPDATE profiles SET tier='free', trial_ends_at=NOW() + INTERVAL '3 days', ls_subscription_status=NULL WHERE id='{USER_ID}';

-- State 4: Trial expired
UPDATE profiles SET tier='free', trial_ends_at=NOW() - INTERVAL '1 day', ls_subscription_status=NULL WHERE id='{USER_ID}';

-- State 5: Premium active
UPDATE profiles SET tier='premium', ls_subscription_status='active', ls_subscription_id='test-sub-001' WHERE id='{USER_ID}';

-- State 6: Premium cancelled
UPDATE profiles SET tier='premium', ls_subscription_status='cancelled', ls_subscription_id='test-sub-001' WHERE id='{USER_ID}';

-- REVERT: Back to free
UPDATE profiles SET tier='free', trial_ends_at=NULL, ls_subscription_status=NULL, ls_subscription_id=NULL, ls_customer_id=NULL WHERE id='{USER_ID}';
```

**Important:** These UPDATE statements will be blocked by the `protect_trial_fields` trigger (migration 007) for non-service_role users. Run them via the Supabase Dashboard SQL editor (which uses service_role) or via `supabase db` CLI.

### Automated Tests

| Test | Type | What it validates |
|------|------|-------------------|
| `detectSegment` with all 6 signals | Unit (Vitest) | Correct segment for each player profile |
| `isPremium` / `isOnTrial` / `isTrialExpired` | Unit | All state transitions covered |
| Subscribe page renders for non-premium | Component | Shows PersonalizedHook + UpgradeCard + ReferralCard |
| Subscribe page redirects premium users | Component | Premium user → redirect to analytics |
| Analytics page redirects non-premium | Component | Free user → redirect to subscribe |
| Analytics page renders for premium | Component | Full dashboard, all 6 tabs |
| `apply_referral` RPC valid code | Integration | Both profiles updated atomically |
| `apply_referral` RPC invalid code | Integration | Returns error, no changes |
| `apply_referral` RPC maxed referrer (5) | Integration | New user gets bonus, referrer doesn't |
| Referral code format | Unit | Matches BV-XXXXX pattern |
| Trial countdown format | Unit | Correct format for >1day, <1day, <1hour |
| TrialBanner expired shows battle count | Component | Fetches and displays count |

---

## Translation Keys

### New namespace `subscribe` (for the subscribe page)

- `title`: "Premium Analytics"
- `subtitle`: "Desbloquea el poder del análisis avanzado"
- `previewCaption1`: "Detecta tu tilt y mejora tu juego"
- `previewCaption2`: "Analiza tu rendimiento por brawler y mapa"
- `previewCaption3`: "Descubre tus matchups y contrarresta"
- `trialCta`: "Prueba 3 días gratis"
- `trialCtaBody`: "Vincula tu tag y accede a todas las analytics"

### New keys in `premium` namespace

- `hookCompetitive`: "Con {trophies}+ trofeos, descubre tus matchups"
- `hookExplorer`: "Juegas {count} modos — descubre dónde dominas"

### Existing `premium` namespace (from v2, still valid)

All trial, referral, hook, and blur-unlock keys remain. The `blurUnlock` key is repurposed as subtitle for PersonalizedHook CTA.

---

## Modified/New Files Summary

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/[locale]/profile/[tag]/subscribe/page.tsx` | Subscribe sales page |
| Create | `src/lib/analytics/detect-segment.ts` | Detect player segment from battlelog |
| Create | `src/components/premium/PersonalizedHook.tsx` | Personalized visible hook metric (simplified) |
| Create | `src/components/premium/FeatureShowcase.tsx` | Static screenshots of premium dashboard |
| Create | `src/__tests__/unit/lib/analytics-detect-segment.test.ts` | Tests for segment detection |
| Create | `supabase/migrations/007_protect_trial_fields.sql` | Security trigger |
| Modify | `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Simplify: redirect guard + clean dashboard |
| Modify | `src/components/auth/AuthProvider.tsx` | apply_referral RPC + referrer notification |
| Modify | `src/components/auth/TagRequiredModal.tsx` | Sync referral code to localStorage |
| Modify | `src/components/premium/TrialBanner.tsx` | CTA → /subscribe + battle count on expired |
| Modify | `src/components/layout/Header.tsx` | Upgrade link → /subscribe + referral code |

---

## What This Spec Does NOT Cover

- Logo rebrand (tracked separately)
- Trial data cleanup cron (deferred to Phase C)
- PlayNowDashboard for non-premium users (removed with blur)
- Draft free uses for non-premium (removed — draft is premium-only)
