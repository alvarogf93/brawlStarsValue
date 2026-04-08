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
  trial_ends_at: string | null
  referral_code: string | null
  referred_by: string | null
  referral_count: number
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

// ── Battles ─────────────────────────────────────────────

export interface BrawlerJsonb {
  id: number
  name: string
  power: number
  trophies: number
  gadgets: Array<{ id: number; name: string }>
  starPowers: Array<{ id: number; name: string }>
  hypercharges: Array<{ id: number; name: string }>
}

export interface TeammateJsonb {
  tag: string
  name: string
  brawler: {
    id: number
    name: string
    power: number
    trophies: number
  }
}

export interface Battle {
  id: number
  player_tag: string
  battle_time: string
  event_id: number | null
  mode: string
  map: string | null
  result: 'victory' | 'defeat' | 'draw'
  trophy_change: number
  duration: number | null
  is_star_player: boolean
  my_brawler: BrawlerJsonb
  teammates: TeammateJsonb[]
  opponents: TeammateJsonb[]
  created_at: string
}

export interface BattleInsert {
  player_tag: string
  battle_time: string
  event_id: number | null
  mode: string
  map: string | null
  result: 'victory' | 'defeat' | 'draw'
  trophy_change: number
  duration: number | null
  is_star_player: boolean
  my_brawler: BrawlerJsonb
  teammates: TeammateJsonb[]
  opponents: TeammateJsonb[]
}

// ── Sync Queue ──────────────────────────────────────────

export interface SyncQueueRow {
  id: number
  player_tag: string
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  retry_count: number
  error: string | null
  created_at: string
}

// ── Webhook Events ──────────────────────────────────────

export interface WebhookEvent {
  event_id: string
  event_type: string
  processed_at: string
}

// ── Database ────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      battles: {
        Row: Battle
        Insert: BattleInsert
        Update: Partial<BattleInsert>
      }
      sync_queue: {
        Row: SyncQueueRow
        Insert: { player_tag: string }
        Update: Partial<SyncQueueRow>
      }
      webhook_events: {
        Row: WebhookEvent
        Insert: { event_id: string; event_type: string }
        Update: never
      }
    }
  }
}
