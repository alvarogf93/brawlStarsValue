import type { Profile } from '@/lib/supabase/types'

/** Check if a profile has active premium access.
 *  Cancelled subscriptions KEEP access until period ends (subscription_expired).
 *  Only 'expired' and 'past_due' revoke access. */
export function isPremium(profile: Profile | null): boolean {
  if (!profile) return false
  if (profile.tier === 'free') return false
  return profile.ls_subscription_status === 'active'
      || profile.ls_subscription_status === 'cancelled'
}
