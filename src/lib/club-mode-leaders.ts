import type { MemberTrophyChange } from '@/hooks/useClubTrophyChanges'
import { isDraftMode } from './draft/constants'

/**
 * Per-mode club leaderboard derivation.
 *
 * Given the battlelogs already fetched by useClubTrophyChanges (each
 * member has up to 25 recent battles with mode + result + star-player
 * flag), aggregate per-mode statistics and identify the top player of
 * each mode. The top player is the member with the most WINS in that
 * mode (raw count — robust to tiny samples), tiebreaker is win rate.
 *
 * The hook already caches these battlelogs per member so this helper
 * is 100% derivation — no network, no side effects.
 *
 * Only 3v3 DRAFT modes are counted (gemGrab, brawlBall, knockout,
 * bounty, hotZone, heist, wipeout, brawlHockey, basketBrawl).
 */

export interface ModeLeader {
  /** The member ranked first for this mode */
  tag: string
  name: string
  /** Wins this member achieved in this mode (among the last ~25 battles) */
  wins: number
  /** Total battles this member played in this mode (losses + draws + wins) */
  total: number
  /** Win rate percentage 0-100 */
  winRate: number
}

export interface ClubModeEntry {
  mode: string
  /** Total battles played across the entire club in this mode */
  totalBattles: number
  /** Top-scoring member for this mode, or null if nobody has any wins */
  leader: ModeLeader | null
}

interface MemberModeStat {
  tag: string
  name: string
  wins: number
  losses: number
  draws: number
  total: number
}

/**
 * Aggregate all members' battlepoints into per-mode, per-member stats.
 * Returns a Map<mode, Map<memberTag, MemberModeStat>>.
 */
function aggregateByModeAndMember(
  members: MemberTrophyChange[],
): Map<string, Map<string, MemberModeStat>> {
  const byMode = new Map<string, Map<string, MemberModeStat>>()

  for (const member of members) {
    if (!member.loaded || member.battlePoints.length === 0) continue

    for (const bp of member.battlePoints) {
      const mode = bp.mode
      // Only track competitive 3v3 draft modes for the leader board
      if (!isDraftMode(mode)) continue

      if (!byMode.has(mode)) byMode.set(mode, new Map())
      const modeMap = byMode.get(mode)!

      const existing = modeMap.get(member.tag) ?? {
        tag: member.tag,
        name: member.name,
        wins: 0,
        losses: 0,
        draws: 0,
        total: 0,
      }
      existing.total++
      if (bp.result === 'victory') existing.wins++
      else if (bp.result === 'defeat') existing.losses++
      else existing.draws++
      modeMap.set(member.tag, existing)
    }
  }

  return byMode
}

/**
 * Compute the top N most-played modes by the club, each with its
 * leading member. Sorts modes by total battles descending; returns
 * up to `topN` entries (caller decides how many cards to show).
 *
 * A mode is only included if it has at least one battle in the last
 * 25 battlelogs of the club. The leader is null only if the mode has
 * battles but zero wins across the entire club — a very rare edge case
 * that still gets a card rendered with a "—" placeholder.
 */
export function computeClubModeLeaders(
  members: MemberTrophyChange[],
  topN = 6,
): ClubModeEntry[] {
  const byMode = aggregateByModeAndMember(members)

  const entries: ClubModeEntry[] = []
  for (const [mode, memberMap] of byMode) {
    let totalBattles = 0
    let leader: ModeLeader | null = null

    for (const stat of memberMap.values()) {
      totalBattles += stat.total
      if (stat.wins === 0) continue

      const winRate = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0
      if (
        !leader ||
        stat.wins > leader.wins ||
        (stat.wins === leader.wins && winRate > leader.winRate)
      ) {
        leader = { tag: stat.tag, name: stat.name, wins: stat.wins, total: stat.total, winRate }
      }
    }

    entries.push({ mode, totalBattles, leader })
  }

  // Sort by total battles descending — most-played modes first
  entries.sort((a, b) => b.totalBattles - a.totalBattles)

  return entries.slice(0, topN)
}
