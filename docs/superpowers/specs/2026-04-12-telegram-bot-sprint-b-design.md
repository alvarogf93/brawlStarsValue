# Telegram Bot Sprint B — Design Spec

**Date:** 2026-04-12
**Status:** Approved by user (v1, post 2nd-pass review), pending implementation plan
**Author:** Brainstormed with Claude (superpowers:brainstorming)

## Changelog

- **v1 (2026-04-12)** — initial design, 5 sections reviewed sequentially with user approval. Second review pass identified 9 minor consistency fixes applied inline (see §15 Review Findings).

## 1. Motivation

Sprint A (2026-04-12 earlier today) delivered `anonymous_visits` tracking: every tag submitted in the landing is captured and notified to the admin Telegram chat. That unlocks inbound data visibility.

Sprint B delivers the **consumer of that data**: a conversational Telegram bot that lets the admin query the state of the whole BrawlVision project from their phone, without opening the Supabase dashboard. It complements Sprint A by closing the feedback loop — Sprint A pushes new visitors, Sprint B pulls aggregated metrics on demand.

Commands in scope for v1 (user explicitly confirmed during brainstorming):

1. `/stats` — project-wide overview
2. `/batallas` — battle sync state
3. `/premium` — monetization metrics
4. `/cron` — cron job status and data freshness
5. `/mapa` — coverage by map, with optional argument
6. `/help` — command listing

## 2. Scope

**In scope:**

- Webhook endpoint `POST /api/telegram/webhook` that receives updates from Telegram
- 2-layer authentication (secret header + chat_id match)
- Command dispatcher with registry pattern
- 6 command handlers with extended-format responses
- Shared SQL query layer (`queries.ts`) and formatter utilities (`formatters.ts`)
- Unit tests (~60) and integration tests (~22) fully automated
- Manual smoke test checklist for rollout verification
- Documentation of the webhook setup procedure

**Out of scope (explicitly deferred):**

- **Push notifications / daily digest**: user confirmed pull-only for v1, push daily is Sprint B v2 follow-up
- **Inline keyboards / callback_query**: v2 only
- **Natural language queries** (`/ask <pregunta>` with Claude Haiku): v2 only if needed
- **E2E tests against real Telegram**: intentionally not automated — see §11
- **LTV / revenue / churn metrics in `/premium`**: require a `subscriptions` or `payments` table that is not confirmed to exist. `/premium` will explicitly surface this limitation in its output
- **Dedup of `update_id`**: every command is idempotent so double-processing is harmless
- **Healthchecks.io API integration in `/cron`**: documented as future work in `docs/crons/SETUP-HEALTHCHECKS.md` Part 6
- **Rate limiting**: only one user authorized, spamming impossible in practice

## 3. User Decisions (Brainstorming Q&A Summary)

| Question | Decision | Implication |
|---|---|---|
| **Q1** — Auth | Only the admin chat, matched against `TELEGRAM_CHAT_ID` env var | No allowlist table needed. Single-user bot. |
| **Q2** — Command parsing | Exact-match deterministic commands, no LLM | Zero variable cost, zero hallucinations, faster implementation |
| **Q3** — Response format | Extended with sections, sparklines, top-N | More SQL queries per command; richer output. ~400-1200 char messages |
| **Q4** — Push vs pull | v1 pull-only; push daily as Sprint B v2 follow-up | `pg_cron` triggered digest is reuse of same handler code, ~20 lines extra |
| **Q5** — `/mapa` parameter | Case-insensitive prefix match + paginated listing when no arg | Needs `findMapByPrefix` helper with ambiguity handling |
| **Q6** — Error handling | Friendly error messages + `/help` command | 3-level try/catch in the webhook handler |
| **Q7** — `/cron` scope | pg_cron direct + data freshness inference for VPS crons | No healthchecks.io dependency. Indirect but actionable |

## 4. Architecture

### 4.1 Request flow

```
     Telegram user              Telegram servers           Vercel (BrawlVision)
     ─────────────              ────────────────           ────────────────────
           │                            │                           │
           │  "/stats"                  │                           │
           ├───────────────────────────▶│                           │
           │                            │                           │
           │                            │   POST /api/telegram/webhook
           │                            ├──────────────────────────▶│
           │                            │   X-Telegram-Bot-Api-Secret-Token: <SECRET>
           │                            │   { message: {chat, text} } │
           │                            │                           │
           │                            │                           │── L1 auth: header secret
           │                            │                           │── Parse body
           │                            │                           │── L2 auth: chat.id === TELEGRAM_CHAT_ID
           │                            │                           │── dispatcher.parse(text)
           │                            │                           │── handler(args, queries)
           │                            │                           │── sendTelegramMessage(chat.id, response)
           │                            │                           │── return 200 OK
           │                            │◀──────────────────────────│
           │                            │                           │
           │  "📊 BrawlVision..."      │                           │
           │◀───────────────────────────│                           │
           │                            │                           │
```

### 4.2 File structure

```
src/app/api/telegram/webhook/route.ts       ← POST handler: 2-layer auth + dispatch + 3-level catch
src/lib/telegram/
  ├── types.ts                              ← TelegramUpdate, TelegramMessage, CommandContext, Queries, StatsData, etc.
  ├── constants.ts                          ← EXPECTED_CRON_RUNS_24H, FRESHNESS_EMOJI, MIN_BATTLES_FOR_RANKING, thresholds
  ├── dispatcher.ts                         ← parseCommand() + command registry Map<name, handler>
  ├── sender.ts                             ← sendTelegramMessage(chatId, text)
  ├── queries.ts                            ← getStats(), getBattles(), getPremium(), getCronStatus(), getMapList(), getMapData(), findMapByPrefix() + memoized admin client
  ├── formatters.ts                         ← sparkline(), bar(), fmtTimeAgo(), fmtNumber(), section(), clampToTelegramLimit(), escapeHtml()
  └── commands/
      ├── stats.ts
      ├── batallas.ts
      ├── premium.ts
      ├── cron.ts
      ├── mapa.ts
      └── help.ts

src/__tests__/unit/lib/telegram/
  ├── dispatcher.test.ts                    ← 8-10 tests
  ├── sender.test.ts                        ← 3 tests
  ├── queries.test.ts                       ← 15-20 tests (one per function, happy + empty + error)
  ├── formatters.test.ts                    ← 10-12 tests
  └── commands/
      ├── stats.test.ts                     ← 3 tests
      ├── batallas.test.ts                  ← 3 tests
      ├── premium.test.ts                   ← 3 tests
      ├── cron.test.ts                      ← 4 tests
      ├── mapa.test.ts                      ← 6 tests
      └── help.test.ts                      ← 1 test

src/__tests__/integration/api/telegram/
  ├── webhook-auth.test.ts                  ← 3 tests (L1 fail, L2 fail, body malformed)
  ├── webhook-stats.test.ts                 ← 3 tests
  ├── webhook-batallas.test.ts              ← 3 tests
  ├── webhook-premium.test.ts               ← 2 tests
  ├── webhook-cron.test.ts                  ← 4 tests
  ├── webhook-mapa.test.ts                  ← 6 tests
  └── webhook-help.test.ts                  ← 1 test

scripts/setup-telegram-webhook.js           ← one-shot script to register the webhook with Telegram
```

**Total test count:** ~60 unit + 22 integration = **~82 automated tests**.

### 4.3 Module responsibilities

- **`webhook/route.ts`**: HTTP entry point only. Parses body, does 2-layer auth, dispatches to a handler, sends response. All try/catch lives here. Never contains domain logic.
- **`types.ts`**: all shared types — both Telegram API types and internal types (`Queries`, `StatsData`, `BattlesData`, `PremiumData`, `CronData`, `MapData`, `MapMatchResult`, `FreshnessStatus`). **`Queries` interface lives in `types.ts`**, not `queries.ts`, to avoid circular imports.
- **`constants.ts`**: all tunable knobs as named constants. Crucially `EXPECTED_CRON_RUNS_24H`, `FRESHNESS_EMOJI`, `MIN_BATTLES_FOR_RANKING`, freshness thresholds per cron.
- **`dispatcher.ts`**: `parseCommand(text)` splits the text into `{ commandName, args }`. A `Map<string, CommandHandler>` registers the 6 handlers. Case-insensitive on command name (`/STATS` === `/stats`).
- **`sender.ts`**: `sendTelegramMessage(chatId, text)`. Accepts `chatId` as parameter (NOT coupled to `TELEGRAM_CHAT_ID` env). Logs failures instead of silent-failing. Distinct from `notify()` which the rest of the app keeps using.
- **`queries.ts`**: one function per command's data needs. Uses a memoized `@supabase/supabase-js` admin client at module level. Each function returns a typed object.
- **`formatters.ts`**: pure functions, no I/O. Visual helpers.
- **`commands/*.ts`**: each a single function `handleX(ctx: CommandContext) => Promise<string>`. Handlers are pure wrt the injected querier — they never call `supabase` directly. This makes them trivially unit-testable.

### 4.4 Data flow inside the handler

```ts
// Pseudocode of src/app/api/telegram/webhook/route.ts POST
export async function POST(request: Request) {
  try {
    // ─── L1 auth: secret token header ───
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
    if (headerSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('[telegram/webhook] L1 auth fail')
      return NextResponse.json({ ok: true })  // silent 200 — no fingerprinting
    }

    // ─── Body parse ───
    let body: TelegramUpdate
    try { body = await request.json() } catch (parseErr) {
      console.error('[telegram/webhook] malformed body', parseErr)
      return NextResponse.json({ ok: true })
    }
    const message = body.message
    if (!message?.text) return NextResponse.json({ ok: true })

    // ─── L2 auth: chat_id match (String comparison, not parseInt) ───
    if (String(message.chat.id) !== String(process.env.TELEGRAM_CHAT_ID)) {
      console.warn('[telegram/webhook] L2 auth fail', { chatId: message.chat.id })
      return NextResponse.json({ ok: true })
    }

    // ─── Dispatch ───
    const chatId = message.chat.id
    try {
      const { commandName, args } = parseCommand(message.text)
      const handler = commandRegistry.get(commandName.toLowerCase())
      if (!handler) {
        await sendTelegramMessage(
          chatId,
          `❓ Comando no reconocido: <code>${escapeHtml(commandName)}</code>\n\nPrueba /help`,
        )
        return NextResponse.json({ ok: true })
      }
      const response = await handler({ args, queries: getQueries() })
      await sendTelegramMessage(chatId, clampToTelegramLimit(response))
    } catch (commandErr) {
      console.error('[telegram/webhook] command failed', { text: message.text, err: commandErr })
      try {
        await sendTelegramMessage(
          chatId,
          `💥 Error ejecutando el comando.\n\n<code>${escapeHtml(
            commandErr instanceof Error ? commandErr.message : 'unknown',
          )}</code>\n\nRevisa los logs de Vercel para el stack completo.`,
        )
      } catch (sendErr) {
        console.error('[telegram/webhook] failed to send error message', sendErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (fatalErr) {
    console.error('[telegram/webhook] FATAL', fatalErr)
    return NextResponse.json({ ok: true })  // always 200 to Telegram
  }
}
```

**Principles:**

1. **Always return 200 OK to Telegram**, even on failure. Otherwise Telegram retries up to ~100 times over an hour on the same `update_id`.
2. **3-level try/catch**: fatal (outer) → command execution → send message. Each level has a corresponding log.
3. **Sync `await` of `sendTelegramMessage`**, NOT `after()`. The outgoing message IS the product of the webhook; deferring it breaks the value.

## 5. Command Specifications

Every command handler has this signature:

```ts
type CommandHandler = (ctx: CommandContext) => Promise<string>

interface CommandContext {
  args: string[]           // text split by whitespace after the command name
  queries: Queries         // injected for testability
}
```

### 5.1 `/help`

**Queries:** none. String constant.

**Output:**

```
🤖 BrawlVision Bot

Comandos disponibles:

/stats — resumen global del sistema
/batallas — estado del battle sync
/premium — métricas de monetización
/cron — estado de los cron jobs
/mapa <nombre> — datos de un mapa específico
/mapa — listado de mapas con datos hoy

/help — este mensaje

Formato de nombres de mapa:
  case-insensitive + prefix match
  /mapa side → "Sidetrack"
  /mapa heal → "Healthy Middle Ground"
```

### 5.2 `/stats` — project-wide overview

**Queries:** `queries.getStats()` — ~12-15 queries in parallel via `Promise.all`. See §6 for exact list.

**Output (realistic, with audit data from 2026-04-12):**

```
📊 BrawlVision Stats
2026-04-12 18:30 UTC

👥 USUARIOS
  Total registered:     3
  Premium activos:      1
  En trial:             0
  Visitantes anónimos:  3 (últimos 30d)

  Anon new / day (7d)
  ▁▁▁▁▁▁▃  → 3 new today

⚔️ ACTIVIDAD (battles table — premium sync)
  Total batallas:      108
  Hoy:                   14
  Últimos 7 días:      108

  Battles / day (7d)
  ▂▂▃▄▄▄█  → 14 today

🌐 META POLL (global pool)
  Meta rows hoy:       836
  Meta rows total:   3,443
  Pool efectivo:       183 / 205 cursors
                       (22 stale >24h)
  Última actividad:  hace 37 min

🎯 TOP 3 MAPAS (hoy)
  1. Sidetrack               2,798 battles
  2. Healthy Middle Ground   2,017 battles
  3. Nutmeg                  1,848 battles

🏆 TOP 3 BRAWLERS (hoy, por win rate)
  1. (brawler)  WR XX% (N partidas)
  2. (brawler)  WR XX%
  3. (brawler)  WR XX%
```

**Edge cases:**

- Empty table → section shows `— sin datos`
- Query failure → propagated to command-level catch in webhook handler

### 5.3 `/batallas` — battle sync state

**Queries:** `queries.getBattles()` — 6-8 queries in parallel.

**Output:**

```
⚔️ BATTLES SYNC
2026-04-12 18:30 UTC

📦 VOLUMEN
  Total batallas:          108
  Hoy:                      14
  Ayer:                      0
  Últimos 7d:              108
  Últimos 30d:             108

  Battles/day last 14d
  ▁▁▁▁▁▁▁▂▂▃▄▄▄█

🎮 DISTRIBUCIÓN POR MODO (últimos 7d)
  lastStand       7   (50%)  ████████████████
  brawlBall       3   (21%)  ███████
  gemGrab         2   (14%)  █████
  knockout        2   (14%)  █████

⚖️ RESULTADO (últimos 7d)
  Victory   48  (44%)  ██████████
  Defeat    55  (51%)  ███████████
  Draw       5   (5%)  █

👤 TOP 5 PLAYERS MÁS ACTIVOS (últimos 7d)
  1. #YJU282PV    108 batallas
  (solo 1 player premium activo)

🔄 SYNC STATUS
  Última sync exitosa: hace 18 min
  Queue pending:       0
```

**Edge cases:** empty `battles` → `"No hay batallas registradas aún. El primer user premium debe sincronizar."`

### 5.4 `/premium` — monetization metrics

**Queries:** `queries.getPremium()` — 5 queries.

**Output:**

```
💎 PREMIUM
2026-04-12 18:30 UTC

✨ ESTADO ACTUAL
  Premium activos:         1
  En trial:                0
  Free:                    2

📈 FUNNEL 30 DÍAS
  Nuevos signups:          3
  Activaron trial:         3  (100%)
  Trial → premium:         1   (33%)
  Trials expirados:        0
  Churn (premium cancelados): 0

📅 PRÓXIMAS RENOVACIONES (próximos 7d)
  — ninguna detectada
  (Requiere integración con tabla de subscriptions
   de PayPal — v2 cuando se active)

⭐ LTV / REVENUE
  (Requiere tabla de payments — ver docs/crons/README.md
   para el plan de integración)
```

**Known limitations surfaced in the output:**

- Churn, LTV, revenue, and renewal-date metrics require tables that are not confirmed to exist (`subscriptions`, `paypal_webhook_events`). The command reports these as "requires integration" rather than calculating fake numbers.
- If the user confirms those tables exist, extend `getPremium()` to query them in v1.5 without changing the design.

### 5.5 `/cron` — cron status + data freshness inference

**Queries:**

- `supabase.rpc('diagnose_cron_jobs')` — list all pg_cron jobs (already in production from migration `010`)
- `supabase.rpc('diagnose_cron_runs', { p_limit: 500 })` — recent runs, enough to count 24h for the most frequent job (288 runs/day for `process-sync-queue`)
- `meta_poll_cursors.select(last_battle_time).order desc.limit(1)` — latest VPS meta-poll activity
- `profiles.select(last_sync).order desc.limit(1) WHERE tier IN ('premium','pro')` — latest VPS sync activity

**Runs-counting logic:** the handler counts runs within the last 24h by filtering `cronRuns` in JS (`start_time > now - 24h`) per `jobid`. Expected runs come from a hardcoded lookup:

```ts
// src/lib/telegram/constants.ts
export const EXPECTED_CRON_RUNS_24H: Record<string, number> = {
  'enqueue-premium-syncs': 96,      // */15 * * * *  → 4 runs/h × 24 = 96
  'process-sync-queue': 288,        // */5 * * * *   → 12 runs/h × 24 = 288
  'cleanup-anonymous-visits': 1,    // 0 3 * * *     → 1 run/day
}
```

**Drift warning:** when adding a new pg_cron job or changing its schedule, update `EXPECTED_CRON_RUNS_24H`. This is tracked drift: the alternative is parsing cron strings in JS at runtime (needs `cron-parser` dependency, not worth it for a 3-entry constant).

**Freshness inference** (see §6.5 for full helper):

```ts
// Thresholds per VPS cron (in constants.ts):
export const FRESHNESS_THRESHOLDS = {
  'meta-poll': { expectedMin: 30, graceMin: 5 },
  'sync': { expectedMin: 20, graceMin: 5 },
}

// Status derivation:
//   fresh: age < expected + grace
//   stale: expected + grace ≤ age < expected × 3
//   dead:  age ≥ expected × 3
```

**Freshness emojis** (consistent across all commands):

```ts
export const FRESHNESS_EMOJI: Record<FreshnessStatus, string> = {
  fresh: '✅',
  stale: '🟡',
  dead: '🔴',
  unknown: '❓',
}
```

**Output:**

```
🔄 CRON STATUS
2026-04-12 18:30 UTC

📅 PG_CRON JOBS (Supabase — directo)

  ✅ enqueue-premium-syncs
     Schedule:    */15 * * * *
     Last run:    hace 8 min  (succeeded, 0.0s)
     Runs 24h:    96 / 96 expected

  ✅ process-sync-queue
     Schedule:    */5 * * * *
     Last run:    hace 2 min  (succeeded, 0.0s)
     Runs 24h:    288 / 288 expected

  ✅ cleanup-anonymous-visits
     Schedule:    0 3 * * *
     Last run:    hace 15h 30m  (succeeded, 0.1s)

🖥️ VPS ORACLE CRONS (inferencia por frescura)

  🟡 meta-poll   (expected: */30 min)
     Proxy:  meta_poll_cursors latest update
     Latest: hace 37 min
     Status: stale — esperado <35min, real 37min
     (ligero retraso, aceptable)

  ✅ sync        (expected: */20 min)
     Proxy:  profiles.last_sync latest (premium)
     Latest: hace 18 min
     Status: fresh

⚠️ Nota: los 2 crons del VPS no son visibles directamente
desde aquí. El status mostrado es inferencia por la frescura
de los datos que cada cron produce. Para status directo y
alertas en tiempo real, configurar healthchecks.io siguiendo
docs/crons/SETUP-HEALTHCHECKS.md
```

**Edge cases:**

- Cron run with `status: 'failed'` → emoji ❌, include `return_message` truncated to 100 chars
- No recent runs at all for a job → status "unknown" with ❓ emoji
- RPC call fails → section shows "(no disponible)" and the command continues with the freshness section

### 5.6 `/mapa` — map coverage

**Two variants** based on args:

#### 5.6.1 `/mapa` without args — paginated list

**Query:** `queries.getMapList()` — 1 query over `meta_stats WHERE date = CURRENT_DATE AND source='global'`, then aggregate in JS by `(map, mode)`.

**Output:**

```
🗺️ MAPAS CON DATOS HOY (44 total)

 1. brawlBall :: Sidetrack               2,798 battles · 81 brawlers
 2. knockout  :: Healthy Middle Ground   2,017 battles · 59 brawlers
 3. brawlBall :: Nutmeg                  1,848 battles · 61 brawlers
 4. hotZone   :: Golden Bay                980 battles · 40 brawlers
 5. bounty    :: Layer Cake                909 battles · 41 brawlers
...
44. heist     :: Pit Stop                     2 battles ·  1 brawler

Para detalles de un mapa: /mapa <nombre>
Ejemplo: /mapa sidetrack
```

No pagination via inline keyboards in v1 (deferred to v2). Output is clamped to 4000 chars by `clampToTelegramLimit` as safety, though 44 lines is well under the limit.

#### 5.6.2 `/mapa <nombre>` — specific map details

**Queries:**

1. `queries.findMapByPrefix(args[0])` — returns `{ kind: 'none' | 'found' | 'ambiguous', ... }`
2. If `kind === 'found'`: `queries.getMapData(map, mode)` — 5-6 queries over `meta_stats` and optionally `meta_matchups`

**findMapByPrefix logic:**

```ts
// Case-insensitive prefix match against distinct (map, mode) pairs
// that have data today
SELECT DISTINCT map, mode
FROM meta_stats
WHERE date = CURRENT_DATE
  AND source = 'global'
  AND LOWER(map) LIKE LOWER($1) || '%'
LIMIT 10
```

- 0 results → `{ kind: 'none' }`
- 1 result → `{ kind: 'found', map, mode }`
- 2+ results → `{ kind: 'ambiguous', candidates }` (up to 10)

**Output (example `/mapa sidetrack`):**

```
🗺️ SIDETRACK (brawlBall)
2026-04-12 18:30 UTC

📊 COBERTURA
  Battles hoy:        2,798
  Battles 7d:        19,586
  Brawlers cubiertos:   81 / 82
  Pool density:       HIGH ✅

📈 Battles/day last 7d
  ████▇██  (stable coverage)

🏆 TOP 5 BRAWLERS POR WIN RATE (hoy)
  1. EDGAR      62.4%  (123 battles)
  2. MICO       58.1%  ( 89 battles)
  3. BUZZ       57.8%  (156 battles)
  4. KENJI      56.9%  (102 battles)
  5. LOU        56.2%  ( 78 battles)

💀 BOTTOM 3 (worst win rates hoy, min 30 battles)
  1. JACKY      38.2%  ( 41 battles)
  2. RICO       39.1%  ( 35 battles)
  3. EVE        40.5%  ( 52 battles)

📊 COMPARACIÓN con otros brawlBall maps
  Sidetrack     2,798 ████████████████████ (#1)
  Nutmeg        1,848 █████████████
  Slippery Slap   334 ██
  Backyard Bowl     9 ▁ (thin coverage)

Última actualización: hace 37 min (meta_poll_cursors)
```

**Edge cases:**

- **Not found**: `"No hay mapa que empiece por 'xyz'. Usa /mapa para ver el listado completo."`
- **Ambiguous**: `"Ambiguo: 'bea' matchea Beach Ball (brawlBall) y Bea Stadium (knockout). Usa el nombre más específico."`
- **Sparse data** (`totalBattlesToday < MIN_BATTLES_FOR_RANKING = 30`): the top/bottom ranking blocks are omitted. The response shows coverage numbers only and the message `"Datos insuficientes para ranking fiable (< 30 batallas). Vuelve más tarde."`

## 6. Queries Layer (`queries.ts`)

All functions return typed objects. Admin client is memoized at module level.

### 6.1 Admin client setup

```ts
// src/lib/telegram/queries.ts — top of file
import 'server-only'
// NOTE: `server-only` is not installed as a dep in this repo (per the
// anonymous_visits sprint decision); use a header comment instead if needed
import { createClient as createSupabaseAdmin, type SupabaseClient } from '@supabase/supabase-js'

// Memoized per cold start. Same pattern as src/lib/anonymous-visits.ts.
let _admin: SupabaseClient | null = null

function getAdmin(): SupabaseClient {
  if (_admin) return _admin
  _admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return _admin
}

export const queries: Queries = {
  getStats,
  getBattles,
  getPremium,
  getCronStatus,
  getMapList,
  getMapData,
  findMapByPrefix,
}
```

If the repo decides later to add the `server-only` npm package, a single-line import uncommented. Until then, the comment block serves as the marker (same rationale as `anonymous-visits.ts`).

### 6.2 `getStats()` — ~12-15 queries in parallel

```ts
export async function getStats(): Promise<StatsData> {
  const admin = getAdmin()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    totalUsers,
    premiumCount,
    trialCount,
    anonCount30d,
    anonLast7d,           // raw rows for sparkline
    totalBattles,
    battlesToday,
    battlesLast7d,        // raw rows for sparkline
    metaRowsToday,
    metaRowsTotal,
    activeCursors,
    staleCursors,
    latestCursor,
    todayMetaRows,        // raw for top 3 maps + brawlers aggregation in JS
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).in('tier', ['premium', 'pro']),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gt('trial_ends_at', now.toISOString()),
    admin.from('anonymous_visits').select('*', { count: 'exact', head: true }).gte('first_visit_at', d30Ago),
    admin.from('anonymous_visits').select('first_visit_at').gte('first_visit_at', d7Ago),
    admin.from('battles').select('*', { count: 'exact', head: true }),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', `${today}T00:00:00Z`),
    admin.from('battles').select('battle_time').gte('battle_time', d7Ago),
    admin.from('meta_stats').select('*', { count: 'exact', head: true }).eq('date', today).eq('source', 'global'),
    admin.from('meta_stats').select('*', { count: 'exact', head: true }),
    admin.from('meta_poll_cursors').select('*', { count: 'exact', head: true }).gt('last_battle_time', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    admin.from('meta_poll_cursors').select('*', { count: 'exact', head: true }).lt('last_battle_time', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    admin.from('meta_poll_cursors').select('last_battle_time').order('last_battle_time', { ascending: false }).limit(1).maybeSingle(),
    admin.from('meta_stats').select('brawler_id, map, mode, total, wins, losses').eq('date', today).eq('source', 'global'),
  ])

  // In-JS aggregation for sparklines, top 3 maps, top 3 brawlers
  const anonSparkline = bucketByDay(anonLast7d.data ?? [], 'first_visit_at', 7)
  const battleSparkline = bucketByDay(battlesLast7d.data ?? [], 'battle_time', 7)
  const { top3Maps, top3Brawlers } = aggregateTopFromMetaStats(todayMetaRows.data ?? [])

  return {
    totalUsers: totalUsers.count ?? 0,
    premiumCount: premiumCount.count ?? 0,
    trialCount: trialCount.count ?? 0,
    anonCount30d: anonCount30d.count ?? 0,
    anonSparkline,
    totalBattles: totalBattles.count ?? 0,
    battlesToday: battlesToday.count ?? 0,
    battleSparkline,
    metaRowsToday: metaRowsToday.count ?? 0,
    metaRowsTotal: metaRowsTotal.count ?? 0,
    activeCursors: activeCursors.count ?? 0,
    staleCursors: staleCursors.count ?? 0,
    latestMetaActivity: latestCursor.data?.last_battle_time ?? null,
    top3Maps,
    top3Brawlers,
  }
}
```

### 6.3 `getBattles()` — 6-8 queries

Follows the same parallel-`Promise.all` pattern. Queries the `battles` table with various filters for totals/sparkline/mode distribution/result distribution/top players, plus `profiles.last_sync` for the latest premium sync, and `sync_queue` for the pending count.

### 6.4 `getPremium()` — 5 queries

Queries only the `profiles` table (tier, trial_ends_at, created_at). Explicitly does NOT touch any PayPal webhook or subscriptions table; the output surfaces those as "requires integration".

### 6.5 `getCronStatus()` — 4 queries

```ts
export async function getCronStatus(): Promise<CronData> {
  const admin = getAdmin()
  const now = Date.now()

  const [jobs, runs, latestCursor, latestSync] = await Promise.all([
    admin.rpc('diagnose_cron_jobs'),
    admin.rpc('diagnose_cron_runs', { p_limit: 500 }),
    admin.from('meta_poll_cursors').select('last_battle_time').order('last_battle_time', { ascending: false }).limit(1).maybeSingle(),
    admin.from('profiles').select('last_sync').order('last_sync', { ascending: false }).in('tier', ['premium', 'pro']).limit(1).maybeSingle(),
  ])

  // Count runs per job in last 24h
  const h24Ago = now - 24 * 60 * 60 * 1000
  const runsByJob = new Map<string, number>()
  for (const r of runs.data ?? []) {
    if (new Date(r.start_time).getTime() < h24Ago) continue
    runsByJob.set(r.jobname, (runsByJob.get(r.jobname) ?? 0) + 1)
  }

  // Infer VPS cron freshness
  const metaPollAge = latestCursor.data
    ? now - new Date(latestCursor.data.last_battle_time).getTime()
    : null
  const metaPollStatus = inferCronHealth(
    metaPollAge,
    FRESHNESS_THRESHOLDS['meta-poll'].expectedMin,
    FRESHNESS_THRESHOLDS['meta-poll'].graceMin,
  )

  const syncAge = latestSync.data
    ? now - new Date(latestSync.data.last_sync).getTime()
    : null
  const syncStatus = inferCronHealth(
    syncAge,
    FRESHNESS_THRESHOLDS['sync'].expectedMin,
    FRESHNESS_THRESHOLDS['sync'].graceMin,
  )

  return {
    pgCronJobs: jobs.data ?? [],
    cronRuns: runs.data ?? [],
    runsByJob,
    metaPollFreshness: { ageMs: metaPollAge, status: metaPollStatus },
    syncFreshness: { ageMs: syncAge, status: syncStatus },
  }
}

function inferCronHealth(
  ageMs: number | null,
  expectedMin: number,
  graceMin: number,
): FreshnessStatus {
  if (ageMs === null) return 'unknown'
  const ageMin = ageMs / (60 * 1000)
  if (ageMin < expectedMin + graceMin) return 'fresh'
  if (ageMin < expectedMin * 3) return 'stale'
  return 'dead'
}
```

### 6.6 `getMapList()` — 1 query

```ts
export async function getMapList(): Promise<MapListItem[]> {
  const admin = getAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from('meta_stats')
    .select('map, mode, total, brawler_id')
    .eq('date', today)
    .eq('source', 'global')

  // Aggregate in JS: group by (map, mode)
  const agg = new Map<string, { map: string; mode: string; battles: number; brawlers: Set<number> }>()
  for (const row of data ?? []) {
    const key = `${row.mode}::${row.map}`
    let entry = agg.get(key)
    if (!entry) {
      entry = { map: row.map, mode: row.mode, battles: 0, brawlers: new Set() }
      agg.set(key, entry)
    }
    entry.battles += row.total
    entry.brawlers.add(row.brawler_id)
  }

  return Array.from(agg.values())
    .map((e) => ({ map: e.map, mode: e.mode, battles: e.battles, brawlerCount: e.brawlers.size }))
    .sort((a, b) => b.battles - a.battles)
}
```

### 6.7 `findMapByPrefix()` and `getMapData()`

`findMapByPrefix` uses `ilike` with a prefix pattern to find matching `(map, mode)` pairs, deduplicates in JS, and returns one of three kinds: `none`, `found`, `ambiguous`.

`getMapData(map, mode)` makes 5-6 parallel queries: today's battles, 7d battles, brawler coverage, top 5 WR, bottom 3 WR (with `MIN_BATTLES_FOR_RANKING` threshold), comparison with other maps in same mode, last cursor update.

## 7. Webhook Setup & Authentication

### 7.1 Registering the webhook with Telegram

One-time setup via `scripts/setup-telegram-webhook.js`:

```js
#!/usr/bin/env node
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local
// and registers the webhook URL with Telegram. Idempotent.

const fs = require('fs')
const path = require('path')

// Load .env.local (pattern from other scripts in this repo)
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const WEBHOOK_URL = 'https://brawlvision.com/api/telegram/webhook'

async function main() {
  if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error('✗ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET in .env.local')
    process.exit(1)
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      allowed_updates: ['message'],
      secret_token: WEBHOOK_SECRET,
      drop_pending_updates: true,
    }),
  })

  const data = await res.json()
  if (!data.ok) {
    console.error('✗ setWebhook failed:', data)
    process.exit(1)
  }
  console.log('✓ Webhook registered at', WEBHOOK_URL)
  console.log('  description:', data.description)

  // Verify
  const info = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`).then((r) => r.json())
  console.log('\nCurrent webhook info:')
  console.log('  url:', info.result.url)
  console.log('  pending_updates:', info.result.pending_update_count)
  console.log('  last_error:', info.result.last_error_message ?? '(none)')
  console.log('  allowed_updates:', info.result.allowed_updates)
}

main().catch((err) => { console.error(err); process.exit(1) })
```

### 7.2 Two authentication layers

**Layer 1 — `X-Telegram-Bot-Api-Secret-Token` header**

Added by Telegram to every webhook POST when `secret_token` was provided to `setWebhook`. The handler checks it before parsing the body. Defeats scanners/attackers who find the public endpoint but don't know the secret.

**Layer 2 — `message.chat.id` match**

After L1 passes, the handler compares `String(message.chat.id)` against `String(process.env.TELEGRAM_CHAT_ID)` (no `parseInt` — avoids coercion gotchas for negative chat IDs used by groups, even though our bot is private-chat only today).

**Both failures → silent 200**. No 4xx responses because:
- Telegram would retry (bad semantics)
- Fingerprinting the endpoint to scanners is useless (they learn nothing from 401 vs 200)

### 7.3 New environment variable

Only one new env var needed:

| Variable | Purpose | How to generate |
|---|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | L1 auth secret in `X-Telegram-Bot-Api-Secret-Token` header | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Add to:
- Vercel production env vars
- `.env.local`

All other env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) already exist.

## 8. Runtime & Performance

- **Runtime**: Node.js (default). Not Edge runtime — reuses the `@supabase/supabase-js` admin client pattern from `anonymous-visits.ts` which is a cold-start-memoized singleton that works best on Node.
- **`maxDuration`**: set to `30` seconds in `route.ts`. The default 10 could cut off the slowest command (`/mapa <nombre>` with 6-8 parallel queries) under Supabase latency spikes. 30 is conservative and fits on Hobby/Pro.
- **Handler execution style**: `await` the `sendTelegramMessage` inline, NOT via `after()`. The outgoing message IS the webhook's product; deferring breaks the value. (`after()` is correct for anonymous_visits because tracking is a side effect, not the user-facing response.)

Expected latency per command:

| Command | Latency (ms) | Why |
|---|---|---|
| `/help` | <5 | String constant |
| `/stats` | 200-500 | ~12-15 queries in parallel, limited by Supabase RTT |
| `/batallas` | 150-400 | 6-8 queries |
| `/premium` | 100-300 | 5 queries |
| `/cron` | 200-400 | 2 RPC calls + 2 simple selects |
| `/mapa` (list) | 100-300 | 1 query + JS aggregation |
| `/mapa <name>` | 300-800 | 5-6 queries, slower than `/mapa` list |

All well under Telegram's 60s webhook retry threshold.

## 9. Error Handling

### 9.1 Three-level try/catch in the webhook handler

1. **Outer (`try/catch` around the whole POST body)**: catches unexpected errors in body parsing, auth, dispatch wiring. Always returns 200 with `[telegram/webhook] FATAL` log.
2. **Inner (`try/catch` around `handler(ctx)`)**: catches errors thrown by command handlers. Sends a friendly error message to the user with the exception message in `<code>` tags (HTML-escaped). Logs `[telegram/webhook] command failed` with full stack.
3. **Innermost (`try/catch` around the error-message `sendTelegramMessage`)**: catches errors sending the error message itself. Only logs — cannot recover further.

### 9.2 HTML escaping in error messages

Every user-visible string that contains error output is passed through `escapeHtml` to prevent the HTML parse_mode from breaking on `<`, `>`, or `&` characters in the error message. Without this, an error like `cannot find '<user>'` would produce a 400 from Telegram `sendMessage` and the user would see nothing.

### 9.3 Graceful degradation

- Unknown command → friendly "not recognized" message with `/help` hint
- Supabase down → command throws in handler → user gets error message with the exception
- Telegram `sendMessage` fails → log only, user sees silence (nothing we can do)
- `diagnose_cron_jobs` RPC fails (e.g., migration 010 not applied) → `/cron` degrades to "(no disponible)" for pg_cron section but still shows freshness section

## 10. Testing Strategy

**Total: ~82 automated tests** (~60 unit + ~22 integration) + 1 manual smoke test checklist.

### 10.1 Unit tests (~60)

One file per production file. All dependencies mocked with `vi.mock`. Fast (<1s each).

| File | Tests | Focus |
|---|---|---|
| `dispatcher.test.ts` | 8-10 | Command parsing, case-insensitivity, unknown commands, args split, leading slash requirement |
| `sender.test.ts` | 3 | Success, fetch failure, `BOT_TOKEN` missing |
| `queries.test.ts` | 15-20 | One describe block per function (`getStats`, `getBattles`, …), happy path + empty DB + error per function. `@supabase/supabase-js` mocked at module level |
| `formatters.test.ts` | 10-12 | `sparkline` with various arrays, `bar` with percentages, `fmtTimeAgo` with multiple intervals, `section` with headers, `clampToTelegramLimit` (under limit, over limit, with footer), `escapeHtml` with HTML special chars |
| `commands/stats.test.ts` | 3 | Happy path with mock queries, empty DB, queries throws |
| `commands/batallas.test.ts` | 3 | Similar |
| `commands/premium.test.ts` | 3 | Happy + empty + explicit "no subscriptions table" placeholder case |
| `commands/cron.test.ts` | 4 | All green, one failed, freshness stale, freshness dead |
| `commands/mapa.test.ts` | 6 | Listado (no args), exact match, prefix, ambiguous, not found, sparse data (< MIN_BATTLES_FOR_RANKING) |
| `commands/help.test.ts` | 1 | String contains all 6 commands |

### 10.2 Integration tests (22)

One file per command + 1 for auth. Supabase client mocked at module level to return fixture data. `global.fetch` stubbed to capture what would have been sent to Telegram API. The webhook handler is imported and POST is called with realistic request bodies.

```
src/__tests__/integration/api/telegram/
  ├── webhook-auth.test.ts         ← 3 tests  (L1 fail, L2 fail, body malformed)
  ├── webhook-stats.test.ts        ← 3 tests
  ├── webhook-batallas.test.ts     ← 3 tests
  ├── webhook-premium.test.ts      ← 2 tests
  ├── webhook-cron.test.ts         ← 4 tests
  ├── webhook-mapa.test.ts         ← 6 tests
  └── webhook-help.test.ts         ← 1 test
```

Each test asserts on the **exact text** that would be sent via `sendTelegramMessage`, not just that "the function was called". This catches typos, missing sections, wrong emojis, bad HTML that only surface when data flows through multiple modules.

### 10.3 E2E tests — intentionally not automated

A real E2E (bot staging + Supabase staging + real Telegram API) would:
- Cost significant infra maintenance
- Be flaky due to Telegram API latency and eventual consistency of `getUpdates`
- Hit rate limits on CI
- Only catch bugs that integration tests already catch (typos in names) OR deploy-config bugs (wrong env var on Vercel) which are detected at the smoke test step post-deploy

**Alternative**: manual smoke test checklist in `docs/superpowers/specs/...` that the user executes **once per deploy to production**. See §11.

## 11. Rollout Plan

### Step 1 — Pre-deploy: env vars

Add to Vercel production:

- `TELEGRAM_WEBHOOK_SECRET` = new value from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Add the same value to `.env.local`.

### Step 2 — Deploy code

`git push main` → Vercel auto-deploys. Verify `/api/telegram/webhook` exists in the Functions tab of the Deployments page.

### Step 3 — Register webhook with Telegram

```bash
node scripts/setup-telegram-webhook.js
```

Expected output: `✓ Webhook registered at https://brawlvision.com/api/telegram/webhook`.

### Step 4 — Verify webhook info

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Verify `url`, `pending_update_count: 0`, `last_error_message: null`, `allowed_updates: ["message"]`.

### Step 5 — Manual smoke test

Execute the checklist (stored at `docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md`, written as part of this sprint):

```
- [ ] /help → list of 6 commands received
- [ ] /stats → full stats message with 5 sections, sparklines
- [ ] /batallas → 4 sections, sparkline 14d
- [ ] /premium → 3 sections, explicit "requires integration" placeholder
- [ ] /cron → pg_cron section + freshness section + VPS note
- [ ] /mapa → list of 44+ maps
- [ ] /mapa sidetrack → detailed map response
- [ ] /mapa xyzxyz → "No hay mapa que empiece por 'xyzxyz'"
- [ ] /foo → "Comando no reconocido. Prueba /help"

- [ ] Auth L2 fail: send a message from a different Telegram account.
        Verify you receive NO response. Check Vercel logs for the
        "L2 auth fail" warning.

- [ ] Auth L1 fail: send a raw curl POST without the secret header.
        Expected: 200 response, no message sent.
```

### Step 6 — Observe 24h

Check Vercel Function logs for unexpected errors, unauthorized attempts, slow queries. Adjust thresholds in `constants.ts` if any command consistently reports "stale" that is actually "fresh" etc.

### Step 7 — Close v1, plan v2

After 24h of stability, Sprint B v1 is in production. The v2 follow-up (push daily digest) is a separate short sprint that reuses 100% of the v1 handler code via a new pg_cron job.

## 12. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Typo in `TELEGRAM_WEBHOOK_SECRET` between Vercel and `setWebhook` call | Medium | High | Script `setup-telegram-webhook.js` reads from `.env.local`; if Vercel value is copy-pasted from the same `.env.local`, they stay aligned |
| 2 | `sendMessage` returns 429 (rate limit) | Low | Medium | Telegram allows ~30 msg/sec to one chat. Spamming requires intent; only user is admin |
| 3 | A command takes >30s | Low | Medium | `maxDuration = 30` and queries in parallel keep latency bounded. If a specific query becomes slow, index or cache |
| 4 | Supabase outage → all commands fail | Low | High | 3-level error handling catches and sends friendly error messages with details |
| 5 | Auth config error (`TELEGRAM_CHAT_ID` typo) | Low | High — bot silent to owner | Step 5 smoke test detects immediately |
| 6 | Attacker discovers webhook URL and POSTs fake body | Medium | Low (with L1) | L1 blocks without secret. L2 blocks without correct chat_id. Two independent layers |
| 7 | Telegram API changes | Very low | High | Telegram webhook v1 has been stable 6+ years. Acceptable dependency |
| 8 | `drop_pending_updates: true` at setup drops user messages during setup | Very low | Low | Only affects the first-time setup; acceptable one-time cost |
| 9 | `queries.ts` fetch error not caught → propagates to webhook handler outer catch | Medium | Medium | Each `getX` wraps risky logic in try/catch and returns partial data. Outer catch is backstop |
| 10 | Output >4096 chars (Telegram hard limit) | Low for v1 commands, medium for `/mapa` list if many maps | Medium | `clampToTelegramLimit(text, footer)` in every command handler. Truncates with "... (output truncado)" marker |
| 11 | `EXPECTED_CRON_RUNS_24H` constant drifts out of sync with real pg_cron state | Medium | Low | Hardcoded; must be updated when adding/modifying a pg_cron job. Drift produces visible "N / M expected" mismatch in `/cron` output — self-diagnosing |
| 12 | New pg_cron job added without updating `FRESHNESS_THRESHOLDS` or `EXPECTED_CRON_RUNS_24H` | Medium | Low | Code inspection catches the gap; `/cron` shows "unknown" or "N / 0 expected" (visible) |

The drift risk (#11, #12) is acceptable because the constants live in `constants.ts` right next to the handler code; any developer modifying pg_cron will notice the constants and update them.

## 13. Future Work (v2+)

### Sprint B v2 (short follow-up after v1 stability)

- **Daily push digest**: new pg_cron `bot-daily-digest` at `0 9 * * *` (09:00 UTC) calling `net.http_post` to a new internal route `/api/telegram/daily-digest` (authed with `CRON_SECRET`) which reuses the `/stats` handler code to generate the message and sends it with `sendTelegramMessage`. ~20 lines of new code + 1 migration.

- **Inline keyboards**: add `callback_query` handling to the dispatcher. Commands end with buttons like `[🔄 Refresh] [⚔️ Battles]`. Click → Telegram sends a `callback_query` update → router handles the callback with a mini-dispatcher. Adds ~50 lines to dispatcher.

- **Healthchecks.io integration**: documented in `docs/crons/SETUP-HEALTHCHECKS.md` Part 6. Upgrades the VPS section of `/cron` from inferred freshness to direct API status.

### Sprint B v3 (nice-to-have ideas)

- **`/ask <pregunta>`**: natural-language free-form questions via Claude Haiku. Generates SQL with strict validation (SELECT only, no DELETE/UPDATE). Adds variable cost per message (~$0.005).
- **Pagination for `/mapa` list**: inline keyboards with `[Anterior] [Siguiente]` when more than 20 maps
- **Date filters**: `/stats 7d`, `/batallas yesterday`, etc.
- **`/alerta <condición>`**: user configures "notify me when X drops below Y"
- **Web dashboard**: `/bot-stats` page on brawlvision.com showing historical command invocations, errors, latency (observability of the bot itself)

## 14. Out-of-Scope Decisions (Explicit)

These are things we are NOT doing in v1, with the rationale so future readers don't wonder:

1. **`notify()` is NOT reused** for the bot's outgoing messages. The bot uses a separate `sendTelegramMessage(chatId, text)` so it's decoupled from the env-var-bound single-chat-id of `notify()`. `notify()` remains unchanged for `/api/notify/signup`, `/api/webhooks/paypal`, and `/lib/anonymous-visits.ts`.
2. **No `update_id` deduplication**. Every command is idempotent (SELECT-only + formatted message). Reprocessing produces the same output harmlessly.
3. **No E2E automated tests**. Manual smoke test is the rollout gate. Integration tests cover most regressions.
4. **No `subscriptions`/`payments` table queried in `/premium`**. Unknown if these tables exist. The command surfaces the limitation in its output as "requires integration".
5. **No rate limiting**. Only one authorized user; spam is not a threat vector.
6. **No fuzzy matching for `/mapa`**. Case-insensitive prefix is sufficient for the use case. Adding fuzzy (`fuse.js`) is YAGNI.
7. **Streaming responses**. Telegram doesn't support streaming `sendMessage`, not applicable.
8. **Edge runtime**. Node.js runtime is consistent with the rest of the codebase and avoids gotchas with `@supabase/supabase-js` RPCs.

## 15. Review Findings (v1, 2nd pass — all fixed inline)

After writing the first draft of sections 1-5, a second-pass review identified 9 minor consistency issues. All fixed in this spec:

| # | Issue | Fix |
|---|---|---|
| 1 | Integration tests claimed "8-10" but listing summed to 22 | Updated to 22 tests in 7 files |
| 2 | `diagnose_cron_runs(30)` insufficient for counting 24h runs of `*/5` cron | Changed to `diagnose_cron_runs(500)` + filter in JS |
| 3 | "Runs 24h: N / M expected" — M source not defined | Added `EXPECTED_CRON_RUNS_24H` constant in `constants.ts` with hardcoded values per job |
| 4 | `escapeHtml` used in error message but not listed in `formatters.ts` inventory | Added to `formatters.ts` exports and to unit tests |
| 5 | Admin client memoization location ambiguous | Explicitly in `queries.ts` as module-level singleton (pattern from `anonymous-visits.ts`) |
| 6 | `types.ts` imports from `queries.ts` for `Queries` interface → potential circular | Moved `Queries` interface into `types.ts`; `queries.ts` implements the interface unilaterally |
| 7 | `getStats` described as "~8 queries" but listed 15 | Corrected to "~12-15 queries in parallel" |
| 8 | Freshness emojis inconsistent between Section 2 examples and Section 3 logic | Centralized `FRESHNESS_EMOJI` constant: ✅ fresh / 🟡 stale / 🔴 dead / ❓ unknown |
| 9 | Threshold for "insufficient data" in `/mapa` (<30 battles) not named | `MIN_BATTLES_FOR_RANKING = 30` in `constants.ts`, used in `/mapa` sparse-data edge case |

None of these rose to a design-level concern. All were refinements that made the spec internally consistent before being committed.

## 16. Approval

This spec reflects all user decisions from the brainstorming on 2026-04-12:

- **Q1**: Auth via `TELEGRAM_CHAT_ID` env var only (option a)
- **Q2**: Exact-match commands, no LLM (option a)
- **Q3**: Extended response format with sparklines (option c)
- **Q4**: v1 pull-only, v2 push daily as follow-up (option a→b)
- **Q5**: Case-insensitive prefix + listing without args (options b+d)
- **Q6**: Friendly errors + `/help` command (option b)
- **Q7**: pg_cron direct + freshness inference for VPS (option b)

Plus the architectural choice: **Option 2 (Modular with command registry + shared queries)**.

The 5 design sections (Architecture, Commands, Queries, Webhook, Rollout) were each approved sequentially by the user with the fixes from the review pass applied.

Pending: final user review of this written spec before invoking `superpowers:writing-plans`.
