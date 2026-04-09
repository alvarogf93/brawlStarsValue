# Phase B: Monetization — Freemium Blur, Trial, Referrals

## Goal

Convert more visitors into premium subscribers through three complementary mechanics: visual FOMO (freemium blur), risk-free trial (3 days), and viral growth (referral system).

## Architecture Overview

Three independent features that share the profile tier system:

1. **Freemium Blur** — Analytics computed from 25 public battles, shown with blur overlay. One personalized metric visible as hook.
2. **Trial 3 días** — Premium access activated on tag linking. Countdown visible. Clean cut on expiry.
3. **Referidos** — Unique code per user. Both parties get 3 days. Max 5 referrals (15 days).

---

## 1. Freemium Blur

### How it works

When a non-premium user visits Analytics:

**Always visible (no blur):**
- Overview stats (win rate, W/L record, streaks, trophy change, star player rate)
- "Vista rápida" section with personalized hook metric

**Personalized hook metric** — detected from 25 public battles:

| Signal | Metric shown | Hook message |
|--------|-------------|-------------|
| 3+ consecutive losses | Tilt Detector | "Estás en tilt y no lo sabías" |
| 60%+ games with same brawler | Brawler Mastery | "Tu curva de mejora con {name}" |
| >25K trophies | Worst Matchup | "Pierdes el 73% contra {name}" |
| Plays 3+ modes | Best Map | "En {map} dominas al 68%" |
| Win streak active | Clutch Stats | "Como Star Player ganas un 82%" |
| Default | Tilt Detector | Universal — everyone tilts |

Detection is **client-side** using data from `useBattlelog` hook (public battlelog, no auth needed).

**Blurred (with real data from 25 battles):**
- Performance tab (Heatmap, TimeOfDay, Weekly, PowerLevel, Comfort)
- Matchups tab (Matrix, OpponentStrength)
- Team tab (Synergy, Carry)
- Trends tab (Daily, Mastery, Efficiency, Recovery)
- Draft tab (3 free uses, then blur)

### Blur implementation

```tsx
<PremiumGate blur>
  <TiltDetector data={analyticsFromBattlelog} />
</PremiumGate>
```

`PremiumGate` component:
- If premium: renders children normally
- If not premium: renders children with `filter: blur(8px)` + absolute overlay with lock icon + "PRO" text + click → navigate to subscription page
- Children receive real data computed from 25 public battles (client-side)
- No security concern — data is from public API

### Analytics from public battlelog

Create a new function `computeLimitedAnalytics(battles)` that takes the 25 public battles and computes the same analytics as the premium version. The difference is sample size (25 vs hundreds). The blur makes the limited data tantalizing but unreadable.

### Draft — 3 free uses

- Counter tracked in localStorage: `brawlvalue:draft-uses`
- Increment on each draft COMPLETE (not on start)
- After 3 uses: Draft tab shows blur with "Has usado tus 3 drafts gratuitos"
- Reset: never (permanent for that browser)

### Click on blur behavior

Any click on a blurred area navigates to the subscription/upgrade section of the analytics page (scrolls to UpgradeCard).

---

## 2. Trial 3 Days

### Activation

Triggered automatically when a new user links their player tag via `linkTag()` in AuthProvider.

**Flow:**
1. User signs in with Google
2. TagRequiredModal appears
3. User enters their player tag → `linkTag()` creates profile
4. Profile created with `trial_ends_at = NOW() + 3 days`
5. User sees: "🎉 ¡3 días de PRO gratis! Tus batallas se guardan desde ahora."
6. `isPremium()` updated to also return true if `trial_ends_at > NOW()`

### During trial

- Full premium access (all analytics, unlimited draft, battle sync)
- Subtle countdown banner at top of analytics page:
  `"⏱ Trial PRO: 2d 14h restantes — Suscríbete para no perder tus batallas →"`
- Banner links to subscription section
- User CAN subscribe during trial (trial_ends_at becomes irrelevant once subscribed)

### Trial expiry

- Clean cut: `isPremium()` returns false when `trial_ends_at < NOW()`
- Battles stop syncing (cron skips non-premium users)
- Existing battles in DB are NOT deleted immediately (retention per spec: 1-2 years for premium users, but trial users... 30 days grace? Then cleanup)
- Post-trial message on analytics page: "Tu trial terminó. Tienes {X} batallas guardadas que se perderán en {Y} días. Suscríbete para conservarlas."

### Trial + Referral stacking

If a user has both trial AND referral bonus, they stack:
- `trial_ends_at` is extended by referral days
- Example: register + get referred = 3 + 3 = 6 days

### isPremium update

```typescript
export function isPremium(profile: Profile | null): boolean {
  if (!profile) return false
  // Active subscription
  if (profile.tier !== 'free') {
    const status = profile.ls_subscription_status
    if (status === 'active' || status === 'cancelled') return true
  }
  // Active trial
  if (profile.trial_ends_at) {
    if (new Date(profile.trial_ends_at) > new Date()) return true
  }
  return false
}
```

---

## 3. Referral System

### Code generation

- Generated on profile creation in `linkTag()`
- Format: `BV-{5 chars alphanumeric}` (e.g., `BV-A3X9K`)
- Stored in `profiles.referral_code`
- Unique constraint in database

### Referral flow

1. **Existing user** shares their code (visible in profile dropdown menu or analytics page)
2. **New user** enters code during registration (field in TagRequiredModal: "¿Tienes código de invitación?")
3. On successful tag linking with referral code:
   - New user: `trial_ends_at += 3 days` (stacks with default trial)
   - Referrer: `trial_ends_at += 3 days` (or extends current premium by 3 days)
   - Referrer: `referral_count += 1`
4. If referrer has `referral_count >= 5`: code still works for new user but referrer gets no bonus

### Referral link

`https://brawlvision.com/{locale}?ref=BV-A3X9K`

When landing page detects `?ref=` param, stores in localStorage. Applied automatically during registration.

### Limits

- Max 5 successful referrals per user
- Each referral gives 3 days to both parties
- Max accumulated bonus: 15 days

---

## 4. Database Changes

```sql
-- Add trial and referral fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_count INT NOT NULL DEFAULT 0;
```

Update `Profile` TypeScript interface accordingly.

---

## 5. New Components

| Component | Purpose |
|-----------|---------|
| `PremiumGate` | Wrapper: blur + overlay for non-premium content |
| `TrialBanner` | Countdown banner shown during active trial |
| `ReferralCard` | Shows referral code + share button + count |

## 6. Security

### Trial timestamp must be server-side

`trial_ends_at` MUST be set by a database trigger or RPC function, never from the client. If set client-side, users could manipulate the timestamp.

```sql
-- Trigger: auto-set trial on new profile insert
CREATE OR REPLACE FUNCTION set_trial_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '3 days';
  END IF;
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'BV-' || upper(substr(md5(random()::text), 1, 5));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_profile_trial
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_trial_on_insert();
```

### Referral application must be atomic

When a referral code is used, both profiles must be updated in a single transaction:

```sql
CREATE OR REPLACE FUNCTION apply_referral(
  p_new_user_id UUID,
  p_referral_code TEXT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_count INT;
BEGIN
  -- Find referrer
  SELECT id, referral_count INTO v_referrer_id, v_referrer_count
  FROM profiles WHERE referral_code = p_referral_code;
  
  IF v_referrer_id IS NULL THEN
    RETURN '{"ok": false, "error": "invalid_code"}'::jsonb;
  END IF;
  
  -- Update new user: set referred_by, extend trial by 3 days
  UPDATE profiles
  SET referred_by = p_referral_code,
      trial_ends_at = COALESCE(trial_ends_at, NOW()) + INTERVAL '3 days'
  WHERE id = p_new_user_id AND referred_by IS NULL;
  
  -- Update referrer: extend trial, increment count (only if < 5)
  IF v_referrer_count < 5 THEN
    UPDATE profiles
    SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + INTERVAL '3 days',
        referral_count = referral_count + 1
    WHERE id = v_referrer_id;
  END IF;
  
  RETURN '{"ok": true}'::jsonb;
END;
$$;
```

### Referral code collision handling

Code generated by trigger using `md5(random())`. If unique constraint fails on insert, the trigger retries are not automatic — handle in the `linkTag()` function by catching the error and retrying the insert once.

## 7. UX Details

### Trial welcome

On successful `linkTag()` with trial activated:
- **Celebration modal**: confetti + "🎉 ¡3 días de PRO gratis!" + "Tus batallas se guardan desde ahora" + dismiss button
- Modal appears ONCE (tracked in localStorage)

### Referral code location

- **Header avatar dropdown** → new item "Invitar amigo 🎁" → shows code + copy button
- **Analytics page** → below UpgradeCard for premium users → ReferralCard component

### Referrer notification

When someone uses a referral code:
- Telegram notification to admin (fire-and-forget)
- Next time referrer loads app: toast "¡Tu amigo {tag} se unió! +3 días PRO 🎉"
- Toast tracked in profile field or localStorage to show only once

### Post-trial message

Shown at top of analytics page when trial expired and user is not subscribed:
- "Tu trial terminó. Tienes {X} batallas guardadas. Suscríbete en los próximos {Y} días para conservarlas."
- Countdown of grace period (30 days)
- Prominent "Suscribirme ahora" button

## 8. Modified Files

| File | Change |
|------|--------|
| `src/lib/premium.ts` | Add trial check to `isPremium()` |
| `src/components/auth/AuthProvider.tsx` | Set `trial_ends_at` on `linkTag()` |
| `src/components/auth/TagRequiredModal.tsx` | Add optional referral code field |
| `src/app/[locale]/profile/[tag]/analytics/page.tsx` | Implement blur gate, personalized hook, trial banner |
| `src/hooks/useBattlelog.ts` | Expose computed analytics from 25 battles |
| `src/lib/supabase/types.ts` | Add trial/referral fields to Profile |
| `src/app/[locale]/page.tsx` | Capture `?ref=` param to localStorage |

## 7. Trial data retention

- Trial users' battles: kept 30 days after trial expiry
- If user subscribes within 30 days: battles preserved, full access restored
- After 30 days without subscription: battles cleaned up by cron
- Premium users: 1-2 years retention (existing policy)

## 8. Countdown timer format

`"⏱ Trial PRO: {days}d {hours}h restantes"` when > 1 day
`"⏱ Trial PRO: {hours}h {minutes}m restantes"` when < 1 day
`"⏱ Trial PRO: última hora!"` when < 1 hour (red, pulsing)

## 12. Testing Requirements

| Test | Type | What it validates |
|------|------|-------------------|
| `isPremium()` with trial active | Unit | Returns true when trial_ends_at > now |
| `isPremium()` with trial expired | Unit | Returns false when trial_ends_at < now |
| `isPremium()` with trial + subscription | Unit | Returns true (subscription takes priority) |
| Player profile detection (tilt/competitive/casual) | Unit | Correct hook metric selected for each segment |
| PremiumGate renders blur for non-premium | Component | Blur overlay visible, click navigates to upgrade |
| PremiumGate renders normally for premium | Component | No blur, children render directly |
| Referral code format | Unit | Matches BV-XXXXX pattern |
| apply_referral RPC with valid code | Integration | Both profiles updated, counts incremented |
| apply_referral RPC with invalid code | Integration | Returns error, no profiles changed |
| apply_referral RPC with maxed referrer (5) | Integration | New user gets bonus, referrer does not |
| Draft use counter | Unit | Increments on COMPLETE, blocks after 3 |
| Trial countdown format | Unit | Correct format for >1day, <1day, <1hour |

## 13. Translation Keys Needed

**Namespace `premium`:**
- `trialWelcome`: "¡3 días de PRO gratis!"
- `trialWelcomeBody`: "Tus batallas se guardan desde ahora. Aprovecha al máximo."
- `trialBanner`: "Trial PRO: {time} restantes"
- `trialBannerUrgent`: "Trial PRO: ¡última hora!"
- `trialBannerSubscribe`: "Suscríbete para no perder tus batallas"
- `trialExpired`: "Tu trial terminó"
- `trialExpiredBody`: "Tienes {battles} batallas guardadas. Suscríbete en los próximos {days} días para conservarlas."
- `draftUsesLeft`: "{count} drafts gratuitos restantes"
- `draftUsesExhausted`: "Has usado tus 3 drafts gratuitos"
- `referralTitle`: "Invitar amigo"
- `referralBody`: "Comparte tu código y ambos ganáis 3 días PRO"
- `referralCopied`: "¡Código copiado!"
- `referralCount`: "{count}/5 invitaciones usadas"
- `referralCodeInvalid`: "Código de invitación no válido"
- `referralCodePlaceholder`: "¿Tienes código de invitación? (opcional)"
- `referralSuccess`: "¡Tu amigo se unió! +3 días PRO"
- `blurUnlock`: "Desbloquea con PRO"
- `hookTilt`: "Estás en tilt y no lo sabías"
- `hookMastery`: "Tu curva de mejora con {name}"
- `hookMatchup`: "Pierdes el {wr}% contra {name}"
- `hookMap`: "En {map} dominas al {wr}%"
- `hookClutch`: "Como Star Player ganas un {wr}%"

All keys translated to 13 locales.
