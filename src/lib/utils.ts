import { PLAYER_TAG_REGEX } from './constants'

export function isValidPlayerTag(tag: string): boolean {
  return PLAYER_TAG_REGEX.test(tag)
}

export function normalizePlayerTag(tag: string): string {
  const normalized = tag.toUpperCase().trim()
  return normalized.startsWith('#') ? normalized : `#${normalized}`
}

export function formatGems(value: number): string {
  return `${value.toLocaleString('en-US')} Gemas`
}

export function formatTrophies(num: number): string {
  return num.toLocaleString('en-US')
}

/**
 * Format hours into the largest meaningful time units.
 * e.g. 2600h → "3m 18d 8h"  (months, days, hours)
 * Only shows units > 0, from largest to smallest.
 */
export function formatPlaytime(totalHours: number): string {
  if (totalHours <= 0) return '0h'

  const totalMinutes = Math.round(totalHours * 60)
  const years = Math.floor(totalMinutes / (60 * 24 * 365))
  let remaining = totalMinutes % (60 * 24 * 365)
  const months = Math.floor(remaining / (60 * 24 * 30))
  remaining = remaining % (60 * 24 * 30)
  const days = Math.floor(remaining / (60 * 24))
  remaining = remaining % (60 * 24)
  const hours = Math.floor(remaining / 60)
  const minutes = remaining % 60

  const parts: string[] = []
  if (years > 0) parts.push(`${years}y`)
  if (months > 0) parts.push(`${months}m`)
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 && years === 0) parts.push(`${minutes}min`)

  return parts.slice(0, 3).join(' ') || '0h'
}


export class ApiErrorObj extends Error {
  constructor(public code: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export function handleApiError(error: unknown): ApiErrorObj {
  if (error instanceof ApiErrorObj) {
    return error
  }
  return new ApiErrorObj(500, error instanceof Error ? error.message : 'Unknown error')
}
export function getBrawlerPortraitUrl(id: number): string {
  return `/assets/brawlers/${id}.png`
}

/** CDN fallback for brawler portraits not in local assets (new brawlers) */
export function getBrawlerPortraitFallback(id: number): string {
  return `https://cdn.brawlify.com/brawler/${id}/avatar.png`
}

export function getMapImageUrl(eventId: number): string {
  // Maps are not in our local assets — keep Brawlify for now
  return `https://cdn.brawlify.com/maps/regular/${eventId}.png`
}

export function getGadgetImageUrl(id: number): string {
  return `/assets/gadgets/${id}.png`
}

export function getStarPowerImageUrl(id: number): string {
  return `/assets/star-powers/${id}.png`
}

/** Map Supercell API mode string → Brawlify scId for mode icon */
const MODE_SC_IDS: Record<string, number> = {
  gemGrab: 48000000,
  heist: 48000002,
  bounty: 48000003,
  brawlBall: 48000005,
  soloShowdown: 48000006,
  duoShowdown: 48000009,
  hotZone: 48000017,
  knockout: 48000020,
  basketBrawl: 48000022,
  volleyBrawl: 48000023,
  duels: 48000024,
  wipeout: 48000025,
  payload: 48000026,
  botDrop: 48000027,
  hunters: 48000028,
  lastStand: 48000029,
  paintBrawl: 48000037,
  trioShowdown: 48000038,
  trophyEscape: 48000034,
  showdown: 48000006,
  brawlHockey: 48000045,
  dodgebrawl: 48000063,
}

export function getClubBadgeUrl(badgeId: number): string {
  return `https://cdn.brawlify.com/club-badges/regular/${badgeId}.png`
}

/** Win rate color class — shared across all analytics and draft components */
export function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400'
  if (wr >= 50) return 'text-[#FFC91B]'
  return 'text-red-400'
}

/** Win rate bar gradient — shared across components */
export function barGradient(wr: number): string {
  if (wr >= 60) return 'from-green-500/80 to-green-400/80'
  if (wr >= 50) return 'from-[#FFC91B]/80 to-yellow-300/80'
  return 'from-red-500/80 to-red-400/80'
}

export function getGameModeImageUrl(mode: string): string | null {
  const scId = MODE_SC_IDS[mode]
  // Game mode icons still from Brawlify (not downloaded yet)
  return scId ? `https://cdn.brawlify.com/game-modes/regular/${scId}.png` : null
}
