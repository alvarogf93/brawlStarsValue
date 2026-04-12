import type { FreshnessStatus } from './types'

// Hard limit from Telegram sendMessage API: 4096 chars.
// Leave a 96-char safety margin for truncation footer.
export const TELEGRAM_MESSAGE_LIMIT = 4000

// Minimum battles for a win-rate ranking to be shown as reliable.
// Used by /mapa <name>: if today's total < MIN, the ranking block is omitted.
// Also applied as a filter in getStats.top3Brawlers and getMapData.wrRows.
export const MIN_BATTLES_FOR_RANKING = 30

// Total brawlers in Brawl Stars as of 2026-04. Update when new brawlers are added.
// Consumed by getMapData to compute the brawler coverage ratio.
export const BRAWLER_TOTAL = 82

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
