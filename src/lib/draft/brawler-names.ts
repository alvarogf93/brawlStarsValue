/**
 * Resolves brawler IDs to display names.
 * Uses the brawler list from the API, cached in memory for the
 * duration of a single request. Falls back to "Brawler #ID".
 */

import { fetchWithRetry, getCircuitBreaker, BRAWLAPI_TIMEOUT_MS } from '../http'

const brawlapiBreaker = getCircuitBreaker('brawlapi')

let cachedBrawlers: Map<number, string> | null = null

export async function loadBrawlerNames(): Promise<Map<number, string>> {
  if (cachedBrawlers) return cachedBrawlers

  try {
    // PERF-01: BrawlAPI timeout (5s) + 2 GET retries + brawlapi breaker.
    const res = await brawlapiBreaker.execute(() =>
      fetchWithRetry(
        'https://api.brawlify.com/v1/brawlers',
        { next: { revalidate: 3600 } } as RequestInit,
        { retries: 2, timeoutMs: BRAWLAPI_TIMEOUT_MS },
      ),
    )
    if (!res.ok) throw new Error(`Brawlify API ${res.status}`)
    const data = await res.json()
    const map = new Map<number, string>()
    for (const b of data.list ?? []) {
      map.set(b.id, b.name)
    }
    cachedBrawlers = map
    return map
  } catch {
    return new Map()
  }
}

export function getBrawlerName(names: Map<number, string>, id: number): string {
  return names.get(id) ?? `Brawler #${id}`
}
