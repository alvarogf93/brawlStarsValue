import { describe, it, expect } from 'vitest'
import { isPremium } from '@/lib/premium'
import { makeProfile, makePremiumProfile, makeExpiredProfile } from '../../fixtures/profile.fixture'

describe('isPremium', () => {
  it('returns false for null profile', () => {
    expect(isPremium(null)).toBe(false)
  })

  it('returns false for free tier', () => {
    expect(isPremium(makeProfile({ tier: 'free' }))).toBe(false)
  })

  it('returns true for premium with active status', () => {
    expect(isPremium(makePremiumProfile())).toBe(true)
  })

  it('returns true for premium with cancelled status (grace period)', () => {
    expect(isPremium(makePremiumProfile({ ls_subscription_status: 'cancelled' }))).toBe(true)
  })

  it('returns false for premium with expired status', () => {
    expect(isPremium(makeExpiredProfile())).toBe(false)
  })

  it('returns false for premium with past_due status', () => {
    expect(isPremium(makeProfile({ tier: 'premium', ls_subscription_status: 'past_due' }))).toBe(false)
  })

  it('returns true for pro tier with active status', () => {
    expect(isPremium(makeProfile({ tier: 'pro', ls_subscription_status: 'active' }))).toBe(true)
  })

  it('returns true for pro tier with cancelled status', () => {
    expect(isPremium(makeProfile({ tier: 'pro', ls_subscription_status: 'cancelled' }))).toBe(true)
  })

  it('returns false for premium with null subscription status', () => {
    expect(isPremium(makeProfile({ tier: 'premium', ls_subscription_status: null }))).toBe(false)
  })
})
