import { describe, it, expect } from 'vitest'
import { handleHelp } from '@/lib/telegram/commands/help'

const noopQueries = {
  getStats: () => Promise.reject(new Error('not used')),
  getBattles: () => Promise.reject(new Error('not used')),
  getPremium: () => Promise.reject(new Error('not used')),
  getCronStatus: () => Promise.reject(new Error('not used')),
  getMapList: () => Promise.reject(new Error('not used')),
  findMapByPrefix: () => Promise.reject(new Error('not used')),
  getMapData: () => Promise.reject(new Error('not used')),
}

describe('handleHelp', () => {
  it('mentions every one of the 6 commands', async () => {
    const out = await handleHelp({ args: [], queries: noopQueries })
    expect(out).toContain('/stats')
    expect(out).toContain('/batallas')
    expect(out).toContain('/premium')
    expect(out).toContain('/cron')
    expect(out).toContain('/mapa')
    expect(out).toContain('/help')
  })
})
