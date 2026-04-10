import { describe, it, expect } from 'vitest'
import { paypalStatusToTier } from '@/lib/paypal'

describe('paypalStatusToTier', () => {
  // ── ACTIVATED ───────────────────────────────────────────────
  it('maps BILLING.SUBSCRIPTION.ACTIVATED to premium / active', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.ACTIVATED', 'ACTIVE')
    expect(result).toEqual({ tier: 'premium', subscriptionStatus: 'active' })
  })

  it('maps ACTIVATED regardless of status param', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.ACTIVATED', 'WHATEVER')
    expect(result).toEqual({ tier: 'premium', subscriptionStatus: 'active' })
  })

  // ── CANCELLED ───────────────────────────────────────────────
  it('maps BILLING.SUBSCRIPTION.CANCELLED to premium / cancelled (grace period)', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.CANCELLED', 'CANCELLED')
    expect(result).toEqual({ tier: 'premium', subscriptionStatus: 'cancelled' })
  })

  // ── SUSPENDED ───────────────────────────────────────────────
  it('maps BILLING.SUBSCRIPTION.SUSPENDED to free / past_due', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.SUSPENDED', 'SUSPENDED')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'past_due' })
  })

  // ── EXPIRED ─────────────────────────────────────────────────
  it('maps BILLING.SUBSCRIPTION.EXPIRED to free / expired', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.EXPIRED', 'EXPIRED')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'expired' })
  })

  // ── PAYMENT.FAILED ──────────────────────────────────────────
  it('maps BILLING.SUBSCRIPTION.PAYMENT.FAILED to free / past_due', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'ACTIVE')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'past_due' })
  })

  // ── UPDATED ─────────────────────────────────────────────────
  it('maps BILLING.SUBSCRIPTION.UPDATED with ACTIVE status to premium / active', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.UPDATED', 'ACTIVE')
    expect(result).toEqual({ tier: 'premium', subscriptionStatus: 'active' })
  })

  it('maps BILLING.SUBSCRIPTION.UPDATED with SUSPENDED status to free / suspended', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.UPDATED', 'SUSPENDED')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'suspended' })
  })

  it('maps BILLING.SUBSCRIPTION.UPDATED with CANCELLED status to free / cancelled', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.UPDATED', 'CANCELLED')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'cancelled' })
  })

  // ── Unknown event type ──────────────────────────────────────
  it('falls back to free / lowercased status for unknown event types', () => {
    const result = paypalStatusToTier('SOME.UNKNOWN.EVENT', 'ACTIVE')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'active' })
  })

  it('falls back correctly for unknown event with arbitrary status', () => {
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.REACTIVATED', 'PENDING')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'pending' })
  })
})
