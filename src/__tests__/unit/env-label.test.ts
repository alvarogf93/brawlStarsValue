import { describe, it, expect, afterEach, vi } from 'vitest'
import { getEnvLabel, envHeader } from '@/lib/telegram/env-label'

afterEach(() => {
  // vi.stubEnv mutations are scoped — undo between tests.
  vi.unstubAllEnvs()
})

describe('getEnvLabel', () => {
  it('returns 🟢 prod for VERCEL_ENV=production', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(getEnvLabel()).toBe('🟢 prod')
  })

  it('returns 🟡 preview for VERCEL_ENV=preview', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(getEnvLabel()).toBe('🟡 preview')
  })

  it('returns 🔵 dev for VERCEL_ENV=development', () => {
    vi.stubEnv('VERCEL_ENV', 'development')
    expect(getEnvLabel()).toBe('🔵 dev')
  })

  it('falls back to NODE_ENV when VERCEL_ENV is absent', () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(getEnvLabel()).toBe('🟢 prod')
  })

  it('surfaces unknown env names instead of returning empty', () => {
    vi.stubEnv('VERCEL_ENV', 'staging')
    expect(getEnvLabel()).toBe('❔ staging')
  })

  it('returns empty string when no env is set anywhere', () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', '')
    expect(getEnvLabel()).toBe('')
  })
})

describe('envHeader', () => {
  it('wraps the label in <i>…</i> + newline when present', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(envHeader()).toBe('<i>🟢 prod</i>\n')
  })

  it('returns empty string when there is no label, so callers can concat safely', () => {
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', '')
    expect(envHeader()).toBe('')
  })
})
