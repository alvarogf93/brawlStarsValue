import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

// Import after stubbing.
import {
  fetchWithTimeout,
  fetchWithRetry,
  HttpTimeoutError,
  CircuitBreaker,
  CircuitOpenError,
  defaultIsRetriable,
  getCircuitBreaker,
} from '@/lib/http'

beforeEach(() => {
  fetchMock.mockReset()
})

function okResponse(body: unknown = { ok: true }, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

// ─── fetchWithTimeout ──────────────────────────────────────────────────────

describe('fetchWithTimeout', () => {
  it('forwards the response when the upstream resolves before timeout', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ hello: 'world' }))
    const res = await fetchWithTimeout('https://example.com/x', undefined, 1000)
    expect(res.status).toBe(200)
  })

  it('throws HttpTimeoutError with url + timeoutMs when the timeout fires', async () => {
    // Simulate a hung upstream: fetch only resolves after the abort fires.
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const sig = init?.signal as AbortSignal | undefined
        if (sig) {
          sig.addEventListener('abort', () => {
            const err = new Error('Aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }
      }),
    )

    const url = 'https://example.com/hung'
    await expect(fetchWithTimeout(url, undefined, 20)).rejects.toMatchObject({
      name: 'HttpTimeoutError',
      url,
      timeoutMs: 20,
    })
  })

  it('propagates a user-supplied AbortSignal cancellation as AbortError (not HttpTimeoutError)', async () => {
    const userController = new AbortController()
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const sig = init?.signal as AbortSignal | undefined
        sig?.addEventListener('abort', () => {
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    )

    const promise = fetchWithTimeout(
      'https://example.com/x',
      { signal: userController.signal },
      // Generous timeout so the user signal definitely wins.
      5_000,
    )
    userController.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    await expect(promise).rejects.not.toBeInstanceOf(HttpTimeoutError)
  })

  it('lets non-abort errors bubble untouched', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))
    await expect(fetchWithTimeout('https://example.com/x', undefined, 1000))
      .rejects.toThrow(TypeError)
  })
})

// ─── fetchWithRetry ────────────────────────────────────────────────────────

describe('fetchWithRetry', () => {
  it('retries a 503 once and returns the eventual 200', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({}, 503))
      .mockResolvedValueOnce(okResponse({ ok: true }, 200))

    const res = await fetchWithRetry('https://example.com/x', undefined, {
      retries: 2,
      baseMs: 0,
      maxMs: 0,
    })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('surfaces the final non-OK response when retries are exhausted', async () => {
    fetchMock.mockResolvedValue(okResponse({}, 503))

    const res = await fetchWithRetry('https://example.com/x', undefined, {
      retries: 2,
      baseMs: 0,
      maxMs: 0,
    })

    expect(res.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })

  it('does NOT retry a 4xx (non-429) — surfaces it on the first attempt', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}, 404))

    const res = await fetchWithRetry('https://example.com/x', undefined, {
      retries: 5,
      baseMs: 0,
      maxMs: 0,
    })

    expect(res.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on 429', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({}, 429))
      .mockResolvedValueOnce(okResponse({ ok: true }, 200))

    const res = await fetchWithRetry('https://example.com/x', undefined, {
      retries: 2,
      baseMs: 0,
      maxMs: 0,
    })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries on HttpTimeoutError', async () => {
    let calls = 0
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      calls += 1
      if (calls === 1) {
        return new Promise((_resolve, reject) => {
          const sig = init?.signal as AbortSignal | undefined
          sig?.addEventListener('abort', () => {
            const err = new Error('Aborted')
            err.name = 'AbortError'
            reject(err)
          })
        })
      }
      return Promise.resolve(okResponse({ ok: true }, 200))
    })

    const res = await fetchWithRetry('https://example.com/x', undefined, {
      retries: 2,
      baseMs: 0,
      maxMs: 0,
      timeoutMs: 20,
    })

    expect(res.status).toBe(200)
    expect(calls).toBe(2)
  })

  it('defaults POST retries to 0 — opt-in required', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({}, 503))

    const res = await fetchWithRetry(
      'https://example.com/x',
      { method: 'POST', body: '{}' },
      // No `retries` opt — should default to 0 because of mutating method.
      { baseMs: 0, maxMs: 0 },
    )

    expect(res.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('respects explicit POST opt-in for retries', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({}, 503))
      .mockResolvedValueOnce(okResponse({ ok: true }, 200))

    const res = await fetchWithRetry(
      'https://example.com/x',
      { method: 'POST', body: '{}' },
      { retries: 2, baseMs: 0, maxMs: 0 },
    )

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('caps the backoff at maxMs (jitter is bounded)', async () => {
    fetchMock.mockResolvedValue(okResponse({}, 503))

    const before = Date.now()
    await fetchWithRetry('https://example.com/x', undefined, {
      retries: 3,
      baseMs: 1_000,
      maxMs: 5, // tiny cap so the test stays fast
    })
    const elapsed = Date.now() - before

    // 3 retries × max 5 ms each = 15 ms ceiling; allow generous slack.
    expect(elapsed).toBeLessThan(500)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('does not retry on a user-supplied AbortError', async () => {
    const userController = new AbortController()
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        const sig = init?.signal as AbortSignal | undefined
        sig?.addEventListener('abort', () => {
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    )

    const promise = fetchWithRetry(
      'https://example.com/x',
      { signal: userController.signal },
      { retries: 5, baseMs: 0, maxMs: 0, timeoutMs: 5_000 },
    )
    userController.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('defaultIsRetriable', () => {
  it('marks HttpTimeoutError as retriable', () => {
    expect(defaultIsRetriable(new HttpTimeoutError('u', 1), null)).toBe(true)
  })
  it('does NOT retry arbitrary errors', () => {
    expect(defaultIsRetriable(new Error('boom'), null)).toBe(false)
  })
  it('retries 429/500/502/503/504/408', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(defaultIsRetriable(null, okResponse({}, status))).toBe(true)
    }
  })
  it('does NOT retry 400/401/403/404', () => {
    for (const status of [400, 401, 403, 404]) {
      expect(defaultIsRetriable(null, okResponse({}, status))).toBe(false)
    }
  })
})

// ─── CircuitBreaker ────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  let now = 0
  const clock = () => now

  beforeEach(() => {
    now = 1_700_000_000_000 // arbitrary base
  })

  it('opens after `failureThreshold` failures within the window', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 5,
      failureWindowMs: 30_000,
      openDurationMs: 60_000,
      now: clock,
    })

    const failOp = () => Promise.reject(new Error('boom'))

    for (let i = 0; i < 5; i++) {
      await expect(cb.execute(failOp)).rejects.toThrow('boom')
    }

    expect(cb.getState()).toBe('open')

    // 6th call fast-fails with CircuitOpenError before invoking the op.
    let opCalled = 0
    await expect(
      cb.execute(async () => { opCalled += 1; return 'x' }),
    ).rejects.toBeInstanceOf(CircuitOpenError)
    expect(opCalled).toBe(0)
  })

  it('half-opens after openDurationMs and closes on a successful probe', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      failureWindowMs: 30_000,
      openDurationMs: 60_000,
      now: clock,
    })

    const failOp = () => Promise.reject(new Error('boom'))
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(failOp)).rejects.toThrow('boom')
    }
    expect(cb.getState()).toBe('open')

    // Advance clock past the open window.
    now += 60_000
    expect(cb.getState()).toBe('half-open')

    // Successful probe closes the breaker.
    const out = await cb.execute(async () => 'probe-ok')
    expect(out).toBe('probe-ok')
    expect(cb.getState()).toBe('closed')
  })

  it('reopens when the half-open probe fails', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 3,
      failureWindowMs: 30_000,
      openDurationMs: 60_000,
      now: clock,
    })

    const failOp = () => Promise.reject(new Error('boom'))
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(failOp)).rejects.toThrow()
    }
    now += 60_000
    expect(cb.getState()).toBe('half-open')

    await expect(cb.execute(failOp)).rejects.toThrow('boom')
    expect(cb.getState()).toBe('open')
  })

  it('forgets failures older than the window', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 5,
      failureWindowMs: 30_000,
      openDurationMs: 60_000,
      now: clock,
    })

    const failOp = () => Promise.reject(new Error('boom'))
    // 4 failures...
    for (let i = 0; i < 4; i++) {
      await expect(cb.execute(failOp)).rejects.toThrow()
    }
    // ...but the next failure is 31 s later, so the window is empty again.
    now += 31_000
    await expect(cb.execute(failOp)).rejects.toThrow()
    // Only 1 fresh failure → still closed.
    expect(cb.getState()).toBe('closed')
  })

  it('rejects concurrent half-open probes with CircuitOpenError', async () => {
    const cb = new CircuitBreaker('test', {
      failureThreshold: 2,
      openDurationMs: 60_000,
      now: clock,
    })

    const failOp = () => Promise.reject(new Error('boom'))
    await expect(cb.execute(failOp)).rejects.toThrow()
    await expect(cb.execute(failOp)).rejects.toThrow()
    now += 60_000
    expect(cb.getState()).toBe('half-open')

    // First probe is in flight (never resolves until we let it).
    let release!: () => void
    const probePromise = cb.execute(
      () => new Promise<string>(resolve => { release = () => resolve('done') }),
    )

    // Second concurrent call must short-circuit.
    await expect(cb.execute(async () => 'x')).rejects.toBeInstanceOf(CircuitOpenError)

    release()
    await expect(probePromise).resolves.toBe('done')
    expect(cb.getState()).toBe('closed')
  })
})

describe('getCircuitBreaker', () => {
  it('returns the same instance across calls for a given key', () => {
    const a = getCircuitBreaker('shared-test-key-abc')
    const b = getCircuitBreaker('shared-test-key-abc')
    expect(a).toBe(b)
  })
})

afterEach(() => {
  fetchMock.mockReset()
})
