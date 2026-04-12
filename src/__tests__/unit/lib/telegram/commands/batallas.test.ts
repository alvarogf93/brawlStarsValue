import { describe, it, expect } from 'vitest'
import { handleBatallas } from '@/lib/telegram/commands/batallas'
import type { BattlesData, Queries } from '@/lib/telegram/types'

function makeQueries(b: Partial<BattlesData> = {}): Queries {
  const defaults: BattlesData = {
    total: 108,
    today: 14,
    yesterday: 0,
    last7d: 108,
    last30d: 108,
    sparkline14d: [1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 4, 4, 14],
    modeDistribution: [
      { mode: 'lastStand', count: 7, pct: 0.50 },
      { mode: 'brawlBall', count: 3, pct: 0.21 },
      { mode: 'gemGrab',   count: 2, pct: 0.14 },
      { mode: 'knockout',  count: 2, pct: 0.14 },
    ],
    resultDistribution: [
      { result: 'victory', count: 48, pct: 0.44 },
      { result: 'defeat',  count: 55, pct: 0.51 },
      { result: 'draw',    count:  5, pct: 0.05 },
    ],
    topPlayers: [{ tag: '#YJU282PV', count: 108 }],
    lastSuccessfulSyncAt: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    queuePending: 0,
  }
  const merged = { ...defaults, ...b }
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: async () => merged,
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handleBatallas', () => {
  it('renders 4 sections with sparkline, mode bars, result bars, top players', async () => {
    const out = await handleBatallas({ args: [], queries: makeQueries() })
    expect(out).toContain('BATTLES SYNC')
    expect(out).toContain('VOLUMEN')
    expect(out).toContain('DISTRIBUCIÓN POR MODO')
    expect(out).toContain('RESULTADO')
    expect(out).toContain('TOP 5 PLAYERS MÁS ACTIVOS')
    expect(out).toContain('#YJU282PV')
    expect(out).toMatch(/[▁▂▃▄▅▆▇█]/)
    expect(out).toMatch(/█+/)  // bar blocks
    expect(out).toContain('SYNC STATUS')
  })

  it('says no data when battles table empty', async () => {
    const out = await handleBatallas({ args: [], queries: makeQueries({
      total: 0, today: 0, yesterday: 0, last7d: 0, last30d: 0,
      sparkline14d: new Array(14).fill(0),
      modeDistribution: [],
      resultDistribution: [
        { result: 'victory', count: 0, pct: 0 },
        { result: 'defeat',  count: 0, pct: 0 },
        { result: 'draw',    count: 0, pct: 0 },
      ],
      topPlayers: [],
      lastSuccessfulSyncAt: null,
      queuePending: 0,
    }) })
    expect(out).toContain('No hay batallas registradas aún')
  })

  it('propagates getBattles errors', async () => {
    const throwing: Queries = {
      ...makeQueries(),
      getBattles: async () => { throw new Error('supabase down') },
    }
    await expect(handleBatallas({ args: [], queries: throwing })).rejects.toThrow('supabase down')
  })
})
