// ARQ-01 — Database type definitions for the public schema.
//
// Source of truth: the `supabase/migrations/*.sql` files. Cross-validated by
// running `node scripts/introspect-supabase-schema.js` against the live
// PostgREST OpenAPI spec — diffs in those reports MUST be reconciled here.
// The "shape on disk" and "shape in the type system" stay in lock-step
// because every code path goes through `Database['public']['Tables'][name]`.

export type Tier = 'free' | 'premium' | 'pro'
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'past_due'
export type BattleResult = 'victory' | 'defeat' | 'draw'
export type MetaSource = 'global' | 'users'

export function isValidTier(value: string): value is Tier {
  return value === 'free' || value === 'premium' || value === 'pro'
}

export function isValidSubscriptionStatus(value: string | null): value is SubscriptionStatus | null {
  if (value === null) return true
  return value === 'active' || value === 'cancelled' || value === 'expired' || value === 'past_due'
}

// ── profiles ────────────────────────────────────────────

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

export interface ProfileUpdate {
  player_tag?: string
  tier?: Tier
  ls_customer_id?: string | null
  ls_subscription_id?: string | null
  ls_subscription_status?: SubscriptionStatus | null
  last_sync?: string | null
}

// ── battles ─────────────────────────────────────────────

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
  result: BattleResult
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
  result: BattleResult
  trophy_change: number
  duration: number | null
  is_star_player: boolean
  my_brawler: BrawlerJsonb
  teammates: TeammateJsonb[]
  opponents: TeammateJsonb[]
}

// ── sync_queue ──────────────────────────────────────────

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

// ── webhook_events ──────────────────────────────────────

export interface WebhookEvent {
  event_id: string
  event_type: string
  processed_at: string
}

// ── meta_stats ──────────────────────────────────────────
// Aggregated win/loss counts per brawler, scoped by map+mode+source+date.
// Composite PK: (brawler_id, map, mode, source, date). The bulk_upsert RPC
// is the canonical write path; meta_stats rows are produced by both
// /api/cron/sync (source='users') and /api/cron/meta-poll (source='global').

export interface MetaStat {
  brawler_id: number
  map: string
  mode: string
  source: MetaSource
  date: string  // YYYY-MM-DD
  wins: number
  losses: number
  total: number
}

export type MetaStatInsert = MetaStat

// ── meta_matchups ───────────────────────────────────────
// Brawler-vs-opponent stats at MODE level (not map). Composite PK:
// (brawler_id, opponent_id, mode, source, date).

export interface MetaMatchup {
  brawler_id: number
  opponent_id: number
  mode: string
  source: MetaSource
  date: string
  wins: number
  losses: number
  total: number
}

export type MetaMatchupInsert = MetaMatchup

// ── meta_trios ──────────────────────────────────────────
// 3-brawler team composition stats. Composite PK:
// (brawler1_id, brawler2_id, brawler3_id, map, mode, source, date).
// brawler[1..3]_id are stored sorted ascending so the same team in any
// player order maps to the same row.

export interface MetaTrio {
  brawler1_id: number
  brawler2_id: number
  brawler3_id: number
  map: string
  mode: string
  source: MetaSource
  date: string
  wins: number
  losses: number
  total: number
}

export type MetaTrioInsert = MetaTrio

// ── cron_heartbeats ─────────────────────────────────────
// Single-row-per-job-name heartbeat used by the cron staleness watchdog.

export interface CronHeartbeat {
  job_name: string
  last_success_at: string
  last_duration_ms: number
  last_summary: Record<string, unknown> | null
}

// ── brawler_trends ──────────────────────────────────────
// One row per brawler, precomputed by `compute_brawler_trends()` on
// pg_cron every 6h. Read by /api/meta/brawler-trends.

export interface BrawlerTrend {
  brawler_id: number
  trend_7d: number | null
  recent_total: number
  prev_total: number
  computed_at: string
}

// ── meta_poll_cursors ───────────────────────────────────
// Per-player cursor used by /api/cron/meta-poll to skip already-processed
// battles on the next run.

export interface MetaPollCursor {
  player_tag: string
  last_battle_time: string
}

// ── anonymous_visits ────────────────────────────────────
// Tracking-table written by /api/calculate when fromLanding=true and the
// user is not authenticated. PII-free by design — only the player tag.

export interface AnonymousVisit {
  tag: string
  locale: string
  first_visit_at: string
  last_visit_at: string
  visit_count: number
}

// ── Database (Supabase generic constraint) ──────────────
// Every table that the application reads or writes appears here. Routes
// that pass `Database` to `createClient<Database>()` get full column-level
// type checking on `.select()`, `.eq()`, `.update()`, etc.

// JSON value type — Supabase serialises jsonb columns through this.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Supabase 2.50+ requires this metadata block on the Database type. Without
// it the typed client falls back to `never` for every Tables row, breaking
// every .select / .insert / .update call site (see supabase-js#1483).
// The PostgrestVersion string just needs to match the literal type the
// client checks against — '12' is what Vercel + Supabase prod currently
// runs with as of 2026-04.
export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      battles: {
        Row: Battle
        Insert: BattleInsert
        Update: Partial<BattleInsert>
        Relationships: []
      }
      sync_queue: {
        Row: SyncQueueRow
        Insert: { player_tag: string }
        Update: Partial<SyncQueueRow>
        Relationships: []
      }
      webhook_events: {
        Row: WebhookEvent
        Insert: { event_id: string; event_type: string }
        Update: Partial<WebhookEvent>
        Relationships: []
      }
      meta_stats: {
        Row: MetaStat
        Insert: MetaStatInsert
        Update: Partial<MetaStatInsert>
        Relationships: []
      }
      meta_matchups: {
        Row: MetaMatchup
        Insert: MetaMatchupInsert
        Update: Partial<MetaMatchupInsert>
        Relationships: []
      }
      meta_trios: {
        Row: MetaTrio
        Insert: MetaTrioInsert
        Update: Partial<MetaTrioInsert>
        Relationships: []
      }
      cron_heartbeats: {
        Row: CronHeartbeat
        Insert: CronHeartbeat
        Update: Partial<CronHeartbeat>
        Relationships: []
      }
      brawler_trends: {
        Row: BrawlerTrend
        Insert: BrawlerTrend
        Update: Partial<BrawlerTrend>
        Relationships: []
      }
      meta_poll_cursors: {
        Row: MetaPollCursor
        Insert: MetaPollCursor
        Update: { last_battle_time: string }
        Relationships: []
      }
      anonymous_visits: {
        Row: AnonymousVisit
        Insert: { tag: string; locale: string }
        Update: Partial<AnonymousVisit>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      // Functions exposed via PostgREST RPC. Only signatures we actually
      // call from the app are listed — drift here means TypeScript will
      // catch a missing/renamed argument before it hits prod.
      sum_meta_stats_total: {
        Args: { p_since: string; p_source?: string | null }
        Returns: number
      }
      sum_meta_stats_by_map_mode: {
        Args: { p_map: string; p_mode: string; p_source: string; p_since: string }
        Returns: number
      }
      compute_brawler_trends: {
        Args: Record<string, never>
        Returns: number
      }
      bulk_upsert_meta_stats: {
        Args: { rows: MetaStatInsert[] }
        Returns: null
      }
      bulk_upsert_meta_matchups: {
        Args: { rows: MetaMatchupInsert[] }
        Returns: null
      }
      bulk_upsert_meta_trios: {
        Args: { rows: MetaTrioInsert[] }
        Returns: null
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
