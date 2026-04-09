import { describe, it, expect } from 'vitest'
import { detectSegment, type PlayerSegment } from '@/lib/analytics/detect-segment'

describe('detectSegment', () => {
  it('returns "tilt" for 3+ consecutive losses', () => {
    const battles = [
      { result: 'defeat' }, { result: 'defeat' }, { result: 'defeat' },
      { result: 'victory' }, { result: 'victory' },
    ]
    expect(detectSegment(battles as any, 20000)).toBe('tilt')
  })

  it('returns "main" when 60%+ games with same brawler', () => {
    const battles = Array.from({ length: 10 }, (_, i) => ({
      result: 'victory',
      my_brawler: { id: i < 7 ? 16000000 : 16000001, name: i < 7 ? 'SHELLY' : 'COLT' },
    }))
    expect(detectSegment(battles as any, 20000)).toBe('main')
  })

  it('returns "competitive" for >25K trophies', () => {
    const battles = [{ result: 'victory', my_brawler: { id: 1, name: 'A' } }]
    expect(detectSegment(battles as any, 30000)).toBe('competitive')
  })

  it('returns "explorer" for 3+ different modes', () => {
    const battles = [
      { result: 'victory', mode: 'gemGrab' },
      { result: 'victory', mode: 'brawlBall' },
      { result: 'victory', mode: 'knockout' },
      { result: 'victory', mode: 'heist' },
    ]
    expect(detectSegment(battles as any, 15000)).toBe('explorer')
  })

  it('returns "streak" for 3+ consecutive wins', () => {
    const battles = [
      { result: 'victory' }, { result: 'victory' }, { result: 'victory' },
      { result: 'defeat' },
    ]
    expect(detectSegment(battles as any, 15000)).toBe('streak')
  })

  it('returns "tilt" as default when no clear signal', () => {
    const battles = [{ result: 'victory' }, { result: 'defeat' }]
    expect(detectSegment(battles as any, 15000)).toBe('tilt')
  })

  it('returns "tilt" for empty battles array', () => {
    expect(detectSegment([], 20000)).toBe('tilt')
  })
})
