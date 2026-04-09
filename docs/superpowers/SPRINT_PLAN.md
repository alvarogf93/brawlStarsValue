# BrawlVision Codebase Audit — Sprint Plan (Verified)

**Date:** 2026-04-09
**Safety tag:** `v1.0-pre-audit`
**Audited by:** 7 MAP agents + manual verification against code
**Verification:** Each finding verified against actual source. 3 false positives removed, 5 severities corrected.

---

## Sprint 1: CRITICAL Fixes (2 tasks)

### Task 1.1: Fix PayPal webhook idempotency bypass
- **Status:** [ ]
- **Severity:** CRITICAL (verified: real data integrity risk)
- **Size:** S
- **File:** `src/app/api/webhooks/paypal/route.ts:44-52`
- **What:** If `insertErr` exists but is NOT code `23505`, the webhook continues processing. Any DB error (timeout, RLS) allows duplicate profile upgrades.
- **Fix:** Add `else if (insertErr) return NextResponse.json({ error: 'Database error' }, { status: 500 })` after the 23505 check.
- **Acceptance:** Non-duplicate DB errors return 500, webhook does NOT proceed to update profile.

### Task 1.2: Fix missing i18n keys in 11 locales
- **Status:** [ ]
- **Severity:** CRITICAL (verified: keys used in Header.tsx:251 and stats/page.tsx:232)
- **Size:** S
- **Files:** `messages/{fr,pt,de,it,ru,tr,pl,ar,ko,ja,zh}.json`
- **What:** Add `nav.referral`, `nav.referralCopied`, `stats.exportCsv` using English values.
- **Acceptance:** All 13 locales have identical key counts.

---

## Sprint 2: HIGH Fixes (4 tasks)

### Task 2.1: Fix useMapImages fragile guard + missing AbortController
- **Status:** [ ]
- **Severity:** HIGH (verified: guard prevents loop but architecture is fragile)
- **File:** `src/hooks/useMapImages.ts`
- **What:** Remove `images` from useEffect deps (replace with `[]`). Add AbortController. Replace `.catch(() => {})` with error state.
- **Acceptance:** Effect runs once, fetch aborted on unmount, no silent failures.

### Task 2.2: PayPal unsafe JSON.parse
- **Status:** [ ]
- **Severity:** HIGH (verified: line 195 has no try-catch)
- **File:** `src/lib/paypal.ts:195`
- **What:** Wrap `JSON.parse(params.body)` in try-catch. Return `false` from `verifyWebhookSignature` on parse error.
- **Acceptance:** Malformed body returns false, not crash.

### Task 2.3: ErrorBoundary hardcoded English strings
- **Status:** [ ]
- **Severity:** HIGH (verified: lines 30-39 have "Oops!", "Error 💀", "Reload")
- **Files:** `src/components/ui/ErrorBoundary.tsx`, `src/app/[locale]/profile/[tag]/DashboardLayoutClient.tsx`
- **What:** ErrorBoundary is a class component (can't use hooks). Pass translated fallback from DashboardLayoutClient which has access to useTranslations. The layout already wraps children in `<ErrorBoundary>` — add `fallback` prop with localized content.
- **Acceptance:** Error boundary shows localized text.

### Task 2.4: API input validation (verified subset)
- **Status:** [ ]
- **Severity:** HIGH
- **Files:** `src/app/api/checkout/paypal/route.ts`, `src/app/api/checkout/paypal/confirm/route.ts`
- **What:** Whitelist locale against `routing.locales` array before using in URL construction. This is the only verified HIGH-severity input validation gap.
- **Acceptance:** Invalid locale falls back to 'es'.

---

## Sprint 3: MEDIUM Fixes (5 tasks)

### Task 3.1: Add AbortController to batch hooks
- **Status:** [ ]
- **Severity:** MEDIUM (verified: real but low-impact in practice)
- **Files:** `src/hooks/useClubEnriched.ts:54`, `src/hooks/useClubTrophyChanges.ts:65`
- **What:** Add AbortController parameter to fetch functions, abort on unmount.
- **Acceptance:** Navigating away mid-fetch doesn't cause state update warnings.

### Task 3.2: Standardize hook return shapes
- **Status:** [ ]
- **Severity:** MEDIUM
- **Files:** `src/hooks/useAdvancedAnalytics.ts`, `src/hooks/useProAnalysis.ts`
- **What:** Rename `loading` → `isLoading` for consistency with all other hooks.
- **Acceptance:** All hooks return `{ data, isLoading, error }`.

### Task 3.3: Accessibility fixes
- **Status:** [ ]
- **Severity:** MEDIUM (verified: real a11y gaps)
- **Files:** `src/components/premium/FeatureShowcase.tsx`, `src/components/layout/Header.tsx:195`
- **What:** Add aria-labels to carousel prev/next/dot buttons. Fix avatar `alt=""` to include user name.
- **Acceptance:** No unnamed interactive elements.

### Task 3.4: Hardcoded "Download" string
- **Status:** [ ]
- **Severity:** MEDIUM (verified: battles/page.tsx and share/page.tsx)
- **Files:** `src/app/[locale]/profile/[tag]/battles/page.tsx`, `share/page.tsx`, `messages/*.json`
- **What:** Replace `'Download'` with `t('download')`. Add key to all locales.
- **Acceptance:** Button text localized.

### Task 3.5: PayPal token caching
- **Status:** [ ]
- **Severity:** MEDIUM (verified: `getAccessToken()` called per function, no caching)
- **File:** `src/lib/paypal.ts`
- **What:** Cache access token with TTL from `expires_in` response field.
- **Acceptance:** Only 1 auth API call per webhook instead of multiple.

---

## Sprint 4: LOW Fixes (3 tasks)

### Task 4.1: Remove unused imports + dead code
- **Status:** [ ]
- **Files:** `src/lib/analytics/recommendations.ts` (unused `groupBy`)
- **Acceptance:** tsc passes, ESLint clean.

### Task 4.2: Extract magic numbers
- **Status:** [ ]
- **Files:** `src/lib/analytics/compute.ts`
- **What:** Export `SESSION_GAP_MS`, `TOP_COMFORT_BRAWLERS` as named constants.

### Task 4.3: Patch-level dependency updates
- **Status:** [ ]
- **File:** `package.json`
- **What:** next 16.2.3, react 19.2.5, vitest 4.1.4

---

## Removed from plan (false positives / overrated)

| Original Task | Why Removed |
|---|---|
| auth.ts `.single()` crash | **FALSE POSITIVE** — Supabase v2 `.single()` returns `{ data: null, error }`, does not throw. Code handles null correctly. |
| Timezone ReDoS | **OVERRATED** — Regex has no backtracking, not vulnerable. Invalid TZ is silently ignored (correct behavior). |
| Cron timing-safe comparison | **OVERRATED** — Timing attacks on internal Vercel CRON headers require edge-level access. Theoretical risk, not practical. |
| Query .limit() | **OVERRATED** — Supabase has default 1000 row limit. Explicit limit is nice but not a security issue. |
| PayPal redirect with origin | **OVERRATED** — In Next.js on Vercel, `origin` from `new URL(request.url)` is server-side, not client-controlled. |

---

## Execution

```
Sprint 1 (2 tasks) → tsc + tests → push
Sprint 2 (4 tasks) → tsc + tests → push
Sprint 3 (5 tasks) → tsc + tests → push
Sprint 4 (3 tasks) → tsc + tests → push
```

**Total: 14 verified tasks (down from 18 — 4 removed as false/overrated)**
