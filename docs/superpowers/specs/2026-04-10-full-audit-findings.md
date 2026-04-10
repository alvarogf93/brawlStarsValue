# Full Codebase Audit — Verified Findings

**Date:** 2026-04-10
**Auditors:** 8 parallel agents + manual verification
**Safety tag:** `v1.1-pre-full-audit`

---

## Verified Findings by Priority

### CRITICAL (0)
None after verification. The reported missing `/api/battles` route was a **false positive** (route exists).

### HIGH (7)

| # | Category | Issue | File(s) | Verified |
|---|----------|-------|---------|----------|
| 1 | **Dead code** | StatsTicker.tsx exported but never imported | `src/components/landing/StatsTicker.tsx` | YES — grep confirms 0 imports |
| 2 | **Dead code** | HowItWorks.tsx exported but never imported | `src/components/landing/HowItWorks.tsx` | YES — grep confirms 0 imports |
| 3 | **Dead code** | paypal.ts: createProduct() + createPlan() never called | `src/lib/paypal.ts` | YES — setup-only functions |
| 4 | **TypeScript** | 47 `as` casts without validation (especially Supabase responses + JSON parse) | Multiple files | YES — Header.tsx has 6 `as Profile` casts |
| 5 | **i18n** | 14 hardcoded strings: game mode names in 3 files, W/L in tooltips | MapPerformanceList, ModePerformanceChart, ModeSelector, MasteryChart, TrendsChart | YES |
| 6 | **i18n** | ~60-67 untranslated keys per locale (FR: 64, DE: 65) — values identical to English | All 11 non-ES/EN locales | YES — verified FR has 64 |
| 7 | **Docs** | CLAUDE.md is empty (1 line), README.md is generic boilerplate | Root | YES |

### MEDIUM (12)

| # | Category | Issue | File(s) |
|---|----------|-------|---------|
| 8 | **Testing** | 13 API routes without integration tests (checkout, draft, meta, maps) | `src/app/api/` |
| 9 | **Testing** | PayPal unit functions untested (createSubscription, paypalStatusToTier) | `src/lib/paypal.ts` |
| 10 | **Performance** | framer-motion imported in 4 landing components (~40KB) for CSS-replaceable animations | Landing components |
| 11 | **Performance** | 0 dynamic() imports — heavy components loaded synchronously | All pages |
| 12 | **Performance** | BrawlImg uses raw `<img>` not next/image — no optimization, no webp | `src/components/ui/BrawlImg.tsx` |
| 13 | **Performance** | HeroBanner: 14 inline style objects + unmemoized arrays/sets on every render | `HeroBanner.tsx` |
| 14 | **Consistency** | CookieConsent uses `brawlvalue_cookie_consent` (underscore) vs `brawlvalue:` (colon) everywhere else | `CookieConsent.tsx:6` |
| 15 | **Consistency** | Duplicate component names: MapSelector (analytics vs draft), TrialBanner (premium vs landing) | 4 files |
| 16 | **TypeScript** | 3 unsafe optional chaining patterns (`.some()` on potentially undefined) | PersonalAnalysis.tsx |
| 17 | **Docs** | 7 specs + 7 plans outdated/superseded (pre-2026-04-08) | `docs/superpowers/` |
| 18 | **Docs** | docs/02-stack-tecnologico.md and docs/08-arquitectura-proyecto.md outdated | `docs/` |
| 19 | **Performance** | 2 logo `<img>` missing width/height (CLS issue) | `page.tsx`, `brawler/page.tsx` |

### LOW (8)

| # | Category | Issue |
|---|----------|-------|
| 20 | Testing | formatPlaytime(), wrColor(), image URL functions untested |
| 21 | Performance | Header.tsx full localStorage scan on sync |
| 22 | TypeScript | 28 non-null assertions (most justified by preceding checks) |
| 23 | i18n | aria-labels and title attributes not translated (LocaleSwitcher, InfoTooltip) |
| 24 | Consistency | Error response format inconsistent (`{error}` vs `{error, code}`) |
| 25 | Docs | JSDoc missing on analytics/compute.ts, recommendations.ts |
| 26 | Docs | 6 architecture docs outdated (old MVP phase docs) |
| 27 | Dead code | hero-mockups.html in root (if still present) |

---

## False Positives Removed

| Agent Report | Actual Status |
|---|---|
| `/api/battles` route missing (API audit) | Route EXISTS — `src/app/api/battles/route.ts` |
| TrialBanner calls `/api/battles` | TrialBanner does NOT call this route |
| Some "untranslated" keys are intentional (game terms: "Win Rate", "Brawlers", "Gadgets") | Approximately 30-40% of "identical" keys are intentional game terms |

---

## Execution Plan

### Sprint A: Cleanup (quick wins, 1-2 hours)
1. Delete StatsTicker.tsx, HowItWorks.tsx
2. Move createProduct/createPlan to docs/setup/ or delete
3. Fix CookieConsent key to `brawlvalue:cookie-consent`
4. Delete hero-mockups.html if present
5. Add width/height to logo images

### Sprint B: i18n (2-3 hours)
6. Create shared game mode translation keys (consolidate 3 duplicates)
7. Replace hardcoded W/L/G in tooltips with t() calls
8. Translate remaining ~40 genuine untranslated keys per locale (after excluding game terms)

### Sprint C: Performance (2-3 hours)
9. Replace framer-motion with CSS in 4 landing components
10. Memoize HeroBanner styles + arrays
11. Add dynamic() imports for heavy components (DraftSimulator, charts)

### Sprint D: Quality (3-4 hours)
12. Add tests for PayPal unit functions
13. Add integration tests for checkout routes
14. Update CLAUDE.md with project overview
15. Archive outdated docs

### Sprint E: TypeScript (2-3 hours)
16. Reduce `as Profile` casts with type guards
17. Fix 3 unsafe optional chaining patterns
18. Remove unnecessary casts where type already known
