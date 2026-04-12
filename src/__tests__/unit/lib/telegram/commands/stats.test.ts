import { describe, it, expect } from 'vitest'
import { handleStats } from '@/lib/telegram/commands/stats'
import type { Queries, StatsData } from '@/lib/telegram/types'

function makeQueries(stats: Partial<StatsData> = {}): Queries {
  const defaults: StatsData = {
    totalUsers: 3,
    premiumCount: 1,
    trialCount: 0,
    anonCount30d: 3,
    anonSparkline: [0, 0, 0, 0, 0, 0, 3],
    totalBattles: 108,
    battlesToday: 14,
    battleSparkline: [2, 2, 3, 4, 4, 4, 14],
    metaRowsToday: 836,
    metaRowsTotal: 3443,
    activeCursors: 183,
    staleCursors: 22,
    latestMetaActivity: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
    top3Maps: [
      { map: 'Sidetrack',              mode: 'brawlBall', battles: 2798 },
      { map: 'Healthy Middle Ground',  mode: 'knockout',  battles: 2017 },
      { map: 'Nutmeg',                 mode: 'brawlBall', battles: 1848 },
    ],
    top3Brawlers: [
      { brawlerId: 1, winRate: 0.62, total: 123 },
      { brawlerId: 2, winRate: 0.58, total: 89  },
      { brawlerId: 3, winRate: 0.57, total: 156 },
    ],
  }
  const merged = { ...defaults, ...stats }
  return {
    getStats: async () => merged,
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handleStats', () => {
  it('renders all 5 sections with sparklines and top 3 lists', async () => {
    const out = await handleStats({ args: [], queries: makeQueries() })
    expect(out).toContain('📊')
    expect(out).toContain('USUARIOS')
    expect(out).toContain('ACTIVIDAD')
    expect(out).toContain('META POLL')
    expect(out).toContain('TOP 3 MAPAS')
    expect(out).toContain('TOP 3 BRAWLERS')
    expect(out).toContain('Sidetrack')
    expect(out).toContain('1,848')          // comma separator
    expect(out).toMatch(/[▁▂▃▄▅▆▇█]/)       // sparkline present
  })

  it('falls back to "— sin datos" when sparklines are all zero', async () => {
    const flat = makeQueries({
      anonSparkline: [0, 0, 0, 0, 0, 0, 0],
      battleSparkline: [0, 0, 0, 0, 0, 0, 0],
      totalBattles: 0,
    })
    const out = await handleStats({ args: [], queries: flat })
    expect(out).toContain('sin datos')
  })

  it('propagates errors when queries.getStats throws', async () => {
    const throwing: Queries = {
      ...makeQueries(),
      getStats: async () => { throw new Error('db down') },
    }
    await expect(handleStats({ args: [], queries: throwing })).rejects.toThrow('db down')
  })
})
