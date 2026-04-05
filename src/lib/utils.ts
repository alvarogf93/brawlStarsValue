import { PLAYER_TAG_REGEX, LOADING_MESSAGES } from './constants'

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

export function getLoadingMessage(): string {
  const randomIndex = Math.floor(Math.random() * LOADING_MESSAGES.length)
  return LOADING_MESSAGES[randomIndex]
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
