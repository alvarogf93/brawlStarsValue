import { describe, it, expect } from 'vitest'
import { verifyWebhookSignature, parseWebhookEvent, statusToTier } from '@/lib/lemonsqueezy'
import crypto from 'crypto'

describe('verifyWebhookSignature', () => {
  const secret = 'test-webhook-secret'

  it('returns true for valid signature', () => {
    const body = '{"data":{"id":"1"}}'
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWebhookSignature(body, hmac, secret)).toBe(true)
  })

  it('returns false for invalid signature', () => {
    expect(verifyWebhookSignature('{"data":{}}', 'bad-signature', secret)).toBe(false)
  })

  it('returns false for empty signature', () => {
    expect(verifyWebhookSignature('{"data":{}}', '', secret)).toBe(false)
  })

  it('returns false for tampered body', () => {
    const body = '{"data":{"id":"1"}}'
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWebhookSignature('{"data":{"id":"2"}}', hmac, secret)).toBe(false)
  })
})

describe('parseWebhookEvent', () => {
  it('extracts subscription_created event data', () => {
    const payload = {
      meta: { event_name: 'subscription_created', custom_data: { profile_id: 'uid1' } },
      data: { id: 'sub_123', attributes: { customer_id: 456, status: 'active', variant_id: 789 } },
    }
    const result = parseWebhookEvent(payload)
    expect(result).toEqual({
      eventName: 'subscription_created',
      profileId: 'uid1',
      subscriptionId: 'sub_123',
      customerId: '456',
      status: 'active',
    })
  })

  it('extracts subscription_expired event data', () => {
    const payload = {
      meta: { event_name: 'subscription_expired', custom_data: { profile_id: 'uid1' } },
      data: { id: 'sub_123', attributes: { customer_id: 456, status: 'expired', variant_id: 789 } },
    }
    const result = parseWebhookEvent(payload)
    expect(result!.eventName).toBe('subscription_expired')
    expect(result!.status).toBe('expired')
  })

  it('returns null for missing profile_id', () => {
    const payload = {
      meta: { event_name: 'subscription_created', custom_data: {} },
      data: { id: 'sub_123', attributes: { customer_id: 456, status: 'active', variant_id: 789 } },
    }
    expect(parseWebhookEvent(payload)).toBeNull()
  })
})

describe('statusToTier', () => {
  it('maps subscription_created to premium + active', () => {
    expect(statusToTier('subscription_created', 'active')).toEqual({ tier: 'premium', subscriptionStatus: 'active' })
  })

  it('maps subscription_cancelled — keeps tier premium', () => {
    expect(statusToTier('subscription_cancelled', 'cancelled')).toEqual({ tier: 'premium', subscriptionStatus: 'cancelled' })
  })

  it('maps subscription_expired — drops to free', () => {
    expect(statusToTier('subscription_expired', 'expired')).toEqual({ tier: 'free', subscriptionStatus: 'expired' })
  })

  it('maps subscription_updated with active status', () => {
    expect(statusToTier('subscription_updated', 'active')).toEqual({ tier: 'premium', subscriptionStatus: 'active' })
  })

  it('maps subscription_updated with past_due status to free (access revoked)', () => {
    expect(statusToTier('subscription_updated', 'past_due')).toEqual({ tier: 'free', subscriptionStatus: 'past_due' })
  })
})
