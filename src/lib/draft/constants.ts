/** 3v3 competitive modes valid for draft and meta tracking */
export const DRAFT_MODES = [
  'gemGrab',
  'heist',
  'bounty',
  'brawlBall',
  'hotZone',
  'knockout',
  'wipeout',
  'brawlHockey',
  'basketBrawl',
] as const

export type DraftMode = typeof DRAFT_MODES[number]

/** Check if a mode string is a valid 3v3 draft mode */
export function isDraftMode(mode: string): mode is DraftMode {
  return (DRAFT_MODES as readonly string[]).includes(mode)
}

/** Bayesian prior strength — how many phantom games at 50% we add */
export const BAYESIAN_STRENGTH = 30

/** Minimum battles for meta data to be considered useful */
export const META_MIN_BATTLES = 30

/** Days of rolling window for meta queries */
export const META_ROLLING_DAYS = 14

/** Base batch — the first chunk processed every cron run (unrestricted, all modes kept) */
export const META_POLL_BATCH_SIZE = 200

/** Hard cap on total players polled per cron run (base + all top-up chunks).
 *  Must stay well below `maxDuration=300s` accounting for throttle + network + bulk upserts.
 *  At ~300ms per player, 600 ≈ 180s → safe margin for DB writes. */
export const META_POLL_MAX_DEPTH = 600

/** Players fetched per top-up iteration after the base batch. */
export const META_POLL_CHUNK_SIZE = 100

/** Fraction of the best-covered mode that under-sampled modes must reach.
 *  0.6 = each mode must end with ≥ 60% of the battles of the top mode. */
export const META_POLL_TARGET_RATIO = 0.6

/** Absolute floor for the target so the algorithm still does something when
 *  the best mode is itself undersampled (e.g. very quiet day). */
export const META_POLL_MIN_TARGET = 50

/** Delay between API calls in ms (throttle) */
export const META_POLL_DELAY_MS = 100

/** Minimum pro battles to show PRO data for a brawler/map combo (avoids noise) */
export const PRO_MIN_BATTLES_DISPLAY = 20

/** Short-term trend window (days) */
export const PRO_TREND_DAYS_SHORT = 7

/** Medium-term trend window (days) */
export const PRO_TREND_DAYS_MEDIUM = 14

/** Long-term trend window (days) */
export const PRO_TREND_DAYS_LONG = 30
