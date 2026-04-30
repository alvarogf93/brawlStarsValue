import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────
const {
  getUserMock, singleMock, updateEqMock, notifyMock,
  capturedAfter, mockAfter, resetCaptured,
} = vi.hoisted(() => {
  let captured: (() => Promise<void>) | null = null
  return {
    getUserMock: vi.fn(),
    singleMock: vi.fn(),
    updateEqMock: vi.fn().mockResolvedValue({ error: null }),
    notifyMock: vi.fn().mockResolvedValue(undefined),
    capturedAfter: () => captured,
    mockAfter: (cb: () => Promise<void>) => { captured = cb },
    resetCaptured: () => { captured = null },
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
  createServiceClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: singleMock,
        }),
      }),
      update: () => ({
        eq: updateEqMock,
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

function makeRequest() {
  return new Request('http://localhost/api/notify/signup', { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetCaptured()
  notifyMock.mockReset().mockResolvedValue(undefined)
  updateEqMock.mockReset().mockResolvedValue({ error: null })
})

describe('POST /api/notify/signup — auth contract + SEG-09 idempotency', () => {
  it('returns 401 when there is no cookie session', async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
    const res = await POST(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('returns 200 ok=false when authenticated but no profile exists yet', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    singleMock.mockResolvedValueOnce({ data: null })
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
    expect(capturedAfter()).toBeNull()
  })

  it('first call: registers after() callback and Telegram fires', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    })
    singleMock.mockResolvedValueOnce({
      data: { player_tag: '#TEST123', signup_notified_at: null },
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.skipped).toBeUndefined()

    // Telegram fires inside the after() — drain it.
    expect(notifyMock).not.toHaveBeenCalled()
    const after = capturedAfter()
    expect(after).not.toBeNull()
    await after!()
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock.mock.calls[0][0]).toContain('#TEST123')
    // SEG-09: the flag IS persisted after successful delivery.
    expect(updateEqMock).toHaveBeenCalledTimes(1)
  })

  it('SEG-09 — second call (signup_notified_at already set) skips Telegram', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    })
    singleMock.mockResolvedValueOnce({
      data: {
        player_tag: '#TEST123',
        signup_notified_at: '2026-04-01T00:00:00.000Z',
      },
    })

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.skipped).toBe(true)

    // No after() registered, no Telegram.
    expect(capturedAfter()).toBeNull()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('Telegram failure does not persist the flag (next call retries)', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.com' } },
      error: null,
    })
    singleMock.mockResolvedValueOnce({
      data: { player_tag: '#TEST123', signup_notified_at: null },
    })
    notifyMock.mockRejectedValueOnce(new Error('telegram down'))

    await POST(makeRequest())
    const after = capturedAfter()
    await expect(after!()).resolves.toBeUndefined()
    // Flag NOT persisted because notify threw — next call will retry.
    expect(updateEqMock).not.toHaveBeenCalled()
  })

  it('uses "unknown" placeholder when user.email is absent', async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u1', email: null } },
      error: null,
    })
    singleMock.mockResolvedValueOnce({
      data: { player_tag: '#TEST123', signup_notified_at: null },
    })

    await POST(makeRequest())
    await capturedAfter()!()
    expect(notifyMock.mock.calls[0][0]).toContain('unknown')
  })
})
