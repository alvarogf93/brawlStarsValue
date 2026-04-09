import { describe, it, expect } from 'vitest'
import { isPremium, isOnTrial, isTrialExpired } from '@/lib/premium'
import { makeProfile, makePremiumProfile, makeExpiredProfile } from '../../fixtures/profile.fixture'

/** Helper: returns an ISO date string N days from now (positive = future, negative = past) */
function daysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

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

  it('returns true for free tier with active trial', () => {
    expect(isPremium(makeProfile({ trial_ends_at: daysFromNow(7) }))).toBe(true)
  })

  it('returns false for free tier with expired trial', () => {
    expect(isPremium(makeProfile({ trial_ends_at: daysFromNow(-1) }))).toBe(false)
  })
})

describe('isOnTrial', () => {
  it('returns false for null profile', () => {
    expect(isOnTrial(null)).toBe(false)
  })

  it('returns false for free profile with no trial', () => {
    expect(isOnTrial(makeProfile())).toBe(false)
  })

  it('returns true for free profile with active trial', () => {
    expect(isOnTrial(makeProfile({ trial_ends_at: daysFromNow(7) }))).toBe(true)
  })

  it('returns false for free profile with expired trial', () => {
    expect(isOnTrial(makeProfile({ trial_ends_at: daysFromNow(-1) }))).toBe(false)
  })

  it('returns false for paid subscriber even with active trial_ends_at', () => {
    // If user upgraded to paid, they are no longer "on trial"
    expect(isOnTrial(makePremiumProfile({ trial_ends_at: daysFromNow(7) }))).toBe(false)
  })

  it('returns false for cancelled subscriber even with active trial_ends_at', () => {
    expect(isOnTrial(makePremiumProfile({
      ls_subscription_status: 'cancelled',
      trial_ends_at: daysFromNow(7),
    }))).toBe(false)
  })

  it('returns true for expired subscriber with active trial', () => {
    // Subscription expired but trial is still active (edge case)
    expect(isOnTrial(makeProfile({
      tier: 'premium',
      ls_subscription_status: 'expired',
      trial_ends_at: daysFromNow(7),
    }))).toBe(true)
  })
})

describe('isTrialExpired', () => {
  it('returns false for null profile', () => {
    expect(isTrialExpired(null)).toBe(false)
  })

  it('returns false for free profile with no trial set', () => {
    expect(isTrialExpired(makeProfile())).toBe(false)
  })

  it('returns false for profile with active trial (still premium)', () => {
    expect(isTrialExpired(makeProfile({ trial_ends_at: daysFromNow(7) }))).toBe(false)
  })

  it('returns true for profile with trial in the past and no subscription', () => {
    expect(isTrialExpired(makeProfile({ trial_ends_at: daysFromNow(-1) }))).toBe(true)
  })

  it('returns false for paid subscriber even if trial_ends_at is past', () => {
    // Active subscription means isPremium is true, so trial is not "expired" in a meaningful sense
    expect(isTrialExpired(makePremiumProfile({ trial_ends_at: daysFromNow(-1) }))).toBe(false)
  })

  it('returns true for expired subscription with expired trial', () => {
    expect(isTrialExpired(makeExpiredProfile({ trial_ends_at: daysFromNow(-1) }))).toBe(true)
  })
})
