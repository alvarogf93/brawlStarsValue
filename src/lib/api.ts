import type { PlayerData } from './types'

const API_BASE = process.env.BRAWLSTARS_API_URL || 'https://api.brawlstars.com/v1'

function getApiKey(): string {
  const key = process.env.BRAWLSTARS_API_KEY
  if (!key) throw new Error('BRAWLSTARS_API_KEY not configured')
  return key
}

function encodeTag(tag: string): string {
  return encodeURIComponent(tag)
}

const headers = () => ({
  Authorization: `Bearer ${getApiKey()}`,
  Accept: 'application/json',
})

export class SuprecellApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'SuprecellApiError'
  }
}

async function apiFetch<T>(path: string, revalidate = 300): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: headers(),
    next: { revalidate },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new SuprecellApiError(res.status, body.message || body.reason || res.statusText)
  }

  return res.json()
}

// ── Players ──────────────────────────────────────────────

export function fetchPlayer(playerTag: string): Promise<PlayerData> {
  return apiFetch(`/players/${encodeTag(playerTag)}`)
}

export interface BattlelogResponse {
  items: BattlelogEntry[]
  paging: { cursors: { before?: string; after?: string } }
}

export interface BattlelogEntry {
  battleTime: string
  event: { id: number; mode: string; modeId: number; map: string }
  battle: {
    mode: string
    type: string
    result: 'victory' | 'defeat' | 'draw'
    duration: number
    trophyChange?: number
    starPlayer?: { tag: string; name: string; brawler: { id: number; name: string; power: number; trophies: number } }
    teams?: Array<Array<{ tag: string; name: string; brawler: { id: number; name: string; power: number; trophies: number } }>>
    players?: Array<{ tag: string; name: string; brawler: { id: number; name: string; power: number; trophies: number } }>
  }
}

export function fetchBattlelog(playerTag: string): Promise<BattlelogResponse> {
  return apiFetch(`/players/${encodeTag(playerTag)}/battlelog`, 120) // 2 min cache
}

// ── Clubs ────────────────────────────────────────────────

export interface ClubResponse {
  tag: string
  name: string
  description: string
  type: string
  badgeId: number
  requiredTrophies: number
  trophies: number
  members: ClubMember[]
  isFamilyFriendly: boolean
}

export interface ClubMember {
  tag: string
  name: string
  nameColor: string
  role: string
  trophies: number
  icon: { id: number }
}

export function fetchClub(clubTag: string): Promise<ClubResponse> {
  return apiFetch(`/clubs/${encodeTag(clubTag)}`, 600) // 10 min cache
}

// ── Rankings ─────────────────────────────────────────────

export interface RankedPlayer {
  tag: string
  name: string
  nameColor: string
  icon: { id: number }
  trophies: number
  rank: number
  club: { name: string }
}

export interface RankingsResponse {
  items: RankedPlayer[]
  paging: { cursors: { before?: string; after?: string } }
}

export function fetchPlayerRankings(countryCode = 'global', limit = 200): Promise<RankingsResponse> {
  return apiFetch(`/rankings/${countryCode}/players?limit=${limit}`, 600)
}

// ── Events ───────────────────────────────────────────────

export interface EventSlot {
  startTime: string
  endTime: string
  slotId: number
  event: { id: number; mode: string; modeId: number; map: string }
}

export function fetchEventRotation(): Promise<EventSlot[]> {
  return apiFetch('/events/rotation', 300)
}
