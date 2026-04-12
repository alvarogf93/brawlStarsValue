import { describe, it, expect } from 'vitest'
import { handlePremium } from '@/lib/telegram/commands/premium'
import type { PremiumData, Queries } from '@/lib/telegram/types'

function makeQueries(p: Partial<PremiumData> = {}): Queries {
  const defaults: PremiumData = {
    premiumActive: 1,
    trialActive: 0,
    freeUsers: 2,
    signupsLast30d: 3,
    trialsActivatedLast30d: 3,
    trialToPremiumLast30d: 1,
    trialsExpiredLast30d: 0,
    upcomingRenewals7d: null,
    ltvTotal: null,
  }
  const merged = { ...defaults, ...p }
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: async () => merged,
    getCronStatus: () => Promise.reject(new Error('not used')),
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handlePremium', () => {
  it('renders 3 sections with funnel percentages and explicit integration placeholders', async () => {
    const out = await handlePremium({ args: [], queries: makeQueries() })
    expect(out).toContain('PREMIUM')
    expect(out).toContain('ESTADO ACTUAL')
    expect(out).toContain('FUNNEL 30 DÍAS')
    expect(out).toContain('Requiere integración')
    expect(out).toContain('100%')  // 3/3 activaron trial
    expect(out).toContain('33%')   // 1/3 trial→premium
  })

  it('handles zero signups without NaN percentages', async () => {
    const out = await handlePremium({ args: [], queries: makeQueries({
      signupsLast30d: 0, trialsActivatedLast30d: 0, trialToPremiumLast30d: 0, trialsExpiredLast30d: 0,
    }) })
    expect(out).not.toMatch(/NaN/)
  })

  it('propagates query errors', async () => {
    const throwing: Queries = {
      ...makeQueries(),
      getPremium: async () => { throw new Error('db down') },
    }
    await expect(handlePremium({ args: [], queries: throwing })).rejects.toThrow('db down')
  })
})
