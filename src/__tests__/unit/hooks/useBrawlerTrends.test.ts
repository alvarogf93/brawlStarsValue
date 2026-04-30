/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useBrawlerTrends } from '@/hooks/useBrawlerTrends'

const CACHE_KEY = 'brawlvalue:brawler-trends'
// Mirror the schema written by lib/local-cache.ts: { v, storedAt, data }.
// LOG-13 — bumping the constant in the hook MUST also bump this in tests
// because all entries with the old version are dropped on read.
const CACHE_VERSION = 1

describe('useBrawlerTrends', () => {
  let fetchMock: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    localStorage.clear()
    fetchMock = vi.spyOn(globalThis, 'fetch') as unknown as ReturnType<typeof vi.spyOn>
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('cache miss: fetches the endpoint and caches the response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ trends: { '16000001': 2.3, '16000002': -1.5 } }),
    } as Response)

    const { result } = renderHook(() => useBrawlerTrends())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.trends).toEqual({ '16000001': 2.3, '16000002': -1.5 })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meta/brawler-trends',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    expect(cached?.v).toBe(CACHE_VERSION)
    expect(cached?.data).toEqual({ '16000001': 2.3, '16000002': -1.5 })
    expect(typeof cached?.storedAt).toBe('number')
  })

  it('cache hit: reads from localStorage without calling the endpoint', async () => {
    const cached = {
      v: CACHE_VERSION,
      storedAt: Date.now(),
      data: { '16000001': -8.3 },
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached))

    const { result } = renderHook(() => useBrawlerTrends())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.trends).toEqual({ '16000001': -8.3 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores stale cache (>10 min) and re-fetches', async () => {
    const stale = {
      v: CACHE_VERSION,
      storedAt: Date.now() - 11 * 60 * 1000, // 11 minutes ago
      data: { '16000001': 5.5 }, // old stale value
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(stale))

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ trends: { '16000001': -1.0 } }), // fresh value
    } as Response)

    const { result } = renderHook(() => useBrawlerTrends())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.trends).toEqual({ '16000001': -1.0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('I1 regression: does NOT cache an empty map when the API returns non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response)

    const { result } = renderHook(() => useBrawlerTrends())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // In-memory state is empty (correct — no data to show).
    expect(result.current.trends).toEqual({})
    // CRUCIALLY: cache was not poisoned with the empty map. A fresh
    // mount would therefore re-attempt the fetch instead of serving
    // `{}` for 10 minutes.
    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
  })

  it('I1 regression: does NOT cache when fetch itself rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() => useBrawlerTrends())

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.trends).toEqual({})
    expect(localStorage.getItem(CACHE_KEY)).toBeNull()
  })
})
