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
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
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
//
// PRECONDITION: `field` must reference an ISO timestamp string on the
// row (e.g. '2026-04-12T18:30:00Z'), NOT a date-only string
// ('2026-04-12'). Date-only strings still parse (JS Date treats them as
// UTC midnight) but this path is tested only with timestamptz columns
// (`battle_time`, `first_visit_at`). For date-only aggregation (see
// getMapData.sparkline7d), open-code the loop instead.
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
