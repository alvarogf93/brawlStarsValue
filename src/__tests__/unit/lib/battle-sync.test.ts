import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncBattles } from '@/lib/battle-sync'

const mockUpsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

vi.mock('@/lib/api', () => ({
  fetchBattlelog: vi.fn().mockResolvedValue({ items: [] }),
}))

describe('syncBattles', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('inserts parsed battles via upsert', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [{
        battleTime: '20260405T171604.000Z',
        event: { id: 1, mode: 'brawlBall', modeId: 2, map: 'Beach' },
        battle: {
          mode: 'brawlBall', type: 'ranked', result: 'victory' as const, duration: 120,
          trophyChange: 8,
          starPlayer: { tag: '#YJU282PV', name: 'T', brawler: { id: 16000000, name: 'S', power: 11, trophies: 750 } },
          teams: [[{ tag: '#YJU282PV', name: 'T', brawler: { id: 16000000, name: 'S', power: 11, trophies: 750 } }], []],
        },
      }],
      paging: { cursors: {} },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'battles') return { upsert: mockUpsert.mockResolvedValue({ error: null, count: 1 }) }
      if (table === 'profiles') return { update: mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      return {}
    })

    const result = await syncBattles('#YJU282PV')
    expect(result.inserted).toBe(1)
    expect(result.error).toBeNull()
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it('returns 0 inserted when no battles found', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })

    const eqMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      return {}
    })

    const result = await syncBattles('#YJU282PV')
    expect(result.inserted).toBe(0)
  })

  it('uses ignoreDuplicates for deduplication', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({
      items: [{
        battleTime: '20260405T171604.000Z',
        event: { id: 1, mode: 'brawlBall', modeId: 2, map: 'Beach' },
        battle: {
          mode: 'brawlBall', type: 'ranked', result: 'victory' as const, duration: 120,
          teams: [[{ tag: '#YJU282PV', name: 'T', brawler: { id: 16000000, name: 'S', power: 11, trophies: 750 } }], []],
        },
      }],
      paging: { cursors: {} },
    })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'battles') return { upsert: mockUpsert.mockResolvedValue({ error: null, count: 0 }) }
      if (table === 'profiles') return { update: mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      return {}
    })

    await syncBattles('#YJU282PV')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: 'player_tag,battle_time', ignoreDuplicates: true })
    )
  })

  it('updates last_sync after sync', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockResolvedValue({ items: [], paging: { cursors: {} } })

    const eqMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') return { update: vi.fn().mockReturnValue({ eq: eqMock }) }
      return {}
    })

    await syncBattles('#YJU282PV')
    expect(eqMock).toHaveBeenCalledWith('player_tag', '#YJU282PV')
  })

  it('returns error when Supercell API fails', async () => {
    const { fetchBattlelog } = await import('@/lib/api')
    vi.mocked(fetchBattlelog).mockRejectedValue(new Error('429 Rate limited'))

    const result = await syncBattles('#YJU282PV')
    expect(result.error).toContain('429')
    expect(result.inserted).toBe(0)
  })
})
