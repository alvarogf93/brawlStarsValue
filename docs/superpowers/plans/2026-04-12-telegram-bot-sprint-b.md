# Telegram Bot Sprint B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Telegram bot that lets the admin query the state of BrawlVision from their phone via 6 commands (`/stats`, `/batallas`, `/premium`, `/cron`, `/mapa`, `/help`), backed by a webhook handler at `POST /api/telegram/webhook`.

**Architecture:** A single Vercel route handler receives Telegram updates, passes them through a 2-layer auth gate (secret header + chat_id match), dispatches to one of 6 command handlers via a registry `Map`, and writes the response back with a new `sendTelegramMessage(chatId, text)` helper (distinct from `notify()`). Each command pulls data via a memoized admin Supabase client in `queries.ts` and formats text with pure helpers in `formatters.ts`. All handlers are trivially unit-testable: they receive a `Queries` interface as context, never importing `supabase` directly.

**Tech Stack:** Next.js 16 App Router (Node runtime), TypeScript strict, `@supabase/supabase-js@^2.101.1` (admin singleton, same pattern as `src/lib/anonymous-visits.ts`), Vitest (`vi.mock`, `vi.hoisted`), Telegram Bot API (`sendMessage` + `setWebhook`), pg_cron RPCs `diagnose_cron_jobs()` / `diagnose_cron_runs(p_limit)` (already in prod from migration `010`).

**Design spec:** `docs/superpowers/specs/2026-04-12-telegram-bot-sprint-b-design.md` (v1). This plan is a direct translation of that spec — if you find a contradiction, the spec wins and you should flag it before changing anything.

**Scope check:** The spec covers a single subsystem (Telegram bot Sprint B). No decomposition needed — one plan, one implementation cycle.

---

## File Structure

**Create (production code):**
- `src/lib/telegram/types.ts` — `TelegramUpdate`, `TelegramMessage`, `CommandContext`, `Queries`, `StatsData`, `BattlesData`, `PremiumData`, `CronData`, `MapData`, `MapListItem`, `MapMatchResult`, `FreshnessStatus`, `CommandHandler`.
- `src/lib/telegram/constants.ts` — `EXPECTED_CRON_RUNS_24H`, `FRESHNESS_EMOJI`, `MIN_BATTLES_FOR_RANKING`, `FRESHNESS_THRESHOLDS`, `TELEGRAM_MESSAGE_LIMIT`.
- `src/lib/telegram/formatters.ts` — `sparkline`, `bar`, `fmtTimeAgo`, `fmtNumber`, `section`, `clampToTelegramLimit`, `escapeHtml`, `bucketByDay`.
- `src/lib/telegram/sender.ts` — `sendTelegramMessage(chatId, text)`.
- `src/lib/telegram/queries.ts` — memoized admin client + 7 query functions + `inferCronHealth` helper.
- `src/lib/telegram/dispatcher.ts` — `parseCommand`, command registry `Map`.
- `src/lib/telegram/commands/help.ts` — `/help` handler.
- `src/lib/telegram/commands/stats.ts` — `/stats` handler.
- `src/lib/telegram/commands/batallas.ts` — `/batallas` handler.
- `src/lib/telegram/commands/premium.ts` — `/premium` handler.
- `src/lib/telegram/commands/cron.ts` — `/cron` handler.
- `src/lib/telegram/commands/mapa.ts` — `/mapa` handler.
- `src/app/api/telegram/webhook/route.ts` — POST handler with 2-layer auth + 3-level try/catch.
- `scripts/setup-telegram-webhook.js` — one-shot CommonJS script to register the webhook with Telegram.

**Create (tests):**
- `src/__tests__/unit/lib/telegram/dispatcher.test.ts`
- `src/__tests__/unit/lib/telegram/sender.test.ts`
- `src/__tests__/unit/lib/telegram/queries.test.ts`
- `src/__tests__/unit/lib/telegram/formatters.test.ts`
- `src/__tests__/unit/lib/telegram/commands/stats.test.ts`
- `src/__tests__/unit/lib/telegram/commands/batallas.test.ts`
- `src/__tests__/unit/lib/telegram/commands/premium.test.ts`
- `src/__tests__/unit/lib/telegram/commands/cron.test.ts`
- `src/__tests__/unit/lib/telegram/commands/mapa.test.ts`
- `src/__tests__/unit/lib/telegram/commands/help.test.ts`
- `src/__tests__/integration/api/telegram/webhook-auth.test.ts`
- `src/__tests__/integration/api/telegram/webhook-stats.test.ts`
- `src/__tests__/integration/api/telegram/webhook-batallas.test.ts`
- `src/__tests__/integration/api/telegram/webhook-premium.test.ts`
- `src/__tests__/integration/api/telegram/webhook-cron.test.ts`
- `src/__tests__/integration/api/telegram/webhook-mapa.test.ts`
- `src/__tests__/integration/api/telegram/webhook-help.test.ts`

**Create (docs):**
- `docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md` — manual smoke-test checklist run once per production deploy.

**Modify:**
- *(none)* — this sprint is additive. `src/lib/telegram.ts` (`notify`) is untouched.

**Do not touch:**
- `src/lib/telegram.ts` — the old `notify()` keeps its one-arg signature. The new `sendTelegramMessage` is a sibling, NOT a replacement.
- `src/lib/anonymous-visits.ts` — reuses `notify()`. Not changed.
- `supabase/migrations/010_cron_diagnostic_helpers.sql` — already in prod. The bot consumes its RPCs; do not modify.

**Reference constants you will need:**
- Supported locales: 13 values from `src/i18n/routing.ts` (not used by the bot, but listed for completeness).
- Normalised player tags are uppercase with a leading `#`, e.g. `#YJU282PV`.
- `meta_stats.source` is one of `'global'` or `'users'`; the bot filters on `source='global'` everywhere.
- `meta_stats.date` is a `date` column (YYYY-MM-DD), NOT a timestamp.
- `battles.battle_time` is `timestamptz`.
- `profiles.tier` is one of `'free' | 'premium' | 'pro'`; premium and pro are both treated as "paying".
- `profiles.trial_ends_at` is `timestamptz | null`; trial-active means `trial_ends_at > now()`.
- `meta_poll_cursors.last_battle_time` is `timestamptz`.
- `sync_queue.completed_at` is `timestamptz | null`; pending is `completed_at IS NULL`.

**New environment variable (only one):**

| Variable | Purpose | How to generate |
|---|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | L1 auth header `X-Telegram-Bot-Api-Secret-Token` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

All other env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) already exist.

---

## Task 1 — Scaffold types.ts + constants.ts

**Files:**
- Create: `src/lib/telegram/types.ts`
- Create: `src/lib/telegram/constants.ts`

**Why first:** Every subsequent task imports from these two files. Landing them first means no forward-reference churn. No tests yet — these are pure declarations.

- [ ] **Step 1.1 — Create `src/lib/telegram/types.ts`**

```ts
// Shared types for the Telegram bot (Sprint B).
// The `Queries` interface lives here (not in queries.ts) to avoid a
// circular import between commands/*.ts (which use Queries) and
// queries.ts (which implements it).

// ── Telegram API subset ────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  chat: { id: number | string; type: string }
  from?: { id: number; username?: string }
  text?: string
  date: number
}

// ── Command layer ──────────────────────────────────────────────

export interface CommandContext {
  args: string[]
  queries: Queries
}

export type CommandHandler = (ctx: CommandContext) => Promise<string>

// ── Query return shapes ────────────────────────────────────────

export interface StatsData {
  totalUsers: number
  premiumCount: number
  trialCount: number
  anonCount30d: number
  anonSparkline: number[]    // length 7
  totalBattles: number
  battlesToday: number
  battleSparkline: number[]  // length 7
  metaRowsToday: number
  metaRowsTotal: number
  activeCursors: number
  staleCursors: number
  latestMetaActivity: string | null  // ISO timestamp
  top3Maps: Array<{ map: string; mode: string; battles: number }>
  top3Brawlers: Array<{ brawlerId: number; winRate: number; total: number }>
}

export interface BattlesData {
  total: number
  today: number
  yesterday: number
  last7d: number
  last30d: number
  sparkline14d: number[]
  modeDistribution: Array<{ mode: string; count: number; pct: number }>
  resultDistribution: Array<{ result: 'victory' | 'defeat' | 'draw'; count: number; pct: number }>
  topPlayers: Array<{ tag: string; count: number }>
  lastSuccessfulSyncAt: string | null  // ISO
  queuePending: number
}

export interface PremiumData {
  premiumActive: number
  trialActive: number
  freeUsers: number
  signupsLast30d: number
  trialsActivatedLast30d: number
  trialToPremiumLast30d: number
  trialsExpiredLast30d: number
  // Explicit placeholders for v2:
  upcomingRenewals7d: null
  ltvTotal: null
}

export type FreshnessStatus = 'fresh' | 'stale' | 'dead' | 'unknown'

export interface PgCronJob {
  jobid: number
  jobname: string
  schedule: string
  active: boolean
  command: string
}

export interface PgCronRun {
  jobid: number
  jobname: string
  status: string           // 'succeeded' | 'failed' | other
  return_message: string | null
  start_time: string       // ISO
  end_time: string | null  // ISO
}

export interface CronData {
  pgCronJobs: PgCronJob[]
  cronRuns: PgCronRun[]
  runsByJob: Map<string, number>              // job name → count in last 24h
  metaPollFreshness: { ageMs: number | null; status: FreshnessStatus }
  syncFreshness: { ageMs: number | null; status: FreshnessStatus }
}

export interface MapListItem {
  map: string
  mode: string
  battles: number
  brawlerCount: number
}

export type MapMatchResult =
  | { kind: 'none' }
  | { kind: 'found'; map: string; mode: string }
  | { kind: 'ambiguous'; candidates: Array<{ map: string; mode: string }> }

export interface MapData {
  map: string
  mode: string
  battlesToday: number
  battlesLast7d: number
  brawlerCovered: number
  brawlerTotal: number
  sparkline7d: number[]
  topWinRates: Array<{ brawlerId: number; winRate: number; total: number }>
  bottomWinRates: Array<{ brawlerId: number; winRate: number; total: number }>
  sameModeComparison: Array<{ map: string; battles: number }>
  lastCursorUpdate: string | null  // ISO
}

// ── Queries interface (implemented by queries.ts) ──────────────

export interface Queries {
  getStats(): Promise<StatsData>
  getBattles(): Promise<BattlesData>
  getPremium(): Promise<PremiumData>
  getCronStatus(): Promise<CronData>
  getMapList(): Promise<MapListItem[]>
  findMapByPrefix(prefix: string): Promise<MapMatchResult>
  getMapData(map: string, mode: string): Promise<MapData>
}
```

- [ ] **Step 1.2 — Create `src/lib/telegram/constants.ts`**

```ts
import type { FreshnessStatus } from './types'

// Hard limit from Telegram sendMessage API: 4096 chars.
// Leave a 96-char safety margin for truncation footer.
export const TELEGRAM_MESSAGE_LIMIT = 4000

// Minimum battles for a win-rate ranking to be shown as reliable.
// Used by /mapa <name>: if today's total < MIN, the ranking block is omitted.
export const MIN_BATTLES_FOR_RANKING = 30

// Expected runs in the last 24h, per pg_cron job.
// MUST be updated when adding or modifying a pg_cron job.
// Drift is self-diagnosing: the /cron output shows "N / M expected".
export const EXPECTED_CRON_RUNS_24H: Record<string, number> = {
  'enqueue-premium-syncs': 96,    // */15 * * * *  → 4/h × 24h
  'process-sync-queue': 288,      // */5 * * * *   → 12/h × 24h
  'cleanup-anonymous-visits': 1,  // 0 3 * * *     → 1/day
}

// Thresholds for freshness inference of VPS crons (no direct visibility).
// `expectedMin` = the cron's natural interval in minutes.
// `graceMin` = slack before flipping to "stale".
export const FRESHNESS_THRESHOLDS: Record<string, { expectedMin: number; graceMin: number }> = {
  'meta-poll': { expectedMin: 30, graceMin: 5 },
  'sync':      { expectedMin: 20, graceMin: 5 },
}

// Emoji used in every command that renders a FreshnessStatus.
// Centralised so /stats, /cron, and future commands stay consistent.
export const FRESHNESS_EMOJI: Record<FreshnessStatus, string> = {
  fresh:   '✅',
  stale:   '🟡',
  dead:    '🔴',
  unknown: '❓',
}
```

- [ ] **Step 1.3 — Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. The new files should not introduce any.

- [ ] **Step 1.4 — Commit**

```bash
git add src/lib/telegram/types.ts src/lib/telegram/constants.ts
git commit -m "feat(telegram-bot): scaffold types and constants for Sprint B"
```

---

## Task 2 — Formatters with TDD

**Files:**
- Create: `src/lib/telegram/formatters.ts`
- Create: `src/__tests__/unit/lib/telegram/formatters.test.ts`

Pure-function helpers with zero I/O — ideal for TDD. Write the tests first, then fill in the implementation until they pass.

- [ ] **Step 2.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/formatters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  sparkline,
  bar,
  fmtTimeAgo,
  fmtNumber,
  section,
  clampToTelegramLimit,
  escapeHtml,
  bucketByDay,
} from '@/lib/telegram/formatters'
import { TELEGRAM_MESSAGE_LIMIT } from '@/lib/telegram/constants'

describe('sparkline', () => {
  it('renders an ascending series with 8 blocks', () => {
    expect(sparkline([0, 1, 2, 3, 4, 5, 6, 7])).toBe('▁▂▃▄▅▆▇█')
  })

  it('renders a flat series using the lowest block', () => {
    expect(sparkline([3, 3, 3, 3])).toBe('▁▁▁▁')
  })

  it('returns empty string for empty input', () => {
    expect(sparkline([])).toBe('')
  })

  it('handles a single-element series', () => {
    expect(sparkline([5])).toBe('▁')
  })
})

describe('bar', () => {
  it('draws a 20-wide bar at 100%', () => {
    expect(bar(1)).toBe('████████████████████')
  })

  it('draws a 10-wide bar at 50%', () => {
    expect(bar(0.5)).toBe('██████████')
  })

  it('draws an empty bar at 0%', () => {
    expect(bar(0)).toBe('')
  })

  it('clamps over 100% to 20 blocks', () => {
    expect(bar(1.5)).toBe('████████████████████')
  })

  it('clamps negative ratio to 0 blocks', () => {
    expect(bar(-0.2)).toBe('')
  })
})

describe('fmtTimeAgo', () => {
  const NOW = new Date('2026-04-12T18:30:00Z').getTime()

  it('returns "ahora" under 60s', () => {
    expect(fmtTimeAgo(new Date(NOW - 20 * 1000).toISOString(), NOW)).toBe('ahora')
  })

  it('returns minutes under 1h', () => {
    expect(fmtTimeAgo(new Date(NOW - 37 * 60 * 1000).toISOString(), NOW)).toBe('hace 37 min')
  })

  it('returns hours and minutes under 24h', () => {
    const iso = new Date(NOW - (15 * 60 + 30) * 60 * 1000).toISOString()
    expect(fmtTimeAgo(iso, NOW)).toBe('hace 15h 30m')
  })

  it('returns days over 24h', () => {
    const iso = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(fmtTimeAgo(iso, NOW)).toBe('hace 3 días')
  })

  it('returns "(desconocido)" for null', () => {
    expect(fmtTimeAgo(null, NOW)).toBe('(desconocido)')
  })
})

describe('fmtNumber', () => {
  it('inserts comma thousand separators', () => {
    expect(fmtNumber(1234567)).toBe('1,234,567')
  })

  it('returns small numbers unchanged', () => {
    expect(fmtNumber(42)).toBe('42')
  })

  it('handles zero', () => {
    expect(fmtNumber(0)).toBe('0')
  })
})

describe('section', () => {
  it('prefixes a header with an emoji and newline', () => {
    expect(section('📊', 'TITULO', 'body line')).toBe('📊 TITULO\nbody line')
  })
})

describe('clampToTelegramLimit', () => {
  it('returns the text unchanged when under limit', () => {
    const text = 'hello'
    expect(clampToTelegramLimit(text)).toBe(text)
  })

  it('truncates and appends footer when over limit', () => {
    const longText = 'x'.repeat(TELEGRAM_MESSAGE_LIMIT + 500)
    const clamped = clampToTelegramLimit(longText)
    expect(clamped.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT)
    expect(clamped.endsWith('… (output truncado)')).toBe(true)
  })
})

describe('escapeHtml', () => {
  it('escapes the 5 HTML-relevant characters', () => {
    expect(escapeHtml(`<a href="x&y">'foo'</a>`))
      .toBe('&lt;a href=&quot;x&amp;y&quot;&gt;&#39;foo&#39;&lt;/a&gt;')
  })

  it('returns plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('bucketByDay', () => {
  it('buckets ISO timestamps into daily counts over the window', () => {
    const now = new Date('2026-04-12T12:00:00Z').getTime()
    // 3 rows today, 1 row 2 days ago, 0 other days — window of 7 days.
    const rows = [
      { t: new Date(now - 1 * 60 * 60 * 1000).toISOString() },
      { t: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
      { t: new Date(now - 3 * 60 * 60 * 1000).toISOString() },
      { t: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    const buckets = bucketByDay(rows, 't', 7, now)
    expect(buckets).toHaveLength(7)
    expect(buckets[6]).toBe(3)  // today → last bucket
    expect(buckets[4]).toBe(1)  // 2 days ago
    expect(buckets[0]).toBe(0)  // 6 days ago
  })

  it('returns an all-zero window when no rows', () => {
    const buckets = bucketByDay([], 't', 5, Date.now())
    expect(buckets).toEqual([0, 0, 0, 0, 0])
  })
})
```

- [ ] **Step 2.2 — Run the tests — expect ALL to fail with "module not found"**

Run: `npx vitest run src/__tests__/unit/lib/telegram/formatters.test.ts`
Expected: FAIL with `Cannot find module '@/lib/telegram/formatters'` or similar.

- [ ] **Step 2.3 — Implement `src/lib/telegram/formatters.ts`**

```ts
import { TELEGRAM_MESSAGE_LIMIT } from './constants'

// ── sparkline ──────────────────────────────────────────────────
// Renders a numeric series as 8 unicode block chars, normalised
// to the full range. Flat series (all same value) → all lowest.
const SPARK_BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

export function sparkline(values: number[]): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  if (range === 0) return SPARK_BLOCKS[0].repeat(values.length)
  return values
    .map((v) => {
      const normalised = (v - min) / range
      const idx = Math.min(
        SPARK_BLOCKS.length - 1,
        Math.floor(normalised * SPARK_BLOCKS.length),
      )
      return SPARK_BLOCKS[idx]
    })
    .join('')
}

// ── bar ────────────────────────────────────────────────────────
// Draws a fixed-width (20-block) horizontal bar. Ratio outside
// [0, 1] is clamped.
export function bar(ratio: number, width = 20): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const blocks = Math.round(clamped * width)
  return '█'.repeat(blocks)
}

// ── fmtTimeAgo ─────────────────────────────────────────────────
// ISO timestamp → human-readable Spanish "hace X" string.
export function fmtTimeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '(desconocido)'
  const diffMs = now - new Date(iso).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'ahora'
  const min = Math.floor(sec / 60)
  if (min < 60) return `hace ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) {
    const remainingMin = min % 60
    return `hace ${hours}h ${remainingMin}m`
  }
  const days = Math.floor(hours / 24)
  return `hace ${days} días`
}

// ── fmtNumber ──────────────────────────────────────────────────
export function fmtNumber(n: number): string {
  return n.toLocaleString('en-US')
}

// ── section ────────────────────────────────────────────────────
export function section(emoji: string, title: string, body: string): string {
  return `${emoji} ${title}\n${body}`
}

// ── clampToTelegramLimit ───────────────────────────────────────
const TRUNCATE_FOOTER = '… (output truncado)'

export function clampToTelegramLimit(text: string): string {
  if (text.length <= TELEGRAM_MESSAGE_LIMIT) return text
  const allowed = TELEGRAM_MESSAGE_LIMIT - TRUNCATE_FOOTER.length
  return text.slice(0, allowed) + TRUNCATE_FOOTER
}

// ── escapeHtml ─────────────────────────────────────────────────
// Escapes the 5 characters that are significant in Telegram's
// HTML parse_mode. Required wherever we inject untrusted text
// (e.g. error messages) into a message with parse_mode=HTML.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── bucketByDay ────────────────────────────────────────────────
// Buckets a list of row objects into daily counts over a fixed
// window that ends "today". Index 0 = oldest, index (days-1) = today.
// `field` is the key of the ISO timestamp inside each row.
export function bucketByDay<T extends Record<string, unknown>>(
  rows: T[],
  field: keyof T,
  days: number,
  now: number = Date.now(),
): number[] {
  const buckets = new Array<number>(days).fill(0)
  const msPerDay = 24 * 60 * 60 * 1000
  const todayStart = new Date(new Date(now).setUTCHours(0, 0, 0, 0)).getTime()

  for (const row of rows) {
    const value = row[field]
    if (typeof value !== 'string') continue
    const rowTs = new Date(value).getTime()
    if (Number.isNaN(rowTs)) continue
    const dayDiff = Math.floor((todayStart - new Date(new Date(rowTs).setUTCHours(0, 0, 0, 0)).getTime()) / msPerDay)
    const idx = days - 1 - dayDiff
    if (idx >= 0 && idx < days) buckets[idx] += 1
  }

  return buckets
}
```

- [ ] **Step 2.4 — Run the tests — expect ALL pass**

Run: `npx vitest run src/__tests__/unit/lib/telegram/formatters.test.ts`
Expected: PASS (all 20 assertions).

- [ ] **Step 2.5 — Commit**

```bash
git add src/lib/telegram/formatters.ts src/__tests__/unit/lib/telegram/formatters.test.ts
git commit -m "feat(telegram-bot): add formatters (sparkline, bar, fmtTimeAgo, …) with unit tests"
```

---

## Task 3 — Sender with TDD

**Files:**
- Create: `src/lib/telegram/sender.ts`
- Create: `src/__tests__/unit/lib/telegram/sender.test.ts`

Single function `sendTelegramMessage(chatId, text)`. Takes `chatId` as a parameter (NOT hardcoded from env) so a future daily-digest cron can call it with the same helper. Logs failures instead of silently swallowing.

- [ ] **Step 3.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/sender.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Import AFTER the global is stubbed.
import { sendTelegramMessage } from '@/lib/telegram/sender'

describe('sendTelegramMessage', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN

  beforeEach(() => {
    fetchMock.mockReset()
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token'
  })

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken
  })

  it('posts to the Telegram sendMessage endpoint with HTML parse mode', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })

    await sendTelegramMessage(123, '<b>hola</b>')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.telegram.org/bottest-bot-token/sendMessage')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body).toEqual({
      chat_id: 123,
      text: '<b>hola</b>',
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    })
  })

  it('logs a warning when fetch throws but never rethrows', async () => {
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('network fail'))

    await expect(sendTelegramMessage(123, 'x')).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns early without fetching when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await sendTelegramMessage(123, 'x')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
```

- [ ] **Step 3.2 — Run the tests — expect failure (module missing)**

Run: `npx vitest run src/__tests__/unit/lib/telegram/sender.test.ts`
Expected: FAIL — `Cannot find module '@/lib/telegram/sender'`.

- [ ] **Step 3.3 — Implement `src/lib/telegram/sender.ts`**

```ts
/**
 * Send a message to a specific Telegram chat via the Bot API.
 *
 * Distinct from `notify()` in `src/lib/telegram.ts`:
 *   - Takes `chatId` as a parameter (future-proof for multi-chat / digest).
 *   - Logs failures loudly — the bot webhook NEEDS to see these in Vercel logs
 *     to diagnose production issues.
 *
 * Never throws. Callers can `await` it but do not need to try/catch.
 */
export async function sendTelegramMessage(
  chatId: number | string,
  text: string,
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error('[telegram/sender] TELEGRAM_BOT_TOKEN is not set')
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const errBody = await res.text().catch(() => '(unreadable)')
      console.error('[telegram/sender] sendMessage returned non-ok', {
        status: res.status,
        body: errBody.slice(0, 500),
      })
    }
  } catch (err) {
    console.error('[telegram/sender] fetch threw', err)
  }
}
```

- [ ] **Step 3.4 — Run the tests — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/sender.test.ts`
Expected: PASS (3 assertions).

- [ ] **Step 3.5 — Commit**

```bash
git add src/lib/telegram/sender.ts src/__tests__/unit/lib/telegram/sender.test.ts
git commit -m "feat(telegram-bot): add sendTelegramMessage helper"
```

---

## Task 4 — queries.ts: admin client + getStats() TDD

**Files:**
- Create: `src/lib/telegram/queries.ts`
- Create: `src/__tests__/unit/lib/telegram/queries.test.ts`

Implements the memoized admin client (same pattern as `src/lib/anonymous-visits.ts`) plus the first query function. Later tasks append the remaining query functions to both files.

- [ ] **Step 4.1 — Write the failing test for `getStats`**

Create `src/__tests__/unit/lib/telegram/queries.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Supabase mock: a chainable builder that we configure per-query. ──
// Each `from()` call returns a fresh builder. The test sets up the
// sequence of responses via `fromQueue`.
type Response = { data: unknown; count?: number; error?: unknown }
const fromQueue: Response[] = []
const rpcQueue: Response[] = []

function makeBuilder(response: Response) {
  // Returns a proxy that resolves to `response` on await and ignores
  // every intermediate method call (select, eq, gte, gt, lt, in,
  // order, limit, maybeSingle).
  const builder: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'gte', 'gt', 'lt', 'in', 'is', 'order', 'limit', 'maybeSingle', 'ilike']
  for (const m of methods) {
    builder[m] = () => builder
  }
  builder.then = (resolve: (v: Response) => unknown) => resolve(response)
  return builder
}

const fromMock = vi.fn(() => {
  const next = fromQueue.shift()
  if (!next) throw new Error('fromQueue exhausted — add more fixtures in the test')
  return makeBuilder(next)
})

const rpcMock = vi.fn(() => {
  const next = rpcQueue.shift()
  if (!next) throw new Error('rpcQueue exhausted — add more fixtures in the test')
  return Promise.resolve(next)
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: fromMock, rpc: rpcMock })),
}))

// Import AFTER mocks are in place.
import { queries } from '@/lib/telegram/queries'

beforeEach(() => {
  fromQueue.length = 0
  rpcQueue.length = 0
  fromMock.mockClear()
  rpcMock.mockClear()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
})

describe('queries.getStats', () => {
  it('returns an aggregated StatsData shape from 14 parallel responses', async () => {
    // Order matches the Promise.all in getStats (see queries.ts).
    const nowIso = '2026-04-12T18:30:00Z'
    fromQueue.push(
      { data: null, count: 3 },  // profiles count
      { data: null, count: 1 },  // premium count
      { data: null, count: 0 },  // trial count
      { data: null, count: 3 },  // anon 30d count
      { data: [{ first_visit_at: nowIso }, { first_visit_at: nowIso }, { first_visit_at: nowIso }] },  // anon 7d
      { data: null, count: 108 },  // battles total
      { data: null, count: 14 },   // battles today
      { data: [{ battle_time: nowIso }] },  // battles 7d rows
      { data: null, count: 836 },  // meta rows today
      { data: null, count: 3443 }, // meta rows total
      { data: null, count: 183 },  // active cursors
      { data: null, count: 22 },   // stale cursors
      { data: { last_battle_time: nowIso } },  // latest cursor
      {
        data: [
          { brawler_id: 1, map: 'Sidetrack', mode: 'brawlBall', total: 100, wins: 60, losses: 40 },
          { brawler_id: 2, map: 'Sidetrack', mode: 'brawlBall', total: 80,  wins: 42, losses: 38 },
          { brawler_id: 1, map: 'Nutmeg',    mode: 'brawlBall', total: 60,  wins: 32, losses: 28 },
        ],
      },  // today meta rows for top aggregation
    )

    const result = await queries.getStats()

    expect(result.totalUsers).toBe(3)
    expect(result.premiumCount).toBe(1)
    expect(result.trialCount).toBe(0)
    expect(result.anonCount30d).toBe(3)
    expect(result.totalBattles).toBe(108)
    expect(result.battlesToday).toBe(14)
    expect(result.metaRowsToday).toBe(836)
    expect(result.metaRowsTotal).toBe(3443)
    expect(result.activeCursors).toBe(183)
    expect(result.staleCursors).toBe(22)
    expect(result.latestMetaActivity).toBe(nowIso)
    expect(result.top3Maps).toEqual([
      { map: 'Sidetrack', mode: 'brawlBall', battles: 180 },
      { map: 'Nutmeg',    mode: 'brawlBall', battles: 60  },
    ])
    // top3Brawlers sorted by win rate desc, min one row
    expect(result.top3Brawlers.length).toBeGreaterThanOrEqual(1)
    expect(result.anonSparkline).toHaveLength(7)
    expect(result.battleSparkline).toHaveLength(7)
  })

  it('returns zeros when tables are empty', async () => {
    fromQueue.push(
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: [] },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: [] },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null },
      { data: [] },
    )

    const result = await queries.getStats()

    expect(result.totalUsers).toBe(0)
    expect(result.top3Maps).toEqual([])
    expect(result.top3Brawlers).toEqual([])
    expect(result.latestMetaActivity).toBeNull()
  })
})
```

- [ ] **Step 4.2 — Run test — expect failure (module missing)**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: FAIL — `Cannot find module '@/lib/telegram/queries'`.

- [ ] **Step 4.3 — Implement `src/lib/telegram/queries.ts` (admin client + getStats)**

```ts
// Server-only. Do not import from client components.
// The `server-only` package is not used in this repo — this comment
// block serves as the marker (same pattern as anonymous-visits.ts).

import {
  createClient as createSupabaseAdmin,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { bucketByDay } from './formatters'
import type {
  Queries,
  StatsData,
} from './types'

// ── Memoised admin client ──────────────────────────────────────

let _admin: SupabaseClient | null = null

export function getAdmin(): SupabaseClient {
  if (_admin) return _admin
  _admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return _admin
}

// ── getStats ───────────────────────────────────────────────────
// ~14 parallel queries. Keep the order stable — unit tests feed
// fixtures in the same sequence.

async function getStats(): Promise<StatsData> {
  const admin = getAdmin()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const d7Ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const d24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [
    totalUsers,
    premiumCount,
    trialCount,
    anonCount30d,
    anonLast7d,
    totalBattles,
    battlesToday,
    battlesLast7d,
    metaRowsToday,
    metaRowsTotal,
    activeCursors,
    staleCursors,
    latestCursor,
    todayMetaRows,
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
    admin.from('meta_poll_cursors').select('*', { count: 'exact', head: true }).gt('last_battle_time', d24hAgo),
    admin.from('meta_poll_cursors').select('*', { count: 'exact', head: true }).lt('last_battle_time', d24hAgo),
    admin.from('meta_poll_cursors').select('last_battle_time').order('last_battle_time', { ascending: false }).limit(1).maybeSingle(),
    admin.from('meta_stats').select('brawler_id, map, mode, total, wins, losses').eq('date', today).eq('source', 'global'),
  ])

  // Sparklines
  const anonSparkline   = bucketByDay(anonLast7d.data ?? [], 'first_visit_at', 7, now.getTime())
  const battleSparkline = bucketByDay(battlesLast7d.data ?? [], 'battle_time', 7, now.getTime())

  // Top 3 maps: sum total by (map, mode), descending
  const mapAgg = new Map<string, { map: string; mode: string; battles: number }>()
  for (const row of (todayMetaRows.data ?? []) as Array<{ map: string; mode: string; total: number }>) {
    const key = `${row.mode}::${row.map}`
    const e = mapAgg.get(key) ?? { map: row.map, mode: row.mode, battles: 0 }
    e.battles += row.total ?? 0
    mapAgg.set(key, e)
  }
  const top3Maps = Array.from(mapAgg.values())
    .sort((a, b) => b.battles - a.battles)
    .slice(0, 3)

  // Top 3 brawlers by win rate (min 30 battles aggregated across maps today)
  const brAgg = new Map<number, { brawlerId: number; wins: number; total: number }>()
  for (const row of (todayMetaRows.data ?? []) as Array<{ brawler_id: number; wins: number; total: number }>) {
    const e = brAgg.get(row.brawler_id) ?? { brawlerId: row.brawler_id, wins: 0, total: 0 }
    e.wins  += row.wins  ?? 0
    e.total += row.total ?? 0
    brAgg.set(row.brawler_id, e)
  }
  const top3Brawlers = Array.from(brAgg.values())
    .filter((e) => e.total >= 30)
    .map((e) => ({ brawlerId: e.brawlerId, winRate: e.wins / e.total, total: e.total }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 3)

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
    latestMetaActivity: (latestCursor.data as { last_battle_time: string } | null)?.last_battle_time ?? null,
    top3Maps,
    top3Brawlers,
  }
}

// ── Public export ─────────────────────────────────────────────
// NOTE: other query functions (getBattles, getPremium, getCronStatus,
// getMapList, findMapByPrefix, getMapData) are appended in subsequent
// tasks. The `queries` export below is extended accordingly.

export const queries: Queries = {
  getStats,
  // Placeholders filled in by later tasks:
  async getBattles() { throw new Error('not implemented yet (task 5)') },
  async getPremium() { throw new Error('not implemented yet (task 5)') },
  async getCronStatus() { throw new Error('not implemented yet (task 6)') },
  async getMapList() { throw new Error('not implemented yet (task 7)') },
  async findMapByPrefix() { throw new Error('not implemented yet (task 7)') },
  async getMapData() { throw new Error('not implemented yet (task 7)') },
}
```

- [ ] **Step 4.4 — Run tests — expect PASS for getStats describe block**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: `queries.getStats` tests PASS (2/2).

- [ ] **Step 4.5 — Commit**

```bash
git add src/lib/telegram/queries.ts src/__tests__/unit/lib/telegram/queries.test.ts
git commit -m "feat(telegram-bot): queries.ts admin client + getStats() with unit tests"
```

---

## Task 5 — queries: getBattles() + getPremium() TDD

**Files:**
- Modify: `src/lib/telegram/queries.ts` (append `getBattles`, `getPremium`; remove their placeholder throws)
- Modify: `src/__tests__/unit/lib/telegram/queries.test.ts` (add describe blocks)

- [ ] **Step 5.1 — Add failing tests for `getBattles` and `getPremium`**

Append to `src/__tests__/unit/lib/telegram/queries.test.ts` before the final closing brace:

```ts
describe('queries.getBattles', () => {
  it('aggregates counts and 14d sparkline', async () => {
    const nowIso = '2026-04-12T18:30:00Z'
    fromQueue.push(
      { data: null, count: 108 },  // total
      { data: null, count: 14 },   // today
      { data: null, count: 0 },    // yesterday
      { data: null, count: 108 },  // last7d
      { data: null, count: 108 },  // last30d
      { data: [{ battle_time: nowIso }, { battle_time: nowIso }] },  // 14d rows
      {
        data: [
          { mode: 'brawlBall', result: 'victory', player_tag: '#A' },
          { mode: 'brawlBall', result: 'defeat',  player_tag: '#A' },
          { mode: 'gemGrab',   result: 'draw',    player_tag: '#B' },
        ],
      },  // distributions
      { data: { last_sync: nowIso } },  // latest sync
      { data: null, count: 0 },  // queue pending
    )

    const result = await queries.getBattles()

    expect(result.total).toBe(108)
    expect(result.today).toBe(14)
    expect(result.yesterday).toBe(0)
    expect(result.last7d).toBe(108)
    expect(result.last30d).toBe(108)
    expect(result.sparkline14d).toHaveLength(14)
    expect(result.modeDistribution.length).toBeGreaterThan(0)
    expect(result.resultDistribution.map((r) => r.result)).toEqual(
      expect.arrayContaining(['victory', 'defeat', 'draw']),
    )
    expect(result.topPlayers.length).toBeGreaterThan(0)
    expect(result.lastSuccessfulSyncAt).toBe(nowIso)
    expect(result.queuePending).toBe(0)
  })

  it('returns zeros when battles table empty', async () => {
    fromQueue.push(
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: null, count: 0 },
      { data: [] },
      { data: [] },
      { data: null },
      { data: null, count: 0 },
    )

    const result = await queries.getBattles()
    expect(result.total).toBe(0)
    expect(result.topPlayers).toEqual([])
    expect(result.lastSuccessfulSyncAt).toBeNull()
  })
})

describe('queries.getPremium', () => {
  it('returns funnel counts with nullable v2 fields', async () => {
    fromQueue.push(
      { data: null, count: 1 },  // premium active
      { data: null, count: 0 },  // trial active
      { data: null, count: 2 },  // free
      { data: null, count: 3 },  // signups 30d
      { data: null, count: 3 },  // trials activated 30d
      { data: null, count: 1 },  // trial→premium 30d
      { data: null, count: 0 },  // trials expired 30d
    )

    const result = await queries.getPremium()
    expect(result.premiumActive).toBe(1)
    expect(result.trialActive).toBe(0)
    expect(result.freeUsers).toBe(2)
    expect(result.signupsLast30d).toBe(3)
    expect(result.trialsActivatedLast30d).toBe(3)
    expect(result.trialToPremiumLast30d).toBe(1)
    expect(result.upcomingRenewals7d).toBeNull()
    expect(result.ltvTotal).toBeNull()
  })
})
```

- [ ] **Step 5.2 — Run tests — expect failure from the "not implemented yet" throws**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: 2 new failing tests; existing `getStats` tests still PASS.

- [ ] **Step 5.3 — Implement `getBattles` and `getPremium` in `queries.ts`**

Add the following functions **above** the `export const queries` block in `src/lib/telegram/queries.ts`:

```ts
// ── getBattles ─────────────────────────────────────────────────

async function getBattles(): Promise<BattlesData> {
  const admin = getAdmin()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const yestStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const d7Ago  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString()
  const d14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    total,
    todayRes,
    yestRes,
    last7d,
    last30d,
    rowsFor14d,
    distroRowsRes,
    latestSyncRes,
    queuePendingRes,
  ] = await Promise.all([
    admin.from('battles').select('*', { count: 'exact', head: true }),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', `${today}T00:00:00Z`),
    admin.from('battles').select('*', { count: 'exact', head: true })
      .gte('battle_time', `${yestStart}T00:00:00Z`)
      .lt('battle_time', `${today}T00:00:00Z`),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', d7Ago),
    admin.from('battles').select('*', { count: 'exact', head: true }).gte('battle_time', d30Ago),
    admin.from('battles').select('battle_time').gte('battle_time', d14Ago),
    admin.from('battles').select('mode, result, player_tag').gte('battle_time', d7Ago),
    admin.from('profiles').select('last_sync').order('last_sync', { ascending: false })
      .in('tier', ['premium', 'pro']).limit(1).maybeSingle(),
    admin.from('sync_queue').select('*', { count: 'exact', head: true }).is('completed_at', null),
  ])

  const sparkline14d = bucketByDay(rowsFor14d.data ?? [], 'battle_time', 14, now.getTime())

  // Mode + result distributions over last 7d
  const distroRows = (distroRowsRes.data ?? []) as Array<{ mode: string; result: string; player_tag: string }>
  const total7d = distroRows.length

  const modeCounts = new Map<string, number>()
  for (const r of distroRows) modeCounts.set(r.mode, (modeCounts.get(r.mode) ?? 0) + 1)
  const modeDistribution = Array.from(modeCounts.entries())
    .map(([mode, count]) => ({ mode, count, pct: total7d ? count / total7d : 0 }))
    .sort((a, b) => b.count - a.count)

  const resultCounts = { victory: 0, defeat: 0, draw: 0 }
  for (const r of distroRows) {
    if (r.result === 'victory' || r.result === 'defeat' || r.result === 'draw') {
      resultCounts[r.result] += 1
    }
  }
  const resultDistribution: BattlesData['resultDistribution'] = (['victory', 'defeat', 'draw'] as const).map(
    (k) => ({ result: k, count: resultCounts[k], pct: total7d ? resultCounts[k] / total7d : 0 }),
  )

  // Top 5 players by battle count over 7d
  const playerCounts = new Map<string, number>()
  for (const r of distroRows) playerCounts.set(r.player_tag, (playerCounts.get(r.player_tag) ?? 0) + 1)
  const topPlayers = Array.from(playerCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    total: total.count ?? 0,
    today: todayRes.count ?? 0,
    yesterday: yestRes.count ?? 0,
    last7d: last7d.count ?? 0,
    last30d: last30d.count ?? 0,
    sparkline14d,
    modeDistribution,
    resultDistribution,
    topPlayers,
    lastSuccessfulSyncAt: (latestSyncRes.data as { last_sync: string } | null)?.last_sync ?? null,
    queuePending: queuePendingRes.count ?? 0,
  }
}

// ── getPremium ─────────────────────────────────────────────────
// Explicitly does not query subscriptions/payments tables — those
// are not confirmed to exist. The /premium output surfaces this as
// "requires integration" instead of fabricating numbers.

async function getPremium(): Promise<PremiumData> {
  const admin = getAdmin()
  const now = new Date()
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    premiumActive,
    trialActive,
    freeUsers,
    signupsLast30d,
    trialsActivatedLast30d,
    trialToPremiumLast30d,
    trialsExpiredLast30d,
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }).in('tier', ['premium', 'pro']),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gt('trial_ends_at', now.toISOString()),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'free'),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30Ago),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', d30Ago),
    admin.from('profiles').select('*', { count: 'exact', head: true })
      .in('tier', ['premium', 'pro']).gte('created_at', d30Ago),
    admin.from('profiles').select('*', { count: 'exact', head: true })
      .lt('trial_ends_at', now.toISOString())
      .eq('tier', 'free')
      .gte('created_at', d30Ago),
  ])

  return {
    premiumActive: premiumActive.count ?? 0,
    trialActive: trialActive.count ?? 0,
    freeUsers: freeUsers.count ?? 0,
    signupsLast30d: signupsLast30d.count ?? 0,
    trialsActivatedLast30d: trialsActivatedLast30d.count ?? 0,
    trialToPremiumLast30d: trialToPremiumLast30d.count ?? 0,
    trialsExpiredLast30d: trialsExpiredLast30d.count ?? 0,
    upcomingRenewals7d: null,
    ltvTotal: null,
  }
}
```

Then extend the imports at the top of the file:

```ts
import type {
  BattlesData,
  PremiumData,
  Queries,
  StatsData,
} from './types'
```

And replace the two placeholder entries in `export const queries`:

```ts
export const queries: Queries = {
  getStats,
  getBattles,
  getPremium,
  async getCronStatus() { throw new Error('not implemented yet (task 6)') },
  async getMapList() { throw new Error('not implemented yet (task 7)') },
  async findMapByPrefix() { throw new Error('not implemented yet (task 7)') },
  async getMapData() { throw new Error('not implemented yet (task 7)') },
}
```

> **Schema note (resolved 2026-04-12):** the `profiles` table does NOT have a `trial_started_at` column. It has `trial_ends_at`, set by the `BEFORE INSERT` trigger in `006_trial_referrals.sql` to `NOW() + INTERVAL '3 days'`. Since every signup auto-activates a trial at profile creation, the trial start time is `created_at` by definition. Both `trialsActivatedLast30d` and `trialsExpiredLast30d` therefore filter on `created_at` above. A consequence: `trialsActivatedLast30d === signupsLast30d` always, so `/premium` will show `Activaron trial: N (100%)`. This is factual — it reflects the current design where trial is auto-on — and should not be "fixed" with fabricated numbers.

- [ ] **Step 5.4 — Run tests — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: all `queries.getStats`, `queries.getBattles`, `queries.getPremium` tests PASS.

- [ ] **Step 5.5 — Commit**

```bash
git add src/lib/telegram/queries.ts src/__tests__/unit/lib/telegram/queries.test.ts
git commit -m "feat(telegram-bot): queries.getBattles and queries.getPremium with unit tests"
```

---

## Task 6 — queries: getCronStatus() + inferCronHealth TDD

**Files:**
- Modify: `src/lib/telegram/queries.ts`
- Modify: `src/__tests__/unit/lib/telegram/queries.test.ts`

- [ ] **Step 6.1 — Add failing tests for `getCronStatus`**

Append to `src/__tests__/unit/lib/telegram/queries.test.ts`:

```ts
describe('queries.getCronStatus', () => {
  it('counts runs per job in last 24h and infers VPS freshness', async () => {
    const nowIso = new Date().toISOString()
    const old   = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

    rpcQueue.push(
      {
        data: [
          { jobid: 1, jobname: 'enqueue-premium-syncs', schedule: '*/15 * * * *', active: true, command: '' },
          { jobid: 2, jobname: 'process-sync-queue',    schedule: '*/5 * * * *',  active: true, command: '' },
        ],
      },
      {
        data: [
          { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
          { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
          { jobid: 2, jobname: 'process-sync-queue',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
          { jobid: 2, jobname: 'process-sync-queue',    status: 'succeeded', return_message: null, start_time: old,    end_time: old },  // outside 24h
        ],
      },
    )

    // Latest meta cursor: fresh (10 min ago)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    // Latest sync: stale (65 min ago)
    const sixtyFiveMinAgo = new Date(Date.now() - 65 * 60 * 1000).toISOString()
    fromQueue.push(
      { data: { last_battle_time: tenMinAgo } },
      { data: { last_sync: sixtyFiveMinAgo } },
    )

    const result = await queries.getCronStatus()

    expect(result.pgCronJobs).toHaveLength(2)
    expect(result.runsByJob.get('enqueue-premium-syncs')).toBe(2)
    expect(result.runsByJob.get('process-sync-queue')).toBe(1)  // 1 inside 24h
    expect(result.metaPollFreshness.status).toBe('fresh')
    expect(result.syncFreshness.status).toBe('dead')  // 65 min > 20 + 5, and > 20 × 3 → dead
  })

  it('returns unknown freshness when proxy data is missing', async () => {
    rpcQueue.push({ data: [] }, { data: [] })
    fromQueue.push({ data: null }, { data: null })

    const result = await queries.getCronStatus()
    expect(result.metaPollFreshness.status).toBe('unknown')
    expect(result.syncFreshness.status).toBe('unknown')
  })
})
```

- [ ] **Step 6.2 — Run tests — expect failure from the placeholder throw**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: 2 new FAILs on `getCronStatus`.

- [ ] **Step 6.3 — Implement `getCronStatus` in `queries.ts`**

Extend the type imports at the top of `src/lib/telegram/queries.ts`:

```ts
import {
  EXPECTED_CRON_RUNS_24H,
  FRESHNESS_THRESHOLDS,
} from './constants'
import type {
  BattlesData,
  CronData,
  FreshnessStatus,
  PremiumData,
  Queries,
  StatsData,
} from './types'
```

(Keep `EXPECTED_CRON_RUNS_24H` imported even though it is not used by the query itself — it is consumed by `commands/cron.ts` in Task 12, but declaring the import here is a no-op error. Remove this line if your IDE flags it as unused; it is fine either way.)

Add the helper + function **above** the `export const queries` block:

```ts
// ── freshness inference ────────────────────────────────────────

export function inferCronHealth(
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

// ── getCronStatus ──────────────────────────────────────────────

async function getCronStatus(): Promise<CronData> {
  const admin = getAdmin()
  const now = Date.now()
  const h24Ago = now - 24 * 60 * 60 * 1000

  const [jobsRes, runsRes, latestCursorRes, latestSyncRes] = await Promise.all([
    admin.rpc('diagnose_cron_jobs'),
    admin.rpc('diagnose_cron_runs', { p_limit: 500 }),
    admin.from('meta_poll_cursors').select('last_battle_time').order('last_battle_time', { ascending: false }).limit(1).maybeSingle(),
    admin.from('profiles').select('last_sync').in('tier', ['premium', 'pro']).order('last_sync', { ascending: false }).limit(1).maybeSingle(),
  ])

  const pgCronJobs = (jobsRes.data ?? []) as CronData['pgCronJobs']
  const cronRuns   = (runsRes.data  ?? []) as CronData['cronRuns']

  const runsByJob = new Map<string, number>()
  for (const r of cronRuns) {
    const startMs = new Date(r.start_time).getTime()
    if (startMs < h24Ago) continue
    runsByJob.set(r.jobname, (runsByJob.get(r.jobname) ?? 0) + 1)
  }

  const metaPollAge = (latestCursorRes.data as { last_battle_time: string } | null)
    ? now - new Date((latestCursorRes.data as { last_battle_time: string }).last_battle_time).getTime()
    : null
  const metaPollStatus = inferCronHealth(
    metaPollAge,
    FRESHNESS_THRESHOLDS['meta-poll'].expectedMin,
    FRESHNESS_THRESHOLDS['meta-poll'].graceMin,
  )

  const syncAge = (latestSyncRes.data as { last_sync: string } | null)
    ? now - new Date((latestSyncRes.data as { last_sync: string }).last_sync).getTime()
    : null
  const syncStatus = inferCronHealth(
    syncAge,
    FRESHNESS_THRESHOLDS['sync'].expectedMin,
    FRESHNESS_THRESHOLDS['sync'].graceMin,
  )

  return {
    pgCronJobs,
    cronRuns,
    runsByJob,
    metaPollFreshness: { ageMs: metaPollAge, status: metaPollStatus },
    syncFreshness:     { ageMs: syncAge,     status: syncStatus },
  }
}
```

Replace the `getCronStatus` placeholder in the export:

```ts
export const queries: Queries = {
  getStats,
  getBattles,
  getPremium,
  getCronStatus,
  async getMapList() { throw new Error('not implemented yet (task 7)') },
  async findMapByPrefix() { throw new Error('not implemented yet (task 7)') },
  async getMapData() { throw new Error('not implemented yet (task 7)') },
}
```

- [ ] **Step 6.4 — Run tests — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: all query tests through `getCronStatus` PASS.

- [ ] **Step 6.5 — Commit**

```bash
git add src/lib/telegram/queries.ts src/__tests__/unit/lib/telegram/queries.test.ts
git commit -m "feat(telegram-bot): queries.getCronStatus + inferCronHealth"
```

---

## Task 7 — queries: getMapList() + findMapByPrefix() + getMapData() TDD

**Files:**
- Modify: `src/lib/telegram/queries.ts`
- Modify: `src/__tests__/unit/lib/telegram/queries.test.ts`

Completes the queries layer. Three related map functions kept in the same task because they share fixtures.

- [ ] **Step 7.1 — Add failing tests**

Append to `src/__tests__/unit/lib/telegram/queries.test.ts`:

```ts
describe('queries.getMapList', () => {
  it('aggregates meta_stats rows into (map, mode) entries sorted by battles', async () => {
    fromQueue.push({
      data: [
        { map: 'Sidetrack', mode: 'brawlBall', total: 1000, brawler_id: 1 },
        { map: 'Sidetrack', mode: 'brawlBall', total:  800, brawler_id: 2 },
        { map: 'Nutmeg',    mode: 'brawlBall', total:  500, brawler_id: 1 },
      ],
    })

    const result = await queries.getMapList()
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ map: 'Sidetrack', mode: 'brawlBall', battles: 1800, brawlerCount: 2 })
    expect(result[1]).toEqual({ map: 'Nutmeg',    mode: 'brawlBall', battles: 500,  brawlerCount: 1 })
  })

  it('returns empty array when no data', async () => {
    fromQueue.push({ data: [] })
    const result = await queries.getMapList()
    expect(result).toEqual([])
  })
})

describe('queries.findMapByPrefix', () => {
  it('returns "found" with the single match', async () => {
    fromQueue.push({
      data: [{ map: 'Sidetrack', mode: 'brawlBall' }],
    })
    const result = await queries.findMapByPrefix('side')
    expect(result).toEqual({ kind: 'found', map: 'Sidetrack', mode: 'brawlBall' })
  })

  it('returns "none" when no matches', async () => {
    fromQueue.push({ data: [] })
    const result = await queries.findMapByPrefix('xyz')
    expect(result).toEqual({ kind: 'none' })
  })

  it('returns "ambiguous" with candidates when multiple distinct pairs match', async () => {
    fromQueue.push({
      data: [
        { map: 'Beach Ball',  mode: 'brawlBall' },
        { map: 'Bea Stadium', mode: 'knockout'  },
      ],
    })
    const result = await queries.findMapByPrefix('bea')
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(result.candidates).toHaveLength(2)
    }
  })
})

describe('queries.getMapData', () => {
  it('returns coverage + rankings for an existing map', async () => {
    const nowIso = new Date().toISOString()
    fromQueue.push(
      { data: null, count: 2798 },                                                                // today count
      { data: null, count: 19586 },                                                               // 7d count
      { data: [{ brawler_id: 1 }, { brawler_id: 2 }, { brawler_id: 3 }] },                        // brawler coverage
      {
        data: [
          { brawler_id: 1, wins: 60, losses: 40, total: 100 },
          { brawler_id: 2, wins: 45, losses: 55, total: 100 },
        ],
      },                                                                                          // WR rows
      { data: [{ battle_time: nowIso }] },                                                        // 7d sparkline rows (here: reusing meta_stats date-bucketing is fine as placeholder; real impl bucketizes by date)
      {
        data: [
          { map: 'Sidetrack', mode: 'brawlBall', total: 2798 },
          { map: 'Nutmeg',    mode: 'brawlBall', total: 1848 },
        ],
      },                                                                                          // same-mode comparison
      { data: { last_battle_time: nowIso } },                                                     // last cursor update
    )

    const result = await queries.getMapData('Sidetrack', 'brawlBall')
    expect(result.map).toBe('Sidetrack')
    expect(result.mode).toBe('brawlBall')
    expect(result.battlesToday).toBe(2798)
    expect(result.battlesLast7d).toBe(19586)
    expect(result.brawlerCovered).toBe(3)
    expect(result.topWinRates.length).toBeGreaterThan(0)
    expect(result.sameModeComparison.length).toBe(2)
    expect(result.lastCursorUpdate).toBe(nowIso)
  })
})
```

- [ ] **Step 7.2 — Run tests — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: FAIL on new describe blocks due to placeholder throws.

- [ ] **Step 7.3 — Implement the 3 functions**

Extend type imports in `src/lib/telegram/queries.ts`:

```ts
import type {
  BattlesData,
  CronData,
  FreshnessStatus,
  MapData,
  MapListItem,
  MapMatchResult,
  PremiumData,
  Queries,
  StatsData,
} from './types'
```

Add the functions **above** the `export const queries` block:

```ts
// ── getMapList ─────────────────────────────────────────────────

async function getMapList(): Promise<MapListItem[]> {
  const admin = getAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from('meta_stats')
    .select('map, mode, total, brawler_id')
    .eq('date', today)
    .eq('source', 'global')

  const agg = new Map<string, { map: string; mode: string; battles: number; brawlers: Set<number> }>()
  for (const row of (data ?? []) as Array<{ map: string; mode: string; total: number; brawler_id: number }>) {
    const key = `${row.mode}::${row.map}`
    let entry = agg.get(key)
    if (!entry) {
      entry = { map: row.map, mode: row.mode, battles: 0, brawlers: new Set() }
      agg.set(key, entry)
    }
    entry.battles += row.total ?? 0
    entry.brawlers.add(row.brawler_id)
  }

  return Array.from(agg.values())
    .map((e) => ({ map: e.map, mode: e.mode, battles: e.battles, brawlerCount: e.brawlers.size }))
    .sort((a, b) => b.battles - a.battles)
}

// ── findMapByPrefix ────────────────────────────────────────────
// Case-insensitive prefix match against distinct (map, mode) pairs
// that have data today. Dedup runs in JS because Supabase JS client
// does not support SELECT DISTINCT cleanly.

async function findMapByPrefix(prefix: string): Promise<MapMatchResult> {
  const admin = getAdmin()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from('meta_stats')
    .select('map, mode')
    .eq('date', today)
    .eq('source', 'global')
    .ilike('map', `${prefix}%`)
    .limit(200)

  const pairs = new Map<string, { map: string; mode: string }>()
  for (const row of (data ?? []) as Array<{ map: string; mode: string }>) {
    const key = `${row.mode}::${row.map}`
    if (!pairs.has(key)) pairs.set(key, { map: row.map, mode: row.mode })
  }
  const candidates = Array.from(pairs.values()).slice(0, 10)

  if (candidates.length === 0) return { kind: 'none' }
  if (candidates.length === 1) return { kind: 'found', map: candidates[0].map, mode: candidates[0].mode }
  return { kind: 'ambiguous', candidates }
}

// ── getMapData ─────────────────────────────────────────────────

async function getMapData(map: string, mode: string): Promise<MapData> {
  const admin = getAdmin()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const d7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    todayRes,
    last7dRes,
    brawlerCoverageRes,
    wrRowsRes,
    sparklineRowsRes,
    sameModeRes,
    cursorRes,
  ] = await Promise.all([
    admin.from('meta_stats').select('total').eq('date', today).eq('source', 'global').eq('map', map).eq('mode', mode),
    admin.from('meta_stats').select('total').gte('date', d7Ago).eq('source', 'global').eq('map', map).eq('mode', mode),
    admin.from('meta_stats').select('brawler_id').eq('date', today).eq('source', 'global').eq('map', map).eq('mode', mode),
    admin.from('meta_stats').select('brawler_id, wins, losses, total').eq('date', today).eq('source', 'global').eq('map', map).eq('mode', mode),
    admin.from('meta_stats').select('date, total').gte('date', d7Ago).eq('source', 'global').eq('map', map).eq('mode', mode),
    admin.from('meta_stats').select('map, mode, total').eq('date', today).eq('source', 'global').eq('mode', mode),
    admin.from('meta_poll_cursors').select('last_battle_time').order('last_battle_time', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Aggregate today's total
  const battlesToday = ((todayRes.data ?? []) as Array<{ total: number }>)
    .reduce((sum, r) => sum + (r.total ?? 0), 0)
  const battlesLast7d = ((last7dRes.data ?? []) as Array<{ total: number }>)
    .reduce((sum, r) => sum + (r.total ?? 0), 0)

  // Brawler coverage
  const brawlerSet = new Set<number>()
  for (const r of (brawlerCoverageRes.data ?? []) as Array<{ brawler_id: number }>) {
    brawlerSet.add(r.brawler_id)
  }

  // WR rankings (min 30 battles)
  const wrRows = ((wrRowsRes.data ?? []) as Array<{ brawler_id: number; wins: number; losses: number; total: number }>)
    .filter((r) => r.total >= 30)
    .map((r) => ({ brawlerId: r.brawler_id, winRate: r.wins / r.total, total: r.total }))
  const topWinRates    = [...wrRows].sort((a, b) => b.winRate - a.winRate).slice(0, 5)
  const bottomWinRates = [...wrRows].sort((a, b) => a.winRate - b.winRate).slice(0, 3)

  // 7d sparkline grouped by date
  const dayBuckets = new Map<string, number>()
  for (const row of (sparklineRowsRes.data ?? []) as Array<{ date: string; total: number }>) {
    dayBuckets.set(row.date, (dayBuckets.get(row.date) ?? 0) + (row.total ?? 0))
  }
  const sparkline7d: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    sparkline7d.push(dayBuckets.get(d) ?? 0)
  }

  // Same-mode comparison — aggregate by map, sort desc
  const comparisonAgg = new Map<string, number>()
  for (const r of (sameModeRes.data ?? []) as Array<{ map: string; total: number }>) {
    comparisonAgg.set(r.map, (comparisonAgg.get(r.map) ?? 0) + (r.total ?? 0))
  }
  const sameModeComparison = Array.from(comparisonAgg.entries())
    .map(([m, battles]) => ({ map: m, battles }))
    .sort((a, b) => b.battles - a.battles)

  return {
    map,
    mode,
    battlesToday,
    battlesLast7d,
    brawlerCovered: brawlerSet.size,
    brawlerTotal: 82,  // total brawlers in the game as of 2026-04. Update in constants.ts if needed.
    sparkline7d,
    topWinRates,
    bottomWinRates,
    sameModeComparison,
    lastCursorUpdate: (cursorRes.data as { last_battle_time: string } | null)?.last_battle_time ?? null,
  }
}
```

Replace the remaining placeholders in the export:

```ts
export const queries: Queries = {
  getStats,
  getBattles,
  getPremium,
  getCronStatus,
  getMapList,
  findMapByPrefix,
  getMapData,
}
```

- [ ] **Step 7.4 — Run tests — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/queries.test.ts`
Expected: all query tests PASS.

- [ ] **Step 7.5 — Commit**

```bash
git add src/lib/telegram/queries.ts src/__tests__/unit/lib/telegram/queries.test.ts
git commit -m "feat(telegram-bot): queries.getMapList, findMapByPrefix, getMapData"
```

---

## Task 8 — /help command

**Files:**
- Create: `src/lib/telegram/commands/help.ts`
- Create: `src/__tests__/unit/lib/telegram/commands/help.test.ts`

Trivial but required: a string constant wrapped in a handler signature.

- [ ] **Step 8.1 — Write the failing test**

Create `src/__tests__/unit/lib/telegram/commands/help.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { handleHelp } from '@/lib/telegram/commands/help'

const noopQueries = {
  getStats: () => Promise.reject(new Error('not used')),
  getBattles: () => Promise.reject(new Error('not used')),
  getPremium: () => Promise.reject(new Error('not used')),
  getCronStatus: () => Promise.reject(new Error('not used')),
  getMapList: () => Promise.reject(new Error('not used')),
  findMapByPrefix: () => Promise.reject(new Error('not used')),
  getMapData: () => Promise.reject(new Error('not used')),
}

describe('handleHelp', () => {
  it('mentions every one of the 6 commands', async () => {
    const out = await handleHelp({ args: [], queries: noopQueries })
    expect(out).toContain('/stats')
    expect(out).toContain('/batallas')
    expect(out).toContain('/premium')
    expect(out).toContain('/cron')
    expect(out).toContain('/mapa')
    expect(out).toContain('/help')
  })
})
```

- [ ] **Step 8.2 — Run — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/help.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 8.3 — Implement `src/lib/telegram/commands/help.ts`**

```ts
import type { CommandHandler } from '../types'

const HELP_MESSAGE = `🤖 <b>BrawlVision Bot</b>

Comandos disponibles:

/stats — resumen global del sistema
/batallas — estado del battle sync
/premium — métricas de monetización
/cron — estado de los cron jobs
/mapa &lt;nombre&gt; — datos de un mapa específico
/mapa — listado de mapas con datos hoy

/help — este mensaje

Formato de nombres de mapa:
  case-insensitive + prefix match
  /mapa side → "Sidetrack"
  /mapa heal → "Healthy Middle Ground"`

export const handleHelp: CommandHandler = async () => HELP_MESSAGE
```

- [ ] **Step 8.4 — Run — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/help.test.ts`

- [ ] **Step 8.5 — Commit**

```bash
git add src/lib/telegram/commands/help.ts src/__tests__/unit/lib/telegram/commands/help.test.ts
git commit -m "feat(telegram-bot): /help command"
```

---

## Task 9 — /stats command TDD

**Files:**
- Create: `src/lib/telegram/commands/stats.ts`
- Create: `src/__tests__/unit/lib/telegram/commands/stats.test.ts`

Handlers receive a `Queries` object via `CommandContext`, so every test in this and subsequent command tasks constructs a fake `queries` that returns canned `StatsData` etc. No supabase mocks needed here — they live in Task 4's queries tests.

- [ ] **Step 9.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/commands/stats.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { handleStats } from '@/lib/telegram/commands/stats'
import type { Queries, StatsData } from '@/lib/telegram/types'

function makeQueries(stats: Partial<StatsData> = {}): Queries {
  const defaults: StatsData = {
    totalUsers: 3,
    premiumCount: 1,
    trialCount: 0,
    anonCount30d: 3,
    anonSparkline: [0, 0, 0, 0, 0, 0, 3],
    totalBattles: 108,
    battlesToday: 14,
    battleSparkline: [2, 2, 3, 4, 4, 4, 14],
    metaRowsToday: 836,
    metaRowsTotal: 3443,
    activeCursors: 183,
    staleCursors: 22,
    latestMetaActivity: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
    top3Maps: [
      { map: 'Sidetrack',              mode: 'brawlBall', battles: 2798 },
      { map: 'Healthy Middle Ground',  mode: 'knockout',  battles: 2017 },
      { map: 'Nutmeg',                 mode: 'brawlBall', battles: 1848 },
    ],
    top3Brawlers: [
      { brawlerId: 1, winRate: 0.62, total: 123 },
      { brawlerId: 2, winRate: 0.58, total: 89  },
      { brawlerId: 3, winRate: 0.57, total: 156 },
    ],
  }
  const merged = { ...defaults, ...stats }
  return {
    getStats: async () => merged,
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handleStats', () => {
  it('renders all 5 sections with sparklines and top 3 lists', async () => {
    const out = await handleStats({ args: [], queries: makeQueries() })
    expect(out).toContain('📊')
    expect(out).toContain('USUARIOS')
    expect(out).toContain('ACTIVIDAD')
    expect(out).toContain('META POLL')
    expect(out).toContain('TOP 3 MAPAS')
    expect(out).toContain('TOP 3 BRAWLERS')
    expect(out).toContain('Sidetrack')
    expect(out).toContain('1,848')          // comma separator
    expect(out).toMatch(/[▁▂▃▄▅▆▇█]/)       // sparkline present
  })

  it('falls back to "— sin datos" when sparklines are all zero', async () => {
    const flat = makeQueries({
      anonSparkline: [0, 0, 0, 0, 0, 0, 0],
      battleSparkline: [0, 0, 0, 0, 0, 0, 0],
      totalBattles: 0,
    })
    const out = await handleStats({ args: [], queries: flat })
    expect(out).toContain('sin datos')
  })

  it('propagates errors when queries.getStats throws', async () => {
    const throwing: Queries = {
      ...makeQueries(),
      getStats: async () => { throw new Error('db down') },
    }
    await expect(handleStats({ args: [], queries: throwing })).rejects.toThrow('db down')
  })
})
```

- [ ] **Step 9.2 — Run — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/stats.test.ts`

- [ ] **Step 9.3 — Implement `src/lib/telegram/commands/stats.ts`**

```ts
import { fmtNumber, fmtTimeAgo, sparkline, section } from '../formatters'
import type { CommandHandler, StatsData } from '../types'

function formatSparkLine(values: number[], label: string): string {
  if (values.every((v) => v === 0)) return '  — sin datos'
  return `  ${sparkline(values)}  → ${label}`
}

export const handleStats: CommandHandler = async ({ queries }) => {
  const s = await queries.getStats()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const users = [
    `  Total registered:    ${fmtNumber(s.totalUsers)}`,
    `  Premium activos:     ${fmtNumber(s.premiumCount)}`,
    `  En trial:            ${fmtNumber(s.trialCount)}`,
    `  Visitantes anónimos: ${fmtNumber(s.anonCount30d)} (últimos 30d)`,
    '',
    '  Anon new / day (7d)',
    formatSparkLine(s.anonSparkline, `${s.anonSparkline[s.anonSparkline.length - 1] ?? 0} new today`),
  ].join('\n')

  const activity = [
    `  Total batallas: ${fmtNumber(s.totalBattles)}`,
    `  Hoy:            ${fmtNumber(s.battlesToday)}`,
    `  Últimos 7 días: ${fmtNumber(s.totalBattles)}`,
    '',
    '  Battles / day (7d)',
    formatSparkLine(s.battleSparkline, `${s.battlesToday} today`),
  ].join('\n')

  const metaPoll = [
    `  Meta rows hoy:    ${fmtNumber(s.metaRowsToday)}`,
    `  Meta rows total:  ${fmtNumber(s.metaRowsTotal)}`,
    `  Pool efectivo:    ${fmtNumber(s.activeCursors)} / ${fmtNumber(s.activeCursors + s.staleCursors)} cursors`,
    `                    (${fmtNumber(s.staleCursors)} stale &gt;24h)`,
    `  Última actividad: ${fmtTimeAgo(s.latestMetaActivity, now.getTime())}`,
  ].join('\n')

  const topMaps = renderTop3Maps(s.top3Maps)
  const topBrawlers = renderTop3Brawlers(s.top3Brawlers)

  return [
    `📊 <b>BrawlVision Stats</b>`,
    nowLabel,
    '',
    section('👥', 'USUARIOS', users),
    '',
    section('⚔️', 'ACTIVIDAD (battles table — premium sync)', activity),
    '',
    section('🌐', 'META POLL (global pool)', metaPoll),
    '',
    section('🎯', 'TOP 3 MAPAS (hoy)', topMaps),
    '',
    section('🏆', 'TOP 3 BRAWLERS (hoy, por win rate)', topBrawlers),
  ].join('\n')
}

function renderTop3Maps(rows: StatsData['top3Maps']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => `  ${i + 1}. ${r.map.padEnd(24)} ${fmtNumber(r.battles)} battles`)
    .join('\n')
}

function renderTop3Brawlers(rows: StatsData['top3Brawlers']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => `  ${i + 1}. brawler#${r.brawlerId}  WR ${(r.winRate * 100).toFixed(1)}% (${fmtNumber(r.total)} partidas)`)
    .join('\n')
}
```

- [ ] **Step 9.4 — Run — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/stats.test.ts`

- [ ] **Step 9.5 — Commit**

```bash
git add src/lib/telegram/commands/stats.ts src/__tests__/unit/lib/telegram/commands/stats.test.ts
git commit -m "feat(telegram-bot): /stats command"
```

---

## Task 10 — /batallas command TDD

**Files:**
- Create: `src/lib/telegram/commands/batallas.ts`
- Create: `src/__tests__/unit/lib/telegram/commands/batallas.test.ts`

- [ ] **Step 10.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/commands/batallas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { handleBatallas } from '@/lib/telegram/commands/batallas'
import type { BattlesData, Queries } from '@/lib/telegram/types'

function makeQueries(b: Partial<BattlesData> = {}): Queries {
  const defaults: BattlesData = {
    total: 108,
    today: 14,
    yesterday: 0,
    last7d: 108,
    last30d: 108,
    sparkline14d: [1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 4, 4, 14],
    modeDistribution: [
      { mode: 'lastStand', count: 7, pct: 0.50 },
      { mode: 'brawlBall', count: 3, pct: 0.21 },
      { mode: 'gemGrab',   count: 2, pct: 0.14 },
      { mode: 'knockout',  count: 2, pct: 0.14 },
    ],
    resultDistribution: [
      { result: 'victory', count: 48, pct: 0.44 },
      { result: 'defeat',  count: 55, pct: 0.51 },
      { result: 'draw',    count:  5, pct: 0.05 },
    ],
    topPlayers: [{ tag: '#YJU282PV', count: 108 }],
    lastSuccessfulSyncAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    queuePending: 0,
  }
  const merged = { ...defaults, ...b }
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: async () => merged,
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handleBatallas', () => {
  it('renders 4 sections with sparkline, mode bars, result bars, top players', async () => {
    const out = await handleBatallas({ args: [], queries: makeQueries() })
    expect(out).toContain('BATTLES SYNC')
    expect(out).toContain('VOLUMEN')
    expect(out).toContain('DISTRIBUCIÓN POR MODO')
    expect(out).toContain('RESULTADO')
    expect(out).toContain('TOP 5 PLAYERS MÁS ACTIVOS')
    expect(out).toContain('#YJU282PV')
    expect(out).toMatch(/[▁▂▃▄▅▆▇█]/)
    expect(out).toMatch(/█+/)  // bar blocks
    expect(out).toContain('SYNC STATUS')
  })

  it('says no data when battles table empty', async () => {
    const out = await handleBatallas({ args: [], queries: makeQueries({
      total: 0, today: 0, yesterday: 0, last7d: 0, last30d: 0,
      sparkline14d: new Array(14).fill(0),
      modeDistribution: [],
      resultDistribution: [
        { result: 'victory', count: 0, pct: 0 },
        { result: 'defeat',  count: 0, pct: 0 },
        { result: 'draw',    count: 0, pct: 0 },
      ],
      topPlayers: [],
      lastSuccessfulSyncAt: null,
      queuePending: 0,
    }) })
    expect(out).toContain('No hay batallas registradas aún')
  })

  it('propagates getBattles errors', async () => {
    const throwing: Queries = {
      ...makeQueries(),
      getBattles: async () => { throw new Error('supabase down') },
    }
    await expect(handleBatallas({ args: [], queries: throwing })).rejects.toThrow('supabase down')
  })
})
```

- [ ] **Step 10.2 — Run — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/batallas.test.ts`

- [ ] **Step 10.3 — Implement `src/lib/telegram/commands/batallas.ts`**

```ts
import { bar, fmtNumber, fmtTimeAgo, section, sparkline } from '../formatters'
import type { BattlesData, CommandHandler } from '../types'

export const handleBatallas: CommandHandler = async ({ queries }) => {
  const b = await queries.getBattles()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  if (b.total === 0) {
    return [
      '⚔️ <b>BATTLES SYNC</b>',
      nowLabel,
      '',
      'No hay batallas registradas aún. El primer user premium debe sincronizar.',
    ].join('\n')
  }

  const volumen = [
    `  Total batallas: ${fmtNumber(b.total)}`,
    `  Hoy:            ${fmtNumber(b.today)}`,
    `  Ayer:           ${fmtNumber(b.yesterday)}`,
    `  Últimos 7d:     ${fmtNumber(b.last7d)}`,
    `  Últimos 30d:    ${fmtNumber(b.last30d)}`,
    '',
    '  Battles/day last 14d',
    `  ${sparkline(b.sparkline14d)}`,
  ].join('\n')

  const modes = renderModeDistribution(b.modeDistribution)
  const results = renderResultDistribution(b.resultDistribution)
  const players = renderTopPlayers(b.topPlayers)

  const syncStatus = [
    `  Última sync exitosa: ${fmtTimeAgo(b.lastSuccessfulSyncAt, now.getTime())}`,
    `  Queue pending:       ${fmtNumber(b.queuePending)}`,
  ].join('\n')

  return [
    '⚔️ <b>BATTLES SYNC</b>',
    nowLabel,
    '',
    section('📦', 'VOLUMEN', volumen),
    '',
    section('🎮', 'DISTRIBUCIÓN POR MODO (últimos 7d)', modes),
    '',
    section('⚖️', 'RESULTADO (últimos 7d)', results),
    '',
    section('👤', 'TOP 5 PLAYERS MÁS ACTIVOS (últimos 7d)', players),
    '',
    section('🔄', 'SYNC STATUS', syncStatus),
  ].join('\n')
}

function renderModeDistribution(rows: BattlesData['modeDistribution']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r) => `  ${r.mode.padEnd(12)} ${String(r.count).padStart(3)} (${Math.round(r.pct * 100)}%) ${bar(r.pct, 16)}`)
    .join('\n')
}

function renderResultDistribution(rows: BattlesData['resultDistribution']): string {
  const labels: Record<BattlesData['resultDistribution'][number]['result'], string> = {
    victory: 'Victory',
    defeat:  'Defeat ',
    draw:    'Draw   ',
  }
  return rows
    .map((r) => `  ${labels[r.result]} ${String(r.count).padStart(3)} (${Math.round(r.pct * 100)}%) ${bar(r.pct, 10)}`)
    .join('\n')
}

function renderTopPlayers(rows: BattlesData['topPlayers']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => `  ${i + 1}. ${r.tag.padEnd(12)} ${fmtNumber(r.count)} batallas`)
    .join('\n')
}
```

- [ ] **Step 10.4 — Run — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/batallas.test.ts`

- [ ] **Step 10.5 — Commit**

```bash
git add src/lib/telegram/commands/batallas.ts src/__tests__/unit/lib/telegram/commands/batallas.test.ts
git commit -m "feat(telegram-bot): /batallas command"
```

---

## Task 11 — /premium command TDD

**Files:**
- Create: `src/lib/telegram/commands/premium.ts`
- Create: `src/__tests__/unit/lib/telegram/commands/premium.test.ts`

This command must explicitly surface the "requires integration" placeholder for LTV/revenue/renewals. Do not fabricate those numbers.

- [ ] **Step 11.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/commands/premium.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { handlePremium } from '@/lib/telegram/commands/premium'
import type { PremiumData, Queries } from '@/lib/telegram/types'

function makeQueries(p: Partial<PremiumData> = {}): Queries {
  const defaults: PremiumData = {
    premiumActive: 1,
    trialActive: 0,
    freeUsers: 2,
    signupsLast30d: 3,
    trialsActivatedLast30d: 3,
    trialToPremiumLast30d: 1,
    trialsExpiredLast30d: 0,
    upcomingRenewals7d: null,
    ltvTotal: null,
  }
  const merged = { ...defaults, ...p }
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: async () => merged,
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handlePremium', () => {
  it('renders 3 sections with funnel percentages and explicit integration placeholders', async () => {
    const out = await handlePremium({ args: [], queries: makeQueries() })
    expect(out).toContain('PREMIUM')
    expect(out).toContain('ESTADO ACTUAL')
    expect(out).toContain('FUNNEL 30 DÍAS')
    expect(out).toContain('Requiere integración')
    expect(out).toContain('100%')  // 3/3 activaron trial
    expect(out).toContain('33%')   // 1/3 trial→premium
  })

  it('handles zero signups without NaN percentages', async () => {
    const out = await handlePremium({ args: [], queries: makeQueries({
      signupsLast30d: 0, trialsActivatedLast30d: 0, trialToPremiumLast30d: 0, trialsExpiredLast30d: 0,
    }) })
    expect(out).not.toMatch(/NaN/)
  })

  it('propagates query errors', async () => {
    const throwing: Queries = {
      ...makeQueries(),
      getPremium: async () => { throw new Error('db down') },
    }
    await expect(handlePremium({ args: [], queries: throwing })).rejects.toThrow('db down')
  })
})
```

- [ ] **Step 11.2 — Run — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/premium.test.ts`

- [ ] **Step 11.3 — Implement `src/lib/telegram/commands/premium.ts`**

```ts
import { fmtNumber, section } from '../formatters'
import type { CommandHandler } from '../types'

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export const handlePremium: CommandHandler = async ({ queries }) => {
  const p = await queries.getPremium()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const estado = [
    `  Premium activos: ${fmtNumber(p.premiumActive)}`,
    `  En trial:        ${fmtNumber(p.trialActive)}`,
    `  Free:            ${fmtNumber(p.freeUsers)}`,
  ].join('\n')

  const funnel = [
    `  Nuevos signups:              ${fmtNumber(p.signupsLast30d)}`,
    `  Activaron trial:             ${fmtNumber(p.trialsActivatedLast30d)}  (${pct(p.trialsActivatedLast30d, p.signupsLast30d)})`,
    `  Trial → premium:             ${fmtNumber(p.trialToPremiumLast30d)}   (${pct(p.trialToPremiumLast30d, p.trialsActivatedLast30d)})`,
    `  Trials expirados:            ${fmtNumber(p.trialsExpiredLast30d)}`,
    `  Churn (premium cancelados):  — (requiere tabla subscriptions)`,
  ].join('\n')

  const revenue = [
    '  — ninguna detectada',
    '  (Requiere integración con tabla de subscriptions',
    '   de PayPal — v2 cuando se active)',
  ].join('\n')

  const ltv = [
    '  (Requiere tabla de payments — ver docs/crons/README.md',
    '   para el plan de integración)',
  ].join('\n')

  return [
    '💎 <b>PREMIUM</b>',
    nowLabel,
    '',
    section('✨', 'ESTADO ACTUAL', estado),
    '',
    section('📈', 'FUNNEL 30 DÍAS', funnel),
    '',
    section('📅', 'PRÓXIMAS RENOVACIONES (próximos 7d)', revenue),
    '',
    section('⭐', 'LTV / REVENUE', ltv),
  ].join('\n')
}
```

- [ ] **Step 11.4 — Run — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/premium.test.ts`

- [ ] **Step 11.5 — Commit**

```bash
git add src/lib/telegram/commands/premium.ts src/__tests__/unit/lib/telegram/commands/premium.test.ts
git commit -m "feat(telegram-bot): /premium command"
```

---

## Task 12 — /cron command TDD

**Files:**
- Create: `src/lib/telegram/commands/cron.ts`
- Create: `src/__tests__/unit/lib/telegram/commands/cron.test.ts`

Consumes `CronData`. Renders the pg_cron section with "N / M expected" counts using `EXPECTED_CRON_RUNS_24H`, and the VPS freshness section using `FRESHNESS_EMOJI`.

- [ ] **Step 12.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/commands/cron.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { handleCron } from '@/lib/telegram/commands/cron'
import type { CronData, Queries } from '@/lib/telegram/types'

function makeQueries(c: Partial<CronData> = {}): Queries {
  const nowIso = new Date().toISOString()
  const defaults: CronData = {
    pgCronJobs: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    schedule: '*/15 * * * *', active: true, command: '' },
      { jobid: 2, jobname: 'process-sync-queue',       schedule: '*/5 * * * *',  active: true, command: '' },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', schedule: '0 3 * * *',    active: true, command: '' },
    ],
    cronRuns: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 2, jobname: 'process-sync-queue',       status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
    ],
    runsByJob: new Map([
      ['enqueue-premium-syncs', 96],
      ['process-sync-queue', 288],
      ['cleanup-anonymous-visits', 1],
    ]),
    metaPollFreshness: { ageMs: 10 * 60 * 1000, status: 'fresh' },
    syncFreshness:     { ageMs: 18 * 60 * 1000, status: 'fresh' },
  }
  const merged: CronData = {
    ...defaults,
    ...c,
    runsByJob: c.runsByJob ?? defaults.runsByJob,
    pgCronJobs: c.pgCronJobs ?? defaults.pgCronJobs,
    cronRuns: c.cronRuns ?? defaults.cronRuns,
    metaPollFreshness: c.metaPollFreshness ?? defaults.metaPollFreshness,
    syncFreshness: c.syncFreshness ?? defaults.syncFreshness,
  }
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: async () => merged,
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handleCron', () => {
  it('renders all 3 pg_cron jobs + VPS freshness — all green', async () => {
    const out = await handleCron({ args: [], queries: makeQueries() })
    expect(out).toContain('PG_CRON JOBS')
    expect(out).toContain('VPS ORACLE')
    expect(out).toContain('enqueue-premium-syncs')
    expect(out).toContain('96 / 96 expected')
    expect(out).toContain('288 / 288 expected')
    expect(out).toContain('✅')
    expect(out).toContain('SETUP-HEALTHCHECKS')
  })

  it('marks failed runs with ❌ and shows return_message', async () => {
    const nowIso = new Date().toISOString()
    const out = await handleCron({ args: [], queries: makeQueries({
      cronRuns: [
        { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'failed', return_message: 'ERROR: duplicate key', start_time: nowIso, end_time: nowIso },
        { jobid: 2, jobname: 'process-sync-queue',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
        { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      ],
    }) })
    expect(out).toContain('❌')
    expect(out).toContain('duplicate key')
  })

  it('renders stale/dead VPS status correctly', async () => {
    const out = await handleCron({ args: [], queries: makeQueries({
      metaPollFreshness: { ageMs: 45 * 60 * 1000, status: 'stale' },
      syncFreshness:     { ageMs: 90 * 60 * 1000, status: 'dead'  },
    }) })
    expect(out).toContain('🟡')
    expect(out).toContain('🔴')
  })

  it('handles empty pgCronJobs gracefully', async () => {
    const out = await handleCron({ args: [], queries: makeQueries({
      pgCronJobs: [], cronRuns: [], runsByJob: new Map(),
    }) })
    expect(out).toContain('(no disponible)')
  })
})
```

- [ ] **Step 12.2 — Run — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/cron.test.ts`

- [ ] **Step 12.3 — Implement `src/lib/telegram/commands/cron.ts`**

```ts
import { EXPECTED_CRON_RUNS_24H, FRESHNESS_EMOJI, FRESHNESS_THRESHOLDS } from '../constants'
import { escapeHtml, fmtTimeAgo, section } from '../formatters'
import type { CommandHandler, CronData, PgCronJob, PgCronRun } from '../types'

export const handleCron: CommandHandler = async ({ queries }) => {
  const c = await queries.getCronStatus()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const pgCronBlock = renderPgCron(c, now.getTime())
  const vpsBlock = renderVps(c, now.getTime())

  return [
    '🔄 <b>CRON STATUS</b>',
    nowLabel,
    '',
    section('📅', 'PG_CRON JOBS (Supabase — directo)', pgCronBlock),
    '',
    section('🖥️', 'VPS ORACLE CRONS (inferencia por frescura)', vpsBlock),
    '',
    '⚠️ Nota: los 2 crons del VPS no son visibles directamente',
    'desde aquí. El status mostrado es inferencia por la frescura',
    'de los datos que cada cron produce. Para status directo y',
    'alertas en tiempo real, configurar healthchecks.io siguiendo',
    'docs/crons/SETUP-HEALTHCHECKS.md',
  ].join('\n')
}

function latestRunFor(jobname: string, runs: PgCronRun[]): PgCronRun | null {
  let latest: PgCronRun | null = null
  for (const r of runs) {
    if (r.jobname !== jobname) continue
    if (!latest || new Date(r.start_time).getTime() > new Date(latest.start_time).getTime()) {
      latest = r
    }
  }
  return latest
}

function durationSeconds(run: PgCronRun): string {
  if (!run.end_time) return '?'
  const ms = new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
  return `${(ms / 1000).toFixed(1)}s`
}

function renderPgCron(c: CronData, nowMs: number): string {
  if (c.pgCronJobs.length === 0) return '  (no disponible)'
  const blocks: string[] = []
  for (const job of c.pgCronJobs) {
    const latest = latestRunFor(job.jobname, c.cronRuns)
    const emoji = statusEmojiForRun(latest)
    const expected = EXPECTED_CRON_RUNS_24H[job.jobname]
    const actual = c.runsByJob.get(job.jobname) ?? 0
    const runsLine = expected !== undefined
      ? `     Runs 24h:    ${actual} / ${expected} expected`
      : `     Runs 24h:    ${actual}`
    const lastLine = latest
      ? `     Last run:    ${fmtTimeAgo(latest.start_time, nowMs)}  (${latest.status}, ${durationSeconds(latest)})`
      : `     Last run:    (ninguna)`
    const errorLine = latest?.status === 'failed' && latest.return_message
      ? `     Error:       ${escapeHtml(latest.return_message.slice(0, 100))}`
      : null
    blocks.push(
      [
        `  ${emoji} ${job.jobname}`,
        `     Schedule:    ${job.schedule}`,
        lastLine,
        runsLine,
        errorLine,
      ].filter(Boolean).join('\n'),
    )
  }
  return blocks.join('\n\n')
}

function statusEmojiForRun(run: PgCronRun | null): string {
  if (!run) return FRESHNESS_EMOJI.unknown
  if (run.status === 'succeeded') return FRESHNESS_EMOJI.fresh
  if (run.status === 'failed') return '❌'
  return FRESHNESS_EMOJI.unknown
}

function renderVps(c: CronData, nowMs: number): string {
  const metaPollLine = [
    `  ${FRESHNESS_EMOJI[c.metaPollFreshness.status]} meta-poll   (expected: */${FRESHNESS_THRESHOLDS['meta-poll'].expectedMin} min)`,
    `     Proxy:  meta_poll_cursors latest update`,
    `     Latest: ${fmtTimeAgoFromAgeMs(c.metaPollFreshness.ageMs)}`,
    `     Status: ${c.metaPollFreshness.status}`,
  ].join('\n')

  const syncLine = [
    `  ${FRESHNESS_EMOJI[c.syncFreshness.status]} sync        (expected: */${FRESHNESS_THRESHOLDS['sync'].expectedMin} min)`,
    `     Proxy:  profiles.last_sync latest (premium)`,
    `     Latest: ${fmtTimeAgoFromAgeMs(c.syncFreshness.ageMs)}`,
    `     Status: ${c.syncFreshness.status}`,
  ].join('\n')

  return [metaPollLine, '', syncLine].join('\n')
}

function fmtTimeAgoFromAgeMs(ageMs: number | null): string {
  if (ageMs === null) return '(desconocido)'
  const iso = new Date(Date.now() - ageMs).toISOString()
  return fmtTimeAgo(iso)
}

// Suppress unused-import lint when type is only used narratively above.
export type _UnusedPgCronJob = PgCronJob
```

> **Note on `PgCronJob` import:** the type is used via the `job` iterator type inference so the `export type _UnusedPgCronJob` line is a safety net. If your linter accepts the implicit usage, delete that final `export type` line.

- [ ] **Step 12.4 — Run — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/cron.test.ts`

- [ ] **Step 12.5 — Commit**

```bash
git add src/lib/telegram/commands/cron.ts src/__tests__/unit/lib/telegram/commands/cron.test.ts
git commit -m "feat(telegram-bot): /cron command with pg_cron + VPS freshness inference"
```

---

## Task 13 — /mapa command TDD

**Files:**
- Create: `src/lib/telegram/commands/mapa.ts`
- Create: `src/__tests__/unit/lib/telegram/commands/mapa.test.ts`

Most complex command — 3 variants (list, found, sparse) + 2 error paths (not found, ambiguous).

- [ ] **Step 13.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/commands/mapa.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { handleMapa } from '@/lib/telegram/commands/mapa'
import type { MapData, MapListItem, MapMatchResult, Queries } from '@/lib/telegram/types'

function makeQueries(opts: {
  list?: MapListItem[]
  match?: MapMatchResult
  data?: MapData
}): Queries {
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: async () => opts.list ?? [],
    findMapByPrefix: async () => opts.match ?? { kind: 'none' },
    getMapData: async () => {
      if (!opts.data) throw new Error('no data fixture')
      return opts.data
    },
  }
}

function makeMapData(overrides: Partial<MapData> = {}): MapData {
  return {
    map: 'Sidetrack',
    mode: 'brawlBall',
    battlesToday: 2798,
    battlesLast7d: 19586,
    brawlerCovered: 81,
    brawlerTotal: 82,
    sparkline7d: [2000, 2100, 1900, 2200, 2100, 2000, 2798],
    topWinRates: [
      { brawlerId: 1, winRate: 0.624, total: 123 },
      { brawlerId: 2, winRate: 0.581, total: 89  },
      { brawlerId: 3, winRate: 0.578, total: 156 },
      { brawlerId: 4, winRate: 0.569, total: 102 },
      { brawlerId: 5, winRate: 0.562, total: 78  },
    ],
    bottomWinRates: [
      { brawlerId: 6, winRate: 0.382, total: 41 },
      { brawlerId: 7, winRate: 0.391, total: 35 },
      { brawlerId: 8, winRate: 0.405, total: 52 },
    ],
    sameModeComparison: [
      { map: 'Sidetrack',     battles: 2798 },
      { map: 'Nutmeg',        battles: 1848 },
      { map: 'Slippery Slap', battles:  334 },
    ],
    lastCursorUpdate: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

describe('handleMapa — list variant', () => {
  it('renders numbered list of maps with data today', async () => {
    const list: MapListItem[] = [
      { map: 'Sidetrack', mode: 'brawlBall', battles: 2798, brawlerCount: 81 },
      { map: 'Nutmeg',    mode: 'brawlBall', battles: 1848, brawlerCount: 61 },
    ]
    const out = await handleMapa({ args: [], queries: makeQueries({ list }) })
    expect(out).toContain('MAPAS CON DATOS HOY')
    expect(out).toContain('1.')
    expect(out).toContain('Sidetrack')
    expect(out).toContain('brawlBall')
    expect(out).toContain('2,798')
  })

  it('says "sin datos" on empty list', async () => {
    const out = await handleMapa({ args: [], queries: makeQueries({ list: [] }) })
    expect(out).toContain('No hay mapas con datos hoy')
  })
})

describe('handleMapa — specific map variant', () => {
  it('renders a detailed map response for exact match', async () => {
    const out = await handleMapa({
      args: ['sidetrack'],
      queries: makeQueries({
        match: { kind: 'found', map: 'Sidetrack', mode: 'brawlBall' },
        data: makeMapData(),
      }),
    })
    expect(out).toContain('SIDETRACK')
    expect(out).toContain('brawlBall')
    expect(out).toContain('COBERTURA')
    expect(out).toContain('TOP 5 BRAWLERS')
    expect(out).toContain('BOTTOM 3')
    expect(out).toContain('COMPARACIÓN')
    expect(out).toContain('81 / 82')
    expect(out).toMatch(/[▁▂▃▄▅▆▇█]/)
  })

  it('omits ranking blocks when below MIN_BATTLES_FOR_RANKING', async () => {
    const out = await handleMapa({
      args: ['pit'],
      queries: makeQueries({
        match: { kind: 'found', map: 'Pit Stop', mode: 'heist' },
        data: makeMapData({ map: 'Pit Stop', mode: 'heist', battlesToday: 2, topWinRates: [], bottomWinRates: [] }),
      }),
    })
    expect(out).toContain('Datos insuficientes para ranking fiable')
    expect(out).not.toContain('TOP 5 BRAWLERS')
  })

  it('reports not-found when no prefix matches', async () => {
    const out = await handleMapa({
      args: ['xyzxyz'],
      queries: makeQueries({ match: { kind: 'none' } }),
    })
    expect(out).toContain("No hay mapa que empiece por 'xyzxyz'")
  })

  it('reports ambiguous when multiple prefixes match', async () => {
    const out = await handleMapa({
      args: ['bea'],
      queries: makeQueries({
        match: {
          kind: 'ambiguous',
          candidates: [
            { map: 'Beach Ball',  mode: 'brawlBall' },
            { map: 'Bea Stadium', mode: 'knockout'  },
          ],
        },
      }),
    })
    expect(out).toContain('Ambiguo')
    expect(out).toContain('Beach Ball')
    expect(out).toContain('Bea Stadium')
  })

  it('normalises the prefix argument to lowercase for display', async () => {
    const out = await handleMapa({
      args: ['SIDE'],
      queries: makeQueries({
        match: { kind: 'found', map: 'Sidetrack', mode: 'brawlBall' },
        data: makeMapData(),
      }),
    })
    expect(out).toContain('SIDETRACK')
  })
})
```

- [ ] **Step 13.2 — Run — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/mapa.test.ts`

- [ ] **Step 13.3 — Implement `src/lib/telegram/commands/mapa.ts`**

```ts
import { MIN_BATTLES_FOR_RANKING } from '../constants'
import { bar, fmtNumber, fmtTimeAgo, section, sparkline } from '../formatters'
import type { CommandHandler, MapData, MapListItem } from '../types'

export const handleMapa: CommandHandler = async ({ args, queries }) => {
  if (args.length === 0) {
    const list = await queries.getMapList()
    return renderList(list)
  }

  const prefix = args[0]
  const match = await queries.findMapByPrefix(prefix)

  if (match.kind === 'none') {
    return `❌ No hay mapa que empiece por '${prefix}'. Usa /mapa para ver el listado completo.`
  }

  if (match.kind === 'ambiguous') {
    const lines = match.candidates
      .map((c) => `  • ${c.map} (${c.mode})`)
      .join('\n')
    return [
      `⚠️ Ambiguo: '${prefix}' matchea varios mapas:`,
      '',
      lines,
      '',
      'Usa el nombre más específico.',
    ].join('\n')
  }

  const data = await queries.getMapData(match.map, match.mode)
  return renderMapData(data)
}

function renderList(list: MapListItem[]): string {
  if (list.length === 0) return '🗺️ No hay mapas con datos hoy.'
  const header = `🗺️ <b>MAPAS CON DATOS HOY</b> (${list.length} total)\n`
  const lines = list.map((item, i) => {
    const idx = String(i + 1).padStart(2)
    const combined = `${item.mode} :: ${item.map}`.padEnd(42)
    return `${idx}. ${combined} ${fmtNumber(item.battles).padStart(6)} battles · ${String(item.brawlerCount).padStart(2)} brawlers`
  })
  const footer = '\nPara detalles de un mapa: /mapa &lt;nombre&gt;\nEjemplo: /mapa sidetrack'
  return [header, lines.join('\n'), footer].join('\n')
}

function renderMapData(data: MapData): string {
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const density = data.brawlerCovered > 60 ? 'HIGH ✅' : data.brawlerCovered > 30 ? 'MEDIUM 🟡' : 'LOW 🔴'

  const cobertura = [
    `  Battles hoy:        ${fmtNumber(data.battlesToday)}`,
    `  Battles 7d:         ${fmtNumber(data.battlesLast7d)}`,
    `  Brawlers cubiertos: ${data.brawlerCovered} / ${data.brawlerTotal}`,
    `  Pool density:       ${density}`,
  ].join('\n')

  const sparkBlock = [
    '  Battles/day last 7d',
    `  ${sparkline(data.sparkline7d)}`,
  ].join('\n')

  const sections: string[] = [
    `🗺️ <b>${data.map.toUpperCase()}</b> (${data.mode})`,
    nowLabel,
    '',
    section('📊', 'COBERTURA', cobertura),
    '',
    section('📈', 'HISTÓRICO 7d', sparkBlock),
  ]

  if (data.battlesToday < MIN_BATTLES_FOR_RANKING) {
    sections.push(
      '',
      `⚠️ Datos insuficientes para ranking fiable (&lt; ${MIN_BATTLES_FOR_RANKING} batallas). Vuelve más tarde.`,
    )
  } else {
    const topBlock = data.topWinRates
      .map((b, i) => `  ${i + 1}. brawler#${b.brawlerId}  ${(b.winRate * 100).toFixed(1)}%  (${fmtNumber(b.total)} battles)`)
      .join('\n') || '  — sin datos'
    const bottomBlock = data.bottomWinRates
      .map((b, i) => `  ${i + 1}. brawler#${b.brawlerId}  ${(b.winRate * 100).toFixed(1)}%  (${fmtNumber(b.total)} battles)`)
      .join('\n') || '  — sin datos'

    sections.push('', section('🏆', 'TOP 5 BRAWLERS POR WIN RATE (hoy)', topBlock))
    sections.push('', section('💀', `BOTTOM 3 (worst WR hoy, min ${MIN_BATTLES_FOR_RANKING} battles)`, bottomBlock))
  }

  // Same-mode comparison (always shown if present)
  if (data.sameModeComparison.length > 1) {
    const max = data.sameModeComparison[0].battles
    const rows = data.sameModeComparison
      .slice(0, 6)
      .map((r) => `  ${r.map.padEnd(14)} ${fmtNumber(r.battles).padStart(6)} ${bar(max === 0 ? 0 : r.battles / max, 20)}`)
      .join('\n')
    sections.push('', section('📊', `COMPARACIÓN con otros ${data.mode} maps`, rows))
  }

  sections.push('', `Última actualización: ${fmtTimeAgo(data.lastCursorUpdate, now.getTime())} (meta_poll_cursors)`)

  return sections.join('\n')
}
```

- [ ] **Step 13.4 — Run — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/commands/mapa.test.ts`

- [ ] **Step 13.5 — Commit**

```bash
git add src/lib/telegram/commands/mapa.ts src/__tests__/unit/lib/telegram/commands/mapa.test.ts
git commit -m "feat(telegram-bot): /mapa command (list + specific + ambiguous + sparse)"
```

---

## Task 14 — Dispatcher TDD

**Files:**
- Create: `src/lib/telegram/dispatcher.ts`
- Create: `src/__tests__/unit/lib/telegram/dispatcher.test.ts`

Parses the incoming text and owns the `Map<string, CommandHandler>`. Must be case-insensitive on the command name and handle `/cmd@BotName` form that Telegram sometimes sends in groups.

- [ ] **Step 14.1 — Write the failing tests**

Create `src/__tests__/unit/lib/telegram/dispatcher.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseCommand, commandRegistry } from '@/lib/telegram/dispatcher'

describe('parseCommand', () => {
  it('parses a simple /stats into name and empty args', () => {
    expect(parseCommand('/stats')).toEqual({ commandName: '/stats', args: [] })
  })

  it('lowercases the command name', () => {
    expect(parseCommand('/STATS')).toEqual({ commandName: '/stats', args: [] })
  })

  it('splits args by whitespace', () => {
    expect(parseCommand('/mapa sidetrack')).toEqual({ commandName: '/mapa', args: ['sidetrack'] })
  })

  it('collapses multiple spaces', () => {
    expect(parseCommand('/mapa   healthy   middle')).toEqual({
      commandName: '/mapa',
      args: ['healthy', 'middle'],
    })
  })

  it('strips a @BotName suffix from the command name', () => {
    expect(parseCommand('/stats@BrawlVisionBot')).toEqual({ commandName: '/stats', args: [] })
    expect(parseCommand('/mapa@BrawlVisionBot side')).toEqual({
      commandName: '/mapa',
      args: ['side'],
    })
  })

  it('returns empty commandName for non-command text', () => {
    expect(parseCommand('hola')).toEqual({ commandName: '', args: [] })
  })

  it('trims leading and trailing whitespace', () => {
    expect(parseCommand('   /stats   ')).toEqual({ commandName: '/stats', args: [] })
  })
})

describe('commandRegistry', () => {
  it('registers 6 commands including /help', () => {
    expect(commandRegistry.has('/stats')).toBe(true)
    expect(commandRegistry.has('/batallas')).toBe(true)
    expect(commandRegistry.has('/premium')).toBe(true)
    expect(commandRegistry.has('/cron')).toBe(true)
    expect(commandRegistry.has('/mapa')).toBe(true)
    expect(commandRegistry.has('/help')).toBe(true)
  })

  it('does not register unknown commands', () => {
    expect(commandRegistry.has('/foo')).toBe(false)
  })
})
```

- [ ] **Step 14.2 — Run — expect failure**

Run: `npx vitest run src/__tests__/unit/lib/telegram/dispatcher.test.ts`

- [ ] **Step 14.3 — Implement `src/lib/telegram/dispatcher.ts`**

```ts
import { handleBatallas } from './commands/batallas'
import { handleCron } from './commands/cron'
import { handleHelp } from './commands/help'
import { handleMapa } from './commands/mapa'
import { handlePremium } from './commands/premium'
import { handleStats } from './commands/stats'
import type { CommandHandler } from './types'

export interface ParsedCommand {
  commandName: string  // e.g. '/stats', '' when not a command
  args: string[]
}

/**
 * Parse a Telegram message text into a command name and arg list.
 *
 *  - Case-insensitive: /STATS and /stats are equal.
 *  - Strips `@BotName` suffix that Telegram adds in group chats.
 *  - Non-command text returns an empty `commandName`.
 */
export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim()
  if (!trimmed.startsWith('/')) return { commandName: '', args: [] }
  const parts = trimmed.split(/\s+/)
  const head = parts[0]
  const atIdx = head.indexOf('@')
  const commandName = (atIdx >= 0 ? head.slice(0, atIdx) : head).toLowerCase()
  return { commandName, args: parts.slice(1) }
}

// Registry: command name → handler.
// Keys must match the lowercase form produced by parseCommand().
export const commandRegistry: Map<string, CommandHandler> = new Map([
  ['/stats',    handleStats],
  ['/batallas', handleBatallas],
  ['/premium',  handlePremium],
  ['/cron',     handleCron],
  ['/mapa',     handleMapa],
  ['/help',     handleHelp],
])
```

- [ ] **Step 14.4 — Run — expect PASS**

Run: `npx vitest run src/__tests__/unit/lib/telegram/dispatcher.test.ts`

- [ ] **Step 14.5 — Commit**

```bash
git add src/lib/telegram/dispatcher.ts src/__tests__/unit/lib/telegram/dispatcher.test.ts
git commit -m "feat(telegram-bot): dispatcher + command registry"
```

---

## Task 15 — Webhook route handler

**Files:**
- Create: `src/app/api/telegram/webhook/route.ts`

No new tests in this task — the full integration test suite in Task 16 exercises this file end-to-end. This task is just the skeleton + wiring.

- [ ] **Step 15.1 — Implement the POST handler**

Create `src/app/api/telegram/webhook/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { commandRegistry, parseCommand } from '@/lib/telegram/dispatcher'
import { clampToTelegramLimit, escapeHtml } from '@/lib/telegram/formatters'
import { queries } from '@/lib/telegram/queries'
import { sendTelegramMessage } from '@/lib/telegram/sender'
import type { TelegramUpdate } from '@/lib/telegram/types'

export const runtime = 'nodejs'
export const maxDuration = 30
export const dynamic = 'force-dynamic'

/**
 * POST /api/telegram/webhook
 *
 * Receives Telegram Bot API updates. 2-layer auth:
 *   1. `X-Telegram-Bot-Api-Secret-Token` header must equal TELEGRAM_WEBHOOK_SECRET.
 *   2. `message.chat.id` must equal TELEGRAM_CHAT_ID.
 *
 * Both failures return 200 OK silently (no fingerprinting for scanners,
 * no retries from Telegram). The webhook ALWAYS returns 200 — Telegram
 * retries aggressively on any non-2xx.
 */
export async function POST(request: Request) {
  try {
    // ── L1: secret header ────────────────────────────────────
    const headerSecret = request.headers.get('x-telegram-bot-api-secret-token')
    if (headerSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('[telegram/webhook] L1 auth fail')
      return NextResponse.json({ ok: true })
    }

    // ── Body parse ───────────────────────────────────────────
    let body: TelegramUpdate
    try {
      body = (await request.json()) as TelegramUpdate
    } catch (parseErr) {
      console.error('[telegram/webhook] malformed body', parseErr)
      return NextResponse.json({ ok: true })
    }

    const message = body.message
    if (!message?.text) return NextResponse.json({ ok: true })

    // ── L2: chat_id match (String compare, not parseInt) ────
    if (String(message.chat.id) !== String(process.env.TELEGRAM_CHAT_ID)) {
      console.warn('[telegram/webhook] L2 auth fail', { chatId: message.chat.id })
      return NextResponse.json({ ok: true })
    }

    const chatId = message.chat.id

    // ── Dispatch ─────────────────────────────────────────────
    try {
      const { commandName, args } = parseCommand(message.text)
      if (!commandName) {
        // Non-command text — ignore. Replying would be noisy.
        return NextResponse.json({ ok: true })
      }
      const handler = commandRegistry.get(commandName)
      if (!handler) {
        await sendTelegramMessage(
          chatId,
          `❓ Comando no reconocido: <code>${escapeHtml(commandName)}</code>\n\nPrueba /help`,
        )
        return NextResponse.json({ ok: true })
      }
      const response = await handler({ args, queries })
      await sendTelegramMessage(chatId, clampToTelegramLimit(response))
    } catch (commandErr) {
      console.error('[telegram/webhook] command failed', {
        text: message.text,
        err: commandErr,
      })
      try {
        await sendTelegramMessage(
          chatId,
          [
            '💥 Error ejecutando el comando.',
            '',
            `<code>${escapeHtml(commandErr instanceof Error ? commandErr.message : 'unknown')}</code>`,
            '',
            'Revisa los logs de Vercel para el stack completo.',
          ].join('\n'),
        )
      } catch (sendErr) {
        console.error('[telegram/webhook] failed to send error message', sendErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (fatalErr) {
    console.error('[telegram/webhook] FATAL', fatalErr)
    return NextResponse.json({ ok: true })
  }
}
```

- [ ] **Step 15.2 — Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 15.3 — Run the entire unit suite to verify nothing regressed**

Run: `npx vitest run src/__tests__/unit/lib/telegram/`
Expected: all unit tests PASS (formatters, sender, queries, dispatcher, commands/* × 6).

- [ ] **Step 15.4 — Commit**

```bash
git add src/app/api/telegram/webhook/route.ts
git commit -m "feat(telegram-bot): webhook route handler with 2-layer auth"
```

---

## Task 16 — Integration tests for the webhook

**Files:**
- Create: `src/__tests__/integration/api/telegram/webhook-auth.test.ts`
- Create: `src/__tests__/integration/api/telegram/webhook-help.test.ts`
- Create: `src/__tests__/integration/api/telegram/webhook-stats.test.ts`
- Create: `src/__tests__/integration/api/telegram/webhook-batallas.test.ts`
- Create: `src/__tests__/integration/api/telegram/webhook-premium.test.ts`
- Create: `src/__tests__/integration/api/telegram/webhook-cron.test.ts`
- Create: `src/__tests__/integration/api/telegram/webhook-mapa.test.ts`

All integration tests follow the same pattern: mock `@/lib/telegram/queries` with canned data, spy on `global.fetch` to capture outgoing Telegram sendMessage calls, import `POST` from the webhook route, and send realistic `Request` bodies. Assertions are on the **exact text** that would hit the Telegram API.

- [ ] **Step 16.1 — Auth test file**

Create `src/__tests__/integration/api/telegram/webhook-auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: vi.fn(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function makeRequest(body: unknown, headerSecret: string | null = SECRET) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (headerSecret) headers['x-telegram-bot-api-secret-token'] = headerSecret
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — auth', () => {
  it('returns 200 and does not send anything on L1 fail (bad/missing header)', async () => {
    const res = await POST(makeRequest({ message: { text: '/stats', chat: { id: CHAT_ID, type: 'private' } } }, 'wrong-secret'))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 200 and does not send anything on L2 fail (wrong chat_id)', async () => {
    const res = await POST(makeRequest({ message: { text: '/stats', chat: { id: '99999', type: 'private' }, message_id: 1, date: 0 } }))
    expect(res.status).toBe(200)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 200 on malformed body', async () => {
    const res = await POST(makeRequest('not-json'))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 16.2 — Help test file**

Create `src/__tests__/integration/api/telegram/webhook-help.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: vi.fn(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function makeRequest(text: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify({ message: { text, chat: { id: CHAT_ID, type: 'private' }, message_id: 1, date: 0 }, update_id: 1 }),
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /help', () => {
  it('sends the full help message', async () => {
    const res = await POST(makeRequest('/help'))
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.chat_id).toBe(CHAT_ID)
    expect(body.text).toContain('/stats')
    expect(body.text).toContain('/mapa')
    expect(body.parse_mode).toBe('HTML')
  })
})
```

- [ ] **Step 16.3 — Stats test file**

Create `src/__tests__/integration/api/telegram/webhook-stats.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { StatsData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getStatsMock = vi.fn<[], Promise<StatsData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: () => getStatsMock(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: vi.fn(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function req(text: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify({ message: { text, chat: { id: CHAT_ID, type: 'private' }, message_id: 1, date: 0 }, update_id: 1 }),
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getStatsMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /stats', () => {
  it('renders the stats message with real data', async () => {
    getStatsMock.mockResolvedValue({
      totalUsers: 3,
      premiumCount: 1,
      trialCount: 0,
      anonCount30d: 3,
      anonSparkline: [0, 0, 0, 0, 0, 0, 3],
      totalBattles: 108,
      battlesToday: 14,
      battleSparkline: [2, 2, 3, 4, 4, 4, 14],
      metaRowsToday: 836,
      metaRowsTotal: 3443,
      activeCursors: 183,
      staleCursors: 22,
      latestMetaActivity: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
      top3Maps: [
        { map: 'Sidetrack',             mode: 'brawlBall', battles: 2798 },
        { map: 'Healthy Middle Ground', mode: 'knockout',  battles: 2017 },
        { map: 'Nutmeg',                mode: 'brawlBall', battles: 1848 },
      ],
      top3Brawlers: [{ brawlerId: 1, winRate: 0.62, total: 123 }],
    })

    const res = await POST(req('/stats'))
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('BrawlVision Stats')
    expect(body.text).toContain('Sidetrack')
    expect(body.text).toContain('1,848')
  })

  it('sends an error message when getStats throws', async () => {
    getStatsMock.mockRejectedValue(new Error('db down'))
    await POST(req('/stats'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Error ejecutando el comando')
    expect(body.text).toContain('db down')
  })

  it('replies with "not recognized" for unknown command', async () => {
    await POST(req('/foo'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Comando no reconocido')
    expect(body.text).toContain('/help')
  })
})
```

- [ ] **Step 16.4 — Batallas test file**

Create `src/__tests__/integration/api/telegram/webhook-batallas.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { BattlesData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getBattlesMock = vi.fn<[], Promise<BattlesData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: () => getBattlesMock(),
    getPremium: vi.fn(),
    getCronStatus: vi.fn(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function req(text: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify({ message: { text, chat: { id: CHAT_ID, type: 'private' }, message_id: 1, date: 0 }, update_id: 1 }),
  })
}

function makeBattlesData(overrides: Partial<BattlesData> = {}): BattlesData {
  return {
    total: 108,
    today: 14,
    yesterday: 0,
    last7d: 108,
    last30d: 108,
    sparkline14d: [1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 4, 4, 14],
    modeDistribution: [
      { mode: 'lastStand', count: 7, pct: 0.50 },
      { mode: 'brawlBall', count: 3, pct: 0.21 },
    ],
    resultDistribution: [
      { result: 'victory', count: 48, pct: 0.44 },
      { result: 'defeat',  count: 55, pct: 0.51 },
      { result: 'draw',    count:  5, pct: 0.05 },
    ],
    topPlayers: [{ tag: '#YJU282PV', count: 108 }],
    lastSuccessfulSyncAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    queuePending: 0,
    ...overrides,
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getBattlesMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /batallas', () => {
  it('renders all sections with real data', async () => {
    getBattlesMock.mockResolvedValue(makeBattlesData())
    await POST(req('/batallas'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('BATTLES SYNC')
    expect(body.text).toContain('VOLUMEN')
    expect(body.text).toContain('#YJU282PV')
  })

  it('says "No hay batallas registradas aún" when total is 0', async () => {
    getBattlesMock.mockResolvedValue(makeBattlesData({
      total: 0, today: 0, yesterday: 0, last7d: 0, last30d: 0,
      sparkline14d: new Array(14).fill(0),
      modeDistribution: [],
      resultDistribution: [
        { result: 'victory', count: 0, pct: 0 },
        { result: 'defeat',  count: 0, pct: 0 },
        { result: 'draw',    count: 0, pct: 0 },
      ],
      topPlayers: [],
      lastSuccessfulSyncAt: null,
    }))
    await POST(req('/batallas'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('No hay batallas registradas aún')
  })

  it('sends error message when getBattles throws', async () => {
    getBattlesMock.mockRejectedValue(new Error('db down'))
    await POST(req('/batallas'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Error ejecutando el comando')
    expect(body.text).toContain('db down')
  })
})
```

- [ ] **Step 16.5 — Premium test file**

Create `src/__tests__/integration/api/telegram/webhook-premium.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PremiumData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getPremiumMock = vi.fn<[], Promise<PremiumData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: () => getPremiumMock(),
    getCronStatus: vi.fn(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function req(text: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify({ message: { text, chat: { id: CHAT_ID, type: 'private' }, message_id: 1, date: 0 }, update_id: 1 }),
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getPremiumMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /premium', () => {
  it('renders sections including the integration placeholder', async () => {
    getPremiumMock.mockResolvedValue({
      premiumActive: 1,
      trialActive: 0,
      freeUsers: 2,
      signupsLast30d: 3,
      trialsActivatedLast30d: 3,
      trialToPremiumLast30d: 1,
      trialsExpiredLast30d: 0,
      upcomingRenewals7d: null,
      ltvTotal: null,
    })
    await POST(req('/premium'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('PREMIUM')
    expect(body.text).toContain('FUNNEL 30 DÍAS')
    expect(body.text).toContain('Requiere integración')
  })

  it('sends error message when getPremium throws', async () => {
    getPremiumMock.mockRejectedValue(new Error('schema missing'))
    await POST(req('/premium'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Error ejecutando el comando')
    expect(body.text).toContain('schema missing')
  })
})
```

- [ ] **Step 16.6 — Cron test file**

Create `src/__tests__/integration/api/telegram/webhook-cron.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CronData } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getCronStatusMock = vi.fn<[], Promise<CronData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: () => getCronStatusMock(),
    getMapList: vi.fn(),
    findMapByPrefix: vi.fn(),
    getMapData: vi.fn(),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function req(text: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify({ message: { text, chat: { id: CHAT_ID, type: 'private' }, message_id: 1, date: 0 }, update_id: 1 }),
  })
}

function makeCronData(overrides: Partial<CronData> = {}): CronData {
  const nowIso = new Date().toISOString()
  return {
    pgCronJobs: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    schedule: '*/15 * * * *', active: true, command: '' },
      { jobid: 2, jobname: 'process-sync-queue',       schedule: '*/5 * * * *',  active: true, command: '' },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', schedule: '0 3 * * *',    active: true, command: '' },
    ],
    cronRuns: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 2, jobname: 'process-sync-queue',       status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
    ],
    runsByJob: new Map([
      ['enqueue-premium-syncs', 96],
      ['process-sync-queue', 288],
      ['cleanup-anonymous-visits', 1],
    ]),
    metaPollFreshness: { ageMs: 10 * 60 * 1000, status: 'fresh' },
    syncFreshness:     { ageMs: 18 * 60 * 1000, status: 'fresh' },
    ...overrides,
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getCronStatusMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /cron', () => {
  it('renders all 3 pg_cron jobs green + VPS fresh', async () => {
    getCronStatusMock.mockResolvedValue(makeCronData())
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('PG_CRON JOBS')
    expect(body.text).toContain('96 / 96 expected')
    expect(body.text).toContain('288 / 288 expected')
    expect(body.text).toContain('✅')
  })

  it('marks failed runs with ❌ and shows return_message', async () => {
    const nowIso = new Date().toISOString()
    getCronStatusMock.mockResolvedValue(makeCronData({
      cronRuns: [
        { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'failed', return_message: 'ERROR: duplicate key', start_time: nowIso, end_time: nowIso },
        { jobid: 2, jobname: 'process-sync-queue', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
        { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      ],
    }))
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('❌')
    expect(body.text).toContain('duplicate key')
  })

  it('renders stale and dead VPS status', async () => {
    getCronStatusMock.mockResolvedValue(makeCronData({
      metaPollFreshness: { ageMs: 45 * 60 * 1000, status: 'stale' },
      syncFreshness:     { ageMs: 90 * 60 * 1000, status: 'dead'  },
    }))
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('🟡')
    expect(body.text).toContain('🔴')
  })

  it('renders "(no disponible)" when pgCronJobs is empty', async () => {
    getCronStatusMock.mockResolvedValue(makeCronData({
      pgCronJobs: [], cronRuns: [], runsByJob: new Map(),
    }))
    await POST(req('/cron'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('(no disponible)')
  })
})
```

- [ ] **Step 16.7 — Mapa test file**

Create `src/__tests__/integration/api/telegram/webhook-mapa.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MapData, MapListItem, MapMatchResult } from '@/lib/telegram/types'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const getMapListMock = vi.fn<[], Promise<MapListItem[]>>()
const findMapByPrefixMock = vi.fn<[string], Promise<MapMatchResult>>()
const getMapDataMock = vi.fn<[string, string], Promise<MapData>>()

vi.mock('@/lib/telegram/queries', () => ({
  queries: {
    getStats: vi.fn(),
    getBattles: vi.fn(),
    getPremium: vi.fn(),
    getCronStatus: vi.fn(),
    getMapList: () => getMapListMock(),
    findMapByPrefix: (prefix: string) => findMapByPrefixMock(prefix),
    getMapData: (map: string, mode: string) => getMapDataMock(map, mode),
  },
}))

import { POST } from '@/app/api/telegram/webhook/route'

const SECRET = 'test-secret'
const CHAT_ID = '12345'

function req(text: string) {
  return new Request('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-bot-api-secret-token': SECRET,
    },
    body: JSON.stringify({ message: { text, chat: { id: CHAT_ID, type: 'private' }, message_id: 1, date: 0 }, update_id: 1 }),
  })
}

function makeMapData(overrides: Partial<MapData> = {}): MapData {
  return {
    map: 'Sidetrack',
    mode: 'brawlBall',
    battlesToday: 2798,
    battlesLast7d: 19586,
    brawlerCovered: 81,
    brawlerTotal: 82,
    sparkline7d: [2000, 2100, 1900, 2200, 2100, 2000, 2798],
    topWinRates: [
      { brawlerId: 1, winRate: 0.624, total: 123 },
      { brawlerId: 2, winRate: 0.581, total:  89 },
      { brawlerId: 3, winRate: 0.578, total: 156 },
      { brawlerId: 4, winRate: 0.569, total: 102 },
      { brawlerId: 5, winRate: 0.562, total:  78 },
    ],
    bottomWinRates: [
      { brawlerId: 6, winRate: 0.382, total: 41 },
      { brawlerId: 7, winRate: 0.391, total: 35 },
      { brawlerId: 8, winRate: 0.405, total: 52 },
    ],
    sameModeComparison: [
      { map: 'Sidetrack', battles: 2798 },
      { map: 'Nutmeg',    battles: 1848 },
    ],
    lastCursorUpdate: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '' })
  getMapListMock.mockReset()
  findMapByPrefixMock.mockReset()
  getMapDataMock.mockReset()
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token'
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET
  process.env.TELEGRAM_CHAT_ID = CHAT_ID
})

afterEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  delete process.env.TELEGRAM_CHAT_ID
})

describe('POST /api/telegram/webhook — /mapa', () => {
  it('/mapa (no args) renders the list', async () => {
    getMapListMock.mockResolvedValue([
      { map: 'Sidetrack', mode: 'brawlBall', battles: 2798, brawlerCount: 81 },
      { map: 'Nutmeg',    mode: 'brawlBall', battles: 1848, brawlerCount: 61 },
    ])
    await POST(req('/mapa'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('MAPAS CON DATOS HOY')
    expect(body.text).toContain('Sidetrack')
    expect(body.text).toContain('Nutmeg')
  })

  it('/mapa sidetrack renders detailed map response', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'found', map: 'Sidetrack', mode: 'brawlBall' })
    getMapDataMock.mockResolvedValue(makeMapData())
    await POST(req('/mapa sidetrack'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('SIDETRACK')
    expect(body.text).toContain('TOP 5 BRAWLERS')
    expect(body.text).toContain('81 / 82')
  })

  it('/mapa xyzxyz replies with not-found', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'none' })
    await POST(req('/mapa xyzxyz'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain("No hay mapa que empiece por 'xyzxyz'")
  })

  it('/mapa bea replies with ambiguous list', async () => {
    findMapByPrefixMock.mockResolvedValue({
      kind: 'ambiguous',
      candidates: [
        { map: 'Beach Ball',  mode: 'brawlBall' },
        { map: 'Bea Stadium', mode: 'knockout'  },
      ],
    })
    await POST(req('/mapa bea'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Ambiguo')
    expect(body.text).toContain('Beach Ball')
    expect(body.text).toContain('Bea Stadium')
  })

  it('/mapa pit omits rankings when below MIN_BATTLES_FOR_RANKING', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'found', map: 'Pit Stop', mode: 'heist' })
    getMapDataMock.mockResolvedValue(makeMapData({
      map: 'Pit Stop', mode: 'heist', battlesToday: 2,
      topWinRates: [], bottomWinRates: [],
    }))
    await POST(req('/mapa pit'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('Datos insuficientes para ranking fiable')
    expect(body.text).not.toContain('TOP 5 BRAWLERS')
  })

  it('/mapa SIDE (uppercase) still resolves and renders', async () => {
    findMapByPrefixMock.mockResolvedValue({ kind: 'found', map: 'Sidetrack', mode: 'brawlBall' })
    getMapDataMock.mockResolvedValue(makeMapData())
    await POST(req('/mapa SIDE'))
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('SIDETRACK')
    // findMapByPrefix should receive the raw arg (normalisation is its job via ilike)
    expect(findMapByPrefixMock).toHaveBeenCalledWith('SIDE')
  })
})
```

- [ ] **Step 16.8 — Run all integration tests**

Run: `npx vitest run src/__tests__/integration/api/telegram/`
Expected: 22 tests PASS (3 + 1 + 3 + 3 + 2 + 4 + 6).

- [ ] **Step 16.9 — Run the entire test suite to check for regressions**

Run: `npx vitest run`
Expected: all tests PASS, including the 358 pre-existing tests.

- [ ] **Step 16.10 — Commit**

```bash
git add src/__tests__/integration/api/telegram/
git commit -m "test(telegram-bot): integration tests for webhook auth + 6 commands"
```

---

## Task 17 — Setup script + smoke test doc

**Files:**
- Create: `scripts/setup-telegram-webhook.js`
- Create: `docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md`

- [ ] **Step 17.1 — Create `scripts/setup-telegram-webhook.js`**

```js
#!/usr/bin/env node
// Idempotent one-shot script to register the Telegram webhook URL.
// Reads TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET from .env.local.
//
// Usage:
//   node scripts/setup-telegram-webhook.js
//
// Re-running is safe — Telegram replaces the existing webhook.

const fs = require('fs')
const path = require('path')

const envPath = path.join(__dirname, '..', '.env.local')
try {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
} catch (err) {
  console.error('✗ Could not read .env.local:', err.message)
  process.exit(1)
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

  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
  const info = await infoRes.json()
  console.log('\nCurrent webhook info:')
  console.log('  url:', info.result.url)
  console.log('  pending_updates:', info.result.pending_update_count)
  console.log('  last_error:', info.result.last_error_message ?? '(none)')
  console.log('  allowed_updates:', info.result.allowed_updates)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
```

- [ ] **Step 17.2 — Create smoke test checklist**

Create `docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md`:

```markdown
# Smoke Test — Telegram Bot Sprint B

Run this checklist **once** after each production deploy that touches `src/app/api/telegram/webhook/` or `src/lib/telegram/`. Takes ~3 minutes.

## Prerequisites

- Deploy is live on `brawlvision.com`.
- `TELEGRAM_WEBHOOK_SECRET` is set in Vercel production and matches `.env.local`.
- `node scripts/setup-telegram-webhook.js` has been run at least once after rotating the secret.

## Command happy paths

- [ ] `/help` → receive full command list with all 6 commands.
- [ ] `/stats` → receive message with 5 sections (Usuarios, Actividad, Meta poll, Top 3 mapas, Top 3 brawlers). Sparklines present.
- [ ] `/batallas` → receive message with 4 sections (Volumen, Distribución por modo, Resultado, Top 5 players) + Sync status.
- [ ] `/premium` → receive 3 sections. "Requires integration" placeholder visible for LTV.
- [ ] `/cron` → pg_cron section with 3 jobs + VPS freshness section + healthchecks.io note.
- [ ] `/mapa` → listado with 40+ maps.
- [ ] `/mapa sidetrack` → detailed map response with top/bottom brawlers and comparison.

## Error paths

- [ ] `/mapa xyzxyz` → "No hay mapa que empiece por 'xyzxyz'".
- [ ] `/foo` → "Comando no reconocido. Prueba /help".

## Auth

- [ ] L2 fail: send a message from a secondary Telegram account. You should receive NO response. Check Vercel Function logs for "L2 auth fail" warning.
- [ ] L1 fail: curl the webhook URL without the secret header:

  ```bash
  curl -X POST https://brawlvision.com/api/telegram/webhook \
    -H 'Content-Type: application/json' \
    -d '{"message":{"text":"/stats","chat":{"id":"1","type":"private"},"message_id":1,"date":0},"update_id":1}'
  ```

  Expected: 200 response. No message sent to the admin chat. Check Vercel logs for "L1 auth fail" warning.

## If any step fails

1. Check Vercel Function logs under Deployments → Functions → `/api/telegram/webhook`.
2. Verify `TELEGRAM_WEBHOOK_SECRET` matches between Vercel and the `setWebhook` call (run `scripts/setup-telegram-webhook.js` to sync).
3. Verify `TELEGRAM_CHAT_ID` in Vercel matches your Telegram chat id.
4. Re-run this checklist.
```

- [ ] **Step 17.3 — Commit**

```bash
git add scripts/setup-telegram-webhook.js docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md
git commit -m "docs(telegram-bot): setup script + smoke test checklist"
```

---

## Task 18 — Rollout (manual, human-executed)

This task is NOT code. It is the sequence the human operator executes after merging the previous 17 tasks to `main`. Do not commit anything during this task.

- [ ] **Step 18.1 — Generate the webhook secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the hex string.

- [ ] **Step 18.2 — Add `TELEGRAM_WEBHOOK_SECRET` to Vercel production**

- Open Vercel dashboard → BrawlVision project → Settings → Environment Variables.
- Add a new variable:
  - Name: `TELEGRAM_WEBHOOK_SECRET`
  - Value: *(hex string from Step 18.1)*
  - Environments: **Production** only (v1 is production-only).
- Save.

- [ ] **Step 18.3 — Add the same value to `.env.local`**

Append this line to `.env.local` (do NOT commit):

```
TELEGRAM_WEBHOOK_SECRET=<the same hex string>
```

- [ ] **Step 18.4 — Redeploy to pick up the env var**

Trigger a redeploy of the production deployment (Vercel dashboard → Deployments → … → Redeploy). The code change from Task 15 must be on `main` already so the new deployment includes the webhook route.

- [ ] **Step 18.5 — Verify the route exists**

Open Deployments → latest production deploy → Functions tab. Confirm `/api/telegram/webhook` is listed.

- [ ] **Step 18.6 — Register the webhook with Telegram**

```bash
node scripts/setup-telegram-webhook.js
```

Expected output: `✓ Webhook registered at https://brawlvision.com/api/telegram/webhook`.

- [ ] **Step 18.7 — Verify the webhook info**

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Verify:
- `url` matches `https://brawlvision.com/api/telegram/webhook`
- `pending_update_count` is 0
- `last_error_message` is null
- `allowed_updates` is `["message"]`

- [ ] **Step 18.8 — Run the smoke test checklist**

Follow `docs/superpowers/specs/SMOKE-TEST-BOT-SPRINT-B.md`. Every checkbox must pass.

- [ ] **Step 18.9 — Observe 24h**

Check Vercel Function logs for:
- Unauthorized attempts (expected: zero from genuine sources).
- Command errors (fix any that appear).
- Slow queries (> 5s — adjust `FRESHNESS_THRESHOLDS` or add indexes if any command is consistently slow).

After 24h of stability, Sprint B v1 is officially in production.

---

## Self-review checklist (before execution)

Run through this checklist yourself after writing the code but before dispatching the plan to a subagent-driven workflow.

- [ ] Every `TODO`, `TBD`, `implement later` comment removed from the plan? *(There should be none. If you find one, fix it inline.)*
- [ ] Every test file name matches its production file 1:1?
- [ ] Every code snippet includes all imports it uses?
- [ ] Every task's commit step lists the exact files it touches?
- [ ] `Queries` interface has the same method names in `types.ts`, `queries.ts`, and every `commands/*.ts`?
- [ ] `FRESHNESS_EMOJI`, `FRESHNESS_THRESHOLDS`, `EXPECTED_CRON_RUNS_24H`, `MIN_BATTLES_FOR_RANKING`, `TELEGRAM_MESSAGE_LIMIT` all declared in `constants.ts` and imported where used?
- [ ] `escapeHtml` used wherever user input or error messages flow into HTML parse_mode output?
- [ ] The webhook handler ALWAYS returns 200 OK to Telegram on every code path?
- [ ] No production code imports from test files or vice versa?
- [ ] The 22 integration tests sum correctly: 3 (auth) + 1 (help) + 3 (stats) + 3 (batallas) + 2 (premium) + 4 (cron) + 6 (mapa) = 22 ✓

If any item is not satisfied, fix inline before proceeding.

## Execution handoff

Once this plan is committed, the recommended next step is:

1. **Subagent-driven execution** (preferred): dispatch a fresh implementer subagent per task. See `superpowers:subagent-driven-development`. Each task completes in isolation; a spec reviewer + code quality reviewer run between tasks.
2. **Inline execution** (fallback): work through the tasks sequentially in the current session. See `superpowers:executing-plans`.

Tasks 1–17 are all code and tests — they can run on a fresh implementer subagent with `sonnet` class models. Task 18 is a human operator checklist and cannot be executed by a subagent.
