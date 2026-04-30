import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncBattles, syncBattlesAndMeta } from '@/lib/battle-sync'

const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockRpc = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [] }),
}))

/**
 * Build a chained mock for supabase.from(table) that handles:
 *   - profiles.select('last_sync').eq('player_tag', tag).maybeSingle()
 *   - profiles.update(...).eq('player_tag', tag)
 *   - battles.upsert(...)
 */
function installSupabaseMock(opts: {
  battlesUpsert?: { error: unknown; count?: number }
  profilesUpdate?: { error: unknown }
  profileLastSync?: string | null
} = {}) {
  const { battlesUpsert = { error: null, count: 0 }, profilesUpdate = { error: null }, profileLastSync = null } = opts
  const profileEq = vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: { last_sync: profileLastSync }, error: null }),
  })
  mockSelect.mockReturnValue({ eq: profileEq })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'battles') {
      return { upsert: mockUpsert.mockResolvedValue(battlesUpsert) }
    }
    if (table === 'profiles') {
      return {
        select: mockSelect,
        update: mockUpdate.mockReturnValue({
          eq: vi.fn().mockResolvedValue(profilesUpdate),
        }),
      }
    }
    return {}
  })
}

const SAMPLE_BATTLE = (overrides: { battleTime?: string; result?: 'victory' | 'defeat'; opponentId?: number } = {}) => ({
  battleTime: overrides.battleTime ?? '20260405T171604.000Z',
  event: { id: 1, mode: 'brawlBall', modeId: 2, map: 'Beach' },
  battle: {
    mode: 'brawlBall',
    type: 'ranked',
    result: (overrides.result ?? 'victory') as 'victory' | 'defeat',
    duration: 120,
    trophyChange: 8,
    starPlayer: { tag: '#YJU282PV', name: 'T', brawler: { id: 16000000, name: 'S', power: 11, trophies: 750 } },
    teams: [
      [{ tag: '#YJU282PV', name: 'T', brawler: { id: 16000000, name: 'S', power: 11, trophies: 750 } }],
      [{ tag: '#OPP', name: 'O', brawler: { id: 16000001, name: 'X', power: 11, trophies: 700 } }, { tag: '#OPP2', name: 'P', brawler: { id: overrides.opponentId ?? 16000002, name: 'Y', power: 11, trophies: 700 } }],
    ],
  },
})

describe('syncBattles (manual flow wrapper)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRpc.mockResolvedValue({ error: null }) })

  it('inserts parsed battles via upsert', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [SAMPLE_BATTLE()], paging: { cursors: {} } })
    installSupabaseMock({ battlesUpsert: { error: null, count: 1 } })

    const result = await syncBattles('#YJU282PV')
    expect(result.inserted).toBe(1)
    expect(result.error).toBeNull()
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it('returns 0 inserted when no battles found', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })
    installSupabaseMock()

    const result = await syncBattles('#YJU282PV')
    expect(result.inserted).toBe(0)
    expect(result.metaRowsWritten).toBe(0)
  })

  it('uses ignoreDuplicates for deduplication', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [SAMPLE_BATTLE()], paging: { cursors: {} } })
    installSupabaseMock({ battlesUpsert: { error: null, count: 0 } })

    await syncBattles('#YJU282PV')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: 'player_tag,battle_time', ignoreDuplicates: true }),
    )
  })

  it('updates last_sync after sync', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })
    installSupabaseMock()

    await syncBattles('#YJU282PV')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ last_sync: expect.any(String) }))
  })

  it('returns error when Supercell API fails', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockRejectedValue(new Error('429 Rate limited'))
    installSupabaseMock()

    const result = await syncBattles('#YJU282PV')
    expect(result.error).toContain('429')
    expect(result.inserted).toBe(0)
  })
})

describe('syncBattlesAndMeta (unified helper)', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRpc.mockResolvedValue({ error: null }) })

  function makeSupabase(opts: {
    battlesUpsert?: { error: unknown; count?: number }
    profilesUpdate?: { error: unknown }
  } = {}) {
    const { battlesUpsert = { error: null, count: 1 }, profilesUpdate = { error: null } } = opts
    const upsert = vi.fn().mockResolvedValue(battlesUpsert)
    const updateEq = vi.fn().mockResolvedValue(profilesUpdate)
    const update = vi.fn().mockReturnValue({ eq: updateEq })
    const rpc = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn((table: string) => {
      if (table === 'battles') return { upsert }
      if (table === 'profiles') return { update }
      return {}
    })
    // Cast: only the methods the helper touches need to exist.
    return { client: { from, rpc } as unknown as Parameters<typeof syncBattlesAndMeta>[0], spies: { upsert, update, updateEq, rpc, from } }
  }

  it('writes meta_stats via bulk_upsert RPC for victories', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [SAMPLE_BATTLE({ battleTime: '20260405T171604.000Z', result: 'victory' })],
      paging: { cursors: {} },
    })
    const { client, spies } = makeSupabase()

    const r = await syncBattlesAndMeta(client, '#YJU282PV', null)

    expect(r.error).toBeNull()
    expect(r.fetched).toBe(1)
    expect(r.inserted).toBe(1)
    // 1 stat row (1 brawler|map|mode) + 2 matchup rows (vs 2 opponents)
    expect(r.metaRowsWritten).toBe(3)

    const statsCall = spies.rpc.mock.calls.find(c => c[0] === 'bulk_upsert_meta_stats')
    expect(statsCall).toBeDefined()
    expect(statsCall![1]).toMatchObject({
      rows: [expect.objectContaining({
        brawler_id: 16000000,
        map: 'Beach',
        mode: 'brawlBall',
        source: 'users',
        wins: 1,
        losses: 0,
        total: 1,
      })],
    })

    const matchupsCall = spies.rpc.mock.calls.find(c => c[0] === 'bulk_upsert_meta_matchups')
    expect(matchupsCall).toBeDefined()
    expect((matchupsCall![1] as { rows: unknown[] }).rows).toHaveLength(2)
  })

  it('aggregates a victory + a defeat into the same stat key', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [
        SAMPLE_BATTLE({ battleTime: '20260405T171604.000Z', result: 'victory' }),
        SAMPLE_BATTLE({ battleTime: '20260405T172604.000Z', result: 'defeat' }),
      ],
      paging: { cursors: {} },
    })
    const { client, spies } = makeSupabase({ battlesUpsert: { error: null, count: 2 } })

    const r = await syncBattlesAndMeta(client, '#YJU282PV', null)
    expect(r.error).toBeNull()

    const statsCall = spies.rpc.mock.calls.find(c => c[0] === 'bulk_upsert_meta_stats')
    expect((statsCall![1] as { rows: unknown[] }).rows).toEqual([
      expect.objectContaining({ wins: 1, losses: 1, total: 2 }),
    ])
  })

  it('skips meta processing for battles at-or-before lastSync (cursor invariant)', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [
        SAMPLE_BATTLE({ battleTime: '20260405T120000.000Z', result: 'victory' }), // before cursor
        SAMPLE_BATTLE({ battleTime: '20260405T180000.000Z', result: 'victory' }), // after cursor
      ],
      paging: { cursors: {} },
    })
    const { client, spies } = makeSupabase({ battlesUpsert: { error: null, count: 2 } })

    // Cursor is between the two battles
    const r = await syncBattlesAndMeta(client, '#YJU282PV', '2026-04-05T15:00:00.000Z')

    // Battles upsert STILL got both rows (cursor only gates the meta path)
    expect((spies.upsert.mock.calls[0][0] as unknown[]).length).toBe(2)
    // Meta got only 1 stat row (the post-cursor battle)
    expect(r.metaRowsWritten).toBe(1 + 2) // 1 stat + 2 matchups
    const statsCall = spies.rpc.mock.calls.find(c => c[0] === 'bulk_upsert_meta_stats')
    expect((statsCall![1] as { rows: unknown[] }).rows).toHaveLength(1)
  })

  it('advances last_sync to NOW after successful run', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [SAMPLE_BATTLE()],
      paging: { cursors: {} },
    })
    const { client, spies } = makeSupabase()
    const before = Date.now()

    await syncBattlesAndMeta(client, '#YJU282PV', null)

    expect(spies.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_sync: expect.any(String) }),
    )
    const lastSyncCall = spies.update.mock.calls.at(-1)![0] as { last_sync: string }
    const written = new Date(lastSyncCall.last_sync).getTime()
    expect(written).toBeGreaterThanOrEqual(before)
    expect(written).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it('respects the source option (manual = users, cron-shared = users by default)', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [SAMPLE_BATTLE()], paging: { cursors: {} } })
    const { client, spies } = makeSupabase()

    await syncBattlesAndMeta(client, '#YJU282PV', null)
    const statsCall = spies.rpc.mock.calls.find(c => c[0] === 'bulk_upsert_meta_stats')
    const rows = (statsCall![1] as { rows: Array<{ source: string }> }).rows
    expect(rows.every(r => r.source === 'users')).toBe(true)
  })

  it('does NOT write source="global" by accident from the manual path', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [SAMPLE_BATTLE()], paging: { cursors: {} } })
    const { client, spies } = makeSupabase()

    // No opts → source defaults to 'users'
    await syncBattlesAndMeta(client, '#YJU282PV', null)
    const statsCall = spies.rpc.mock.calls.find(c => c[0] === 'bulk_upsert_meta_stats')
    const rows = (statsCall![1] as { rows: Array<{ source: string }> }).rows
    expect(rows.find(r => r.source === 'global')).toBeUndefined()
  })

  it('REGRESSION (MIX-02): manual sync between cron runs writes meta rows for those battles', async () => {
    // SCENARIO:
    //   1. Cron runs at T0, processes battles before T0, advances last_sync = T0.
    //   2. User clicks "Sync now" at T1 > T0. Supercell returns 1 battle at T1.
    //   3. Pre-fix: manual sync only inserted into `battles` and advanced
    //      last_sync = T1 — without writing meta_stats. Next cron at T2 read
    //      last_sync = T1, skipped that battle (b.battle_time <= last_sync),
    //      and the meta_stats row was silently lost.
    //   4. Post-fix: the helper writes meta_stats for that battle at T1.
    //      The next cron at T2 sees nothing new and writes nothing.
    //
    // This test exercises step 3-4: it asserts that running the helper
    // with the post-cron cursor on a fresh battle DOES emit a meta upsert.
    const { fetchBattlelog } = await import('@/lib/api')
    const cronTime = '2026-04-28T10:00:00.000Z'
    const userBattleTime = '20260428T103000.000Z' // 30 min after cron, Supercell format
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [SAMPLE_BATTLE({ battleTime: userBattleTime, result: 'victory' })],
      paging: { cursors: {} },
    })
    const { client, spies } = makeSupabase()

    const r = await syncBattlesAndMeta(client, '#YJU282PV', cronTime)

    expect(r.error).toBeNull()
    // The fix's invariant: this meta upsert is the one that used to be lost.
    expect(r.metaRowsWritten).toBeGreaterThan(0)
    const statsCall = spies.rpc.mock.calls.find(c => c[0] === 'bulk_upsert_meta_stats')
    expect(statsCall).toBeDefined()
    expect((statsCall![1] as { rows: unknown[] }).rows).toHaveLength(1)
  })

  it('does not call the meta RPCs when there is nothing to write', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })
    const { client, spies } = makeSupabase()

    const r = await syncBattlesAndMeta(client, '#YJU282PV', null)
    expect(r.metaRowsWritten).toBe(0)
    expect(spies.rpc).not.toHaveBeenCalled()
  })
})
