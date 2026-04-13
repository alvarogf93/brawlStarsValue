import { describe, it, expect } from 'vitest'
import { computeClubModeLeaders } from '@/lib/club-mode-leaders'
import type { MemberTrophyChange, BattlePoint } from '@/hooks/useClubTrophyChanges'

function bp(
  mode: string,
  result: 'victory' | 'defeat' | 'draw',
  map = 'test-map',
): BattlePoint {
  return { change: 0, cumulative: 0, result, mode, map, isStarPlayer: false }
}

function member(
  tag: string,
  name: string,
  battlePoints: BattlePoint[],
  loaded = true,
): MemberTrophyChange {
  return {
    tag, name, battlePoints, loaded,
    netChange: 0, totalBattles: battlePoints.length, progression: [],
  }
}

describe('computeClubModeLeaders — per-mode club leaderboard', () => {
  it('returns an empty array when no member has loaded battles', () => {
    const result = computeClubModeLeaders([])
    expect(result).toEqual([])
  })

  it('ignores members whose battlelog has not loaded yet', () => {
    const members = [member('#A', 'Alice', [bp('brawlBall', 'victory')], false)]
    expect(computeClubModeLeaders(members)).toEqual([])
  })

  it('picks the member with the most wins as the leader for a mode', () => {
    const members = [
      member('#A', 'Alice', [
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'defeat'),
      ]),
      member('#B', 'Bob', [
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'defeat'),
      ]),
    ]
    const result = computeClubModeLeaders(members)
    expect(result).toHaveLength(1)
    expect(result[0].mode).toBe('brawlBall')
    expect(result[0].leader?.name).toBe('Bob') // 3 wins > Alice's 2
    expect(result[0].leader?.wins).toBe(3)
    expect(result[0].leader?.total).toBe(4)
  })

  it('breaks ties on win count using win rate', () => {
    const members = [
      member('#A', 'Alice', [
        bp('gemGrab', 'victory'),
        bp('gemGrab', 'victory'),
        bp('gemGrab', 'defeat'),
        bp('gemGrab', 'defeat'),
      ]),
      member('#B', 'Bob', [
        bp('gemGrab', 'victory'),
        bp('gemGrab', 'victory'),
        bp('gemGrab', 'defeat'),
      ]),
    ]
    // Both have 2 wins; Bob has 2/3 = 66.7% WR, Alice has 2/4 = 50% WR
    const result = computeClubModeLeaders(members)
    expect(result[0].leader?.name).toBe('Bob')
  })

  it('sorts returned modes by total club battles in that mode, descending', () => {
    const members = [
      member('#A', 'Alice', [
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'defeat'),
        bp('brawlBall', 'victory'),
        bp('gemGrab', 'victory'),
      ]),
      member('#B', 'Bob', [
        bp('brawlBall', 'victory'),
        bp('knockout', 'victory'),
      ]),
    ]
    const result = computeClubModeLeaders(members)
    // brawlBall = 4 battles (most), gemGrab = 1, knockout = 1
    expect(result[0].mode).toBe('brawlBall')
    expect(result[0].totalBattles).toBe(4)
    // Second and third are both 1 battle — order between them is
    // stable but not specified; assert both are present
    const restModes = result.slice(1).map(e => e.mode).sort()
    expect(restModes).toEqual(['gemGrab', 'knockout'])
  })

  it('caps the result length at topN', () => {
    const battles: BattlePoint[] = [
      bp('brawlBall', 'victory'),
      bp('gemGrab', 'victory'),
      bp('knockout', 'victory'),
      bp('bounty', 'victory'),
      bp('heist', 'victory'),
      bp('hotZone', 'victory'),
      bp('wipeout', 'victory'),
      bp('brawlHockey', 'victory'),
      bp('basketBrawl', 'victory'),
    ]
    const members = [member('#A', 'Alice', battles)]
    const result = computeClubModeLeaders(members, 6)
    expect(result).toHaveLength(6)
  })

  it('excludes non-draft modes from the leaderboard', () => {
    const members = [
      member('#A', 'Alice', [
        bp('brawlBall', 'victory'),
        bp('showdown', 'victory'),       // not a draft mode
        bp('duoShowdown', 'victory'),    // not a draft mode
        bp('duels', 'victory'),          // not a draft mode
      ]),
    ]
    const result = computeClubModeLeaders(members)
    expect(result.map(e => e.mode)).toEqual(['brawlBall'])
  })

  it('returns a mode with leader=null when the club has battles but zero wins', () => {
    const members = [
      member('#A', 'Alice', [
        bp('brawlBall', 'defeat'),
        bp('brawlBall', 'defeat'),
      ]),
    ]
    const result = computeClubModeLeaders(members)
    expect(result).toHaveLength(1)
    expect(result[0].mode).toBe('brawlBall')
    expect(result[0].totalBattles).toBe(2)
    expect(result[0].leader).toBeNull()
  })

  it('produces a realistic club scenario with multiple members and multiple modes', () => {
    const members = [
      member('#A', 'Alice', [
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'victory'),
        bp('brawlBall', 'defeat'),
        bp('gemGrab', 'victory'),
        bp('knockout', 'defeat'),
      ]),
      member('#B', 'Bob', [
        bp('brawlBall', 'defeat'),
        bp('gemGrab', 'victory'),
        bp('gemGrab', 'victory'),
        bp('gemGrab', 'victory'),
        bp('knockout', 'victory'),
      ]),
      member('#C', 'Carol', [
        bp('knockout', 'victory'),
        bp('knockout', 'victory'),
        bp('bounty', 'victory'),
      ]),
    ]
    const result = computeClubModeLeaders(members)
    // brawlBall: 4 battles (Alice leads w/ 2 wins)
    // gemGrab: 4 battles (Bob leads w/ 3 wins)
    // knockout: 4 battles (Carol leads w/ 2 wins)
    // bounty: 1 battle (Carol leads w/ 1 win)
    expect(result.find(e => e.mode === 'brawlBall')?.leader?.name).toBe('Alice')
    expect(result.find(e => e.mode === 'gemGrab')?.leader?.name).toBe('Bob')
    expect(result.find(e => e.mode === 'knockout')?.leader?.name).toBe('Carol')
    expect(result.find(e => e.mode === 'bounty')?.leader?.name).toBe('Carol')
  })
})
