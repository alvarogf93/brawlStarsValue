/** Brawler data from BrawlAPI (community API) */
export interface BrawlerEntry {
  id: number
  name: string
  rarity: string
  class: string
  imageUrl: string
}

let cachedBrawlers: BrawlerEntry[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetch all brawlers from BrawlAPI.
 * Caches in memory for 24h. Falls back to empty array on failure.
 */
export async function fetchBrawlerRegistry(): Promise<BrawlerEntry[]> {
  if (cachedBrawlers && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedBrawlers
  }

  try {
    const res = await fetch('https://api.brawlapi.com/v1/brawlers', {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return cachedBrawlers ?? []

    const data = await res.json()
    const list = (data.list ?? data) as Array<{
      id: number
      name: string
      rarity?: { name: string }
      class?: { name: string }
      imageUrl2?: string
      imageUrl?: string
    }>

    cachedBrawlers = list.map(b => ({
      id: b.id,
      name: b.name,
      rarity: b.rarity?.name ?? 'Unknown',
      class: b.class?.name ?? 'Unknown',
      imageUrl: b.imageUrl2 ?? b.imageUrl ?? '',
    }))
    cacheTimestamp = Date.now()

    return cachedBrawlers
  } catch {
    return cachedBrawlers ?? []
  }
}

/** Client-side hook data — fetches once and caches in localStorage */
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
