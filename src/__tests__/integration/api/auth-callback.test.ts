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
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset default happy-path mock; tests that need failure override per-case
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      },
    } as never)
  })

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

  it('redirects to default-locale landing on exchange failure with auth_error flag', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('bad code') }),
      },
    } as never)

    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=badcode&next=/es'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/es?auth_error=1')
  })

  // ─── SEG-01: Open redirect protection ─────────────────────────────────────

  it('rejects protocol-relative URL (next=//evil.com) — SEG-01', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc&next=//evil.com/phish'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('rejects backslash-prefixed protocol-relative URL (next=/\\evil.com) — SEG-01', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc&next=/%5Cevil.com'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('rejects pure backslash prefix (next=\\evil.com) — SEG-01', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc&next=%5Cevil.com'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('rejects absolute URL with scheme (next=https://evil.com) — SEG-01', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc&next=https%3A%2F%2Fevil.com'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('rejects javascript: pseudo-scheme (next=javascript:alert) — SEG-01', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc&next=javascript%3Aalert(1)'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('rejects open redirect even when no code is present — SEG-01', async () => {
    // Branch sin code también valida next; sin esto un atacante puede rebotar a evil.com sin OAuth
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?next=//evil.com'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('preserves search and hash on safe relative path', async () => {
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=abc&next=%2Fes%2Fprofile%3Fwelcome%3D1'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/es/profile?welcome=1')
  })

  // ─── SEG-03: Locale validation against SUPPORTED_LOCALES ──────────────────

  it('uses default locale (es) when next has unsupported locale segment — SEG-03', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('boom') }),
      },
    } as never)

    // /admin/secret is rejected as locale; default 'es' applied
    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=x&next=/admin/secret'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/es?auth_error=1')
  })

  it('uses default locale when next is just / — SEG-03', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('boom') }),
      },
    } as never)

    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=x&next=/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/es?auth_error=1')
  })

  it('respects valid locale segment on error — SEG-03', async () => {
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: new Error('boom') }),
      },
    } as never)

    const res = await GET(makeRequest('http://localhost:3000/api/auth/callback?code=x&next=/fr/profile'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/fr?auth_error=1')
  })

  // ─── LOG-05: No retry of single-use OAuth code ────────────────────────────

  it('does not retry exchangeCodeForSession on failure — LOG-05', async () => {
    const exchangeMock = vi.fn().mockResolvedValue({ error: new Error('invalid grant') })
    const { createServerClient } = await import('@supabase/ssr')
    vi.mocked(createServerClient).mockReturnValue({
      auth: { exchangeCodeForSession: exchangeMock },
    } as never)

    await GET(makeRequest('http://localhost:3000/api/auth/callback?code=consumed&next=/es'))
    // OAuth/PKCE codes are single-use; retry on the same code always returns invalid grant
    expect(exchangeMock).toHaveBeenCalledTimes(1)
  })
})
