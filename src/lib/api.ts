import type { PlayerData } from './types'
import { fetchWithRetry, getCircuitBreaker } from './http'

const API_BASE = process.env.BRAWLSTARS_API_URL || 'http://141.253.197.60:3001/v1'

// Per-process Supercell circuit breaker. Trips after 5 failures in 30 s and
// fails fast for 60 s. See `src/lib/http.ts` for the per-instance caveat —
// in serverless this only bounds blast within a single Function instance,
// which is exactly what we need for the meta-poll cron loop.
const supercellBreaker = getCircuitBreaker('supercell')

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
  // PERF-01: 8 s per-attempt timeout + 2 GET retries (timeout, 5xx, 429) +
  // supercell circuit breaker so meta-poll stops hammering a dead upstream
  // mid-cron.
  const res = await supercellBreaker.execute(() =>
    fetchWithRetry(
      `${API_BASE}${path}`,
      {
        headers: headers(),
        next: { revalidate },
      },
      { timeoutMs: 8_000, retries: 2 },
    ),
  )

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

// ── Brawlers (game-wide registry) ───────────────────────────────

export interface GameBrawler {
  id: number
  name: string
  starPowers: Array<{ id: number; name: string }>
  gadgets: Array<{ id: number; name: string }>
}

export interface BrawlersResponse {
  items: GameBrawler[]
  paging: { cursors: { before?: string; after?: string } }
}

/**
 * Fetch the game-wide brawler registry (all brawlers, not per-player).
 * Used to compute "max possible" denominators for completion charts.
 * Long revalidate (24h) because the roster only changes monthly.
 *
 * Note: the Supercell API `/brawlers` endpoint does NOT include
 * hypercharges, gears or buffies — those totals must be derived via
 * constants and multiplied by the brawler count.
 */
export function fetchBrawlers(): Promise<BrawlersResponse> {
  return apiFetch('/brawlers', 86_400)
}
