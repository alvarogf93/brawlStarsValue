// ── Advanced Analytics Type Definitions ─────────────────────────

/** Minimum games to show a statistic (1 = show everything, let Wilson score rank) */
export const MIN_GAMES = 1
/** Lower threshold for teammate/synergy stats */
export const MIN_GAMES_SOFT = 1
/** Minimum games for "reliable" confidence badge in UI */
export const RELIABLE_GAMES = 10
/** Minimum games for "medium" confidence in UI */
export const CONFIDENT_GAMES = 3

/** Confidence level based on sample size */
export type Confidence = 'low' | 'medium' | 'high'

/** Returns confidence level for a given game count */
export function getConfidence(total: number): Confidence {
  if (total >= RELIABLE_GAMES) return 'high'
  if (total >= CONFIDENT_GAMES) return 'medium'
  return 'low'
}

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
  confidence: Confidence
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
  confidence: Confidence
}

export interface BrawlerModeEntry {
  brawlerId: number
  brawlerName: string
  mode: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
  confidence: Confidence
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
  confidence: Confidence
}

// ── Team synergy ────────────────────────────────────────────────

export interface TeammateSynergy {
  tag: string
  name: string
  wins: number
  total: number
  winRate: number
  wilsonScore: number
  confidence: Confidence
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
  confidence: Confidence
}

export interface TrioSynergy {
  brawlers: Array<{ id: number; name: string }>
  wins: number
  total: number
  winRate: number
  wilsonScore: number
  confidence: Confidence
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
  bestTrio: { brawlers: Array<{ id: number; name: string }>; winRate: number; total: number } | null
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

// ── New metrics ────────────────────────────────────────────────

export interface ClutchAnalysis {
  wrAsStar: number | null
  wrNotStar: number | null
  starGames: number
  nonStarGames: number
  delta: number | null
}

export interface OpponentStrengthBreakdown {
  tier: 'weak' | 'even' | 'strong'
  wins: number
  total: number
  winRate: number
  avgOpponentTrophies: number
}

export interface BrawlerComfort {
  brawlerId: number
  brawlerName: string
  comfortScore: number
  gamesPlayed: number
  winRate: number
  wilsonScore: number
  consistency: number
}

export interface PowerLevelImpact {
  powerLevel: number
  wins: number
  total: number
  winRate: number
}

export interface SessionEfficiency {
  sessionLength: number
  count: number
  avgWinRate: number
  avgTrophiesPerGame: number
}

export interface WarmUpAnalysis {
  warmUpWR: number | null
  peakWR: number | null
  warmUpGames: number
  peakGames: number
  delta: number | null
}

export interface CarryAnalysis {
  carryWR: number | null
  normalWR: number | null
  carryGames: number
  normalGames: number
}

export interface GadgetStarPowerImpact {
  withGadgets: { wins: number; total: number; winRate: number }
  withoutGadgets: { wins: number; total: number; winRate: number }
  withStarPowers: { wins: number; total: number; winRate: number }
  withoutStarPowers: { wins: number; total: number; winRate: number }
}

export interface RecoveryAnalysis {
  avgGamesToRecover: number | null
  recoveryEpisodes: number
  successRate: number | null
}

export interface WeeklyPattern {
  dayOfWeek: number
  dayName: string
  wins: number
  total: number
  winRate: number
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
  trioSynergy: TrioSynergy[]
  teammateSynergy: TeammateSynergy[]
  byHour: HourPerformance[]
  dailyTrend: DailyTrend[]
  brawlerMastery: BrawlerMastery[]
  tilt: TiltAnalysis
  sessions: SessionInfo[]
  // New metrics
  clutch: ClutchAnalysis
  opponentStrength: OpponentStrengthBreakdown[]
  brawlerComfort: BrawlerComfort[]
  powerLevelImpact: PowerLevelImpact[]
  sessionEfficiency: SessionEfficiency[]
  warmUp: WarmUpAnalysis
  carry: CarryAnalysis
  gadgetImpact: GadgetStarPowerImpact
  recovery: RecoveryAnalysis
  weeklyPattern: WeeklyPattern[]
}
