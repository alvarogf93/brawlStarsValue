import type { Profile } from '@/lib/supabase/types'

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-uuid-123',
    player_tag: '#TEST123',
    tier: 'free',
    ls_customer_id: null,
    ls_subscription_id: null,
    ls_subscription_status: null,
    last_sync: null,
    trial_ends_at: null,
    referral_code: null,
    referred_by: null,
    referral_count: 0,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makePremiumProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({
    tier: 'premium',
    ls_subscription_status: 'active',
    last_sync: new Date().toISOString(),
    ...overrides,
  })
}

export function makeExpiredProfile(overrides: Partial<Profile> = {}): Profile {
  return makeProfile({
    tier: 'premium',
    ls_subscription_status: 'expired',
    ...overrides,
  })
}
