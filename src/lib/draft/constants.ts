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

/** Max players to poll per cron run */
export const META_POLL_BATCH_SIZE = 200

/** Delay between API calls in ms (throttle) */
export const META_POLL_DELAY_MS = 200
