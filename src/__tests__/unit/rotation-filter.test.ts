import { describe, it, expect } from 'vitest'
import {
  filterRegularRotation,
  isRegularRotation,
  durationHours,
  REGULAR_ROTATION_MAX_HOURS,
  REGULAR_ROTATION_MIN_HOURS,
} from '@/lib/meta/rotation-filter'

/**
 * Regression: 2026-05-04, user #YJU282PV reported on the Meta-PRO
 * map selector that "Spiraling Out" appeared duplicated and "Gem
 * Fort" was listed even though the in-game rotation only showed
 * "Local Restaurants" for gemGrab. Empirical /api/events at that
 * time returned both 24h and 216h slots for several maps. The
 * fixture below mirrors that exact response.
 */

const SAMPLE_RESPONSE = [
  // Regular rotation — 24h slots the player sees in-game.
  { startTime: '20260504T080000.000Z', endTime: '20260505T080000.000Z', slotId: 1, event: { id: 15001021, mode: 'brawlBall', modeId: 5, map: 'Spiraling Out' } },
  { startTime: '20260504T080000.000Z', endTime: '20260505T080000.000Z', slotId: 2, event: { id: 15000956, mode: 'soloShowdown', modeId: 1, map: 'Acid Lakes' } },
  { startTime: '20260504T080000.000Z', endTime: '20260505T080000.000Z', slotId: 3, event: { id: 15000932, mode: 'gemGrab', modeId: 2, map: 'Local Restaurants' } },
  { startTime: '20260504T080000.000Z', endTime: '20260505T080000.000Z', slotId: 4, event: { id: 15001099, mode: 'heist', modeId: 8, map: 'Photic Doom' } },

  // Extended ranked / Power-League — 216h. THESE are the bug.
  { startTime: '20260428T080000.000Z', endTime: '20260507T080000.000Z', slotId: 20, event: { id: 15000548, mode: 'knockout', modeId: 17, map: 'Out in the Open' } },
  { startTime: '20260428T080000.000Z', endTime: '20260507T080000.000Z', slotId: 21, event: { id: 15001021, mode: 'brawlBall', modeId: 5, map: 'Spiraling Out' } },
  { startTime: '20260428T080000.000Z', endTime: '20260507T080000.000Z', slotId: 22, event: { id: 15000010, mode: 'gemGrab', modeId: 2, map: 'Gem Fort' } },

  // Short special — 2h flashlight-tier event.
  { startTime: '20260504T080000.000Z', endTime: '20260504T100000.000Z', slotId: 55, event: { id: 15000581, mode: 'knockout', modeId: 17, map: 'Healthy Middle Ground' } },
]

describe('durationHours', () => {
  it('computes 24h for daily slots', () => {
    expect(durationHours(SAMPLE_RESPONSE[0])).toBe(24)
  })
  it('computes 216h for the 9-day extended slots', () => {
    expect(durationHours(SAMPLE_RESPONSE[4])).toBe(216)
  })
  it('computes 2h for the special event', () => {
    expect(durationHours(SAMPLE_RESPONSE[7])).toBe(2)
  })
  it('returns null when timestamps are missing', () => {
    expect(durationHours({})).toBeNull()
    expect(durationHours({ startTime: '20260504T080000.000Z' })).toBeNull()
  })
})

describe('isRegularRotation', () => {
  it('accepts daily 24h slots', () => {
    expect(isRegularRotation(SAMPLE_RESPONSE[0])).toBe(true)
  })
  it('rejects 216h ranked slots', () => {
    expect(isRegularRotation(SAMPLE_RESPONSE[4])).toBe(false)
    expect(isRegularRotation(SAMPLE_RESPONSE[5])).toBe(false)
    expect(isRegularRotation(SAMPLE_RESPONSE[6])).toBe(false)
  })
  it('rejects 2h special events', () => {
    expect(isRegularRotation(SAMPLE_RESPONSE[7])).toBe(false)
  })
  it('accepts events at the exact boundaries', () => {
    const min = { startTime: '20260504T000000.000Z', endTime: '20260504T120000.000Z' } // 12h
    const max = { startTime: '20260504T000000.000Z', endTime: '20260506T000000.000Z' } // 48h
    expect(isRegularRotation(min)).toBe(true)
    expect(isRegularRotation(max)).toBe(true)
  })
  it('keeps events with malformed timestamps (defensive — old behavior)', () => {
    expect(isRegularRotation({})).toBe(true)
    expect(isRegularRotation({ startTime: 'not-a-timestamp', endTime: '20260504T120000.000Z' })).toBe(true)
  })
})

describe('filterRegularRotation — bug 2026-05-04', () => {
  it('removes the Spiraling Out duplicate (slot 21, 216h)', () => {
    const result = filterRegularRotation(SAMPLE_RESPONSE)
    const spiraling = result.filter(e => e.event?.map === 'Spiraling Out')
    expect(spiraling).toHaveLength(1)
    expect(spiraling[0].slotId).toBe(1) // the 24h regular slot wins
  })

  it('removes Gem Fort (slot 22, 216h, no regular counterpart)', () => {
    const result = filterRegularRotation(SAMPLE_RESPONSE)
    expect(result.find(e => e.event?.map === 'Gem Fort')).toBeUndefined()
  })

  it('keeps only the regular-rotation gemGrab map', () => {
    const result = filterRegularRotation(SAMPLE_RESPONSE)
    const gemGrab = result.filter(e => e.event?.mode === 'gemGrab')
    expect(gemGrab).toHaveLength(1)
    expect(gemGrab[0].event?.map).toBe('Local Restaurants')
  })

  it('removes the 2h short special', () => {
    const result = filterRegularRotation(SAMPLE_RESPONSE)
    expect(result.find(e => e.event?.map === 'Healthy Middle Ground')).toBeUndefined()
  })

  it('reduces the 8-event sample to 4 regular slots', () => {
    const result = filterRegularRotation(SAMPLE_RESPONSE)
    expect(result).toHaveLength(4)
    const slots = result.map(e => e.slotId).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(slots).toEqual([1, 2, 3, 4])
  })

  it('preserves the order of surviving events', () => {
    const result = filterRegularRotation(SAMPLE_RESPONSE)
    expect(result[0].event?.map).toBe('Spiraling Out')
    expect(result[1].event?.map).toBe('Acid Lakes')
    expect(result[2].event?.map).toBe('Local Restaurants')
    expect(result[3].event?.map).toBe('Photic Doom')
  })

  it('handles a flat-shape event (no nested .event field)', () => {
    const flat = [
      { startTime: '20260504T080000.000Z', endTime: '20260505T080000.000Z', id: 1, map: 'Spiraling Out', mode: 'brawlBall' },
      { startTime: '20260428T080000.000Z', endTime: '20260507T080000.000Z', id: 1, map: 'Spiraling Out', mode: 'brawlBall' },
    ]
    const result = filterRegularRotation(flat)
    expect(result).toHaveLength(1)
    expect(durationHours(result[0])).toBe(24)
  })
})

describe('boundary constants', () => {
  it('exposes the documented thresholds for downstream tooling', () => {
    expect(REGULAR_ROTATION_MIN_HOURS).toBe(12)
    expect(REGULAR_ROTATION_MAX_HOURS).toBe(48)
  })
})
