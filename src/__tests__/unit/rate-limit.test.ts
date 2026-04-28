import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Hoisted mock state — accessible from inside vi.mock factories.
const { ratelimitLimitMock, redisCtor, ratelimitCtor, slidingWindowSpy } = vi.hoisted(() => ({
  ratelimitLimitMock: vi.fn(),
  redisCtor: vi.fn(),
  ratelimitCtor: vi.fn(),
  slidingWindowSpy: vi.fn(() => 'sliding-window-marker'),
}))

vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(...args: unknown[]) {
      redisCtor(...args)
    }
  },
}))

vi.mock('@upstash/ratelimit', () => {
  class RatelimitMock {
    static slidingWindow = slidingWindowSpy
    constructor(...args: unknown[]) {
      ratelimitCtor(...args)
    }
    limit = ratelimitLimitMock
  }
  return { Ratelimit: RatelimitMock }
})

// IMPORTANT: import the module under test AFTER mocks are declared.
// Use dynamic re-imports per test so the singleton + warning state is fresh.
async function freshImport() {
  vi.resetModules()
  return await import('@/lib/rate-limit')
}

function makeRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
})

afterEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
})

describe('enforceRateLimit — credential handling', () => {
  it('falls open and warns ONCE when both Upstash creds are missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { enforceRateLimit } = await freshImport()

    const r1 = await enforceRateLimit(makeRequest(), { limit: 10, window: '60 s' })
    const r2 = await enforceRateLimit(makeRequest(), { limit: 10, window: '60 s' })

    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    // Warning must NOT include the values of the env vars (defensive — they are
    // empty here, but we lock the contract).
    const warningText = warn.mock.calls.map((c) => c.join(' ')).join(' ')
    expect(warningText).not.toMatch(/UPSTASH_REDIS_REST_TOKEN=\S/)
    expect(ratelimitLimitMock).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('throws when ONLY UPSTASH_REDIS_REST_URL is set (misconfiguration)', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    const { enforceRateLimit } = await freshImport()
    await expect(
      enforceRateLimit(makeRequest(), { limit: 10, window: '60 s' }),
    ).rejects.toThrow(/upstash/i)
  })

  it('throws when ONLY UPSTASH_REDIS_REST_TOKEN is set (misconfiguration)', async () => {
    process.env.UPSTASH_REDIS_REST_TOKEN = 'abc'
    const { enforceRateLimit } = await freshImport()
    await expect(
      enforceRateLimit(makeRequest(), { limit: 10, window: '60 s' }),
    ).rejects.toThrow(/upstash/i)
  })

  it('uses redis + sliding window when both creds are present', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'abc'
    ratelimitLimitMock.mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 60_000,
      limit: 10,
    })
    const { enforceRateLimit } = await freshImport()

    const res = await enforceRateLimit(
      makeRequest({ 'x-forwarded-for': '1.2.3.4' }),
      { limit: 10, window: '60 s' },
    )

    expect(redisCtor).toHaveBeenCalledTimes(1)
    expect(slidingWindowSpy).toHaveBeenCalledWith(10, '60 s')
    expect(ratelimitLimitMock).toHaveBeenCalledWith('1.2.3.4')
    expect(res.ok).toBe(true)
    expect(res.remaining).toBe(9)
    expect(typeof res.reset).toBe('number')
    expect(res.reset).toBeGreaterThan(0)
  })
})

describe('enforceRateLimit — limit enforcement', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'abc'
  })

  it('returns ok=false with non-negative reset (seconds) when limit exceeded', async () => {
    const resetMs = Date.now() + 30_000
    ratelimitLimitMock.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      reset: resetMs,
      limit: 10,
    })
    const { enforceRateLimit } = await freshImport()

    const res = await enforceRateLimit(
      makeRequest({ 'x-forwarded-for': '5.6.7.8' }),
      { limit: 10, window: '60 s' },
    )

    expect(res.ok).toBe(false)
    expect(res.remaining).toBe(0)
    expect(res.reset).toBeGreaterThanOrEqual(0)
    // reset must be a sane number of seconds, not a ms timestamp passed straight through
    expect(res.reset).toBeLessThanOrEqual(60)
  })

  it('uses x-real-ip when x-forwarded-for is missing', async () => {
    ratelimitLimitMock.mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 1000,
      limit: 10,
    })
    const { enforceRateLimit } = await freshImport()

    await enforceRateLimit(
      makeRequest({ 'x-real-ip': '9.9.9.9' }),
      { limit: 10, window: '60 s' },
    )

    expect(ratelimitLimitMock).toHaveBeenCalledWith('9.9.9.9')
  })

  it('falls back to "anonymous" when neither header is present', async () => {
    ratelimitLimitMock.mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 1000,
      limit: 10,
    })
    const { enforceRateLimit } = await freshImport()

    await enforceRateLimit(makeRequest(), { limit: 10, window: '60 s' })

    expect(ratelimitLimitMock).toHaveBeenCalledWith('anonymous')
  })

  it('takes the FIRST IP in a comma-separated x-forwarded-for chain', async () => {
    ratelimitLimitMock.mockResolvedValueOnce({
      success: true,
      remaining: 9,
      reset: Date.now() + 1000,
      limit: 10,
    })
    const { enforceRateLimit } = await freshImport()

    await enforceRateLimit(
      makeRequest({ 'x-forwarded-for': '11.22.33.44, 10.0.0.1, 10.0.0.2' }),
      { limit: 10, window: '60 s' },
    )

    expect(ratelimitLimitMock).toHaveBeenCalledWith('11.22.33.44')
  })
})
