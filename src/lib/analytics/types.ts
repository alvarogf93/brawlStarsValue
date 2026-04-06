// ── Advanced Analytics Type Definitions ─────────────────────────

/** Minimum games required to show a statistic */
export const MIN_GAMES = 3
/** Lower threshold for teammate/synergy stats (hard to repeat with randoms) */
export const MIN_GAMES_SOFT = 2
/** Minimum games for "reliable" confidence badge */
export const RELIABLE_GAMES = 10

// ── Per-entity performance ──────────────────────────────────────

export interface BrawlerPerformance {
  id: number
  name: string
  wins: number
  losses: number
  draws: number
  total: number
  winRate: number            // raw percentage 0-100
  wilsonScore: number        // Wilson lower bound for ranking
  starPlayerCount: number
  starPlayerRate: number
  avgTrophyChange: number
  avgDuration: number | null // seconds
}

export interface ModePerformance {
  mode: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
}

export interface MapPerformance {
  map: string
  mode: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
}

// ── Cross-reference matrices ────────────────────────────────────

export interface BrawlerMapEntry {
  brawlerId: number
  brawlerName: string
  map: string
  mode: string
  eventId: number | null
  wins: number
  total: number
  winRate: number
  wilsonScore: number
}

export interface BrawlerModeEntry {
  brawlerId: number
  brawlerName: string
  mode: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
}

// ── Matchup analysis ────────────────────────────────────────────

export interface MatchupEntry {
  myBrawlerId: number
  myBrawlerName: string
  opponentBrawlerId: number
  opponentBrawlerName: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
}

// ── Team synergy ────────────────────────────────────────────────

export interface TeammateSynergy {
  tag: string
  name: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
  bestMode: string | null
  bestModeWR: number | null
}

export interface BrawlerSynergy {
  myBrawlerId: number
  myBrawlerName: string
  teammateBrawlerId: number
  teammateBrawlerName: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
}

// ── Time & trends ───────────────────────────────────────────────

export interface HourPerformance {
  hour: number  // 0-23
  wins: number
  total: number
  winRate: number
}

export interface DailyTrend {
  date: string  // YYYY-MM-DD
  wins: number
  total: number
  winRate: number
  trophyChange: number
  cumulativeTrophies: number
}

export interface BrawlerMastery {
  brawlerId: number
  brawlerName: string
  points: MasteryPoint[]
}

export interface MasteryPoint {
  date: string
  wins: number
  total: number
  winRate: number          // rolling WR up to this date
  cumulativeWins: number
  cumulativeTotal: number
}

// ── Streaks & tilt ──────────────────────────────────────────────

export interface StreakInfo {
  currentType: 'win' | 'loss' | 'none'
  currentCount: number
  longestWin: number
  longestLoss: number
}

export interface TiltAnalysis {
  /** WR after 3+ consecutive losses within a session */
  wrAfterTilt: number | null
  /** WR in normal play (not tilted) */
  wrNormal: number | null
  /** Number of tilt episodes */
  tiltEpisodes: number
  /** Average games played after entering tilt */
  avgGamesInTilt: number
  /** Suggestion based on data */
  shouldStop: boolean
}

export interface SessionInfo {
  start: string
  end: string
  battles: number
  wins: number
  winRate: number
  trophyChange: number
}

// ── Recommendations ─────────────────────────────────────────────

export interface PlayNowRecommendation {
  map: string
  mode: string
  eventId: number
  slotEndTime: string
  recommendations: BrawlerRecommendation[]
}

export interface BrawlerRecommendation {
  brawlerId: number
  brawlerName: string
  winRate: number
  gamesPlayed: number
  wilsonScore: number
  bestTeammateBrawler: string | null
  bestTeammateWR: number | null
}

export interface CounterPickResult {
  brawlerId: number
  brawlerName: string
  winRate: number
  gamesPlayed: number
  wilsonScore: number
  /** WR against each of the specified opponent brawlers */
  vsBreakdown: Array<{
    opponentName: string
    wins: number
    total: number
    winRate: number
  }>
}

// ── Top-level aggregate ─────────────────────────────────────────

export interface AdvancedAnalytics {
  overview: {
    totalBattles: number
    overallWinRate: number
    totalWins: number
    trophyChange: number
    starPlayerCount: number
    starPlayerRate: number
    avgDuration: number | null
    streak: StreakInfo
  }
  byBrawler: BrawlerPerformance[]
  byMode: ModePerformance[]
  byMap: MapPerformance[]
  brawlerMapMatrix: BrawlerMapEntry[]
  brawlerModeMatrix: BrawlerModeEntry[]
  matchups: MatchupEntry[]
  brawlerSynergy: BrawlerSynergy[]
  teammateSynergy: TeammateSynergy[]
  byHour: HourPerformance[]
  dailyTrend: DailyTrend[]
  brawlerMastery: BrawlerMastery[]
  tilt: TiltAnalysis
  sessions: SessionInfo[]
}
