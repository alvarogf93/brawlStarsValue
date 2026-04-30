import { beforeEach, describe, expect, test, vi } from 'vitest'

// ───────────────── Mocks ─────────────────

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockAdmin = {
  from: mockFrom,
  rpc: mockRpc,
}

// `createClient` from @supabase/supabase-js must return our mock admin
const createClientMock = vi.fn(() => mockAdmin)
vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}))

const notifyMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/telegram/notify', () => ({
  notify: notifyMock,
}))

// ───────────────── Setup / Teardown ─────────────────

beforeEach(() => {
  vi.resetModules()     // critical: resets the `_admin` singleton between tests
  vi.clearAllMocks()
  mockFrom.mockReset()
  mockRpc.mockReset()
  notifyMock.mockReset().mockResolvedValue(undefined)
  createClientMock.mockClear()

  // Required env vars for getAdminClient()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

// Helper: build a chainable mock for .from('profiles').select(...).eq(...).maybeSingle()
function mockProfilesLookup(result: { data: { id: string } | null, error: null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return { select }
    if (table === 'anonymous_visits') {
      // for the count-after-insert branch
      const countSelect = vi.fn().mockResolvedValue({ count: 5, data: null, error: null })
      return { select: countSelect }
    }
    throw new Error(`Unexpected table: ${table}`)
  })
}

// ───────────────── Tests ─────────────────

describe('trackAnonymousVisit', () => {
  test('1. new valid tag, not in profiles → insert + notify', async () => {
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: true, error: null })  // RPC returns is_new = true

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(mockRpc).toHaveBeenCalledWith('track_anonymous_visit', {
      p_tag: '#ABC123',
      p_locale: 'es',
    })
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock.mock.calls[0][0]).toContain('#ABC123')
    expect(notifyMock.mock.calls[0][0]).toContain('Tags únicos en la tabla: 5')
  })

  test('2. existing tag (re-entry) → RPC called, notify NOT called', async () => {
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: false, error: null })  // is_new = false

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  test('3. tag already in profiles → RPC NOT called, notify NOT called', async () => {
    mockProfilesLookup({ data: { id: 'user-uuid' }, error: null })

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(mockRpc).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  test('4. invalid tag format → no DB calls, no notify', async () => {
    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '??INVALID??', locale: 'es' })

    expect(mockFrom).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
    expect(notifyMock).not.toHaveBeenCalled()
  })

  test('5. RPC returns error → logged, notify NOT called', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })

    expect(consoleError).toHaveBeenCalledWith(
      '[anonymous-visits] RPC failed',
      expect.objectContaining({ message: 'boom' }),
    )
    expect(notifyMock).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  test('6. notify throws → caught, no propagation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: true, error: null })
    notifyMock.mockRejectedValueOnce(new Error('telegram down'))

    const { trackAnonymousVisit } = await import('@/lib/anonymous-visits')
    await expect(
      trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })
    ).resolves.toBeUndefined()  // does NOT throw

    expect(consoleError).toHaveBeenCalledWith(
      '[anonymous-visits] unexpected failure',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })

  test('7. admin client is memoized within a single module load', async () => {
    mockProfilesLookup({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: false, error: null })

    const mod = await import('@/lib/anonymous-visits')
    await mod.trackAnonymousVisit({ tag: '#ABC123', locale: 'es' })
    await mod.trackAnonymousVisit({ tag: '#DEF456', locale: 'en' })

    // createClient() from @supabase/supabase-js must be called exactly once
    expect(createClientMock).toHaveBeenCalledTimes(1)
  })
})
