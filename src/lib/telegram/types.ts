// Shared types for the Telegram bot (Sprint B).
// The `Queries` interface lives here (not in queries.ts) to avoid a
// circular import between commands/*.ts (which use Queries) and
// queries.ts (which implements it).

// ── Telegram API subset ────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  chat: { id: number | string; type: string }
  from?: { id: number; username?: string }
  text?: string
  date: number
}

// ── Command layer ──────────────────────────────────────────────

export interface CommandContext {
  args: string[]
  queries: Queries
}

export type CommandHandler = (ctx: CommandContext) => Promise<string>

// ── Query return shapes ────────────────────────────────────────

export interface StatsData {
  totalUsers: number
  premiumCount: number
  trialCount: number
  anonCount30d: number
  anonSparkline: number[]    // length 7
  totalBattles: number
  battlesToday: number
  battleSparkline: number[]  // length 7
  metaRowsToday: number
  metaRowsTotal: number
  activeCursors: number
  staleCursors: number
  latestMetaActivity: string | null  // ISO timestamp
  top3Maps: Array<{ map: string; mode: string; battles: number }>
  top3Brawlers: Array<{ brawlerId: number; winRate: number; total: number }>
}

export interface BattlesData {
  total: number
  today: number
  yesterday: number
  last7d: number
  last30d: number
  sparkline14d: number[]
  modeDistribution: Array<{ mode: string; count: number; pct: number }>
  resultDistribution: Array<{ result: 'victory' | 'defeat' | 'draw'; count: number; pct: number }>
  topPlayers: Array<{ tag: string; count: number }>
  lastSuccessfulSyncAt: string | null  // ISO
  queuePending: number
}

export interface PremiumData {
  premiumActive: number
  trialActive: number
  freeUsers: number
  signupsLast30d: number
  trialsActivatedLast30d: number
  trialToPremiumLast30d: number
  trialsExpiredLast30d: number
  upcomingRenewals7d: null
  ltvTotal: null
}

export type FreshnessStatus = 'fresh' | 'stale' | 'dead' | 'unknown'

export interface PgCronJob {
  jobid: number
  jobname: string
  schedule: string
  active: boolean
  command: string
}

export interface PgCronRun {
  jobid: number
  jobname: string
  status: string           // 'succeeded' | 'failed' | other
  return_message: string | null
  start_time: string       // ISO
  end_time: string | null  // ISO
}

export interface CronData {
  pgCronJobs: PgCronJob[]
  cronRuns: PgCronRun[]
  runsByJob: Map<string, number>              // job name → count in last 24h
  metaPollFreshness: { ageMs: number | null; status: FreshnessStatus }
  syncFreshness: { ageMs: number | null; status: FreshnessStatus }
}

export interface MapListItem {
  map: string
  mode: string
  battles: number
  brawlerCount: number
}

export type MapMatchResult =
  | { kind: 'none' }
  | { kind: 'found'; map: string; mode: string }
  | { kind: 'ambiguous'; candidates: Array<{ map: string; mode: string }> }

export interface MapData {
  map: string
  mode: string
  battlesToday: number
  battlesLast7d: number
  brawlerCovered: number
  brawlerTotal: number
  sparkline7d: number[]
  topWinRates: Array<{ brawlerId: number; winRate: number; total: number }>
  bottomWinRates: Array<{ brawlerId: number; winRate: number; total: number }>
  sameModeComparison: Array<{ map: string; battles: number }>
  lastCursorUpdate: string | null  // ISO
}

// ── Queries interface (implemented by queries.ts) ──────────────

export interface Queries {
  getStats(): Promise<StatsData>
  getBattles(): Promise<BattlesData>
  getPremium(): Promise<PremiumData>
  getCronStatus(): Promise<CronData>
  getMapList(): Promise<MapListItem[]>
  findMapByPrefix(prefix: string): Promise<MapMatchResult>
  getMapData(map: string, mode: string): Promise<MapData>
}
