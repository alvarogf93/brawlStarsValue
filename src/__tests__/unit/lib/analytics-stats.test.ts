import { describe, it, expect } from 'vitest'
import { wilsonLowerBound, winRate, wilsonPct, groupBy, isWin, isLoss, avg } from '@/lib/analytics/stats'

describe('winRate', () => {
  it('returns 0 for 0 total', () => {
    expect(winRate(0, 0)).toBe(0)
  })

  it('calculates correct percentage', () => {
    expect(winRate(7, 10)).toBe(70)
  })

  it('rounds to 1 decimal', () => {
    expect(winRate(1, 3)).toBe(33.3)
  })

  it('returns 100 for all wins', () => {
    expect(winRate(5, 5)).toBe(100)
  })

  it('returns 0 for all losses', () => {
    expect(winRate(0, 10)).toBe(0)
  })
})

describe('wilsonLowerBound', () => {
  it('returns 0 for 0 total', () => {
    expect(wilsonLowerBound(0, 0)).toBe(0)
  })

  it('returns a value between 0 and 1', () => {
    const result = wilsonLowerBound(7, 10)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(1)
  })

  it('1/1 (100%) ranks LOWER than 45/50 (90%)', () => {
    // This is the key property: low sample size should rank lower
    const oneOfOne = wilsonLowerBound(1, 1)
    const fortyFiveOfFifty = wilsonLowerBound(45, 50)
    expect(fortyFiveOfFifty).toBeGreaterThan(oneOfOne)
  })

  it('10/10 ranks lower than 90/100', () => {
    const tenOfTen = wilsonLowerBound(10, 10)
    const ninetyOfHundred = wilsonLowerBound(90, 100)
    expect(ninetyOfHundred).toBeGreaterThan(tenOfTen)
  })

  it('higher sample size with same ratio gives higher score', () => {
    const small = wilsonLowerBound(6, 10)   // 60% in 10
    const large = wilsonLowerBound(60, 100) // 60% in 100
    expect(large).toBeGreaterThan(small)
  })

  it('never returns negative', () => {
    expect(wilsonLowerBound(0, 100)).toBeGreaterThanOrEqual(0)
  })
})

describe('wilsonPct', () => {
  it('returns percentage (0-100 scale)', () => {
    const result = wilsonPct(45, 50)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThanOrEqual(100)
  })
})

describe('groupBy', () => {
  it('groups items by key function', () => {
    const items = [
      { mode: 'gemGrab', win: true },
      { mode: 'brawlBall', win: false },
      { mode: 'gemGrab', win: false },
    ]
    const grouped = groupBy(items, i => i.mode)
    expect(grouped.get('gemGrab')?.length).toBe(2)
    expect(grouped.get('brawlBall')?.length).toBe(1)
  })

  it('returns empty map for empty array', () => {
    const grouped = groupBy([], () => 'key')
    expect(grouped.size).toBe(0)
  })
})

describe('isWin / isLoss', () => {
  it('isWin returns true for victory', () => {
    expect(isWin('victory')).toBe(true)
  })

  it('isWin returns false for defeat', () => {
    expect(isWin('defeat')).toBe(false)
  })

  it('isWin returns false for null', () => {
    expect(isWin(null)).toBe(false)
  })

  it('isLoss returns true for defeat', () => {
    expect(isLoss('defeat')).toBe(true)
  })

  it('isLoss returns false for victory', () => {
    expect(isLoss('victory')).toBe(false)
  })
})

describe('avg', () => {
  it('returns null for empty array', () => {
    expect(avg([])).toBe(null)
  })

  it('returns the value for single element', () => {
    expect(avg([42])).toBe(42)
  })

  it('calculates correct average', () => {
    expect(avg([10, 20, 30])).toBe(20)
  })
})
