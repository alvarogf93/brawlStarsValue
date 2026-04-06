// ── Statistical Utility Functions ────────────────────────────────
// All win-rate ranking uses Wilson score lower bound to prevent
// low-sample-size entries from dominating (e.g., "1/1 = 100%").

/**
 * Wilson score lower bound for a binomial proportion.
 * Used to rank win rates fairly: a 10/12 (83%) with high confidence
 * ranks above 1/1 (100%) with no confidence.
 *
 * @param wins   Number of successes
 * @param total  Number of trials
 * @param z      Z-score for confidence level (1.96 = 95%)
 * @returns Lower bound of the confidence interval (0-1 scale)
 */
export function wilsonLowerBound(wins: number, total: number, z = 1.96): number {
  if (total === 0) return 0
  const p = wins / total
  const denominator = 1 + (z * z) / total
  const centre = p + (z * z) / (2 * total)
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)
  return Math.max(0, (centre - spread) / denominator)
}

/**
 * Calculate win rate as a percentage (0-100), rounded to 1 decimal.
 */
export function winRate(wins: number, total: number): number {
  if (total === 0) return 0
  return Math.round((wins / total) * 1000) / 10
}

/**
 * Round Wilson score to percentage for display (0-100).
 */
export function wilsonPct(wins: number, total: number): number {
  return Math.round(wilsonLowerBound(wins, total) * 1000) / 10
}

/**
 * Group an array by a key function. Returns a Map preserving insertion order.
 */
export function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const group = map.get(key)
    if (group) group.push(item)
    else map.set(key, [item])
  }
  return map
}

/**
 * Composite key for multi-dimensional grouping.
 */
export function compositeKey(...parts: (string | number)[]): string {
  return parts.join('|||')
}

/**
 * Parse a composite key back to parts.
 */
export function parseCompositeKey(key: string): string[] {
  return key.split('|||')
}

/**
 * Check if a battle result counts as a win.
 */
export function isWin(result: string | null | undefined): boolean {
  return result === 'victory'
}

/**
 * Check if a battle result counts as a loss.
 */
export function isLoss(result: string | null | undefined): boolean {
  return result === 'defeat'
}

/**
 * Safe average calculation.
 */
export function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}
