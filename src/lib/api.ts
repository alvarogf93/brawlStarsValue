import type { PlayerData } from './types'

const API_BASE = process.env.BRAWLSTARS_API_URL || 'http://141.253.197.60:3001/v1'

// Dev-mode guardrail: warn once at boot if BRAWLSTARS_API_URL isn't set.
// Without it, the fallback hits the raw Oracle VPS IP, which is firewalled
// to Vercel IPs only — from a dev machine it silently times out, breaking
// /compare (trophy chart), /subscribe (player segment), brawler detail
// calendar, and club trophy charts, all of which are gated on data and
// fail invisibly. See commit 745fe80 for the hardcoded fallback rationale.
if (
  typeof process !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  !process.env.BRAWLSTARS_API_URL
) {
  console.warn(
    '[api] BRAWLSTARS_API_URL is not set — falling back to the VPS IP. ' +
    'Features that depend on /api/battlelog (compare trophy chart, subscribe ' +
    "page segmentation, brawler detail calendar, club trophy chart) will " +
    'silently return empty. Set BRAWLSTARS_API_URL in .env.local — see .env.example.',
  )
}

function encodeTag(tag: string): string {
  return encodeURIComponent(tag)
}

const headers = (): Record<string, string> => {
  const h: Record<string, string> = { Accept: 'application/json' }
  const key = process.env.BRAWLSTARS_API_KEY
  if (key) h.Authorization = `Bearer ${key}`
  return h
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

export interface BattlelogBrawler {
  id: number
  name: string
  power: number
  trophies: number
  gadgets?: Array<{ id: number; name: string }>
  starPowers?: Array<{ id: number; name: string }>
  hypercharges?: Array<{ id: number; name: string }>
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
    starPlayer?: { tag: string; name: string; brawler: BattlelogBrawler }
    teams?: Array<Array<{ tag: string; name: string; brawler: BattlelogBrawler }>>
    players?: Array<{ tag: string; name: string; brawler: BattlelogBrawler }>
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
