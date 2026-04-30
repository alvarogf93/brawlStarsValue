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

  it('maps BILLING.SUBSCRIPTION.UPDATED with SUSPENDED status to free / past_due (LOG-14)', () => {
    // SUSPENDED on the UPDATED branch maps to past_due so dunning logic
    // can distinguish a "PayPal will retry billing" state from a hard
    // cancel. The dedicated SUSPENDED event maps explicitly elsewhere.
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.UPDATED', 'SUSPENDED')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'past_due' })
  })

  it('maps BILLING.SUBSCRIPTION.UPDATED with CANCELLED status to premium / cancelled (LOG-14 grace)', () => {
    // PayPal can emit UPDATED+CANCELLED after the dedicated CANCELLED
    // event. Out-of-order delivery would otherwise downgrade the user
    // to free immediately and lose the documented grace period that
    // `isPremium()` relies on. Both code paths must preserve `premium`.
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.UPDATED', 'CANCELLED')
    expect(result).toEqual({ tier: 'premium', subscriptionStatus: 'cancelled' })
  })

  it('maps BILLING.SUBSCRIPTION.UPDATED with unknown status to free / <raw> (admin diagnostic)', () => {
    // Defensive fallback so a future PayPal status surfaces in admin
    // diagnostics rather than being silently mapped to a stale enum.
    const result = paypalStatusToTier('BILLING.SUBSCRIPTION.UPDATED', 'EXPIRED')
    expect(result).toEqual({ tier: 'free', subscriptionStatus: 'expired' })
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
