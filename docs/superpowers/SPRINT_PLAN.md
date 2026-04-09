# BrawlVision Codebase Audit — Sprint Plan

**Date:** 2026-04-09
**Safety tag:** `v1.0-pre-audit`
**Audited by:** 7 parallel MAP agents + manual synthesis

---

## Sprint 1: CRITICAL Fixes (Data Loss / Crash Prevention)

### Task 1.1: Fix useMapImages infinite loop + AbortController
- **Status:** [ ]
- **Severity:** CRITICAL
- **Size:** S (1 file)
- **Files:** `src/hooks/useMapImages.ts`
- **What:** Remove `images` from useEffect dependency array (causes infinite re-render loop). Add AbortController with cleanup. Add error state instead of silent `.catch(() => {})`.
- **Acceptance:** No infinite renders, fetch aborted on unmount, error state exposed.

### Task 1.2: Add AbortController to useClubEnriched + useClubTrophyChanges
- **Status:** [ ]
- **Severity:** CRITICAL
- **Size:** S (2 files)
- **Files:** `src/hooks/useClubEnriched.ts`, `src/hooks/useClubTrophyChanges.ts`
- **What:** Add AbortController to `fetchMemberData()` and `fetchTrophyChange()` async functions. Abort on unmount/re-render.
- **Acceptance:** No memory leaks on rapid navigation, fetch cleanup on unmount.

### Task 1.3: Fix PayPal webhook idempotency bypass
- **Status:** [ ]
- **Severity:** CRITICAL
- **Size:** S (1 file)
- **Files:** `src/app/api/webhooks/paypal/route.ts`
- **What:** Line 45-51: if `insertErr` is NOT code 23505, return 500 instead of continuing. Currently only checks for duplicate constraint — any other DB error lets webhook proceed.
- **Acceptance:** Non-duplicate DB errors return 500, don't update profile.

### Task 1.4: Fix PayPal unsafe JSON.parse
- **Status:** [ ]
- **Severity:** CRITICAL
- **Size:** S (1 file)
- **Files:** `src/lib/paypal.ts`
- **What:** Line 195: wrap `JSON.parse(params.body)` in try-catch. Return meaningful error if body is malformed.
- **Acceptance:** Malformed webhook body returns error, not crash.

### Task 1.5: Add missing i18n keys to 11 locales
- **Status:** [ ]
- **Severity:** CRITICAL
- **Size:** S (11 files)
- **Files:** `messages/{fr,pt,de,it,ru,tr,pl,ar,ko,ja,zh}.json`
- **What:** Add `nav.referral`, `nav.referralCopied`, `stats.exportCsv` keys (use English values as placeholder).
- **Acceptance:** All 13 locales have identical key counts. `node -e` validation script passes.

---

## Sprint 2: HIGH Severity (Security + Error Handling)

### Task 2.1: API input validation hardening
- **Status:** [ ]
- **Severity:** HIGH
- **Size:** M (5 files)
- **Files:** `src/app/api/analytics/route.ts`, `src/app/api/meta/pro-analysis/route.ts`, `src/app/api/checkout/paypal/route.ts`, `src/app/api/checkout/paypal/confirm/route.ts`, `src/app/api/battlelog/route.ts`
- **What:**
  - analytics: validate timezone against `Intl.supportedValuesOf('timeZone')`
  - pro-analysis: whitelist modes against DRAFT_MODES
  - paypal routes: whitelist locale against routing.locales
  - paypal confirm: use env var for redirect URL, not `origin`
  - battlelog: add year bounds check (2020-2030) on `before` cursor
- **Acceptance:** Invalid inputs return 400, no path traversal possible.

### Task 2.2: Supabase query safety
- **Status:** [ ]
- **Severity:** HIGH
- **Size:** S (2 files)
- **Files:** `src/app/api/meta/route.ts`, `src/app/api/analytics/route.ts`
- **What:** Add `.limit()` to unbounded meta_stats queries. Reduce analytics battle limit from 5000 to 2000.
- **Acceptance:** No query returns > 2000 rows.

### Task 2.3: Auth error handling
- **Status:** [ ]
- **Severity:** HIGH
- **Size:** S (2 files)
- **Files:** `src/lib/auth.ts`, `src/app/api/auth/callback/route.ts`
- **What:** auth.ts: change `.single()` to `.maybeSingle()` to avoid unhandled throw. callback: validate code length/format before exchange.
- **Acceptance:** Missing profile returns null (not throw). Invalid auth codes rejected.

### Task 2.4: ErrorBoundary i18n
- **Status:** [ ]
- **Severity:** HIGH
- **Size:** S (1 file + 13 locales)
- **Files:** `src/components/ui/ErrorBoundary.tsx`, `messages/*.json`
- **What:** Replace hardcoded "Oops!", "Error", "Reload" with `useTranslations('errorPage')`. Add keys to all locales.
- **Acceptance:** Error boundary text localized in all 13 languages.

### Task 2.5: Cron timing-safe auth comparison
- **Status:** [ ]
- **Severity:** HIGH  
- **Size:** S (2 files)
- **Files:** `src/app/api/cron/sync/route.ts`, `src/app/api/cron/meta-poll/route.ts`
- **What:** Replace string `!==` with `crypto.timingSafeEqual()` for CRON_SECRET comparison.
- **Acceptance:** Auth check is constant-time.

---

## Sprint 3: MEDIUM (Consistency + Quality)

### Task 3.1: Standardize hook return shapes
- **Status:** [ ]
- **Severity:** MEDIUM
- **Size:** M (4 files)
- **Files:** `src/hooks/useAdvancedAnalytics.ts`, `src/hooks/useProAnalysis.ts`, `src/hooks/useClubEnriched.ts`, `src/hooks/useClubTrophyChanges.ts`
- **What:** Rename `loading` to `isLoading` in useAdvancedAnalytics and useProAnalysis for consistency. Document batch hook return shape difference.
- **Acceptance:** All simple hooks return `{ data, isLoading, error }`.

### Task 3.2: Accessibility fixes
- **Status:** [ ]
- **Severity:** MEDIUM
- **Size:** M (4 files)
- **Files:** `src/components/premium/FeatureShowcase.tsx`, `src/components/layout/Header.tsx`, `src/components/brawler-detail/MasteryTimeline.tsx`, `src/components/ui/CookieConsent.tsx`
- **What:** Add aria-labels to carousel buttons, avatar alt text, chart aria-describedby, cookie buttons.
- **Acceptance:** No a11y warnings on manual check.

### Task 3.3: Hardcoded strings cleanup
- **Status:** [ ]
- **Severity:** MEDIUM
- **Size:** S (3 files + locales)
- **Files:** `src/app/[locale]/profile/[tag]/battles/page.tsx`, `src/app/[locale]/profile/[tag]/share/page.tsx`, `src/components/ui/AdPlaceholder.tsx`
- **What:** Replace hardcoded "Download" and "Anuncio - Ad Space" with t() calls. Add keys to locales.
- **Acceptance:** No English strings in non-English locale renders.

### Task 3.4: API error response standardization
- **Status:** [ ]
- **Severity:** MEDIUM
- **Size:** M (8+ files)
- **Files:** All API routes under `src/app/api/`
- **What:** Standardize all error responses to `{ error: string }` with matching HTTP status. Remove inconsistent `{ ok: false }`, `{ error, code }` patterns.
- **Acceptance:** Every API route follows same error format.

### Task 3.5: PayPal token caching
- **Status:** [ ]
- **Severity:** MEDIUM
- **Size:** S (1 file)
- **Files:** `src/lib/paypal.ts`
- **What:** Cache `getAccessToken()` result with TTL. Currently makes 5 API calls per webhook instead of 1.
- **Acceptance:** Token reused within TTL, only 1 auth call per webhook.

---

## Sprint 4: LOW (Polish + Maintenance)

### Task 4.1: Remove dead code + unused imports
- **Status:** [ ]
- **Severity:** LOW
- **Size:** S (3 files)
- **Files:** `src/lib/analytics/recommendations.ts` (unused `groupBy` import), `src/app/[locale]/profile/[tag]/analytics/page.tsx` (empty TAB_ICONS entries), page.tsx + share.tsx (`as any` casts)
- **Acceptance:** tsc passes, no unused imports.

### Task 4.2: Extract magic numbers to constants
- **Status:** [ ]
- **Severity:** LOW
- **Size:** S (2 files)
- **Files:** `src/lib/analytics/compute.ts`, `src/lib/analytics/types.ts`
- **What:** Export `SESSION_GAP_MS`, `TOP_COMFORT_BRAWLERS`, `STANDARD_3V3_MODES` as named constants.
- **Acceptance:** No magic numbers in compute functions.

### Task 4.3: Update patch-level dependencies
- **Status:** [ ]
- **Severity:** LOW
- **Size:** S (1 file)
- **Files:** `package.json`
- **What:** Update: next 16.2.3, react 19.2.5, vitest 4.1.4, @supabase/ssr 0.10.2, eslint-config-next 16.2.3
- **Acceptance:** `npm audit` clean, `npm run build` passes.

---

## Execution Order

```
Sprint 1 (CRITICAL) → verify build → Sprint 2 (HIGH) → verify build → Sprint 3 (MEDIUM) → verify build → Sprint 4 (LOW) → final verification
```

**Verification gate after each sprint:**
```bash
npx tsc --noEmit && npx vitest run && npm run build
```

**Total: 18 tasks across 4 sprints**
- Sprint 1: 5 tasks (CRITICAL)
- Sprint 2: 5 tasks (HIGH)
- Sprint 3: 5 tasks (MEDIUM)
- Sprint 4: 3 tasks (LOW)
