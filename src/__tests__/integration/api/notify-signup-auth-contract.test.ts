import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────
const { getUserMock, singleMock, notifyMock, capturedAfter, mockAfter } = vi.hoisted(() => {
  let captured: (() => Promise<void>) | null = null
  return {
    getUserMock: vi.fn(),
    singleMock: vi.fn(),
    notifyMock: vi.fn().mockResolvedValue(undefined),
    capturedAfter: () => captured,
    mockAfter: (cb: () => Promise<void>) => { captured = cb },
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
    }),
  })),
}))

vi.mock('@/lib/telegram/notify', () => ({
  notify: notifyMock,
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: vi.fn(mockAfter) }
})

import { POST } from '@/app/api/notify/signup/route'

beforeEach(() => {
  vi.clearAllMocks()
  notifyMock.mockReset().mockResolvedValue(undefined)
})

describe('POST /api/notify/signup — auth contract (TEST-02)', () => {
  it('returns 401 when there is no cookie session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('returns 200 ok=false (no Telegram) when authenticated but no profile exists yet', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    singleMock.mockResolvedValueOnce({ data: null })
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
    // No after() registered either — no Telegram side-effect at all.
    expect(capturedAfter()).toBeNull()
  })

  it('returns 200 ok=true and registers an after() callback when profile exists', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    })
    singleMock.mockResolvedValueOnce({ data: { player_tag: '#TEST123' } })

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    // Crucially: notify did NOT run yet (RES-03 — fire-and-forget after response).
    expect(notifyMock).not.toHaveBeenCalled()
    const after = capturedAfter()
    expect(after).not.toBeNull()

    // Drain the after() — now Telegram fires.
    await after!()
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock.mock.calls[0][0]).toContain('#TEST123')
    expect(notifyMock.mock.calls[0][0]).toContain('a@b.com')
  })

  it('after() callback never throws even if notify rejects', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    })
    singleMock.mockResolvedValueOnce({ data: { player_tag: '#TEST123' } })
    notifyMock.mockRejectedValueOnce(new Error('telegram down'))

    await POST()
    const after = capturedAfter()
    // Must NOT propagate — Vercel after() runs out of request scope.
    await expect(after!()).resolves.toBeUndefined()
  })

  it('uses "unknown" placeholder when user.email is absent', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: null } },
      error: null,
    })
    singleMock.mockResolvedValueOnce({ data: { player_tag: '#TEST123' } })

    await POST()
    await capturedAfter()!()
    expect(notifyMock.mock.calls[0][0]).toContain('unknown')
  })
})
