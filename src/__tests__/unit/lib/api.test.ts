import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch before importing the module
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { fetchPlayer, fetchBattlelog, fetchClub, SuprecellApiError } from '@/lib/api'
import { resetAllCircuitBreakers } from '@/lib/http'

beforeEach(() => {
  vi.clearAllMocks()
  // The supercell breaker is a per-process singleton; tests that force 5xx
  // responses would otherwise trip it for the next test in the file.
  resetAllCircuitBreakers()
})

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }
}

describe('SuprecellApiError', () => {
  it('captures status code and message', () => {
    const err = new SuprecellApiError(404, 'Not found')
    expect(err.status).toBe(404)
    expect(err.message).toBe('Not found')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('fetchPlayer', () => {
  it('returns player data for valid tag', async () => {
    const playerData = { tag: '#TEST', name: 'Player', trophies: 25000, brawlers: [] }
    mockFetch.mockResolvedValueOnce(mockJsonResponse(playerData))

    const result = await fetchPlayer('#TEST')
    expect(result).toEqual(playerData)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('throws SuprecellApiError on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ reason: 'notFound' }, 404))

    await expect(fetchPlayer('#NONEXISTENT')).rejects.toThrow(SuprecellApiError)
  })

  it('throws SuprecellApiError on 403', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ reason: 'accessDenied' }, 403))

    await expect(fetchPlayer('#TEST')).rejects.toThrow(SuprecellApiError)
  })

  it('throws SuprecellApiError on 429 rate limit', async () => {
    // 429 is retried by the resilience wrapper — mock the same response across
    // all attempts. The final attempt surfaces as SuprecellApiError, locking
    // in the contract that retries do not silently mask rate limits.
    mockFetch.mockResolvedValue(mockJsonResponse({}, 429))

    await expect(fetchPlayer('#TEST')).rejects.toThrow(SuprecellApiError)
  })

  it('throws SuprecellApiError on 503 maintenance', async () => {
    // 503 is retried; mock all attempts so retries exhaust into the typed error.
    mockFetch.mockResolvedValue(mockJsonResponse({}, 503))

    await expect(fetchPlayer('#TEST')).rejects.toThrow(SuprecellApiError)
  })

  it('encodes # in player tag for URL', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ tag: '#TEST' }))

    await fetchPlayer('#TEST')
    const calledUrl = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('%23TEST')
  })
})

describe('fetchBattlelog', () => {
  it('returns battlelog with items', async () => {
    const battlelog = { items: [{ battleTime: '20260405T170000.000Z' }] }
    mockFetch.mockResolvedValueOnce(mockJsonResponse(battlelog))

    const result = await fetchBattlelog('#TEST')
    expect(result.items).toHaveLength(1)
  })

  it('throws on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 404))

    await expect(fetchBattlelog('#NONEXISTENT')).rejects.toThrow(SuprecellApiError)
  })
})

describe('fetchClub', () => {
  it('returns club data', async () => {
    const club = { tag: '#CLUB1', name: 'TestClub', members: [] }
    mockFetch.mockResolvedValueOnce(mockJsonResponse(club))

    const result = await fetchClub('#CLUB1')
    expect(result.name).toBe('TestClub')
  })

  it('throws on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 404))

    await expect(fetchClub('#NONEXISTENT')).rejects.toThrow(SuprecellApiError)
  })
})
