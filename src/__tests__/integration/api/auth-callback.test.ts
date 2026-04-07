import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/auth/callback/route'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

function makeRequest(url: string) {
  return new Request(url)
}

describe('GET /api/auth/callback', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('redirects to next param after successful code exchange', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc123&next=/es/profile/%23TAG'))
    expect(res.status).toBe(307)
    // %23 gets decoded to # during URL construction — this is expected browser behavior
    expect(res.headers.get('location')).toBe('http://localhost:3000/es/profile/#TAG')
  })

  it('redirects to / when no next param', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc123'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('redirects to home when no code (no auth-error page)', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('redirects to next param even on exchange failure (graceful)', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('bad code') }),
      },
    } as never)

    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=badcode&next=/es'))
    expect(res.status).toBe(307)
    // Route always redirects to next (or /) even on error — graceful failure
    expect(res.headers.get('location')).toBe('http://localhost:3000/es')
  })
})
