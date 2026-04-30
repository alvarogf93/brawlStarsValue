# Estado de la sesión — Panóptico audit

> Última actualización: 2026-04-30 (post-merge de los 10 PRs)
> Branch base de revisión: `main` (commit `dabf8f1`)
> Reportes fuente: `fase-1-arquitectura.md`, `fase-2-logica.md`, `fase-3-seguridad.md`, `fase-5-testing.md`, `MASTER-TODO.md`

## Cómo retomar en una sesión nueva

1. Leer este archivo primero, luego `MASTER-TODO.md` para detalle por hallazgo.
2. Verificar `git log main` para ver el estado real de merges.
3. Antes de empezar trabajo nuevo, `git fetch origin main && git pull`.

---

## Resumen ejecutivo

**De 69 hallazgos totales del audit Panóptico:**

| Criticidad | Cerradas | Restantes |
|------------|----------|-----------|
| 🔴 CRÍTICAS | 4 / 4 (100%) | 0 |
| 🟠 ALTAS | 14 / 24 (58%) | 10 |
| 🟡 MEDIAS | 19 / 26 (73%) | 7 |
| 🟢 BAJAS | 11 / 15 (73%) | 4 |
| **Total** | **48 / 69 (70%)** | **21** |

Tras la sesión 2026-04-30 (post-merge inicial + 3 PRs adicionales sin intervención del usuario):
- **PR A** cerró PERF-05/06/07 + MIX-01 + LOG-06 (5 hallazgos backend perf/resilience).
- **PR B** cerró LOG-10/11/13 (3 hallazgos hook hardening).
- **PR C** cerró ARQ-04 + ARQ-10 + RES-02 + LOG-16/17/18 + TEST-08/12 (7 hallazgos sweep).

**Tests:** 877 vitest passing (+19 desde 858 baseline pre-PR-A), tsc 0, todos los workflows CI configurados, vitest coverage thresholds activadas.

---

## PRs mergeados a `main` (13/13)

| # | Branch (mergeada) | Hallazgos cerrados |
|---|---|---|
| 1 | `audit/panoptico-2026-04-28-criticals` | SEG-01, LOG-02, LOG-01+LOG-04, MIX-03, SEG-02, SEG-03, SEG-04, LOG-05 + GRANT en migration 023 |
| 2 | `audit/arq-05-safe-ad-slot` | ARQ-05 |
| 3 | `audit/seg-06-rate-limit` | SEG-06 + parcial SEG-10 (ip:tag bucketing) |
| 4 | `audit/test-01-ci-workflow` | TEST-01 + parcial ARQ-10 (3 lint suppressions con TODO) |
| 5 | `audit/sweep-bajas` | LOG-15, LOG-19, ARQ-12, ARQ-13, ARQ-15, RES-03, TEST-15 |
| 6 | `audit/log-09-confirm-error` | LOG-09 |
| 7 | `audit/perf-01-http-timeouts` | PERF-01 |
| 8 | `audit/sweep-medias-batch1` | SEG-05, SEG-08, LOG-12 (con skip-on-error), LOG-14 |
| 9 | `audit/mix-02-sync-helper` | MIX-02 |
| 10 | `audit/res-01-paypal-verify-local` | RES-01, RES-05 + anti-replay window 5min ± 30s |
| **A** | `audit/pr-a-backend-perf` | **PERF-05, PERF-06, PERF-07, MIX-01, LOG-06** |
| **B** | `audit/pr-b-hooks` | **LOG-10, LOG-11, LOG-13** + helper `lib/local-cache.ts` |
| **C** | `audit/pr-c-sweep` | **ARQ-04, RES-02, LOG-16, LOG-17, LOG-18, TEST-08, TEST-12** + parcial ARQ-10 |

Todos rebasados sobre el `main` actualizado y mergeados con `--no-ff` para preservar lineage.

---

## Acciones manuales pendientes — INFRA

Bloqueantes operacionales que el código ya está preparado para consumir, pero requieren tu cuenta:

| Acción | PR | Estado actual sin esto |
|--------|---|------------------------|
| Aplicar migrations 022 + 023 en Supabase prod | #1 | Trends fast-path contaminado; brawler-detail RPC `sum_meta_stats_total` devuelve 500 |
| Configurar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` en Vercel prod | #3 | Helper "fall-open" — los 4 endpoints públicos no tienen rate-limit en prod (solo log warning una vez) |
| Habilitar branch protection en GitHub Settings → Branches con required checks: `typecheck, lint, unit, build` (NO `e2e`) | #4 | Workflow corre pero no gatilla merges |
| Configurar 4 secrets en GitHub Actions para que e2e pueda correr: `BRAWLSTARS_API_URL`, `BRAWLSTARS_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | #4 | Job `e2e` se skipea (notice "missing secrets") — no falla, solo no corre |
| Validar webhook ID PayPal con verificación local (sandbox primero) | #10 | El refactor de RES-01 pasa todos los tests locales; staging end-to-end no probado |
| Sandbox PayPal end-to-end para SEG-04 + LOG-09 + RES-01 | #1, #6, #10 | Mocks cubren contratos pero no transacciones reales |

El pre-push hook local (`.claude/hooks/pre-push-check.sh`) está roto (invoca `tsc` directo en lugar de `npx tsc`); afecta solo a operaciones locales destructivas como `git push --delete`. No bloquea el flujo normal con `npx`.

---

## DEUDA TÉCNICA RESTANTE — 21 hallazgos pendientes

### 🟠 ALTAS pendientes (10) — sin cambio respecto a snapshot anterior

#### Producto / arquitectura
- **ARQ-01** — Generar tipos Supabase con `npx supabase gen types typescript`. 7 tablas pasan como `any`. Desbloquea TEST-03. **M (1 día).** Necesita login Supabase CLI o introspección manual del schema.
- **ARQ-02** — Extraer 4 módulos de `pro-analysis/route.ts` (582 LoC). **M (4-6 h).**
- **ARQ-03** — Extraer `src/lib/meta/cascade.ts::buildEventsWithCascade` para deduplicar `/api/meta` ↔ `picks/page.tsx`. **S (2-3 h).**
- **ARQ-08** — Test integración Postgres-backed para enforcement SQL↔TS de `compute7dTrend`. **M (4-6 h).** Necesita Supabase preview branch o testcontainers.
- **ARQ-14** — `/api/player/club-summary` para evitar 18-54s en `useClubEnriched`. **M (3-4 h).** Diseño depende del shape mínimo que `useClubEnriched` necesita.

#### Resiliencia / lógica
- **LOG-07** — Tilt/warmUp/recovery O(N×M) → O(N+M). **M (4-6 h).**

#### Seguridad / infra
- **SEG-07** — Content-Security-Policy iterativo Report-Only → enforce. **M (varios días con fase Report-Only).** Necesita deploy a prod para iterar la allow-list.

#### Testing
- **TEST-02** — 8 routes sin test integración. **M.** Cohesivo, sin blockers — buen candidato siguiente.
- **TEST-03** — Tipar mocks Supabase contra schema (depende ARQ-01). **M.**
- **TEST-04** — `__tests__/security/` (IDOR, XSS, path-traversal, Bearer-cookie). **M.** Sin blockers.

### 🟡 MEDIAS pendientes (7)

#### Arquitectura
- **ARQ-07** — Split `compute.ts` (963 LoC) en `analytics/compute/{overview,brawler,...}.ts`. **M.**
- **ARQ-09** — Rename `ls_*` → `subscription_*` en `Profile` types. Migration + 8 callsites. **M.** Coordinar con release window.

#### Rendimiento
- **PERF-03** — Precompute `battle_analytics_daily` o reescribir `compute.ts` en una pasada. **M-L.** Decisión arquitectural.
- **PERF-04** — Eliminar cache de módulo `/api/draft/maps`, confiar en `next: { revalidate }`. **M.** Necesita verificar comportamiento real con Fluid Compute.

#### Resiliencia
- **RES-04** — Structured logging via `console.log(JSON.stringify({...}))` + `request_id` en `proxy.ts`. **M.**

#### Seguridad
- **SEG-09** — `profiles.signup_notified_at` flag de idempotencia + hashear/truncar email. **S.**

#### Testing
- **TEST-09** — Stryker mutation testing en módulos críticos. **M.** Opcional/nightly.
- **TEST-11** — Modo "E2E offline" con `page.route` + fixtures versionados. **M.**

(Cerrados en sesión 2026-04-30: ARQ-04, LOG-10, LOG-11, LOG-13, MIX-01, PERF-05, PERF-06, PERF-07, RES-02, TEST-08.)
(Cerrados antes: ARQ-12, LOG-12, LOG-14, SEG-05, SEG-08.)

### 🟢 BAJAS pendientes (4)

- **TEST-05** — Sustituir 7 `waitForTimeout` por `page.waitForFunction(...)`. **S.** (Reclasificada — depende de E2E que actualmente tiene secrets-gate.)
- **TEST-06** — Migrar smokes "zero console.error" a aserciones positivas. **S.**
- **TEST-07** — Sustituir 35+ `toBeDefined()` y 9 `toBeTruthy()` débiles. **S.**
- **TEST-10** — `vi.stubEnv` per-test (cubierto globalmente por TEST-15 ya, mejora opcional). **S.**

(Cerrados en sesión 2026-04-30: LOG-16, LOG-17, LOG-18, TEST-12.)
(Cerrados antes: LOG-15, LOG-19, ARQ-13, ARQ-15, RES-03, TEST-15.)

### Histórica (referencia)
- **LOG-06** — cerrado en PR A (logging en cron catch vacío).
- **ARQ-04** — cerrado en PR C (notify() reubicado a lib/telegram/notify.ts).
- **LOG-17** — Documentar granularidad real `computeMinLive` por-jugador. **S.**
- **LOG-18** — Documentar fórmula `comfort` o extraer constantes. **S.**
- **SEG-10** — Side-channel timing constant en check-premium (rate-limit ya cubierto). **S.**
- **TEST-12** — Eliminar tests redundantes "no crashea". **S.**
- **TEST-13** — Migrar componentes restantes al strict `mockNextIntl`. **S.**
- **TEST-14** — Edge cases en `player-tag-summary.test.ts`. **S.**
- **TEST-(varios pequeños)** — Verificar contra MASTER-TODO si quedan.

---

## Próximas tandas sugeridas (paralelizables)

**Tanda A — datos/typing/tests (3 worktrees):**
- ARQ-01 (gen Supabase types + propagar)
- TEST-02 (8 routes sin test integración)
- TEST-03 (tipar mocks Supabase, depende ARQ-01 — secuencial)

**Tanda B — código limpio (3 worktrees):**
- ARQ-02 (extraer pro-analysis)
- ARQ-03 (helper cascade compartido)
- ARQ-07 (split compute.ts)

**Tanda C — rendimiento (1 PR cohesiva):**
- PERF-05 + PERF-06 + PERF-07 (Promise.all + p-limit + Cache-Control)
- MIX-01 (aplicar helper Upstash a /api/analytics)

**Tanda D — seguridad / observability (2 worktrees):**
- SEG-07 (CSP — empezar Report-Only)
- RES-04 (structured logging + request_id)

**Tanda E — UI / hooks (1 worktree):**
- LOG-10 + LOG-11 + LOG-13 (TTL/LRU, AbortController, schema versioning)

**Tanda F — limpieza:**
- ARQ-04 + ARQ-09 + ARQ-10 (renombres + refactor de los 3 set-state-in-effect)

---

## Disciplina recomendada (pasada esta sesión)

- Cada PR debe seguir referenciando `Refs: docs/audits/2026-04-28-1147/MASTER-TODO.md (<ID>)`.
- Code review humano antes de merge en `main`, incluso si los tests pasan.
- Aplicar las "Acciones manuales pendientes" arriba antes de declarar el sprint cerrado.
- Próxima auditoría Panóptico: sugerida en 4-6 semanas para verificar regresiones.

---

## Inventario consolidado de la sesión 2026-04-30 (post-review + merges)

**Patches aplicados a los 10 PRs en respuesta a review:**
- PR #1: GRANT EXECUTE migration 023 → authenticated, anon, service_role
- PR #3: RateLimit-* + X-RateLimit-* headers, dead code removed, ip:tag bucketing en check-premium
- PR #4: secrets-gate job para e2e, Node 24
- PR #7: openDurationMs default 60s → 30s, BrawlAPI timeout 8s → 5s con constantes nombradas, test TimeoutError
- PR #8: parseBattlelog skipea entries malformadas en lugar de tirar el batch; tests LOG-14 actualizados
- PR #10: anti-replay window 5min ± 30s, padding RSA_PKCS1 explícito, regression test round-trip, engines >=20.15.0

**Líneas tocadas (estimado):** ~3500 añadidas, ~400 eliminadas en el sweep total.

**Tests netos al final:** 871 (subida desde 758 baseline pre-audit).

**Migrations nuevas:** 022 (compute_brawler_trends source filter) + 023 (sum_meta_stats_total RPC).

**Archivos nuevos:**
- `src/lib/http.ts` — wrapper canónico con timeouts/retries/breakers
- `src/lib/rate-limit.ts` — Upstash sliding-window helper + headers helper
- `src/lib/battle-sync.ts` ya extendido con `syncBattlesAndMeta`
- `.github/workflows/ci.yml` — pipeline con secrets-gate
- `src/__tests__/unit/lib/paypal-verify-local.test.ts` — 25 tests
- `src/__tests__/unit/lib/http.test.ts`, `src/__tests__/unit/rate-limit.test.ts`
- 4 `-auth-contract.test.ts` para rutas con rate-limit
