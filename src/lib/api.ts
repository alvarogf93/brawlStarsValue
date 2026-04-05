import type { PlayerData } from './types'

const API_BASE = 'https://api.brawlstars.com/v1'

function getApiKey(): string {
  const key = process.env.BRAWLSTARS_API_KEY
  if (!key) throw new Error('BRAWLSTARS_API_KEY not configured')
  return key
}

function encodeTag(tag: string): string {
  return encodeURIComponent(tag)
}

export class SuprecellApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'SuprecellApiError'
  }
}

export async function fetchPlayer(playerTag: string): Promise<PlayerData> {
  const res = await fetch(`${API_BASE}/players/${encodeTag(playerTag)}`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: 'application/json',
    },
    next: { revalidate: 300 }, // 5 min cache aligned with Supercell's ~3min internal cache
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body.message || body.reason || res.statusText
    throw new SuprecellApiError(res.status, message)
  }

  return res.json()
}
