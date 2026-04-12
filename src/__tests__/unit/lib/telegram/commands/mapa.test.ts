import { describe, it, expect } from 'vitest'
import { handleMapa } from '@/lib/telegram/commands/mapa'
import type { MapData, MapListItem, MapMatchResult, Queries } from '@/lib/telegram/types'

function makeQueries(opts: {
  list?: MapListItem[]
  match?: MapMatchResult
  data?: MapData
}): Queries {
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: async () => opts.list ?? [],
    findMapByPrefix: async () => opts.match ?? { kind: 'none' },
    getMapData: async () => {
      if (!opts.data) throw new Error('no data fixture')
      return opts.data
    },
  }
}

function makeMapData(overrides: Partial<MapData> = {}): MapData {
  return {
    map: 'Sidetrack',
    mode: 'brawlBall',
    battlesToday: 2798,
    battlesLast7d: 19586,
    brawlerCovered: 81,
    brawlerTotal: 82,
    sparkline7d: [2000, 2100, 1900, 2200, 2100, 2000, 2798],
    topWinRates: [
      { brawlerId: 1, winRate: 0.624, total: 123 },
      { brawlerId: 2, winRate: 0.581, total: 89  },
      { brawlerId: 3, winRate: 0.578, total: 156 },
      { brawlerId: 4, winRate: 0.569, total: 102 },
      { brawlerId: 5, winRate: 0.562, total: 78  },
    ],
    bottomWinRates: [
      { brawlerId: 6, winRate: 0.382, total: 41 },
      { brawlerId: 7, winRate: 0.391, total: 35 },
      { brawlerId: 8, winRate: 0.405, total: 52 },
    ],
    sameModeComparison: [
      { map: 'Sidetrack',     battles: 2798 },
      { map: 'Nutmeg',        battles: 1848 },
      { map: 'Slippery Slap', battles:  334 },
    ],
    lastCursorUpdate: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

describe('handleMapa — list variant', () => {
  it('renders numbered list of maps with data today', async () => {
    const list: MapListItem[] = [
      { map: 'Sidetrack', mode: 'brawlBall', battles: 2798, brawlerCount: 81 },
      { map: 'Nutmeg',    mode: 'brawlBall', battles: 1848, brawlerCount: 61 },
    ]
    const out = await handleMapa({ args: [], queries: makeQueries({ list }) })
    expect(out).toContain('MAPAS CON DATOS HOY')
    expect(out).toContain('1.')
    expect(out).toContain('Sidetrack')
    expect(out).toContain('brawlBall')
    expect(out).toContain('2,798')
  })

  it('says "sin datos" on empty list', async () => {
    const out = await handleMapa({ args: [], queries: makeQueries({ list: [] }) })
    expect(out).toContain('No hay mapas con datos hoy')
  })
})

describe('handleMapa — specific map variant', () => {
  it('renders a detailed map response for exact match', async () => {
    const out = await handleMapa({
      args: ['sidetrack'],
      queries: makeQueries({
        match: { kind: 'found', map: 'Sidetrack', mode: 'brawlBall' },
        data: makeMapData(),
      }),
    })
    expect(out).toContain('SIDETRACK')
    expect(out).toContain('brawlBall')
    expect(out).toContain('COBERTURA')
    expect(out).toContain('TOP 5 BRAWLERS')
    expect(out).toContain('BOTTOM 3')
    expect(out).toContain('COMPARACIÓN')
    expect(out).toContain('81 / 82')
    expect(out).toMatch(/[▁▂▃▄▅▆▇█]/)
  })

  it('omits ranking blocks when below MIN_BATTLES_FOR_RANKING', async () => {
    const out = await handleMapa({
      args: ['pit'],
      queries: makeQueries({
        match: { kind: 'found', map: 'Pit Stop', mode: 'heist' },
        data: makeMapData({ map: 'Pit Stop', mode: 'heist', battlesToday: 2, topWinRates: [], bottomWinRates: [] }),
      }),
    })
    expect(out).toContain('Datos insuficientes para ranking fiable')
    expect(out).not.toContain('TOP 5 BRAWLERS')
  })

  it('reports not-found when no prefix matches', async () => {
    const out = await handleMapa({
      args: ['xyzxyz'],
      queries: makeQueries({ match: { kind: 'none' } }),
    })
    expect(out).toContain("No hay mapa que empiece por 'xyzxyz'")
  })

  it('reports ambiguous when multiple prefixes match', async () => {
    const out = await handleMapa({
      args: ['bea'],
      queries: makeQueries({
        match: {
          kind: 'ambiguous',
          candidates: [
            { map: 'Beach Ball',  mode: 'brawlBall' },
            { map: 'Bea Stadium', mode: 'knockout'  },
          ],
        },
      }),
    })
    expect(out).toContain('Ambiguo')
    expect(out).toContain('Beach Ball')
    expect(out).toContain('Bea Stadium')
  })

  it('normalises the prefix argument to lowercase for display', async () => {
    const out = await handleMapa({
      args: ['SIDE'],
      queries: makeQueries({
        match: { kind: 'found', map: 'Sidetrack', mode: 'brawlBall' },
        data: makeMapData(),
      }),
    })
    expect(out).toContain('SIDETRACK')
  })
})
