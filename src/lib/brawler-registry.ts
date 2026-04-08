/** Brawler data from BrawlAPI (community API) */
export interface BrawlerEntry {
  id: number
  name: string
  rarity: string
  class: string
  imageUrl: string
}

/** Client-side cache — fetches once and caches in localStorage */
const LS_KEY = 'brawlvalue:brawler-registry'
const LS_TTL = 24 * 60 * 60 * 1000

export function getCachedRegistry(): BrawlerEntry[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > LS_TTL) return null
    return data
  } catch {
    return null
  }
}

export function setCachedRegistry(data: BrawlerEntry[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ data, ts: Date.now() }))
  } catch { /* ignore */ }
}
