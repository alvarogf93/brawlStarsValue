import type { Profile } from '@/lib/supabase/types'

/** Check if a profile has active premium access.
 *  - 'active': paying, full access
 *  - 'cancelled': grace period until end of billing cycle, full access
 *  - 'past_due': payment failed, access REVOKED to prevent indefinite free use
 *  - 'expired': subscription ended, access REVOKED
 *  - null/undefined: no subscription, no access */
export function isPremium(profile: Profile | null): boolean {
  if (!profile) return false
  if (profile.tier === 'free') return false
  const status = profile.ls_subscription_status
  return status === 'active' || status === 'cancelled'
}
