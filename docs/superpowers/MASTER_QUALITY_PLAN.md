# BrawlVision — Master Quality Plan

**Date:** 2026-04-09
**Objective:** Llevar el proyecto a calidad de producción sin nuevas funcionalidades.
**Principio:** No se construye sobre cimientos rotos. Fix → Harden → Test → Polish.

---

## Phases (orden de dependencias)

```
Phase 1: FIX        → Bugs y seguridad del sprint plan (14 tasks)
Phase 2: UI POLISH  → Brawler filter dropdown + minor UX fixes
Phase 3: HARDEN     → Security headers, SEO, bundle optimization
Phase 4: TEST       → Coverage gaps + E2E critical flows
Phase 5: MEASURE    → Lighthouse audit, Web Vitals baseline
```

Cada phase tiene un gate de verificación antes de pasar a la siguiente:
```
tsc --noEmit && vitest run && npm run build
```

---

## Phase 1: FIX (Sprint Plan Verified)

**Spec:** `docs/superpowers/SPRINT_PLAN.md` (ya creado y verificado)
**Tasks:** 14 (2 CRITICAL, 4 HIGH, 5 MEDIUM, 3 LOW)
**Approach:** Subagent-driven, develop → test → commit per task

### Batch 1.1 — CRITICAL (paralelo)
- [ ] PayPal webhook idempotency bypass
- [ ] i18n missing keys in 11 locales

### Batch 1.2 — HIGH (paralelo)
- [ ] useMapImages fragile guard + AbortController
- [ ] PayPal JSON.parse try-catch
- [ ] ErrorBoundary i18n (class component → fallback prop)
- [ ] PayPal locale whitelist

### Batch 1.3 — MEDIUM (paralelo)
- [ ] AbortController batch hooks
- [ ] Hook return shape standardization
- [ ] Accessibility fixes (carousel, avatar, buttons)
- [ ] Hardcoded "Download" i18n
- [ ] PayPal token caching

### Batch 1.4 — LOW (paralelo)
- [ ] Remove dead code/unused imports
- [ ] Extract magic numbers to constants
- [ ] Patch-level dependency updates

**Gate:** `tsc && vitest run && npm run build` → push

---

## Phase 2: UI POLISH

**Scope:** Fixes de UX detectados durante esta sesión, sin nuevas funcionalidades.

### Task 2.1: Brawler rarity filter — dropdown on mobile
- **File:** `src/app/[locale]/profile/[tag]/brawlers/page.tsx`
- **Problem:** 8 rarity buttons con scroll lateral en móvil. Incómodo en desktop también.
- **Solution:**
  - Móvil (`md:hidden`): Dropdown selector con color dot + rarity name (mismo patrón que el sort dropdown que ya existe en el mismo archivo)
  - Desktop (`hidden md:flex`): Mantener botones pero más compactos: color dot (12px circle) + nombre corto, sin skew, sin sombra 3D excesiva
  - Multi-select: tap para toggle (como ahora), mostrar count de activos en el trigger
- **Design system:** Reutilizar el patrón del sort dropdown (líneas 199-224)

### Task 2.2: ActivityCalendar tooltip i18n
- **File:** `src/components/brawler-detail/ActivityCalendar.tsx:100`
- **Problem:** Tooltip hardcoded "games, wins" en inglés
- **Fix:** Usar `t('games')` y traducir tooltip format

**Gate:** Visual verification on mobile (375px) + desktop (1280px)

---

## Phase 3: HARDEN (Seguridad + SEO + Bundle)

### Task 3.1: Security headers
- **File:** `next.config.ts`
- **What:** Añadir Content-Security-Policy, Strict-Transport-Security, Permissions-Policy
- **Current:** Ya tiene X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **Missing:** CSP (script-src, style-src, img-src), HSTS (max-age=31536000), Permissions-Policy

### Task 3.2: SEO audit + fixes
- **Files:** `src/app/[locale]/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`
- **Checklist:**
  - [ ] Verificar que existe robots.txt con allow/disallow correcto
  - [ ] Verificar sitemap.xml dinámico con todas las rutas públicas
  - [ ] Meta tags: title, description, og:image por página
  - [ ] Structured data (JSON-LD) para la landing
  - [ ] Canonical URLs por locale
  - [ ] hreflang tags para 13 locales

### Task 3.3: Bundle size analysis
- **Command:** `ANALYZE=true npm run build`
- **What:** Identificar:
  - Dependencias duplicadas
  - Imports pesados que podrían ser lazy
  - CSS no utilizado
  - Imágenes sin optimizar
- **Target:** First Load JS < 100KB por ruta

**Gate:** `npm run build` clean + Lighthouse score baseline

---

## Phase 4: TEST (Coverage + E2E)

### Task 4.1: Coverage audit
- **Command:** `vitest --coverage`
- **Target:** Identificar funciones con 0% coverage en:
  - `src/lib/paypal.ts` (crítico: maneja dinero)
  - `src/lib/premium.ts` (crítico: gates de acceso)
  - `src/lib/battle-parser.ts` (datos de usuario)
  - `src/lib/brawler-detail/compute.ts` (ya tiene 11 tests)
- **Deliverable:** Escribir tests para gaps en funciones puras (no componentes UI)

### Task 4.2: E2E critical flows con Playwright
- **Flows a testear:**
  1. Landing → Search → Profile overview (public)
  2. Profile → Brawlers → Click brawler → Detail page
  3. Profile → Brawlers → Filter by rarity → Verify count
  4. Profile → Analytics → Tab navigation (mobile dropdown)
  5. Language switcher → Verify page translates
- **Files:** `e2e/` directory (nuevo)
- **Setup:** Playwright config, test against localhost:3000

### Task 4.3: API route tests para gaps
- **Target:** Rutas sin tests:
  - `/api/meta/brawler-detail` (nuevo)
  - `/api/webhooks/paypal` (crítico, maneja subscriptions)
  - `/api/checkout/paypal` y `/confirm`
- **Pattern:** Vitest integration tests con Supabase mocks

**Gate:** Coverage > 60% en lib/, todos los E2E pass

---

## Phase 5: MEASURE (Performance Baseline)

### Task 5.1: Lighthouse audit
- **Tool:** Playwright + Lighthouse CI o Chrome DevTools
- **Pages a medir:**
  - Landing page (pública, SEO crítica)
  - Profile overview
  - Brawlers grid
  - Brawler detail
  - Analytics (premium)
- **Metrics:** LCP, FID/INP, CLS, TTI, Speed Index
- **Target:** Score > 90 en Performance, > 95 en Accessibility

### Task 5.2: Web Vitals monitoring
- **What:** Añadir `next/web-vitals` reporting a la app
- **File:** `src/app/[locale]/layout.tsx`
- **Deliverable:** Console logging en dev, considerar analytics service para prod

### Task 5.3: Image optimization audit
- **What:** Verificar que todas las imágenes usan `<Image>` de Next.js o tienen `loading="lazy"`, `width/height` explícitos
- **Files:** Grep por `<img` tags que deberían ser `<Image>`

**Gate:** Lighthouse > 90 Performance en todas las páginas medidas

---

## Execution Strategy

**Agentes por fase:**
- Phase 1: Subagentes paralelos por batch (ya probado, funciona)
- Phase 2: Inline (2 tasks pequeñas, no necesitan worktrees)
- Phase 3: 3 agentes paralelos (security, SEO, bundle son independientes)
- Phase 4: 3 agentes paralelos (coverage, E2E, API tests son independientes)
- Phase 5: Inline (mediciones requieren browser real)

**Commits:** Un commit por task, message descriptivo, verificación pre-push.

**Total estimado:** ~45 tasks across 5 phases
