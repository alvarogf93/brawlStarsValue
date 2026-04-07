import { describe, it, expect } from 'vitest'
import {
  PLAYER_TAG_REGEX,
  POWER_LEVEL_GEM_COST,
  GEM_COSTS,
  BRAWLER_RARITY_MAP,
  SKIN_TIER_PRICES,
  PIN_TIER_PRICES,
} from '@/lib/constants'

describe('PLAYER_TAG_REGEX', () => {
  it.each([
    '#YJU282PV',
    '#ABC',
    '#abc',
    '#12345678901234567890',
  ])('accepts valid tag %s', (tag) => {
    expect(PLAYER_TAG_REGEX.test(tag)).toBe(true)
  })

  it.each([
    '',
    'YJU282PV',
    '#AB',
    '#AB!',
    '# SPACE',
    '#123456789012345678901',
  ])('rejects invalid tag %s', (tag) => {
    expect(PLAYER_TAG_REGEX.test(tag)).toBe(false)
  })
})

describe('POWER_LEVEL_GEM_COST', () => {
  it('has entries for levels 1 through 11', () => {
    for (let i = 1; i <= 11; i++) {
      expect(POWER_LEVEL_GEM_COST[i], `level ${i}`).toBeDefined()
      expect(typeof POWER_LEVEL_GEM_COST[i]).toBe('number')
    }
  })

  it('costs are monotonically increasing', () => {
    for (let i = 2; i <= 11; i++) {
      expect(POWER_LEVEL_GEM_COST[i]).toBeGreaterThanOrEqual(POWER_LEVEL_GEM_COST[i - 1])
    }
  })

  it('level 1 costs 0 gems (base level)', () => {
    expect(POWER_LEVEL_GEM_COST[1]).toBe(0)
  })

  it('level 11 is the most expensive', () => {
    expect(POWER_LEVEL_GEM_COST[11]).toBe(1151)
  })
})

describe('GEM_COSTS', () => {
  it('all costs are positive numbers', () => {
    for (const [key, value] of Object.entries(GEM_COSTS)) {
      expect(value, `GEM_COSTS.${key}`).toBeGreaterThan(0)
    }
  })

  it('has required upgrade types', () => {
    expect(GEM_COSTS).toHaveProperty('gadget')
    expect(GEM_COSTS).toHaveProperty('starPower')
    expect(GEM_COSTS).toHaveProperty('hypercharge')
    expect(GEM_COSTS).toHaveProperty('gear')
  })
})

describe('BRAWLER_RARITY_MAP', () => {
  const validRarities = ['Trophy Road', 'Rare', 'Super Rare', 'Epic', 'Mythic', 'Legendary', 'Chromatic', 'Ultra Legendary']

  it('has at least 50 brawlers', () => {
    expect(Object.keys(BRAWLER_RARITY_MAP).length).toBeGreaterThanOrEqual(50)
  })

  it('all rarities are valid strings', () => {
    for (const [id, rarity] of Object.entries(BRAWLER_RARITY_MAP)) {
      expect(validRarities, `Brawler ${id}`).toContain(rarity)
    }
  })
})

describe('SKIN_TIER_PRICES', () => {
  it('all paid tiers have positive prices', () => {
    for (const [tier, price] of Object.entries(SKIN_TIER_PRICES)) {
      if (tier === 'none') {
        expect(price, `Skin tier ${tier}`).toBe(0)
      } else {
        expect(price, `Skin tier ${tier}`).toBeGreaterThan(0)
      }
    }
  })

  it('has the none (unclassified) tier', () => {
    expect(SKIN_TIER_PRICES).toHaveProperty('none', 0)
  })
})

describe('PIN_TIER_PRICES', () => {
  it('all prices are positive', () => {
    for (const [tier, price] of Object.entries(PIN_TIER_PRICES)) {
      expect(price, `Pin tier ${tier}`).toBeGreaterThan(0)
    }
  })
})
