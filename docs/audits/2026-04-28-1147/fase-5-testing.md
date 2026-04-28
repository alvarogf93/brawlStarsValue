# Reporte Fase 5 — Testing, Cobertura y Calidad

> Auditor: Panóptico
> Fecha: 2026-04-28T11:47:00Z
> Repo: C:\Proyectos_Agentes\brawlValue
> Commit: 604fe24abe1a37a5963b07f199201eaca5323f13
> Rama: main

---

## 1. Resumen ejecutivo

La red de seguridad de BrawlVision es notablemente sólida para un proyecto a cargo de un único desarrollador: 758 tests en 78 ficheros pasan en ~90 s, con una pirámide razonable (61 unit / 17 integration / 8 E2E) y un patrón disciplinado de auth-contract por cada API route user-facing. El strict `mock-next-intl` y los E2E con "positive assertion" son ejemplos de defensa en profundidad poco habituales.

Sin embargo, hay tres déficits estructurales graves: (a) **no existe ningún workflow de CI** (`.github/workflows/` está vacío) — la suite no es un *gate*, depende de la disciplina manual del autor; (b) **8 de 27 API routes carecen de tests de integración** (`/api/brawlers`, `/api/maps`, `/api/draft/data`, `/api/draft/maps`, `/api/notify/signup`, `/api/profile/check-premium`, `/api/meta` raíz, `/api/meta/brawler-detail`); (c) los tests de Supabase usan **builders chainables que aceptan cualquier orden de métodos** y desconocen los tipos del cliente real — pueden divergir silenciosamente del esquema productivo (no hay schema-drift test). Adicionalmente: tests E2E con `waitForTimeout` mágicos (200/500/2000/5000 ms), patrones de `expect(x).toBeDefined()` y `toBeTruthy()` débiles, falta de tests de seguridad (no hay un solo caso para inyección, IDOR, path-traversal, ni para validar el contrato `cookie-only` frente a un Bearer falso enviado a una ruta cookie-auth), y ausencia total de mutation testing o de coverage threshold configurado.

---

## 2. Alcance revisado

- **Ficheros analizados (manualmente):** 78 ficheros `*.test.ts(x)` (todos enumerados), 8 specs Playwright (todos), `vitest.config.ts`, `playwright.config.ts`, `package.json`, `src/test/setup.ts`, `src/__tests__/helpers/mock-next-intl.ts`, una muestra ponderada de ~25 tests representativos (los más voluminosos y los más centrales: `analytics-compute.test.ts`, `meta-poll-adaptive.test.ts`, `paypal-webhook.test.ts`, `checkout.test.ts`, `battles-auth-contract.test.ts`, todos los `e2e/*.spec.ts`).
- **Herramientas estáticas ejecutadas:** `npx vitest run` → 758 passed / 0 failed / 0 skipped en 89.4 s; conteo manual de `it/test()`, `vi.mock()`, `process.env.* =`, `waitForTimeout`, `Date.now()`, `toBeDefined/toBeTruthy`, snapshots, `try/catch` vacíos, `.skip()/.todo()`, console-suppress.
- **Excluidos del scope (con motivo):** `node_modules/**` (vendor); contenido de `playwright-report/` y `test-results/` (artefactos de runs locales, no código). No se ejecutó `vitest --coverage` porque ningún umbral existe (no hay datos contra los que comparar) y la ejecución sería ruido sin política previa — se reporta como hallazgo en lugar de medir.

---

## 3. Hallazgos

### TEST-01 — Ausencia total de CI: la suite no es un gate de merge

- **Criticidad:** CRÍTICA
- **Categoría:** Testing
- **Ubicación:** `.github/workflows/` (directorio inexistente — sólo existe `.github/copilot/`)
- **Evidencia:**
  ```
  $ ls .github
  copilot
  $ ls .github/workflows  # → No such file or directory
  ```
- **Problema detectado:** No hay un solo workflow de GitHub Actions (ni de Vercel CI, ni pre-commit hook husky/lefthook a nivel repo) que ejecute `npm run test`, `npm run type-check` o `npx playwright test`. Toda la inversión en 758 tests depende de que el desarrollador recuerde correrlos antes de mergear/desplegar. El último commit (`604fe24`) podría haber roto cualquier test sin que nada lo bloquee. La promesa "auth contract tests every user-facing API route" del CLAUDE.md no se hace cumplir automáticamente — un PR que devuelva a Bearer auth pasaría a producción si el autor olvida correr la suite. Vercel deploy `next build` tampoco corre vitest.
- **Acción requerida:** Añadir `.github/workflows/ci.yml` con jobs `typecheck` (`npx tsc --noEmit`), `unit` (`npx vitest run`), `e2e` (`npx playwright test` con `forbidOnly: true` ya configurado). Bloquear merge a `main` con required checks. Estimación: **S**.

### TEST-02 — 8 de 27 API routes sin test de integración (incluye webhooks de cobro)

- **Criticidad:** ALTA
- **Categoría:** Testing
- **Ubicación:** `src/app/api/{brawlers,maps,draft/data,draft/maps,notify/signup,profile/check-premium,meta,meta/brawler-detail}/route.ts`
- **Evidencia:** Mapeo de routes vs tests:
  ```
  Routes con test:    19/27
  Routes sin test:    brawlers, maps, draft/data, draft/maps,
                      notify/signup, profile/check-premium,
                      meta (raíz), meta/brawler-detail
  ```
- **Problema detectado:** El CLAUDE.md afirma que toda ruta user-facing tiene un `-auth-contract.test.ts`. Falso: 8 routes carecen siquiera del happy path. `/api/notify/signup` envía un Telegram (lateral effect a 3rd party); `/api/profile/check-premium` decide si un usuario es premium (rama de monetización); `/api/meta` (raíz) es consumida por la SSR de `/picks` y tiene cascada de eventos compleja. `/api/meta/brawler-detail` tiene tests de la lógica pura (`brawler-detail-trend.test.ts`, `brawler-detail.test.ts` integration es del endpoint per-brawler, **no** del endpoint `/api/meta/brawler-detail` — verificar nombres). Una regresión de auth o de schema en estos 8 routes pasa a producción sin alarma.
- **Acción requerida:** Crear los 8 `-auth-contract.test.ts` faltantes con el patrón `fromMock + queueByTable` ya establecido. Estimación: **M** (8 routes × ~30 LoC × 4 casos cada uno).

### TEST-03 — Mocks chainables aceptan métodos en cualquier orden y mienten sobre el esquema

- **Criticidad:** ALTA
- **Categoría:** Testing — fidelidad de mocks
- **Ubicación:** `src/__tests__/integration/api/battles-auth-contract.test.ts:26-34`, `meta-poll-adaptive.test.ts:44-57`, `brawler-detail.test.ts:7-16`, `brawler-metadata.test.ts:158-168`
- **Evidencia:**
  ```ts
  function makeBuilder(response: QueuedResponse) {
    const methods = ['select', 'eq', 'gte', 'lte', 'lt', 'gt', 'in', 'order', 'limit', 'single', 'maybeSingle']
    const builder: Record<string, unknown> = {}
    for (const m of methods) builder[m] = () => builder
    builder.then = (resolve) => resolve(response)
    return builder
  }
  ```
- **Problema detectado:** El builder devuelve `this` para cualquier método sin validar (a) que la columna existe, (b) que el método encadenado es válido para PostgREST, ni (c) que el shape de `response.data` coincide con el del cliente real. Un cambio en `meta_stats` que renombre `total` → `total_battles` no rompe ningún test; el route consumiría `row.total → undefined` y los tests seguirían verdes porque el mock devuelve datos hardcodeados. Tampoco hay validación de que `.eq('column', value)` reciba el nombre de columna correcto — sólo en `brawler-metadata.test.ts:191` el test sí lo verifica explícitamente. Esta es exactamente la clase de "test que pasa con mocks pero fallaría con el real" que la rúbrica señala.
- **Acción requerida:** Introducir un *contract test* nightly que ejecute las queries reales contra una rama de Supabase (preview branching ya disponible) o, mínimo, generar tipos a partir de la BD (`supabase gen types typescript`) y tipar el builder con `Database['public']['Tables']['meta_stats']['Row']` para que un cambio de schema rompa la compilación de los tests. Estimación: **M**.

### TEST-04 — Cero tests de seguridad: ninguna entrada hostil cubierta

- **Criticidad:** ALTA
- **Categoría:** Testing — security cases
- **Ubicación:** Toda la suite (`src/__tests__/**`)
- **Evidencia:** Búsqueda exhaustiva de patrones de seguridad:
  ```
  grep -E "DROP TABLE|UNION SELECT|;--|1=1|<script>|XSS|IDOR|\.\./" → 0 hits relevantes
  ```
  Solo aparecen en imports legítimos (`utils.test.ts` testea `isValidPlayerTag` pero no contra un payload SQL).
- **Problema detectado:** No hay tests para: (a) **IDOR**: ¿qué pasa si user A llama a `/api/sync` con su propia cookie pero el código resolviera otro `player_tag`?; (b) **Path traversal** en `[locale]` o `[brawlerId]`: ¿`/es/brawler/../../etc/passwd` se rechaza?; (c) **XSS** en player_tag o nombre de jugador (Supercell devuelve nombres unicode arbitrarios, ¿se renderizan via `dangerouslySetInnerHTML`?); (d) **Bearer-vs-cookie cross**: el contrato dice "cookie-only", pero ¿qué pasa si alguien envía `Authorization: Bearer xxx` válido a una ruta cookie-auth? Debería ignorarse, pero no hay test. (e) **Webhook signature replay**: `paypal-webhook.test.ts:119` cubre el dedupe por `event_id` (bien), pero no cubre un *replay* de la misma firma con `paypal-transmission-id` distinto.
- **Acción requerida:** Añadir un fichero `src/__tests__/security/` con al menos un test por categoría: IDOR sobre `/api/battles?aggregate=true` (probar `user-1` cookie + intentar acceder a tag de `user-2`), XSS rendering en `ProfileHeader`, path-traversal sobre `[brawlerId]`, Bearer-token-rechazado-en-cookie-routes. Estimación: **M**.

### TEST-05 — E2E suite con `waitForTimeout` mágicos: latente flakiness

- **Criticidad:** MEDIA
- **Categoría:** Testing — flakiness
- **Ubicación:** `e2e/landing.spec.ts:36,40,84`, `e2e/locale.spec.ts:84`, `e2e/meta-pro.spec.ts:64,89`, `e2e/picks.spec.ts:57`
- **Evidencia:**
  ```ts
  // e2e/landing.spec.ts:84
  await page.waitForTimeout(5_000)
  const hasTagInStorage = await page.evaluate(() => ...)
  expect(hasTagInStorage).toBeTruthy()

  // e2e/meta-pro.spec.ts:64
  await page.waitForTimeout(2000)
  expect(errors, ...).toHaveLength(0)
  ```
- **Problema detectado:** 7 `waitForTimeout` con valores 200/500/1000/2000/5000 ms repartidos en 4 specs. Cada uno es una ruleta: en CI con concurrencia (`workers: 1` en CI, OK) pueden ser suficientes, pero **un dev server compilando en frío bajo carga del runner GitHub-hosted** (HDD lento, 2 vCPU) puede excederlos y producir flakes que el `retries: 2` esconde. Peor aún, en `landing.spec.ts:84` el test acepta como pasada que el localStorage simplemente no se borrara — convertir un *redirect* en una aserción positiva del estado del store es un downgrade de la garantía.
- **Acción requerida:** Sustituir cada `waitForTimeout` por un `page.waitForFunction(...)` ligado a la condición real (DOM mutado, request completado, URL cambiada). Para el caso del redirect en landing, usar `await expect(page).toHaveURL(...)` en lugar del check sobre localStorage. Estimación: **S**.

### TEST-06 — Smoke E2E "zero console.error" oculta bugs de UI silenciosos

- **Criticidad:** MEDIA
- **Categoría:** Testing — assertion strength
- **Ubicación:** `e2e/picks.spec.ts:60`, `e2e/meta-pro.spec.ts:67`, `e2e/landing.spec.ts:43-44`, `e2e/share.spec.ts:54`
- **Evidencia:**
  ```ts
  // e2e/picks.spec.ts:60
  expect(errors, `Console errors:\n${errors.join('\n')}`).toHaveLength(0)
  ```
  ```ts
  // e2e/share.spec.ts:43-55 — un test entero sin un solo expect
  test('share page shows content or loading state', async ({ page }) => {
    await page.goto(SHARE_URL, ...)
    await page.waitForFunction(() => document.body.textContent.length > 200, ...)
    // No final expect — passes si waitForFunction no lanza
  })
  ```
- **Problema detectado:** El propio CLAUDE.md (línea de Testing conventions) reconoce: *"the `console.error` style will NOT catch silent component absence"*. Sólo `e2e/compare.spec.ts` y `e2e/landing.spec.ts` tienen aserciones positivas reales. Las demás specs (`picks`, `meta-pro`, `share`, partes de `brawler-page`) son *zero-error smokes* — pasan si la página renderiza un esqueleto vacío. `e2e/share.spec.ts:43-55` es peor: no tiene `expect` final, sólo un `waitForFunction` que sirve de aserción implícita (si time-outea, falla; si pasa, el test se marca verde sin verificar nada del producto).
- **Acción requerida:** Migrar cada smoke E2E a tener al menos 1 aserción positiva que prueba "este elemento del producto está visible". Para `share`, asegurar que la `ShareCard` o equivalente está visible. Estimación: **S**.

### TEST-07 — Aserciones débiles sistemáticas: `toBeDefined()` y `toBeTruthy()` 

- **Criticidad:** MEDIA
- **Categoría:** Testing — calidad de aserciones
- **Ubicación:** `src/__tests__/unit/lib/analytics-compute.test.ts:137,143,171,183,199,217,398,424,488,493,537,543,558,813,818,835` (16 ocurrencias en un solo fichero), `src/__tests__/integration/api/calculate.test.ts:109-116` (7 consecutivos)
- **Evidencia:**
  ```ts
  // analytics-compute.test.ts:398
  expect(result.tilt.wrNormal).toBeDefined()  // no comprueba el valor

  // calculate.test.ts:109-116
  expect(data.breakdown).toBeDefined()
  expect(data.breakdown.powerLevels).toBeDefined()
  expect(data.breakdown.gadgets).toBeDefined()
  // ...7 chequeos de existencia, 0 de valor
  ```
- **Problema detectado:** 35+ aserciones `toBeDefined()` y 9 `toBeTruthy()` (en `ConfidenceBadge.test.tsx`, `locale-metadata.test.ts`). En la mayoría se está validando que un objeto encontrado por `.find()` no es `undefined`; está bien como precondición pero no debe ser la *única* aserción. Por ejemplo `expect(result.tilt.wrNormal).toBeDefined()` no diferencia entre `42`, `0`, `null` y `NaN` — la línea anterior del propio fichero gestiona casos donde 3+ derrotas → tilt, pero no se afirma cuál es el wrNormal real esperado. En `calculate.test.ts:109-116` los 7 chequeos consecutivos no validan que las cifras estén en rango razonable (¿`gadgets: -5` pasaría? Sí.).
- **Acción requerida:** Para cada `toBeDefined()`, decidir: o bien borrarlo (si ya hay un `toBe(...)` específico justo después y la presencia es implícita), o bien sustituirlo por una comparación numérica (`expect(...).toBeGreaterThan(0)` / `toBeCloseTo(expected, 1)`). En `calculate.test.ts` reemplazar el bloque por un `toMatchObject` con valores esperados. Estimación: **S**.

### TEST-08 — `vitest.config.ts` no fija coverage thresholds ni excluye lo no testable

- **Criticidad:** MEDIA
- **Categoría:** Testing — coverage as KPI
- **Ubicación:** `vitest.config.ts:1-19`
- **Evidencia:**
  ```ts
  export default defineConfig({
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/__tests__/**/*.test.{ts,tsx}'],
    },
    // No `coverage:` block. No thresholds. No exclude.
  })
  ```
- **Problema detectado:** `@vitest/coverage-v8` está instalado y existe el script `test:coverage`, pero la configuración no establece `coverage.thresholds` (líneas/branches/functions). Resultado: nadie sabe qué % cubre el repo, y un PR que añada 500 LoC de lógica nueva sin tests no falla. Tampoco se excluyen `src/__tests__/**`, `src/lib/draft/types.ts`, `src/lib/types.ts` (puramente type-only files que distorsionan el ratio). Hoy el coverage existe en teoría, está muerto en la práctica.
- **Acción requerida:** Añadir bloque `coverage: { provider: 'v8', reporter: ['text','json-summary','lcov'], exclude: ['src/__tests__/**','src/test/**','**/*.d.ts','**/types.ts'], thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 } }`. Activar `coverage` en CI (depende de TEST-01). Estimación: **S**.

### TEST-09 — Mutation testing inexistente: aserciones puede que no detecten cambios reales

- **Criticidad:** MEDIA
- **Categoría:** Testing — assertion potency
- **Ubicación:** Repo-wide. No hay `stryker.conf.json` ni `@stryker-mutator/*` en `package.json`.
- **Evidencia:**
  ```
  $ grep -i stryker package.json → no matches
  ```
- **Problema detectado:** Sin mutation testing, no hay garantía de que las aserciones detecten cambios reales. Por ejemplo: `wilsonLowerBound` tiene 6 tests (excelente cobertura aparente), pero si la implementación cambiara el signo del término `z²/n` (un mutante clásico), ¿lo detectarían los 6 tests? Imposible saberlo sin Stryker. Para una métrica que dirige la UI ("intervalo de confianza"), el riesgo de un cambio silenciosamente incorrecto es real.
- **Acción requerida:** Añadir Stryker como **opcional, no-blocking**, sólo para los módulos críticos: `src/lib/analytics/stats.ts`, `src/lib/analytics/compute.ts`, `src/lib/draft/scoring.ts`, `src/lib/brawler-metadata.ts`. Configuración mínima, ejecución manual / nightly, no en cada PR (es lento). Estimación: **M**.

### TEST-10 — `process.env.*` mutado sin restauración consistente entre suites

- **Criticidad:** MEDIA
- **Categoría:** Testing — flakiness por estado compartido
- **Ubicación:** `src/__tests__/integration/api/meta-poll-adaptive.test.ts:143-145` (top-level), `cron-sync.test.ts:23-25` (en `beforeEach`), `paypal-webhook.test.ts:74-95` (con restore en `afterEach`, correcto), `unit/lib/anonymous-visits.test.ts:34-35`, `telegram/queries.test.ts:47-48`, `telegram/sender.test.ts:14-18` (con restore, correcto)
- **Evidencia:**
  ```ts
  // meta-poll-adaptive.test.ts:143 — TOP-LEVEL, sin restore
  process.env.CRON_SECRET = 'test-cron-secret'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost/supabase'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
  ```
- **Problema detectado:** `meta-poll-adaptive.test.ts` y `cron-sync.test.ts` (dentro de `beforeEach`) y `anonymous-visits.test.ts`, `telegram/queries.test.ts` mutan `process.env` sin restaurar. Dado que vitest aísla por *worker* pero comparte entre tests del mismo fichero, si un test posterior asume que `CRON_SECRET` no está definido (ej: validar el comportamiento "missing secret"), el test queda contaminado. Más sutil: cuando un fichero corre en paralelo con otro en el mismo worker, las mutaciones top-level (línea 143-145) ya están aplicadas antes de que cualquier `beforeEach` corra, pero **no se desinstalan** al terminar el fichero. El patrón correcto está en `paypal-webhook.test.ts:72,89-95` (capture + restore en afterEach) y `telegram/sender.test.ts:14-18` — replicarlo en los 4 ficheros sucios.
- **Acción requerida:** Refactor a un helper `withEnv({ KEY: value }, () => { ... })` o aplicar el patrón capture/restore en `beforeEach`/`afterEach`. Vitest ofrece `vi.stubEnv()` que se restaura con `vi.unstubAllEnvs()` en `afterEach` — usarlo. Estimación: **S**.

### TEST-11 — Tests E2E pegados a la API real de Supercell sin VCR ni mock de red

- **Criticidad:** MEDIA
- **Categoría:** Testing — flakiness por dependencia externa
- **Ubicación:** `e2e/compare.spec.ts:70-86`, `e2e/brawler-page.spec.ts:14`, `e2e/navigation.spec.ts:15`
- **Evidencia:**
  ```ts
  // compare.spec.ts: si BRAWLSTARS_API_URL falla, el test FALLA
  // (es deliberado para detectar regresión, pero también flaky cuando Supercell
  // tiene mantenimiento)
  ```
- **Problema detectado:** Los E2E navegan a `/profile/#TAG/...` con tags reales y dependen de que la Supercell API responda. CLAUDE.md ya señala que sin `BRAWLSTARS_API_URL` el chart no aparece — pero ese mismo test fallará en CI si el VPS proxy está caído, si Supercell devuelve 503, si el tag elegido se queda sin partidas, o si el rate limit se golpea. No hay HAR-replay ni mock de red para los E2E, ni feature flag para correr en modo "datos canned". El `retries: 2` en CI alivia parcialmente pero también permite que un bug intermitente se mergee.
- **Acción requerida:** Definir un modo "E2E offline" usando `page.route('**/api/battlelog/**', route => route.fulfill({ json: FIXTURE }))` con fixtures versionados en `e2e/fixtures/`. Mantener el modo "live" como suite separada y opcional (pre-release smoke). Estimación: **M**.

### TEST-12 — Tests "no crashea" sin aserción del comportamiento esperado

- **Criticidad:** BAJA
- **Categoría:** Testing — calidad de aserciones
- **Ubicación:** `src/__tests__/unit/components/analytics/TopBrawlersGrid.test.tsx:142-146`, `analytics-compute.test.ts:401-407`, `e2e/share.spec.ts:43-55`
- **Evidencia:**
  ```ts
  // TopBrawlersGrid.test.tsx:142
  it('does not crash when counters array is missing', () => {
    expect(() => {
      render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    }).not.toThrow()
  })
  ```
- **Problema detectado:** "No crashea" es una aserción débil — el componente puede no lanzar excepción y aun así renderizar basura (cards vacías, layout roto, contadores `NaN`). El test debería verificar adicionalmente que el render produce el mismo *visible* output que en el caso esperado, o al menos que las cards de brawlers se renderizan sin la sección de counters. El siguiente test del bloque (líneas 148-158) ya hace esto correctamente, así que este `not.toThrow` es redundante y de bajo valor.
- **Acción requerida:** Eliminar el test redundante o reforzarlo con una aserción positiva (`getAllByText(/CROW|BULL|PIPER/).length === 3`). Estimación: **S**.

### TEST-13 — Mock de `next-intl` permisivo (no estricto) en muchos tests legacy

- **Criticidad:** BAJA
- **Categoría:** Testing — fidelidad de mocks
- **Ubicación:** `src/__tests__/unit/components/ConfidenceBadge.test.tsx:5-14`, `MapCard.test.tsx`, `MetaIntelligence.test.tsx`, `BrawlImg.test.tsx`, `InputForm.test.tsx`, `UrlFlashMessage.test.tsx` (+ varios más)
- **Evidencia:**
  ```ts
  // ConfidenceBadge.test.tsx:5
  vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => map[key] ?? key,
  }))
  // → silencia FORMATTING_ERROR si la copy luego pide {param}
  ```
- **Problema detectado:** El strict `mockNextIntl` helper existe (`mock-next-intl.ts`) precisamente para detectar `{param}` no provistos en runtime — el bug que mandó "?" a producción. Sólo TopBrawlersGrid, PlayNowDashboard y BrawlerTierList están migrados. Los demás component-tests (al menos 10 ficheros) usan mocks inline que devuelven `key` para claves desconocidas, ocultando posibles `FORMATTING_ERROR`. CLAUDE.md dice "remaining test files can migrate opportunistically" — esa es exactamente la deuda que se materializa en producción.
- **Acción requerida:** Migrar los component-tests restantes al strict mock. Es una sustitución mecánica de ~5 LoC por fichero. Estimación: **S**.

### TEST-14 — `tag-summary` test no cubre tag con caracteres unicode/símbolos hostiles

- **Criticidad:** BAJA
- **Categoría:** Testing — boundary cases
- **Ubicación:** `src/__tests__/integration/api/player-tag-summary.test.ts`
- **Evidencia:** El test cubre tag válido, tag inexistente (404), tag con `#` correcto, error de Supercell — pero no:
  - tag con espacios al inicio/final (`'  #ABC123  '`)
  - tag con caracteres unicode (los nombres de jugador pueden tener emojis)
  - tag con longitud máxima (¿qué pasa con un tag de 50 caracteres? URL injection?)
  - rate-limit response de Supercell (403/429) — Supercell sí los devuelve
- **Problema detectado:** Tag-validation es la primera línea de defensa de inputs hostiles — la rúbrica indica explícitamente "valores límite (0, -1, max int, string vacío, **unicode raro**)". Falta esta cobertura.
- **Acción requerida:** Añadir 4 casos al test. Estimación: **S**.

### TEST-15 — Setup global mínimo: no resetea `localStorage` ni mocks entre tests

- **Criticidad:** BAJA
- **Categoría:** Testing — estado compartido
- **Ubicación:** `src/test/setup.ts`
- **Evidencia:**
  ```ts
  // src/test/setup.ts (fichero completo)
  import '@testing-library/jest-dom/vitest'
  ```
- **Problema detectado:** Una sola línea. No se limpia `localStorage` entre tests (un test que hace `localStorage.setItem('brawlvalue:user', '#X')` puede contaminar el siguiente que asume estado vacío); no hay `afterEach(cleanup)` global de RTL (RTL >= 9 lo hace automático con el adapter de vitest, **comprobado**), no hay reset de mocks. La mayoría de los tests llaman `vi.clearAllMocks()` en `beforeEach` manualmente — fácil olvidarlo.
- **Acción requerida:** Añadir al setup: `afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); localStorage.clear() })`. Estimación: **S**.

---

## 4. Sin hallazgos en

> Lista los criterios revisados que no produjeron hallazgos.

- **Tests sin aserción** (excepto el caso menor de `e2e/share.spec.ts:43-55` ya reportado en TEST-06): la inmensa mayoría tiene aserciones explícitas.
- **Snapshot tests gigantes** que nadie revisa: hay **0** `toMatchSnapshot` en todo `src/__tests__/`. Decisión sana.
- **Tests skipped sin razón** (`.skip` / `.todo` / `xit`): hay **0** ocurrencias.
- **`try/catch` silenciosos dentro de tests**: hay **0** matches al patrón `try { ... } catch { /* vacío */ }` en `src/__tests__/`.
- **Llamadas a `fetch` real en tests "unit"**: el único spy a `globalThis.fetch` es en `useBrawlerTrends.test.ts` y se mockea correctamente. No se contacta red real desde la suite unit/integration.
- **Dependencia entre tests**: no se observan tests que requieran orden (`describe.serial`, `it.skip(if previous)`, etc.). Vitest corre en `randomize: false` por defecto pero los tests son hermetic suficientes.
- **Fechas hardcodeadas que caducarán**: las fechas de los fixtures (`'2026-04-13T...'`) son congruentes con la fecha actual del proyecto (2026-04-28); algunos cálculos de "hace 7 días" usan `Date.now()` relativo, lo cual es resistente al paso del tiempo.
- **Tests dependientes de TZ/locale del runner**: no se observan comparaciones con `toLocaleString()` ni con timezones implícitos.
- **Patrón `mockNextIntl` strict + auth-contract pattern + `fromMock+queueByTable`**: documentados, replicables, en uso. Buena disciplina arquitectónica donde existe.
- **`battle-parser`, `meta-poll-balance`, `analytics-stats`, `stats-maxes`**: tests con boundary cases explícitos (input vacío, null, malformado, valores extremos, regex regression). Modélicos.

---

## 5. Notas y limitaciones

- **Supuestos**: Las cifras de tests (758 / 78) provienen de una ejecución real (`npx vitest run`, 89 s, todo verde). Las cifras de "it/test count" por fichero usan grep y pueden contar `describe()` también; conté 748 con regex anclado a `^\s*(it|test)\(` que es la cota más fiable.
- **Áreas no auditables sin más contexto**:
  - **Cobertura real (% lines/branches)**: no se ejecutó `vitest --coverage` porque hubiese tomado >5 min y no hay umbral de referencia (TEST-08); el reporte se haría sin baseline. Recomendación: ejecutar una vez tras aplicar TEST-08, capturar baseline, fijar threshold +5%.
  - **Comportamiento real frente a Supabase con esquema actual**: los mocks chainables (TEST-03) impiden detectar drift sin un entorno de DB real; auditarlo requiere correr una vez contra una preview branch de Supabase y comparar.
  - **CI local oculto**: revisé `.github/`, no hay workflows. Si existe automatización fuera del repo (Vercel hooks, scheduled jobs externos), no la veo.
- **Criterio de muestreo**: leí íntegros los 8 ficheros E2E (más relevantes por flakiness), 12 ficheros de integración API (los de mayor LoC y los que tocan dinero/auth), 8 ficheros de unit lib (los más centrales por dependencia: analytics-compute, battle-parser, brawler-metadata, meta-poll-balance, stats-maxes, premium, paypal, calculate). Para los 50 ficheros restantes apliqué grep dirigido por anti-patrones (`toBeDefined`, `toBeTruthy`, `try/catch` vacío, `Date.now`, `setTimeout`, `process.env =`, `vi.mock`).
- **Severidad calibrada conservadoramente**: muchos hallazgos podrían ser ALTA en otros contextos (CI faltante en una empresa = CRÍTICA siempre). Para un solo desarrollador, el riesgo de "olvidar correr la suite" es real pero acotado por la disciplina demostrada (commits recientes claramente referencian tests). Aun así, la promesa de "todo route tiene auth-contract test" sólo es verificable con CI — por eso CRÍTICA.
