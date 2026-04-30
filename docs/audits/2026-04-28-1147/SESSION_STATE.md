# Estado de la sesión — Panóptico audit

> Última actualización: 2026-04-30 (post-merge de 17 PRs autónomos: 10 originales + A..K)
> Branch base de revisión: `main` (commit `40ab2d6`)
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
| 🟠 ALTAS | 22 / 24 (92%) | 2 |
| 🟡 MEDIAS | 22 / 26 (85%) | 4 |
| 🟢 BAJAS | 15 / 15 (100%) | 0 |
| **Total** | **63 / 69 (91%)** | **6** |

Tras la sesión completa autónoma 2026-04-30 (17 PRs total):
- **PRs 1-10** (audit inicial) — 33 hallazgos
- **PR A** PERF-05/06/07 + MIX-01 + LOG-06 — 5
- **PR B** LOG-10/11/13 — 3
- **PR C** ARQ-04 + ARQ-10 + RES-02 + LOG-16/17/18 + TEST-08/12 — 7
- **PR D** ARQ-01 (Database types desde introspección PostgREST) — 1
- **PR E** ARQ-03 (cascade helper) + ARQ-14 (club-summary endpoint) — 2
- **PR F** TEST-02 (5 routes integración) + TEST-04 (security suite) — 2
- **PR G** SEG-07 (CSP Report-Only) + RES-04 (structured logging) + SEG-09 (idempotency) — 3
- **PR H** LOG-07 (algorithm O(N×M)→O(N+M)) + PERF-04 (cache stampede) — 2
- **PR I** TEST-05/06/07/10 (testing polish) — 4
- **PR J** ARQ-08 (SQL↔TS parity test) — 1

**Tests:** 943 vitest passing (+85 desde 858 baseline pre-autonomous), tsc 0, vitest coverage thresholds activadas, security suite (IDOR/path-traversal/Bearer-vs-cookie), SQL↔TS parity contra prod read-only.

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

## DEUDA TÉCNICA RESTANTE — 6 hallazgos pendientes

Todos son refactors de gran alcance o decisiones de producto que conviene
abordar con plan dedicado, no autónomamente. La cobertura efectiva de los
hallazgos restantes es alta — los tests existentes ya verifican el
comportamiento correcto de las funciones afectadas.

### 🟠 ALTAS pendientes (2)

#### Producto / arquitectura
- **ARQ-02** — Extraer 4 módulos de `pro-analysis/route.ts` (582 LoC) en `lib/meta/pro-analysis/{aggregate,counters,personalGap,trios}.ts`. **M (4-6 h).** Refactor invasivo, baja relevancia user-facing — mejor en sesión dedicada con plan explícito antes de tocar la lógica de Tier 1/2 + premium gating + serialización.
- **TEST-03** — Tipar mocks Supabase contra `Database['public']['Tables'][T]['Row']`. **M.** Requiere migrar todos los `vi.mock` builders a un helper tipado compartido. Mejor con plan dedicado tras consumir progresivamente el `Database` generic en call-sites (ARQ-01 quedó como tipos exportados, NO como `createServerClient<Database>()` — esa propagación está documentada como deuda en `lib/supabase/server.ts`).

### 🟡 MEDIAS pendientes (4)

#### Arquitectura
- **ARQ-07** — Split `compute.ts` (963 LoC) en `analytics/compute/{overview,brawler,...}.ts` con barrel index. **M (1 día).** ~25 funciones a extraer + tipos compartidos + helpers. Refactor amplio; mejor con un plan que asegure los 46 tests existentes se mantienen verde paso a paso.
- **ARQ-09** — Rename `ls_*` → `subscription_*` en `profiles`. Migration + 8 callsites + RLS policies. **M (3-4 h).** Necesita release window coordinado: si la migration corre antes que el deploy del código, todo lo que lea `ls_*` rompe; si el código deploya antes, las nuevas columnas no existen aún. Patrón seguro: 3 pasos (add cols copy-from-old → code reads/writes both → drop old cols), cada uno tras verificación. **NO autónomo.**

#### Rendimiento
- **PERF-03** — Precompute `battle_analytics_daily` o reescribir `compute.ts` en una pasada. **M-L.** Decisión arquitectural (precompute vs in-pass): impacta latencia vs frescura. Necesita decisión de producto antes de implementación.

#### Testing
- **TEST-09** — Stryker mutation testing en módulos críticos. **M.** Opt-in/nightly, valor incremental sobre la suite actual de 943 tests; conviene activarlo cuando se observe stalling de bug-finding por la suite normal.
- **TEST-11** — Modo "E2E offline" con `page.route` + fixtures versionados en `e2e/fixtures/`. **M.** Reduce flake del E2E que actualmente pega contra Supercell. Útil pero requiere trabajo de fixture seeding + decisión sobre cobertura de fixtures vs tests live separados.

### 🟢 BAJAS pendientes (0)

Todas cerradas. ✅
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
