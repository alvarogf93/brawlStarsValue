export type Tier = 'free' | 'premium' | 'pro'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due'

export function isValidTier(value: string): value is Tier {
  return value === 'free' || value === 'premium' || value === 'pro'
}

export function isValidSubscriptionStatus(value: string | null): value is SubscriptionStatus | null {
  if (value === null) return true
  return value === 'active' || value === 'cancelled' || value === 'expired' || value === 'past_due'
}

/** Row type for the profiles table */
export interface Profile {
  id: string
  player_tag: string
  tier: Tier
  ls_customer_id: string | null
  ls_subscription_id: string | null
  ls_subscription_status: SubscriptionStatus | null
  last_sync: string | null
  created_at: string
  updated_at: string
}

/** What the client sends when creating a profile */
export interface ProfileInsert {
  id: string
  player_tag: string
  tier?: Tier
  ls_customer_id?: string | null
  ls_subscription_id?: string | null
  ls_subscription_status?: SubscriptionStatus | null
  last_sync?: string | null
  created_at?: string
  updated_at?: string
}

/** What the client sends when updating a profile */
export interface ProfileUpdate {
  player_tag?: string
  tier?: Tier
  ls_customer_id?: string | null
  ls_subscription_id?: string | null
  ls_subscription_status?: SubscriptionStatus | null
  last_sync?: string | null
}

/** Supabase Database type (used for typed client) */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
    }
  }
}
