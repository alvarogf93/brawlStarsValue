import type { Profile } from '@/lib/supabase/types'

/** Check if a profile has active premium access.
 *  Sources of premium (in priority order):
 *  1. Active subscription (PayPal): tier !== 'free' + status active/cancelled
 *  2. Active trial: trial_ends_at > now
 */
export function isPremium(profile: Profile | null): boolean {
  if (!profile) return false

  // Active subscription
  if (profile.tier !== 'free') {
    const status = profile.ls_subscription_status
    if (status === 'active' || status === 'cancelled') return true
  }

  // Active trial
  if (profile.trial_ends_at) {
    if (new Date(profile.trial_ends_at) > new Date()) return true
  }

  return false
}

/** Check if profile is on an active trial (not a paid subscription) */
export function isOnTrial(profile: Profile | null): boolean {
  if (!profile) return false
  // Has paid subscription → not on trial
  if (profile.tier !== 'free') {
    const status = profile.ls_subscription_status
    if (status === 'active' || status === 'cancelled') return false
  }
  // Has active trial
  if (profile.trial_ends_at) {
    return new Date(profile.trial_ends_at) > new Date()
  }
  return false
}

/** Check if trial has expired (had trial, now it's over, not subscribed) */
export function isTrialExpired(profile: Profile | null): boolean {
  if (!profile) return false
  if (isPremium(profile)) return false
  if (profile.trial_ends_at) {
    return new Date(profile.trial_ends_at) <= new Date()
  }
  return false
}
