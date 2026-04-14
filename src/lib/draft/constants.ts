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

/**
 * Check if a mode string is a valid 3v3 draft mode.
 *
 * This is a pure membership check against DRAFT_MODES — no fallback,
 * no quirk handling. Use this ONLY for data that has already been
 * normalized (e.g. rows from `meta_stats`, `battles.mode` after
 * `parseBattle()`). For RAW Supercell API payloads — which can
 * report `mode: "unknown"` for brand-new modes while the `modeId`
 * is correct — use `normalizeSupercellMode(mode, modeId)` first
 * and only fall back to `isDraftMode` on the normalized result.
 */
export function isDraftMode(mode: string): mode is DraftMode {
  return (DRAFT_MODES as readonly string[]).includes(mode)
}

/**
 * Map from Supercell numeric modeId → our canonical mode string.
 * Used by `normalizeSupercellMode` when the API reports a string
 * of "unknown" for a mode it hasn't registered yet (most commonly
 * the latest release — e.g. Brawl Hockey stayed `mode: "unknown"`
 * for weeks after launch while the modeId was always 45).
 */
const MODE_ID_TO_KEY: Record<number, DraftMode> = {
  45: 'brawlHockey',
}

/**
 * Resolve a Supercell-reported mode string to our canonical key.
 *
 * modeId is the authoritative source of truth when it maps to a
 * known draft mode. The `mode` string is only trusted when the
 * modeId is absent or unmapped. Two bugs motivated this ordering:
 *
 *   1. brand-new modes were reported with `mode: "unknown"` even
 *      though the modeId was correct (this was the first symptom,
 *      fixed in commit ce047f5 for Brawl Hockey).
 *
 *   2. Hyperspace — a Brawl Hockey map — shipped with
 *      `mode: "brawlBall"` + `modeId: 45`. Because the original
 *      implementation checked `isDraftMode(rawMode)` FIRST and
 *      returned early on any valid draft mode string, every
 *      Hyperspace battle was stored as `brawlBall::Hyperspace`
 *      in `meta_stats`. 369 rows were mis-classified before this
 *      fix and `brawlHockey` had 0 rows in the entire history
 *      of the table. Flipping the priority so modeId wins over
 *      the string eliminates this class of bug going forward.
 *
 * Returns `null` when neither source yields a known mode so the
 * caller can drop the battle explicitly instead of accidentally
 * letting an "unknown" string through to `meta_stats`.
 */
export function normalizeSupercellMode(
  mode: string | null | undefined,
  modeId: number | null | undefined,
): DraftMode | null {
  // Authoritative path: trust the numeric modeId when it maps to
  // a known draft mode. Wins over a conflicting `mode` string.
  if (typeof modeId === 'number' && modeId in MODE_ID_TO_KEY) {
    return MODE_ID_TO_KEY[modeId]
  }
  // Fallback path: use the mode string when modeId is absent or
  // not in our known-mappings table.
  const rawMode = mode?.trim() ?? ''
  if (isDraftMode(rawMode)) return rawMode
  return null
}

/** Bayesian prior strength — how many phantom games at 50% we add */
export const BAYESIAN_STRENGTH = 30

/** Minimum battles for meta data to be considered useful */
export const META_MIN_BATTLES = 30

/** Days of rolling window for meta queries */
export const META_ROLLING_DAYS = 14

/**
 * Country codes whose `/rankings/{code}/players` endpoint is polled
 * in addition to `global` to expand the candidate player pool.
 *
 * The Supercell API hard-caps every `/rankings/.../players` response
 * at **200 items** regardless of the requested `limit` — probed
 * empirically on 2026-04-14 against the proxy. A single global call
 * therefore delivers at most 200 players, which is wildly insufficient
 * for the per-(map, mode) balancing because 200 top global players
 * play 60-80% brawlBall and ~0% Brawl Hockey.
 *
 * The fix is to pull from multiple country rankings. Cross-country
 * overlap is tiny: in a 16-country probe, 3,076 unique players came
 * back (≈96% unique — only 4% of players showed up in two countries).
 * Each country contributes roughly 185-200 fresh players.
 *
 * The 11 entries below give us ~2,100 unique candidates per run. The
 * cron then processes up to `META_POLL_MAX_DEPTH` of them, filtered
 * dynamically against the per-(map, mode) target so budget is spent
 * on under-sampled maps first.
 *
 * Why these 11: `global` for the absolute top, then the top-10 by
 * Brawl Stars player base roughly. Order matters — the first entries
 * are processed first so `global` stays the primary signal. Feel
 * free to add/reorder if a specific region proves more diverse in
 * niche modes.
 */
export const META_POLL_RANKING_COUNTRIES = [
  'global', 'US', 'BR', 'MX', 'DE', 'FR', 'ES', 'JP', 'KR', 'TR', 'RU',
] as const

/** Hard cap on total players polled per cron run.
 *  Must stay well below `maxDuration=300s` accounting for throttle + network + bulk upserts.
 *  At ~150-300ms per player, 600 ≈ 90-180s → safe margin for DB writes.
 *  The pool (~2,100 unique from 11 country rankings) is much larger than
 *  this cap, so balance-filtering has real budget to spend. */
export const META_POLL_MAX_DEPTH = 600

/** Fraction of the best-covered LIVE (map, mode) pair that under-sampled
 *  live pairs must reach. 0.6 = each live map ends with ≥ 60% of the
 *  battles of the top live map. */
export const META_POLL_TARGET_RATIO = 0.6

/** Absolute floor for the target so the algorithm still does something when
 *  every live pair is undersampled (e.g. fresh rolling-window after a reset). */
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
