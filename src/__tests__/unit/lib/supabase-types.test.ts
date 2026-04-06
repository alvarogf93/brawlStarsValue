import { describe, it, expect } from 'vitest'
import { isValidTier, isValidSubscriptionStatus } from '@/lib/supabase/types'

describe('Supabase type guards', () => {
  it('validates tier values', () => {
    expect(isValidTier('free')).toBe(true)
    expect(isValidTier('premium')).toBe(true)
    expect(isValidTier('pro')).toBe(true)
    expect(isValidTier('ultra')).toBe(false)
    expect(isValidTier('')).toBe(false)
  })

  it('validates subscription status values', () => {
    expect(isValidSubscriptionStatus('active')).toBe(true)
    expect(isValidSubscriptionStatus('cancelled')).toBe(true)
    expect(isValidSubscriptionStatus('expired')).toBe(true)
    expect(isValidSubscriptionStatus('past_due')).toBe(true)
    expect(isValidSubscriptionStatus(null)).toBe(true)
    expect(isValidSubscriptionStatus('invalid')).toBe(false)
  })
})
