import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  aggregateBestMap,
  buildBrawlerMetaTitle,
  buildBrawlerMetaDescription,
  fetchBrawlerMetaSummary,
  __resetBrawlerMetadataCache,
  SUPPORTED_LOCALES,
  type MetaStatRow,
  type BrawlerMetaSummary,
} from '@/lib/brawler-metadata'

// ── aggregateBestMap ────────────────────────────────────────────

describe('aggregateBestMap', () => {
  it('returns null for empty input', () => {
    expect(aggregateBestMap([])).toBeNull()
  })

  it('returns null when every (map, mode) has fewer than MIN_BATTLES_FOR_SUMMARY', () => {
    const rows: MetaStatRow[] = [
      { map: 'Gem Fort', mode: 'gemGrab', wins: 2, total: 5 },
      { map: 'Minecart', mode: 'brawlBall', wins: 3, total: 9 },
    ]
    expect(aggregateBestMap(rows)).toBeNull()
  })

  it('picks the single qualifying (map, mode) when only one meets threshold', () => {
    const rows: MetaStatRow[] = [
      { map: 'Small', mode: 'gemGrab', wins: 1, total: 3 },
      { map: 'Big', mode: 'brawlBall', wins: 8, total: 15 },
    ]
    const r = aggregateBestMap(rows)
    expect(r).not.toBeNull()
    expect(r!.map).toBe('Big')
    expect(r!.mode).toBe('brawlBall')
    expect(r!.totalBattles).toBe(15)
  })

  it('aggregates multiple rows with the same (map, mode) before ranking', () => {
    const rows: MetaStatRow[] = [
      { map: 'Arena', mode: 'hotZone', wins: 4, total: 6 },
      { map: 'Arena', mode: 'hotZone', wins: 5, total: 8 },
      { map: 'Arena', mode: 'hotZone', wins: 3, total: 4 },
    ]
    const r = aggregateBestMap(rows)
    expect(r).not.toBeNull()
    expect(r!.totalBattles).toBe(18)
  })

  it('picks the highest Bayesian WR across qualifying (map, mode) pairs', () => {
    // Two qualifying rows. Bayesian shrinks small samples toward 50,
    // so a small-sample high-raw-WR can lose to a large-sample moderate-WR.
    const rows: MetaStatRow[] = [
      // Raw WR = 80%, but small sample → shrinks toward 50
      { map: 'Small', mode: 'gemGrab', wins: 8, total: 10 },
      // Raw WR = 65%, large sample → stays close to 65
      { map: 'Big', mode: 'brawlBall', wins: 130, total: 200 },
    ]
    const r = aggregateBestMap(rows)
    expect(r).not.toBeNull()
    // The big-sample row should win despite lower raw WR
    expect(r!.map).toBe('Big')
  })

  it('rounds winRate to one decimal place', () => {
    const rows: MetaStatRow[] = [
      { map: 'X', mode: 'gemGrab', wins: 63, total: 100 },
    ]
    const r = aggregateBestMap(rows)
    // Bayesian with prior 0.5, strength 30 → (63 + 15) / (100 + 30) = 60.0%
    expect(r!.winRate).toBe(60)
  })
})

// ── buildBrawlerMetaTitle ───────────────────────────────────────

describe('buildBrawlerMetaTitle', () => {
  it('supports all 13 locales', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(13)
    for (const l of ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']) {
      expect(SUPPORTED_LOCALES).toContain(l)
    }
  })

  it('includes the brawler name and the BrawlVision brand in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const title = buildBrawlerMetaTitle(locale, 'SHELLY')
      expect(title).toContain('SHELLY')
      expect(title).toContain('BrawlVision')
    }
  })

  it('produces a distinct title per locale (no English default leak)', () => {
    const titles = new Set(SUPPORTED_LOCALES.map((l) => buildBrawlerMetaTitle(l, 'SHELLY')))
    expect(titles.size).toBe(SUPPORTED_LOCALES.length)
  })

  it('falls back to English for unknown locales', () => {
    expect(buildBrawlerMetaTitle('xx', 'SHELLY')).toBe(
      buildBrawlerMetaTitle('en', 'SHELLY'),
    )
  })
})

// ── buildBrawlerMetaDescription ─────────────────────────────────

describe('buildBrawlerMetaDescription', () => {
  const summary: BrawlerMetaSummary = {
    mode: 'gemGrab',
    map: 'Gem Fort',
    winRate: 54.3,
    totalBattles: 420,
  }

  it('uses the with-data template when summary is provided, in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const d = buildBrawlerMetaDescription(locale, 'SHELLY', summary)
      expect(d).toContain('SHELLY')
      // Numeric WR should be embedded verbatim
      expect(d).toContain('54.3')
      // Map should be embedded verbatim
      expect(d).toContain('Gem Fort')
      // Friendly mode name (not raw "gemGrab")
      expect(d).toContain('Gem Grab')
      expect(d).not.toContain('gemGrab')
    }
  })

  it('uses the generic template when summary is null, in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const d = buildBrawlerMetaDescription(locale, 'COLT', null)
      expect(d).toContain('COLT')
      // Generic template does NOT mention a specific WR percentage
      expect(d).not.toMatch(/\b\d{1,3}\.\d%/)
    }
  })

  it('produces a distinct description per locale (no English fallback leak)', () => {
    const descriptions = new Set(
      SUPPORTED_LOCALES.map((l) => buildBrawlerMetaDescription(l, 'COLT', null)),
    )
    expect(descriptions.size).toBe(SUPPORTED_LOCALES.length)
  })

  it('keeps total length reasonable for Google snippet (< 200 chars, with data)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const d = buildBrawlerMetaDescription(locale, 'SHELLY', summary)
      expect(d.length).toBeLessThan(200)
    }
  })
})

// ── fetchBrawlerMetaSummary ─────────────────────────────────────

// Re-use the chainable mock pattern from brawler-detail.test.ts.
function chainable(resolvedValue: { data: unknown; error: unknown }) {
  const self: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'gte']) {
    self[method] = vi.fn().mockReturnValue(self)
  }
  self.then = vi.fn((resolve: (v: unknown) => void) => resolve(resolvedValue))
  return self
}

const mockChain = chainable({ data: [], error: null })
const mockFrom = vi.fn(() => mockChain)

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(async () => ({ from: mockFrom })),
}))

describe('fetchBrawlerMetaSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetBrawlerMetadataCache()
  })

  it('queries meta_stats filtered by brawler_id and date cutoff', async () => {
    // Return empty data so the chain resolves successfully
    mockChain.then = vi.fn((resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null }),
    )

    await fetchBrawlerMetaSummary(16000000)

    expect(mockFrom).toHaveBeenCalledWith('meta_stats')
    expect(mockChain.select).toHaveBeenCalled()
    // brawler_id eq filter
    expect(mockChain.eq).toHaveBeenCalledWith('brawler_id', 16000000)
    // date gte filter (cutoff is dynamic — just assert the method was called)
    expect(mockChain.gte).toHaveBeenCalled()
  })

  it('returns null when the query errors (does not throw)', async () => {
    mockChain.then = vi.fn((resolve: (v: unknown) => void) =>
      resolve({ data: null, error: { message: 'boom' } }),
    )

    const r = await fetchBrawlerMetaSummary(16000001)
    expect(r).toBeNull()
  })

  it('returns an aggregated summary when data is present', async () => {
    mockChain.then = vi.fn((resolve: (v: unknown) => void) =>
      resolve({
        data: [
          { map: 'Gem Fort', mode: 'gemGrab', wins: 60, total: 100 },
          { map: 'Gem Fort', mode: 'gemGrab', wins: 40, total: 80 },
        ],
        error: null,
      }),
    )

    const r = await fetchBrawlerMetaSummary(16000002)
    expect(r).not.toBeNull()
    expect(r!.map).toBe('Gem Fort')
    expect(r!.mode).toBe('gemGrab')
    expect(r!.totalBattles).toBe(180)
  })

  it('caches the result per brawlerId (second call skips Supabase)', async () => {
    mockChain.then = vi.fn((resolve: (v: unknown) => void) =>
      resolve({
        data: [{ map: 'A', mode: 'gemGrab', wins: 5, total: 10 }],
        error: null,
      }),
    )

    await fetchBrawlerMetaSummary(16000003)
    const callsAfterFirst = mockFrom.mock.calls.length
    await fetchBrawlerMetaSummary(16000003)
    expect(mockFrom.mock.calls.length).toBe(callsAfterFirst)
  })

  it('does NOT cache failures (failure retries next call)', async () => {
    // First call — error
    mockChain.then = vi.fn((resolve: (v: unknown) => void) =>
      resolve({ data: null, error: { message: 'boom' } }),
    )
    await fetchBrawlerMetaSummary(16000004)
    const callsAfterFirst = mockFrom.mock.calls.length

    // Second call — should re-query
    mockChain.then = vi.fn((resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null }),
    )
    await fetchBrawlerMetaSummary(16000004)
    expect(mockFrom.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })
})
