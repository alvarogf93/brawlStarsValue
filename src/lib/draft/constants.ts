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

/** Max players to poll per cron run (bulk RPCs keep it fast — ~60s for 200) */
export const META_POLL_BATCH_SIZE = 200

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
