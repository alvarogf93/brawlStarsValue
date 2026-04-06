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
  return `https://cdn.brawlify.com/brawlers/borders/${id}.png`
}
