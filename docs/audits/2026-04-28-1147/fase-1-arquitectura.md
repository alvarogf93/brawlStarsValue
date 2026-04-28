# Reporte Fase 1 — Auditoría Arquitectónica y Estructural

> Auditor: Panóptico
> Fecha: 2026-04-28T11:47:00Z
> Repo: C:\Proyectos_Agentes\brawlValue
> Commit: 604fe24abe1a37a5963b07f199201eaca5323f13
> Rama: main

---

## 1. Resumen ejecutivo

BrawlVision tiene una base coherente —Next.js 16 App Router con `src/lib` desacoplado de `src/components` y un patrón de cron + heartbeat aplicado de forma uniforme—, pero arrastra cinco problemas estructurales transversales que ya están encareciendo cada feature: (1) tres rutas API gigantes (`pro-analysis` 582 LoC, `cron/meta-poll` 628 LoC, `compute.ts` 963 LoC) mezclan auth + queries + agregación + serialización; (2) duplicación funcional consciente entre `/api/meta` y `picks/page.tsx` que CLAUDE.md "permite" pero ya está creciendo; (3) la tabla `Database` en `supabase/types.ts` solo declara 4 de las 11 tablas reales, dejando todas las queries de `meta_*`, `cron_heartbeats`, `brawler_trends` y `anonymous_visits` silenciosamente sin tipar; (4) divergencia decisión-vs-realidad: CLAUDE.md exige `SafeAdSlot` pero 8 páginas siguen usando `AdPlaceholder` directo; (5) doble módulo `telegram` (`lib/telegram.ts` archivo + `lib/telegram/` directorio) con dos funciones de envío casi idénticas (`notify` vs `sendTelegramMessage`). El nombrado `ls_*` en columnas (legado Lemon Squeezy) propaga la confusión PayPal-vs-LS por toda la base de datos y el código de premium.

---

## 2. Alcance revisado

- **Ficheros analizados (manualmente):** 225 ficheros TS/TSX productivos. Foco en los 25 más grandes por LoC (≥200 LoC) y en cualquier fichero "centro de gravedad" (importado por ≥3 capas: `src/lib/api.ts`, `src/lib/premium.ts`, `src/lib/supabase/server.ts`, `src/lib/draft/constants.ts`, `src/lib/utils.ts`, `src/proxy.ts`, `src/lib/analytics/compute.ts`, `src/lib/battle-parser.ts`, `src/lib/cron/heartbeat.ts`). Mapeo top-down de `src/app`, `src/lib`, `src/components`, `src/hooks`, `src/i18n`. Lectura completa de `package.json`, `tsconfig.json`, `eslint.config.mjs`, `proxy.ts`, `[locale]/layout.tsx`, las 27 routes de `src/app/api/**`, los 13 hooks de `src/hooks/**` y los 16 ficheros de `src/lib/**`.
- **Herramientas estáticas ejecutadas:**
  - `npx tsc --noEmit` — exit 0 (typecheck limpio).
  - `npx eslint .` — 73 problemas: 3 errores `react-hooks/set-state-in-effect` y 70 warnings (mayoría `@next/next/no-img-element` por elección consciente con CDN Brawlify, +1 unused arg en `lib/telegram/commands/cron.ts:83`).
  - No se ejecutó `vitest` (fuera del scope arquitectónico, propio de Fase 6).
- **Excluidos del scope (con motivo):**
  - `supabase/functions/**` — Deno edge functions, ignoradas en eslint.config y excluidas en tsconfig.
  - `node_modules/**`, `.next/**`, `playwright-report/**`, `test-results/**` — artefactos.
  - `src/__tests__/**`, `e2e/**` — calidad de tests es trabajo de Fase 6.
  - `messages/*.json` — copy i18n, ya cubierto por Sprint i18n previos.
  - PNG/JPG sueltos en raíz (`battle-history-*.png`) — visuales adjuntas, sin impacto arquitectónico (ver hallazgo BAJA al final).

---

## 3. Hallazgos

### ARQ-01 — Database type-graph cubre 4 tablas; el código consulta 11

- **Criticidad:** ALTA
- **Categoría:** Arquitectura
- **Ubicación:** `src/lib/supabase/types.ts:131-155`
- **Evidencia:**
  ```ts
  export interface Database {
    public: {
      Tables: {
        profiles:        { Row: Profile;        Insert: ProfileInsert; Update: ProfileUpdate }
        battles:         { Row: Battle;         Insert: BattleInsert;   Update: Partial<BattleInsert> }
        sync_queue:      { Row: SyncQueueRow;   Insert: { player_tag: string }; Update: Partial<SyncQueueRow> }
        webhook_events:  { Row: WebhookEvent;   Insert: { event_id: string; event_type: string }; Update: never }
      }
    }
  }
  ```
  Tablas realmente consultadas (probadas con grep `\.from\('...`):
  ```
  anonymous_visits  battles  brawler_trends  cron_heartbeats
  meta_matchups     meta_poll_cursors  meta_stats  meta_trios
  profiles          sync_queue  webhook_events
  ```
- **Problema detectado:** 7 tablas (`meta_stats`, `meta_matchups`, `meta_trios`, `meta_poll_cursors`, `cron_heartbeats`, `brawler_trends`, `anonymous_visits`) son "implícitas" — Supabase JS las acepta por strings y devuelve filas con tipo `any` (efectivamente). Esto invalida el `strict: true` en estas rutas calientes (cron, meta, brawler-trends). Cualquier renombrado de columna en una migración no falla en TS y se descubre solo en runtime. La confianza en el typecheck queda quebrada en exactamente las rutas más críticas (cron escribe ~10 k filas/run sin tipos).
- **Acción requerida:** generar `supabase/types.gen.ts` con `npx supabase gen types typescript --project-id <id>` y consumirlo en `createClient<Database>()`. Estimación: M (1 día — generar, parametrizar el client con el genérico, propagar fixes de tipos en las ~6 rutas que rompan).

### ARQ-02 — `pro-analysis/route.ts` es un God Object de 582 LoC con 6 responsabilidades

- **Criticidad:** ALTA
- **Categoría:** Arquitectura
- **Ubicación:** `src/app/api/meta/pro-analysis/route.ts:31-582`
- **Evidencia:**
  La función `GET()` única ejecuta secuencialmente: validación de parámetros (l. 33-43), creación de DOS clientes Supabase distintos —service-role y cookie— (l. 45-75), 4 queries `meta_stats` (l. 92-128), Tier 1 + Tier 2 fallback con 3 sub-queries en paralelo (l. 208-275), agregación `aggregateAllBrawlers` (helper interno l. 154-206), construcción de `trending` (l. 282-293), construcción de `counters` (l. 295-345), gating premium para `topBrawlers` (l. 347-348), `dailyTrend` premium (l. 351-376), trios y `topBrawlerTeammates` (l. 378-435), `proTrios` premium (l. 437-453), `personalGap` y `matchupGaps` con queries adicionales sobre `battles` (l. 455-557), serialización (l. 559-582).
- **Problema detectado:** un único `GET` de 580 líneas con cambios de capa (auth → query → agregación → premium-gating → serialización) entremezclados sin barreras. Cada nueva métrica obliga a editar este fichero en su justo medio, riesgo de regresión cruzada (un bug en gap-analysis tira el endpoint entero y la ruta es no-cachéable durante el premiumGap). El fichero está al borde del mismo problema que ya tuvo `compute.ts` antes de extraerse a `analytics/`.
- **Acción requerida:** extraer 4 módulos en `src/lib/meta/pro-analysis/` siguiendo el patrón ya usado por `src/lib/analytics/compute.ts`: `aggregate.ts` (Tier 1/2 + buildTrendMaps), `counters.ts`, `personalGap.ts`, `trios.ts`. Dejar la route como orquestador de 80-100 LoC. Estimación: M (4-6 h, código ya está en helpers internos `buildTrendMaps`/`aggregateAllBrawlers`; mover y testear).

### ARQ-03 — Duplicación deliberada entre `/api/meta` y `picks/page.tsx::fetchMetaEvents` ya creció a 100+ LoC

- **Criticidad:** ALTA
- **Categoría:** Código Limpio (DRY)
- **Ubicación:** `src/app/api/meta/route.ts:16-154` ↔ `src/app/[locale]/picks/page.tsx:53-162`
- **Evidencia:**
  ```ts
  // /api/meta/route.ts:39-94 (Tier 1 + Tier 2 con SPARSE_THRESHOLD = 30)
  const SPARSE_THRESHOLD = 30
  const sparseModes = new Set<string>()
  for (const event of draftEvents) { … if (total < SPARSE_THRESHOLD) sparseModes.add(event.event.mode) }
  if (sparseModes.size > 0) {
    const { data: modeStats } = await supabase
      .from('meta_stats').select(...).in('mode', Array.from(sparseModes))
    ...
  }
  ```
  ```ts
  // picks/page.tsx:86-116 — bloque idéntico con la misma constante 30, mismas variables y misma estructura
  const SPARSE_THRESHOLD = 30
  const sparseModes = new Set<string>()
  for (const event of draftEvents) { … if (total < SPARSE_THRESHOLD) sparseModes.add(event.event.mode) }
  if (sparseModes.size > 0) {
    const { data: modeStats } = await supabase
      .from('meta_stats').select(...).in('mode', Array.from(sparseModes))
    ...
  }
  ```
- **Problema detectado:** CLAUDE.md justifica esta duplicación como "YAGNI-acceptable" para "single cross-file reuse", pero ya son 3 lugares de divergencia silenciosa (constante `SPARSE_THRESHOLD`, lógica Tier 1/Tier 2, agregador). La intención de mantenerlas en sync es disciplina manual, sin red de seguridad. Cualquier ajuste de `SPARSE_THRESHOLD` o del shape del `topBrawlers[]` aplicado solo en `/api/meta` deja `/picks` SSR mostrando datos diferentes que la página de draft que llama al endpoint, exactamente el tipo de divergencia que ya pasó con `STANDARD_3V3_MODES` (citada en `compute.ts:285-291`).
- **Acción requerida:** extraer a `src/lib/meta/cascade.ts::buildEventsWithCascade(supabase, draftEvents)` devolviendo `MetaEvent[]`. Tanto la route como el server-component lo consumen. Aceptar el coste de un tipo público; es 1 export. Estimación: S (2-3 h).

### ARQ-04 — Doble convención de Telegram: `lib/telegram.ts` (archivo) vs `lib/telegram/` (directorio)

- **Criticidad:** MEDIA
- **Categoría:** Arquitectura / Nombrado
- **Ubicación:** `src/lib/telegram.ts` ↔ `src/lib/telegram/sender.ts`, `src/lib/telegram/dispatcher.ts`, etc.
- **Evidencia:**
  ```ts
  // src/lib/telegram.ts:8-24 — funcion notify()
  export async function notify(message: string): Promise<void> { … fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { … chat_id: CHAT_ID … }) … }
  ```
  ```ts
  // src/lib/telegram/sender.ts:11-42 — sendTelegramMessage()
  export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> { … fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { … chat_id: chatId … parse_mode: 'HTML', disable_web_page_preview: true }) … }
  ```
  Imports cruzados:
  ```
  src/app/api/notify/signup/route.ts:3:    import { notify } from '@/lib/telegram'
  src/app/api/webhooks/paypal/route.ts:4:  import { notify } from '@/lib/telegram'
  src/app/api/telegram/webhook/route.ts:6: import { sendTelegramMessage } from '@/lib/telegram/sender'
  ```
- **Problema detectado:** TS y bundlers permiten coexistir un `lib/telegram.ts` y un `lib/telegram/index.ts` (no existe pero podría confundir), pero el lector humano (y el agente IA) tropieza al razonar sobre "el módulo telegram". Hay dos funciones semánticamente equivalentes (`notify`, `sendTelegramMessage`) que difieren solo en `disable_web_page_preview` y manejo de logs. SRP violado: `notify` tiene chat_id implícito (env var); `sendTelegramMessage` lo recibe — son la misma función con dos APIs. Cualquier cambio en headers/timeouts requiere editar dos archivos. El comentario de `sender.ts:1-9` ya documenta la confusión defensivamente, lo que confirma que es deuda conocida.
- **Acción requerida:** mover `notify()` a `src/lib/telegram/notify.ts` (o `src/lib/telegram/admin.ts` para clarificar que envía al chat-admin), reescribirla como un wrapper de `sendTelegramMessage(process.env.TELEGRAM_CHAT_ID, message)`. Borrar `src/lib/telegram.ts`. Actualizar 3 imports. Estimación: S (30 min).

### ARQ-05 — Decisión-vs-realidad: `SafeAdSlot` mandatorio en CLAUDE.md, pero 8 páginas usan `AdPlaceholder` directo

- **Criticidad:** ALTA
- **Categoría:** Arquitectura / Cumplimiento de decisiones
- **Ubicación:** múltiples; ver listado.
- **Evidencia:**
  CLAUDE.md (`Important Decisions`):
  > "Ads go through `SafeAdSlot`, not `AdPlaceholder` directly — `SafeAdSlot` (`src/components/ui/SafeAdSlot.tsx`) forces every callsite to pass a required `hasContent: boolean` prop"

  Imports actuales:
  ```
  $ grep -rn "from '@/components/ui/AdPlaceholder'" src --include='*.tsx'
  src/app/[locale]/leaderboard/page.tsx:7
  src/app/[locale]/profile/[tag]/battles/page.tsx:8
  src/app/[locale]/profile/[tag]/brawlers/page.tsx:9
  src/app/[locale]/profile/[tag]/club/page.tsx:13
  src/app/[locale]/profile/[tag]/cosmetics/page.tsx:10
  src/app/[locale]/profile/[tag]/page.tsx:9
  src/app/[locale]/profile/[tag]/share/page.tsx:7
  src/app/[locale]/profile/[tag]/stats/page.tsx:14
  ```
  Solo 4 ficheros usan `SafeAdSlot` (`battle-history`, `brawler`, `brawler/[id]`, `picks`).
- **Problema detectado:** la intención del decisión-record es defenderse contra el ban de AdSense ("Valuable Inventory: No Content"). Que 8 páginas privadas usen `AdPlaceholder` directo significa que la guarda `hasContent` se evalúa de forma ad-hoc en cada callsite (varias páginas lo hacen, p.ej. `brawlers/page.tsx:374` con `{filteredAndSorted.length > 0 && <AdPlaceholder />}`, otras NO — `cosmetics/page.tsx:125` y `share/page.tsx:97` renderizan `<AdPlaceholder>` sin gate). Riesgo de re-incurrir en la misma infracción que ya causó un ban de cuenta. Adicionalmente, `AdPlaceholder` no es internamente tonto: hace `useEffect` con `window.adsbygoogle.push({})` (l. 25-34) — montarlo en un estado vacío sí dispara un slot vacío en AdSense.
- **Acción requerida:** auditar las 8 páginas; cada `<AdPlaceholder>` se sustituye por `<SafeAdSlot hasContent={…}/>` con la condición correcta (data && !error && lista no-vacía). Convertir `AdPlaceholder` en módulo NO exportado desde el barrel UI (rename a `_AdPlaceholder` o moverlo a `SafeAdSlot.internal.ts`) para forzar el uso del wrapper. Estimación: M (4 h — 8 callsites × revisar condición real).

### ARQ-06 — `lib/battle-sync.ts` y `app/api/cron/sync/route.ts` divergen: el manual NO escribe meta_stats

- **Criticidad:** ALTA
- **Categoría:** Datos / Arquitectura (DRY + SRP)
- **Ubicación:** `src/lib/battle-sync.ts:1-62` ↔ `src/app/api/cron/sync/route.ts:79-132`
- **Evidencia:**
  ```ts
  // lib/battle-sync.ts:39-59 — manual sync (botón "Sync ahora" del header)
  const parsed = parseBattlelog(entries, playerTag)
  const { error, count } = await supabase.from('battles').upsert(parsed, { onConflict: 'player_tag,battle_time', ignoreDuplicates: true, count: 'exact' })
  …
  await supabase.from('profiles').update({ last_sync: new Date().toISOString() }).eq('player_tag', playerTag)
  return { playerTag, fetched: entries.length, inserted: count ?? parsed.length, error: null }
  ```
  ```ts
  // cron/sync/route.ts:79-132 — cron sync
  const parsed = parseBattlelog(entries, player_tag)
  await supabase.from('battles').upsert(parsed, …)
  // ⬇ AQUÍ el cron además agrega meta_stats / meta_matchups / meta_trios:
  const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
  for (const b of parsed) {
    if (last_sync && b.battle_time <= last_sync) continue
    if (!isDraftMode(b.mode) || !b.map) continue
    …
    processBattleForMeta(acc, { myBrawlerId, opponentBrawlerIds: opponentIds, map: b.map, mode: b.mode, result: b.result })
  }
  if (acc.stats.size > 0) await supabase.rpc('bulk_upsert_meta_stats', { rows: statRows })
  …
  ```
- **Problema detectado:** dos rutas hacen "sync de un usuario premium" pero solo el cron alimenta `meta_stats` (source='users'). Si el usuario se sincroniza manualmente entre runs del cron, sus battles entran en `battles` pero NO en `meta_stats`, y el cursor `last_sync` se avanza, así que el siguiente cron salta esas battles por la guarda `b.battle_time <= last_sync`. Pérdida silenciosa de aporte al meta global (source='users') para todo usuario que pulse "Sync" entre crones. Es exactamente la clase de divergencia que CLAUDE.md alerta sobre el cascade `/api/meta` ↔ `picks/page.tsx`, pero aquí NO está documentada como aceptada y SÍ es un bug.
- **Acción requerida:** extraer un único helper `syncBattlesAndMeta(supabase, playerTag, lastSync)` en `src/lib/battle-sync.ts` que ambas rutas consumen. Devolver `{ fetched, inserted, metaRowsWritten }`. La route manual lo llama; el cron itera con él. Estimación: M (3-4 h — la lógica meta del cron tiene que aceptar la condición "no last_sync previo" que el manual no pasa hoy).

### ARQ-07 — `lib/analytics/compute.ts` (963 LoC) acerca el techo de SRP

- **Criticidad:** MEDIA
- **Categoría:** Código Limpio (SRP)
- **Ubicación:** `src/lib/analytics/compute.ts:1-963`
- **Evidencia:**
  El fichero exporta una `computeAdvancedAnalytics` que orquesta 21 sub-aggregaciones distintas (`computeOverview`, `computeStreaks`, `computeByBrawler`, `computeByMode`, `computeByMap`, `computeBrawlerMapMatrix`, `computeBrawlerModeMatrix`, `computeMatchups`, `computeTrioSynergy`, `computeTeammateSynergy`, `computeByHour`, `computeDailyTrend`, `computeBrawlerMastery`, `computeTiltAnalysis`, `computeSessions`, `computeClutch`, `computeOpponentStrength`, `computeBrawlerComfort`, `computePowerLevelImpact`, `computeSessionEfficiency`, `computeWarmUp`, `computeCarry`, `computeGadgetImpact`, `computeRecovery`, `computeWeeklyPattern`).
- **Problema detectado:** funciones puras no es justificación para 963 LoC en un fichero. Cada nueva métrica empuja la cifra; el momento ideal para fragmentar es ya. La `AdvancedAnalytics` interface en `analytics/types.ts` ya tiene 35 campos.
- **Acción requerida:** dividir en `analytics/compute/{overview,brawler,mode,map,matchups,trios,tilt,sessions,powerLevel,gadget,weeklyPattern}.ts`, manteniendo el barrel `analytics/index.ts` como punto de entrada único. La function `computeAdvancedAnalytics` queda en `compute/index.ts` orquestando 21 imports. Estimación: M (1 día — refactor mecánico, tests cubren cada subfuncion).

### ARQ-08 — `compute7dTrend` con doble fuente de verdad TS↔SQL sin enforcement

- **Criticidad:** ALTA
- **Categoría:** Datos / Arquitectura
- **Ubicación:** `src/lib/brawler-detail/trend.ts:32-62` y `supabase/migrations/021_brawler_trends_hardening.sql` (función `public.compute_brawler_trends()`)
- **Evidencia:**
  ```ts
  // trend.ts (TS, fallback inline + endpoint detalle)
  export const MIN_BATTLES_PER_TREND_WINDOW = 3
  …
  if (recentTotal < MIN_BATTLES_PER_TREND_WINDOW) return null
  if (prevTotal < MIN_BATTLES_PER_TREND_WINDOW) return null
  const recentWR = (recentWins / recentTotal) * 100
  const prevWR = (prevWins / prevTotal) * 100
  return Math.round((recentWR - prevWR) * 10) / 10
  ```
  CLAUDE.md ya advierte:
  > "If you change the threshold, the window math, or the rounding rule in one, change it in the other or the bulk endpoint and the detail endpoint will silently disagree for the same brawler. There's an integration test covering the endpoint's fast/fallback parity, but nothing enforces SQL-vs-TS equivalence — that's a manual discipline until we ship a Postgres-backed test environment."
- **Problema detectado:** la lógica vive en TS *y* en pl/pgSQL. La protección actual es disciplina humana. Cualquier cambio en `MIN_BATTLES_PER_TREND_WINDOW` o `Math.round((recentWR - prevWR) * 10) / 10` solo en uno de los dos lados produce dos endpoints (`/api/meta/brawler-trends` fast-path PRECOMPUTED vs `/api/meta/brawler-detail`) reportando trends DIFERENTES para el mismo brawler. La fase fast-path PRECOMPUTED se sirve a la grilla de 100 brawlers, mientras la detail page sirve la card individual — un usuario abre una card y ve un número que no cuadra con el badge en la lista.
- **Acción requerida:** dos opciones:
  1. (preferida) shippear el "Postgres-backed test environment" que CLAUDE.md menciona — un test de integración que llama a `compute_brawler_trends()` SQL via service-role client y compara contra `compute7dTrend()` TS sobre fixtures idénticas. Lograble con una migration de seed + un test vitest que llama el RPC.
  2. mover la fast-path a "agregación crudo + cómputo en TS" (la SQL solo agrupa por brawler, el endpoint corre `compute7dTrend` sobre los grupos). Cuesta latencia (la SQL ya devuelve el delta listo) pero elimina el doble código. Trade-off de M (cuesta ~30 ms por request, baja prioridad si la auditoría de Fase 5 confirma que está dentro del SLA del endpoint).
  Estimación: M (4-6 h, opción 1).

### ARQ-09 — Naming `ls_*` (Lemon Squeezy) en columnas de `profiles` propaga confusión PayPal-vs-LS

- **Criticidad:** MEDIA
- **Categoría:** Nombrado / Datos
- **Ubicación:** `src/lib/supabase/types.ts:14-28`, propagado a 8+ ficheros
- **Evidencia:**
  ```ts
  // types.ts
  export interface Profile {
    …
    ls_customer_id:        string | null
    ls_subscription_id:    string | null
    ls_subscription_status: SubscriptionStatus | null
    …
  }
  ```
  ```
  $ grep -rn "ls_subscription" src --include='*.ts' --include='*.tsx'
  src/app/api/checkout/paypal/confirm/route.ts:37   .select('tier, ls_subscription_status, ls_subscription_id')
  src/app/api/checkout/paypal/confirm/route.ts:51       ls_subscription_id: subscriptionId,
  src/app/api/checkout/paypal/confirm/route.ts:52       ls_subscription_status: 'active',
  src/app/api/profile/check-premium/route.ts:30       const status = profile.ls_subscription_status
  src/app/api/webhooks/paypal/route.ts:82            ls_subscription_id: subscriptionId,
  src/app/api/webhooks/paypal/route.ts:83            ls_subscription_status: mappedStatus,
  src/lib/premium.ts:13                              const status = profile.ls_subscription_status
  ```
- **Problema detectado:** stack actual usa PayPal (`paypal.ts`, `paypalStatusToTier`, `BILLING.SUBSCRIPTION.*`). Los nombres `ls_*` son legado de Lemon Squeezy y ya nunca los va a tocar LS. Cuando un nuevo dev (humano o IA) ve `ls_customer_id = 'paypal_${subscriptionId}'` (literalmente, en `webhooks/paypal/route.ts:84`) la pista cognitiva queda invertida. Y la documentación `MEMORY.md` del usuario menciona "Supabase + Lemon Squeezy" en `premium_architecture.md` — vector de migración no terminada.
- **Acción requerida:** migration `022_rename_ls_to_subscription.sql` que renombra `ls_customer_id → subscription_customer_id`, `ls_subscription_id → subscription_id`, `ls_subscription_status → subscription_status` (o `payment_provider_*`). Update de `Profile`/`ProfileInsert`/`ProfileUpdate` y los 8 callsites con un `replace_all`. Actualizar el `MEMORY.md` del usuario (anotar el rebranding en `premium_architecture.md`). Estimación: M (3-4 h con migration + ts updates + smoke test).

### ARQ-10 — Tres errores ESLint `react-hooks/set-state-in-effect` sin gate de CI

- **Criticidad:** MEDIA
- **Categoría:** Código Limpio / Resiliencia
- **Ubicación:** `src/components/landing/InputForm.tsx:46`, `src/components/landing/InputForm.tsx:75`, `src/hooks/useBrawlerTrends.ts:62`
- **Evidencia:**
  ```
  $ npx eslint .
  ✖ 73 problems (3 errors, 70 warnings)
  src/components/landing/InputForm.tsx:46  error  Calling setState synchronously within an effect can trigger cascading renders
  src/components/landing/InputForm.tsx:75  error  Calling setState synchronously within an effect can trigger cascading renders
  src/hooks/useBrawlerTrends.ts:62         error  Calling setState synchronously within an effect can trigger cascading renders
  ```
- **Problema detectado:** la regla en CLAUDE.md dice `npm run lint` y `tsc --noEmit` son comandos de validación pre-commit pero ESLint reporta 3 errores con exit-code != 0 (en eslint v9 con `defineConfig`). No hay hooks de pre-commit ni un job de CI que falle el build con esto. `useBrawlerTrends.ts:62` ya tiene un `// eslint-disable-next-line` en su gemelo `usePlayerData.ts:57` con justificación; el hook trends carece de la justificación y la disable-line. `InputForm` tiene comentarios extensos pero no `eslint-disable`. Inconsistencia: regla "set-state-in-effect" se acepta en 2 hooks análogos con justificaciones distintas. Tampoco hay un script `npm run lint:strict` o un pre-commit que rechace push con errors.
- **Acción requerida:** decidir y aplicar política. Opción A: añadir `eslint-disable-next-line` con razón en los 3 sites (la lógica es la classic "cache hit on mount", de hecho ya documentada en `usePlayerData`). Opción B: refactorizar a `useState(() => readCache())` lazy initializer (riesgo SSR — el comentario del hook de player lo argumenta en contra). Opción C: mover a un sync external store via `useSyncExternalStore`. Recomendación: A en los 3 sites + añadir `"lint:strict": "eslint . --max-warnings 0"` al `package.json` y un husky pre-commit. Estimación: S (1 h).

### ARQ-11 — Rate-limiter en memoria por instancia (false sense of security)

- **Criticidad:** MEDIA
- **Categoría:** Arquitectura / Seguridad (rozando ALTA si abusan)
- **Ubicación:** `src/app/api/analytics/route.ts:8-9`
- **Evidencia:**
  ```ts
  /** Per-user rate limit: 1 request per 10 seconds (in-memory, per function instance) */
  const RATE_LIMIT_MS = 10_000
  const rateLimitMap = new Map<string, number>()
  ```
- **Problema detectado:** Vercel Functions corren múltiples instancias por región y arrancan en frío. Un atacante autenticado puede dispararse N requests, cada uno cayendo en una instancia distinta sin entrada previa en su `Map`. El rate-limiter NUNCA limita en práctica. Peor: el comentario "Per-user rate limit" sugiere al lector que la protección está en su sitio. Si la Fase 5 decide subir el throttle a 1/seg porque `computeAdvancedAnalytics` cuesta CPU, el cambio será cosmético. (Ya hay rate-limit real en `/api/sync` por `last_sync` en DB, l. 35-41 — modelo correcto.)
- **Acción requerida:** mover la rate-limit a la fila de `profiles` (column `last_analytics_at`) o a una tabla `rate_limits(user_id, endpoint, last_at)` con un upsert atómico vía RPC `claim_rate_slot(user, endpoint, window_ms)`. Borrar el `Map` in-memory y su comentario engañoso. Estimación: S (2 h con SQL + cliente).

### ARQ-12 — Rutas API que importan `createServerClient` directo, en vez del wrapper de la capa server

- **Criticidad:** BAJA
- **Categoría:** Arquitectura (DRY)
- **Ubicación:** 4 ficheros
- **Evidencia:**
  ```
  $ grep -rn "createServerClient" src/app/api src/lib | grep "from '@supabase"
  src/app/api/auth/callback/route.ts:2     import { createServerClient } from '@supabase/ssr'
  src/app/api/cron/meta-poll/route.ts:2    import { createServerClient } from '@supabase/ssr'
  src/app/api/cron/sync/route.ts:2         import { createServerClient } from '@supabase/ssr'
  src/app/api/meta/pro-analysis/route.ts:2 import { createServerClient } from '@supabase/ssr'
  ```
  El wrapper canónico en `src/lib/supabase/server.ts` exporta `createClient()` (con cookies) y `createServiceClient()` (service-role). Los 4 ficheros aquí no lo usan; cada uno reimplementa la misma config inline.
- **Problema detectado:** divergencia de configuración (los 3 cron-routes pasan `cookies: { getAll: () => [], setAll: () => {} }` no-op; `auth/callback` reimplementa `getAll`/`setAll` con `cookies()` de next; `pro-analysis` lo combina con un cookie-auth client en paralelo). Cualquier cambio futuro en `sameSite`/`secure`/`domain` tiene que aplicarse a 5 ficheros. CLAUDE.md ya documenta "All user-authenticated routes use cookie-based auth via `createClient` from `@/lib/supabase/server`" — la convención existe pero solo se aplica al 70% de las rutas.
- **Acción requerida:** añadir un helper `createServiceClientNoCookies()` en `lib/supabase/server.ts` para los crones (es lo que ellos necesitan: service-role + sin cookies), reescribir los 4 imports. `auth/callback` puede usar `createClient()` existente (ya maneja cookies). Estimación: S (1 h).

### ARQ-13 — Tipos `MasteryPoint` / `BrawlerMastery` duplicados en componente y types canónico

- **Criticidad:** BAJA
- **Categoría:** Código Limpio (DRY)
- **Ubicación:** `src/components/analytics/MasteryChart.tsx:11-28` y `src/lib/analytics/types.ts:141-154`
- **Evidencia:**
  ```ts
  // MasteryChart.tsx:11-28 — declarado localmente
  interface MasteryPoint {
    date: string; wins: number; total: number; winRate: number;
    cumulativeWins: number; cumulativeTotal: number;
  }
  interface BrawlerMastery { brawlerId: number; brawlerName: string; points: MasteryPoint[] }
  interface Props { data: BrawlerMastery[] }
  ```
  ```ts
  // types.ts:141-154 — el "canónico", consumido por MasteryTimeline.tsx
  export interface BrawlerMastery {
    brawlerId: number
    brawlerName: string
    points: MasteryPoint[]
  }
  export interface MasteryPoint {
    date: string
    wins: number
    total: number
    winRate: number          // rolling WR up to this date
    cumulativeWins: number
    cumulativeTotal: number
  }
  ```
- **Problema detectado:** las dos definiciones son estructuralmente compatibles HOY. Si el shape canónico añade un campo (p.ej. `streak`), el componente sigue compilando contra su tipo local sin obtener el campo nuevo. El cliente del componente le pasa un `BrawlerMastery` que estructuralmente coincide y el campo nuevo se pierde silenciosamente.
- **Acción requerida:** borrar interfaces locales en `MasteryChart.tsx`, `import type { BrawlerMastery, MasteryPoint } from '@/lib/analytics/types'`. Estimación: S (15 min).

### ARQ-14 — `/api/calculate` invocado en `useClubEnriched` para 25-50 miembros (peso 1-3 s c/u)

- **Criticidad:** ALTA
- **Categoría:** Rendimiento / Arquitectura
- **Ubicación:** `src/hooks/useClubEnriched.ts:54-73`
- **Evidencia:**
  ```ts
  async function fetchMemberData(tag: string): Promise<Partial<EnrichedMember>> {
    const res = await fetch('/api/calculate', { method: 'POST', … body: JSON.stringify({ playerTag: tag }) })
    …
    return { totalGems: …, brawlerCount: …, powerLevelsGems: …, totalVictories: …, winRateUsed: …, estimatedHoursPlayed: …, highestTrophies: …, totalPrestigeLevel: …, expLevel: … }
  }
  ```
  Y el comentario de CLAUDE.md sobre `/api/calculate`:
  > "Reserve `/api/calculate` for the landing InputForm where the gem value is the actual deliverable."
- **Problema detectado:** `useClubEnriched` necesita `totalGems`/`powerLevelsGems` (sí necesita el cálculo), pero también extrae `totalVictories`, `winRateUsed`, `estimatedHoursPlayed`, `highestTrophies`, `totalPrestigeLevel`, `expLevel` — campos que `/api/player/tag-summary` ya expone. Aún si la página NO puede vivir sin gem-value, está trayendo 9 campos mientras paga el coste de 3 llamadas Supercell + el cómputo de gemas, EN CADA miembro, en BATCH_SIZE=5 paralelo. Para un club de 30 miembros, 6 batches de 5 = ~6 × 3-9 s = 18-54 s de carga total y carga de proxy Brawl Stars desproporcionada. CLAUDE.md AVISA explícitamente contra este patrón en el contexto de signup; aquí simplemente nadie aplicó la lección.
- **Acción requerida:** introducir `/api/player/club-summary` que devuelve solo los 9 campos sin el cómputo de gem-value (usa `fetchPlayer` solo, sin `fetchClub` ni `calculateValue`). O ampliar `/api/player/tag-summary` para devolver opcionalmente brawlerCount + victorias (los campos derivables del payload de player ya devuelto). Cambiar `useClubEnriched` a la nueva ruta. Estimación: M (3-4 h con tests).

### ARQ-15 — `META_POLL_MAX_DEPTH` y `maxDuration` divergen entre código, comentarios y CLAUDE.md

- **Criticidad:** BAJA
- **Categoría:** Documentación / Nombrado
- **Ubicación:** `src/lib/draft/constants.ts:158`, `src/app/api/cron/meta-poll/route.ts:48`, `CLAUDE.md`
- **Evidencia:**
  - `constants.ts:158`: `export const META_POLL_MAX_DEPTH = 1000`
  - `meta-poll/route.ts:48-50` (header docstring): `"Loop through the candidate pool up to META_POLL_MAX_DEPTH (1000 on Hobby plan, 1500 on Pro)"`
  - `meta-poll/route.ts:80`: `export const maxDuration = 300`
  - CLAUDE.md (`Data Pipeline`): `"Base batch: 200 players. Hard cap: 600. Top-up chunks of 100…"`, `"Runtime: ~60s balanced day, up to ~180s on top-up days. Well inside the 300s Vercel Function cap."`
- **Problema detectado:** CLAUDE.md describe un esquema (200 base / 600 cap / top-up) que NO existe en el código actual. El código actual es probabilistic-sampling con MAX_DEPTH=1000 y un soft-budget de 270s. La discrepancia es ≥ 1.5×: si un agente IA toma CLAUDE.md como verdad y diseña un cambio sobre "top-up chunks of 100", el cambio no aplica.
- **Acción requerida:** actualizar CLAUDE.md (sección "Data Pipeline → cron meta-poll") para reflejar el sampler probabilístico de Sprint F: "candidate pool 11 country rankings ≈ 2,100 unique players, MAX_DEPTH=1000, sampler `p = min(1, (minLive+1)/(current+1))`, soft budget 270s on `maxDuration=300`". Estimación: S (15 min, solo docs).

---

## 4. Sin hallazgos en

- **Dependencias circulares entre paquetes:** revisé los grafos de import de `lib → components`, `components → lib`, `app → lib`, `app → components`. No detecté ningún ciclo. `lib/utils.ts` importa de `lib/constants.ts` (sin ciclo). `lib/battle-parser.ts` importa de `lib/draft/constants.ts` (sin ciclo). `app/[locale]/layout.tsx` y `proxy.ts` no se importan circularmente.
- **Cross-layer leakage `lib → components`:** grep `import .* from '@/components'` dentro de `src/lib` devuelve 0 resultados. La capa `lib` está limpia.
- **LSP / ISP violations en jerarquías de tipos:** no hay clases con herencia ni interfaces "fat" con `NotImplementedError`. La única clase no-trivial es `SuprecellApiError` en `api.ts:35-43` (extends Error, sin contratos rotos).
- **Patrones de moda mal aplicados:** no hay DDD táctico, no hay hexagonal con 1 adapter, no hay "microservicios fingidos". El stack es coherentemente Next.js App Router monolito + Supabase.
- **Inconsistencias de carpetas:** todas las carpetas usan `kebab-case` plural (`components/`, `hooks/`, `lib/`, `analytics/`, `brawler-detail/`, etc.). Solo `__tests__` usa el formato `__double-underscore__` por convención de Vitest. Aceptable.
- **Convenciones snake/camel:** TS files exclusivamente camelCase. Columnas de DB exclusivamente snake_case (`battle_time`, `player_tag`, `last_sync`). El boundary se respeta. Solo el ARQ-09 (ls_*) introduce ruido conceptual, pero no de naming-style.
- **Estructura de App Router:** `[locale]/...` para páginas localizadas, `app/api/` aislado. Convención `proxy.ts` correcta para Next 16 (CLAUDE.md lo documenta como gotcha). `src/middleware.ts` no existe (correcto). Single source of truth para metadata en `[locale]/layout.tsx::LOCALE_COPY` confirmado.
- **God Objects en `lib/`:** revisados los 16 ficheros de `lib/`. Solo `compute.ts` (963 LoC) y `lib/telegram/queries.ts` (471 LoC) están por encima del umbral; `compute.ts` ya quedó cubierto en ARQ-07; `queries.ts` está bien estructurado en sub-funciones (`getStats`, `getBattles`, `getMap`, `getCron`, `getPremium`) y exporta un `queries` namespace coherente — sin hallazgo.
- **Nombrado de endpoints REST:** uniformes (todos sustantivos plurales: `/battles`, `/profiles`, `/brawlers`, `/maps`, `/events`; o gerundios para acciones: `/calculate`, `/sync`). No hay mezcla verb-vs-noun.

---

## 5. Notas y limitaciones

- **Supuestos hechos:**
  - Asumo que las migraciones SQL en `supabase/migrations/*.sql` están aplicadas en producción (no validable desde el repo). El audit razona sobre el shape declarado, no sobre el real en DB.
  - Asumo que `BRAWLSTARS_API_URL` en producción apunta al proxy correcto y los crones tienen acceso (.env.local local no se inspecciona por seguridad).
  - El "premium architecture" del MEMORY.md menciona Lemon Squeezy + pg_cron como spec aprobada; el código actual usa PayPal — interpreto que la spec quedó parcialmente migrada y la decisión de PayPal ya es definitiva.

- **Áreas que NO pude auditar y por qué:**
  - El estado real de `pg_cron` jobs (compute-brawler-trends, archive cron) requiere acceso a la DB; aquí solo audité el código que los invoca.
  - No corrí `npm run build` (Next 16 con cacheComponents puede tardar ≥ 60 s y no aporta nuevos hallazgos arquitectónicos sobre los que ya saqué del typecheck + lint).
  - El comportamiento dinámico (race conditions en `AuthProvider`, `InputForm`'s `useEffect` cascade, `useClubEnriched` con BATCH_SIZE=5) es trabajo de Fase 5 (resiliencia) o Fase 3 (lógica), aquí solo lo flagueé como ARQ-10/ARQ-14 cuando vi un error de regla.

- **Criterio de muestreo para los ficheros >200 LoC:**
  Top-25 por LoC priorizado, además los ficheros que CLAUDE.md cita explícitamente (cron meta-poll, pro-analysis, brawler-trends, picks/page, [locale]/layout, AuthProvider, supabase/server, premium, paypal, telegram). Los 8 ficheros que NO se leyeron en detalle (`battle-history/page.tsx`, `cosmetics/page.tsx`, `compare/page.tsx` >100 LoC, `share/page.tsx`, los charts `MatchupMatrix.tsx`/`TimeOfDayChart.tsx`/`BrawlerMapHeatmap.tsx`/`OverviewStats.tsx`) son layouts de presentación y, por inspección rápida, siguen el mismo patrón hook-based; no esperaba hallazgos arquitectónicos nuevos.

- **PNG sueltos en raíz** (`battle-history-en-desktop.png`, `battle-history-es*.png`, etc., ~1.3 MB total) — son screenshots de QA; deberían moverse a `docs/screenshots/` o ignorarse en `.gitignore`. Hallazgo BAJA-mínimo no-listado en sección 3 porque es housekeeping, no arquitectura.
