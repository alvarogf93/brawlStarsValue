# Estado de la sesión — Panóptico audit

> Última actualización: 2026-04-28 (sesión de paralelización con agentes)
> Branch base de revisión: `main` (commit `604fe24`)
> Reportes fuente: `fase-1-arquitectura.md`, `fase-2-logica.md`, `fase-3-seguridad.md`, `fase-5-testing.md`, `MASTER-TODO.md`

## Cómo retomar en una sesión nueva

1. Leer este archivo primero, luego `MASTER-TODO.md` para detalle por hallazgo.
2. `gh pr list --state open` para ver el estado de los PRs abiertos.
3. Verificar qué se ha mergeado mirando `git log main`.
4. Antes de abrir nuevas branches, sincronizar con `git fetch origin main` y rebasar las branches abiertas si `main` ha avanzado.
5. **NO mergear automáticamente.** Cada PR debe pasar por code review humano.

---

## Resumen ejecutivo

**De 69 hallazgos totales del audit Panóptico:**

- 🔴 CRÍTICAS: 4 / 4 cerradas (100%) — todas en PR #1.
- 🟠 ALTAS: 14 / 24 cerradas (58%) — distribuidas en 9 PRs.
- 🟡 MEDIAS: 4 / 26 cerradas (15%) — PR #8.
- 🟢 BAJAS: 7 / 15 cerradas (47%) — PR #5.

**Total cerradas: 29 / 69 (42%)**, en **10 PRs separadas** contra `main`. Cada PR es atómica, revertible, con tests pasando, tsc limpio, commit convencional referenciando el ID del hallazgo.

---

## PRs abiertos (10)

| # | Branch | Título | Hallazgos cerrados |
|---|--------|--------|---------------------|
| 1 | `audit/panoptico-2026-04-28-criticals` | 4 CRÍTICAS + 5 ALTAS de la auditoría | SEG-01, LOG-02, LOG-01, LOG-04, MIX-03, SEG-02, SEG-03, SEG-04, LOG-05 + filtro source en brawler-detail |
| 2 | `audit/arq-05-safe-ad-slot` | SafeAdSlot en 8 páginas | ARQ-05 |
| 3 | `audit/seg-06-rate-limit` | Rate-limit Upstash 4 endpoints | SEG-06, parcial SEG-10 |
| 4 | `audit/test-01-ci-workflow` | GitHub Actions CI | TEST-01 (lint suppressions ARQ-10 referenciadas) |
| 5 | `audit/sweep-bajas` | 6 BAJAS y 1 BAJA-RES | LOG-15, LOG-19, ARQ-12, ARQ-13, ARQ-15, RES-03, TEST-15 |
| 6 | `audit/log-09-confirm-error` | paypal/confirm error handling | LOG-09 |
| 7 | `audit/perf-01-http-timeouts` | http.ts wrapper + circuit breakers | PERF-01 |
| 8 | `audit/sweep-medias-batch1` | 4 MEDIAS cohesivas | SEG-05, SEG-08, LOG-12, LOG-14 |
| 9 | `audit/mix-02-sync-helper` | syncBattlesAndMeta helper | MIX-02 |
| 10 | `audit/res-01-paypal-verify-local` | Verify webhook PayPal local | RES-01, RES-05 |

URLs de los PRs: ver `gh pr list` o `https://github.com/alvarogf93/brawlStarsValue/pull/<n>`.

---

## Acciones manuales pendientes ANTES de mergear

| Acción | PR afectado | Por qué |
|--------|-------------|---------|
| Aplicar migrations 022 + 023 en Supabase prod | #1 | Sin la 022 los trends fast-path siguen contaminados; sin la 023 `/api/meta/brawler-detail` devuelve 500 |
| Configurar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` en Vercel prod | #3 | Sin ambos el helper "fall-open" — local-dev seguro pero prod silenciosamente sin protección |
| Habilitar branch protection en GitHub Settings → Branches con required checks (typecheck/lint/unit/e2e/build) | #4 | El workflow corre pero no gatilla merges hasta esto |
| Verificar que el PayPal webhook ID actual sigue siendo válido tras el cambio de verificación local | #10 | Local verify usa `paypal-cert-url` real; staging deber probar antes de prod |
| Sandbox PayPal para validar end-to-end #1, #6, #10 (LOG-02 + LOG-09 + RES-01) | #1, #6, #10 | Mocks cubren contratos pero no transacciones reales |

---

## Worktrees activas (limpieza al terminar)

```
C:/Proyectos_Agentes/bv-arq05      (audit/arq-05-safe-ad-slot)
C:/Proyectos_Agentes/bv-seg06      (audit/seg-06-rate-limit)
C:/Proyectos_Agentes/bv-test01     (audit/test-01-ci-workflow)
C:/Proyectos_Agentes/bv-sweep      (audit/sweep-bajas)
C:/Proyectos_Agentes/bv-log09      (audit/log-09-confirm-error)
C:/Proyectos_Agentes/bv-perf01     (audit/perf-01-http-timeouts)
C:/Proyectos_Agentes/bv-res01      (audit/res-01-paypal-verify-local)
C:/Proyectos_Agentes/bv-mix02      (audit/mix-02-sync-helper)
C:/Proyectos_Agentes/bv-medias1    (audit/sweep-medias-batch1)
```

Tras mergear cada PR, eliminar la worktree:
```bash
cd /c/Proyectos_Agentes/brawlValue
git worktree remove ../bv-<name>
git branch -D audit/<branch>   # solo si la branch ya está mergeada upstream
```

---

## DEUDA TÉCNICA RESTANTE — 40 hallazgos pendientes

Lista exhaustiva, agrupada por tipo y prioridad. Cada entrada cita la ubicación del hallazgo en los reportes Panóptico para reabrir contexto rápido.

### 🟠 ALTAS pendientes (10)

#### Producto / arquitectura
- **ARQ-01** — `Database` en `supabase/types.ts` declara 4 tablas; el código consulta 11. `meta_stats`, `meta_matchups`, `meta_trios`, `cron_heartbeats`, `brawler_trends`, `meta_poll_cursors`, `anonymous_visits` van como `any`. Acción: `npx supabase gen types typescript --project-id <id>` → `supabase/types.gen.ts`. **Coste M (1 día).** Desbloquea TEST-03.
- **ARQ-02** — `pro-analysis/route.ts` (582 LoC) God Object. Acción: extraer 4 módulos en `src/lib/meta/pro-analysis/`. **Coste M (4-6 h).**
- **ARQ-03** — Duplicación `/api/meta` ↔ `picks/page.tsx::fetchMetaEvents` (>100 LoC compartidos). Acción: `src/lib/meta/cascade.ts::buildEventsWithCascade`. **Coste S (2-3 h).**
- **ARQ-08** — `compute7dTrend` lógica TS↔SQL sin enforcement. Acción: shippear test integración Postgres-backed. **Coste M (4-6 h).**
- **ARQ-14** — `useClubEnriched` invoca `/api/calculate` por miembro (3 Supercell calls + cómputo gemas, 18-54s para club de 30). Acción: crear `/api/player/club-summary` o ampliar `/api/player/tag-summary`. **Coste M (3-4 h).**

#### Resiliencia / lógica
- **LOG-06** — `processOnePlayer` en `cron/meta-poll/route.ts:97-200` envuelve toda la lógica en `try/catch` con bloque vacío sin logging. Acción: añadir `catch (err) { console.warn(...) }` con `err.status` cuando es `SuprecellApiError`. **Coste S (1 h).**
- **LOG-07** — `computeTiltAnalysis`, `computeWarmUp`, `computeRecovery` recomputan `computeSessions` y hacen `battles.filter(...)` dentro del loop sobre sesiones — O(N×M). Acción: pasar `sessions` precomputado + indexar en una pasada con puntero. **Coste M (4-6 h).**

#### Seguridad / infra
- **SEG-07** — Ausencia total de Content-Security-Policy. Acción: deploy iterativo en `Report-Only` antes de enforcing, allow-list explícita para CDN Brawlify, AdSense, GA, BrawlAPI. **Coste M (varios días por la fase Report-Only).**

#### Testing
- **TEST-02** — 8 de 27 API routes sin test integración: `brawlers`, `maps`, `draft/data`, `draft/maps`, `notify/signup`, `profile/check-premium`, `meta` raíz, `meta/brawler-detail`. Acción: `-auth-contract.test.ts` con patrón `fromMock + queueByTable`. **Coste M (8 routes × ~30 LoC × 4 casos).**
- **TEST-03** — Mocks chainables aceptan cualquier orden, no validan schema. Acción: tipar el builder con `Database['public']['Tables'][...]['Row']` (depende de ARQ-01) o nightly contract test contra Supabase preview branch. **Coste M.**
- **TEST-04** — Cero tests de seguridad (IDOR, XSS, path-traversal, Bearer-vs-cookie). Acción: nuevo directorio `src/__tests__/security/`. **Coste M.**

### 🟡 MEDIAS pendientes (22)

#### Arquitectura
- **ARQ-04** — Doble convención Telegram: `lib/telegram.ts` (archivo) ⊕ `lib/telegram/` (directorio). Mover `notify()` dentro del directorio. **S (30 min).**
- **ARQ-07** — `compute.ts` (963 LoC) cerca de SRP. Dividir en `analytics/compute/{overview,brawler,mode,...}.ts`. **M (1 día).**
- **ARQ-09** — Naming `ls_*` (Lemon Squeezy legacy) sobre stack PayPal. Migration `022_rename_ls_to_subscription.sql` + 8 callsites. **M (3-4 h).** Nota: muy disruptivo, considerar coordinarlo con un release window.
- **ARQ-10** — 3 errores ESLint `react-hooks/set-state-in-effect`. Cubierto parcialmente por TEST-01 (suppressions con TODO). Refactor real pendiente: o `useState(() => readCache())` lazy, o `useSyncExternalStore`. **S (1 h).**

#### Datos / lógica
- **LOG-10** — `useProAnalysis` cache module-level sin TTL/eviction. Acción: TTL 30 min + LRU `maxSize=50`. **S (puntual) / M (si se migra todo a SWR).**
- **LOG-11** — `useClubTrophyChanges` stale-write race al cambiar `members`. Acción: `controllerRef = useRef<AbortController>()`. **S.**
- **LOG-13** — Caches localStorage sin schema versioning. Acción: `_schemaVersion: number` + comparación con constante. **S** (5 hooks).

#### Rendimiento
- **PERF-03** — `computeAdvancedAnalytics` síncrono 5000 battles en handler. Acción: precomputar tabla diaria via cron (a) o reescribir en una pasada (b). **M-L según ruta.**
- **PERF-04** — `/api/draft/maps` cache stampede sin negative caching. Acción: confiar en `revalidate: 86400` de Next + fallback en `map_images_cache` Supabase. **M.**
- **PERF-05** — `/api/meta/pro-analysis` 4 queries seriadas + cache poco defensiva. Acción: `Promise.all` + whitelist de mapas vivos. **S.**
- **PERF-06** — `/api/cron/meta-poll` 1000 jugadores secuencial. Acción: `p-limit` concurrencia 4 + combinar con PERF-01 timeout 8s. **M.**
- **PERF-07** — `/api/draft/data` sin `Cache-Control` ni `s-maxage`. Acción: `s-maxage=900` + paralelizar 3 queries iniciales. **S.**

#### Resiliencia
- **MIX-01** (ARQ-11 + PERF-02 fusionados) — Rate-limit in-memory en `/api/analytics`. Cubierto parcialmente por SEG-06 (helper Upstash existe). Acción: aplicar el helper a `/api/analytics`. **S.**
- **RES-02** — `paypal/confirm` y `webhooks/paypal` race condition sin row-locking. Acción: o eliminar la escritura desde `/confirm`, o `UPDATE … WHERE … AND ls_subscription_status NOT IN ('cancelled','expired')`. **S.**
- **RES-04** — Sin tracing/observabilidad estructurada. Acción: structured logging via `console.log(JSON.stringify({...}))` + `request_id` propagado en `proxy.ts`. **M.**

#### Seguridad
- **SEG-09** — `/api/notify/signup` sin idempotencia (cubierto parcialmente por RES-03 — async ahora, pero se puede llamar repetidamente). Acción: flag `profiles.signup_notified_at`, hashear/truncar email. **S.**

#### Testing
- **TEST-05** — E2E `waitForTimeout` mágicos (200/500/2000/5000 ms). Sustituir por `page.waitForFunction(...)` por condición real. **S.**
- **TEST-06** — Smokes "zero console.error" ocultan absencia silenciosa de UI. Migrar cada smoke a ≥1 aserción positiva. **S.**
- **TEST-07** — 35+ `toBeDefined()` y 9 `toBeTruthy()` débiles. Sustituir por comparaciones de valor / `toMatchObject`. **S.**
- **TEST-08** — `vitest.config.ts` sin coverage thresholds. Añadir bloque `coverage: { thresholds: {...} }`. **S.**
- **TEST-09** — Mutation testing inexistente. Stryker opcional, no-blocking, módulos críticos (analytics/stats, compute, scoring, brawler-metadata). **M.**
- **TEST-10** — `process.env` mutado sin restaurar (cubierto por TEST-15 globalmente, pero el patrón `vi.stubEnv` per-test sigue mejor). **S.**
- **TEST-11** — E2E pegados a Supercell sin VCR. Modo "E2E offline" con `page.route` + fixtures versionados en `e2e/fixtures/`. **M.**

### 🟢 BAJAS pendientes (8)

- **LOG-16** — Clasificación weak/even/strong umbral fijo (no escala con tier). Decisión de producto. **S.**
- **LOG-17** — `meta-poll` sampler reconstruye `computeMinLive` por player. Documentar granularidad o tracking incremental. **S.**
- **LOG-18** — Fórmula `comfort` mezcla unidades. Documentar o extraer constantes. **S.**
- **SEG-10** — `/api/profile/check-premium` enumeración. Cubierto parcialmente por SEG-06 (rate-limit aplicado). Pendiente: side-channel timing constant. **S.**
- (Las otras 4 BAJAS están en el sweep #5 ya cerrado o no se reportaron específicamente — verificar contra `MASTER-TODO.md`.)

---

## Cómo retomar el desarrollo

### Si quieres seguir con el ritmo paralelo

```bash
cd /c/Proyectos_Agentes/brawlValue

# Sincronizar
git fetch origin
git checkout main
git pull origin main

# Crear worktrees nuevas para los siguientes hallazgos
# Ejemplo: 3 worktrees paralelos para 3 ALTAs cohesivas
git worktree add -B audit/arq-01-supabase-types ../bv-arq01 origin/main
git worktree add -B audit/log-06-meta-poll-logging ../bv-log06 origin/main
git worktree add -B audit/log-07-tilt-perf ../bv-log07 origin/main

# Junctions y .env.local (Windows)
cmd //c "mklink /J ..\\bv-arq01\\node_modules ..\\brawlValue\\node_modules"
cmd //c "mklink /J ..\\bv-log06\\node_modules ..\\brawlValue\\node_modules"
cmd //c "mklink /J ..\\bv-log07\\node_modules ..\\brawlValue\\node_modules"
cp .env.local ../bv-arq01/.env.local
cp .env.local ../bv-log06/.env.local
cp .env.local ../bv-log07/.env.local
```

### Patrón para invocar agentes con calidad

Cada agente recibe:
1. Contexto del proyecto (BrawlVision Next.js 16, etc.)
2. Hallazgo verbatim del MASTER-TODO + ubicación + acción
3. cwd EXPLÍCITO de su worktree
4. Branch ya creada (no permite push a main)
5. Quality gates NO-NEGOCIABLES: TDD, tsc 0, vitest verde, commit convencional con `Refs: docs/audits/2026-04-28-1147/MASTER-TODO.md (<ID>)`, `git push -u origin <branch>` al final
6. Self code-review checklist específico del hallazgo
7. Restricción de retorno: ≤ 250 palabras + branch + commit SHA

Modelo de prompt: ver los Agent calls de esta sesión (`SEG-06`, `PERF-01`, `RES-01`, `MIX-02`).

### Próximas tandas sugeridas (paralelizables)

**Tanda A — datos / typing / tests (3 worktrees):**
- ARQ-01 (gen Supabase types + propagar)
- TEST-02 (8 routes sin test integración)
- TEST-03 (tipar mocks Supabase contra schema, depende ARQ-01)

**Tanda B — código limpio (3 worktrees):**
- ARQ-02 (extraer pro-analysis)
- ARQ-03 (helper cascade compartido)
- ARQ-07 (split compute.ts)

**Tanda C — performance (3 worktrees):**
- PERF-03 (precompute analytics tabla)
- PERF-04 (eliminar cache módulo en draft/maps)
- PERF-05+06+07 (paralelizar queries + p-limit cron + cache draft/data) — pueden ir en una sola PR

**Tanda D — seguridad / observability (2 worktrees):**
- SEG-07 (CSP — empezar por Report-Only)
- RES-04 (structured logging + request_id)

**Tanda E — UI / hooks (1 worktree, varios cambios):**
- LOG-10 + LOG-11 + LOG-13 (cache TTL, abort controllers, schema versioning)

### Disciplina recomendada

- **NUNCA mergear sin code review humano**, incluso si los tests pasan.
- **NUNCA mergear PR sin haber aplicado las acciones manuales upstream** (migrations, env vars en Vercel, branch protection).
- **NUNCA juntar más de 5-7 hallazgos en una PR**, salvo sweeps cohesivos de coste S.
- **Cada PR debe tener `Refs: docs/audits/2026-04-28-1147/MASTER-TODO.md (<ID>)`** en el commit message para trazabilidad.
- **Verificar pre-commit con vitest + tsc + ESLint** (cuando ARQ-10 esté refactorizado).

---

## Inventario completo del trabajo de la sesión

**Commits totales generados:** 17 commits sobre 10 branches, todos pushed.

**Tests añadidos:** ~70 tests netos (de 758 originales a ~830 con todas las branches mergeadas).

**Líneas tocadas (estimado):** ~3500 líneas añadidas, ~400 eliminadas.

**Archivos nuevos:**
- `src/lib/http.ts` (+ test) — PERF-01
- `src/lib/rate-limit.ts` (+ test) — SEG-06
- `supabase/migrations/022_brawler_trends_filter_global_source.sql` — LOG-01
- `supabase/migrations/023_sum_meta_stats_total.sql` — MIX-03
- `.github/workflows/ci.yml` — TEST-01
- 6 ficheros de test nuevos
- `docs/audits/2026-04-28-1147/SESSION_STATE.md` (este archivo)

**Documentación actualizada:**
- `CLAUDE.md` — 3 entradas nuevas (filter source='global', migration 022, sampler probabilístico)
- `MASTER-TODO.md` — sin cambios
- `.env.example` — Upstash credentials documentadas con fall-open semantics
