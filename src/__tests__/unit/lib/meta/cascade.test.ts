import { describe, it, expect, vi } from 'vitest'
import {
  buildEventsWithCascade,
  META_CASCADE_SPARSE_THRESHOLD,
  type DraftEventInput,
} from '@/lib/meta/cascade'

// ── Minimal Supabase shim ──────────────────────────────────────
//
// The cascade helper only ever calls
//   supabase.from(table).select(cols).eq(col, val).gte(col, val).in(col, vals)
// and `await`s the chain. We model that as a thennable that ignores
// every chained method and returns the stubbed `{ data }` payload —
// matching the established pattern from meta-poll-adaptive.test.ts so
// readers don't trip over a new mocking style.

type StubRow = Record<string, unknown>
function makeSupabase(stubs: { meta_stats: StubRow[]; meta_stats_mode_fallback?: StubRow[] }) {
  // Track which call we're on for `meta_stats` (Tier 1 first, Tier 2 second).
  const calls: StubRow[][] = [
    stubs.meta_stats,
    stubs.meta_stats_mode_fallback ?? [],
  ]
  let callIndex = 0

  return {
    from: vi.fn((table: string) => {
      if (table !== 'meta_stats') {
        throw new Error(`unexpected table: ${table}`)
      }
      const data = calls[callIndex++] ?? []
      const builder: Record<string, unknown> = {}
      const chain = ['select', 'eq', 'gte', 'in']
      for (const m of chain) builder[m] = () => builder
      builder.then = (resolve: (v: { data: StubRow[] }) => unknown) => resolve({ data })
      return builder
    }),
  }
}

function makeEvent(map: string, mode: string, id = 1): DraftEventInput {
  return {
    event: { id, mode, map },
    startTime: '2026-04-30T00:00:00.000Z',
    endTime: '2026-04-30T01:00:00.000Z',
  }
}

describe('buildEventsWithCascade', () => {
  it('returns empty array on empty input — no Supabase call', async () => {
    const supabase = makeSupabase({ meta_stats: [] })
    const result = await buildEventsWithCascade(
      supabase as unknown as Parameters<typeof buildEventsWithCascade>[0],
      [],
    )
    expect(result).toEqual([])
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('Tier 1 — populated map+mode pair returns map-mode source', async () => {
    const supabase = makeSupabase({
      meta_stats: Array.from({ length: 10 }, (_, i) => ({
        brawler_id: 16000000 + i,
        map: 'Sneaky Fields',
        mode: 'brawlBall',
        wins: 5,
        losses: 5,
        total: 10,
      })),
    })

    const result = await buildEventsWithCascade(
      supabase as unknown as Parameters<typeof buildEventsWithCascade>[0],
      [makeEvent('Sneaky Fields', 'brawlBall')],
    )

    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('map-mode')
    expect(result[0].totalBattles).toBe(100) // 10 brawlers × 10 battles
    expect(result[0].topBrawlers).toHaveLength(10)
    // Top-10 sorted by Bayesian WR descending — all equal here, so sorted by id
    expect(result[0].topBrawlers[0].pickCount).toBe(10)
  })

  it('Tier 2 fallback fires when Tier 1 is below SPARSE_THRESHOLD', async () => {
    // Tier 1 sparse: only 1 brawler with 5 battles → totalBattles=5 < 30
    // Tier 2 mode fallback: 30+ battles
    const supabase = makeSupabase({
      meta_stats: [
        { brawler_id: 16000001, map: 'Sneaky Fields', mode: 'brawlBall', wins: 3, losses: 2, total: 5 },
      ],
      meta_stats_mode_fallback: Array.from({ length: 6 }, (_, i) => ({
        brawler_id: 16000010 + i,
        mode: 'brawlBall',
        wins: 5,
        losses: 5,
        total: 10,
      })),
    })

    const result = await buildEventsWithCascade(
      supabase as unknown as Parameters<typeof buildEventsWithCascade>[0],
      [makeEvent('Sneaky Fields', 'brawlBall')],
    )

    expect(result[0].source).toBe('mode-fallback')
    expect(result[0].totalBattles).toBe(60) // 6 brawlers × 10 battles, fallback wins
  })

  it('respects the SPARSE_THRESHOLD constant exposed for downstream tuning', () => {
    // Lock the value the cascade publishes — moving it should require an
    // explicit decision (visible in a PR diff).
    expect(META_CASCADE_SPARSE_THRESHOLD).toBe(30)
  })

  it('limits topBrawlers to 10 even when many brawlers cleared the threshold', async () => {
    const supabase = makeSupabase({
      meta_stats: Array.from({ length: 15 }, (_, i) => ({
        brawler_id: 16000100 + i,
        map: 'Sneaky Fields',
        mode: 'brawlBall',
        wins: 7,
        losses: 3,
        total: 10,
      })),
    })

    const result = await buildEventsWithCascade(
      supabase as unknown as Parameters<typeof buildEventsWithCascade>[0],
      [makeEvent('Sneaky Fields', 'brawlBall')],
    )

    expect(result[0].topBrawlers).toHaveLength(10)
  })

  it('returns the original event metadata (eventId, times) verbatim', async () => {
    const supabase = makeSupabase({ meta_stats: [] })
    const result = await buildEventsWithCascade(
      supabase as unknown as Parameters<typeof buildEventsWithCascade>[0],
      [makeEvent('Hard Rock Mine', 'gemGrab', 42)],
    )

    expect(result[0].eventId).toBe(42)
    expect(result[0].map).toBe('Hard Rock Mine')
    expect(result[0].mode).toBe('gemGrab')
    expect(result[0].startTime).toBe('2026-04-30T00:00:00.000Z')
  })
})
