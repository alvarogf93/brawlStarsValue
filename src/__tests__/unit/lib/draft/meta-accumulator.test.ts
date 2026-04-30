import { describe, it, expect } from 'vitest'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'

function makeAccumulators(): MetaAccumulators {
  return { stats: new Map(), matchups: new Map(), trios: new Map() }
}

function makeAccumulatorsWithTrios(): MetaAccumulators {
  return { stats: new Map(), matchups: new Map(), trios: new Map() }
}

describe('MetaAccumulators trios field', () => {
  it('initializes with an empty trios Map', () => {
    const acc = makeAccumulatorsWithTrios()
    expect(acc.trios).toBeInstanceOf(Map)
    expect(acc.trios.size).toBe(0)
  })

  it('trios Map accepts TrioAccumulator entries', () => {
    const acc = makeAccumulatorsWithTrios()
    const trioKey = '1|2|3|Hard Rock Mine|gemGrab'
    acc.trios.set(trioKey, {
      wins: 5,
      losses: 3,
      total: 8,
      ids: [1, 2, 3],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
    })

    const entry = acc.trios.get(trioKey)!
    expect(entry.wins).toBe(5)
    expect(entry.losses).toBe(3)
    expect(entry.total).toBe(8)
    expect(entry.ids).toEqual([1, 2, 3])
    expect(entry.map).toBe('Hard Rock Mine')
    expect(entry.mode).toBe('gemGrab')
  })

  it('processBattleForMeta still works after trios added to interface', () => {
    const acc = makeAccumulatorsWithTrios()
    processBattleForMeta(acc, {
      myBrawlerId: 1,
      opponentBrawlerIds: [10, 11, 12],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'victory',
    })

    expect(acc.stats.size).toBe(1)
    expect(acc.matchups.size).toBe(3)
    // trios are NOT populated by processBattleForMeta — cron does that separately
    expect(acc.trios.size).toBe(0)
  })
})

describe('processBattleForMeta', () => {
  it('accumulates a victory correctly', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: 1,
      opponentBrawlerIds: [10, 11, 12],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'victory',
    })

    // Check meta_stats accumulator
    const statKey = '1|Hard Rock Mine|gemGrab'
    const stat = acc.stats.get(statKey)!
    expect(stat.wins).toBe(1)
    expect(stat.losses).toBe(0)
    expect(stat.total).toBe(1)

    // Check meta_matchups accumulators (one per opponent)
    expect(acc.matchups.size).toBe(3)
    const m1 = acc.matchups.get('1|10|gemGrab')!
    expect(m1.wins).toBe(1)
    expect(m1.losses).toBe(0)
  })

  it('accumulates a defeat correctly', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: 5,
      opponentBrawlerIds: [20, 21, 22],
      map: 'Sneaky Fields',
      mode: 'brawlBall',
      result: 'defeat',
    })

    const statKey = '5|Sneaky Fields|brawlBall'
    const stat = acc.stats.get(statKey)!
    expect(stat.wins).toBe(0)
    expect(stat.losses).toBe(1)
    expect(stat.total).toBe(1)

    const m = acc.matchups.get('5|20|brawlBall')!
    expect(m.wins).toBe(0)
    expect(m.losses).toBe(1)
  })

  it('accumulates multiple battles for the same brawler/map', () => {
    const acc = makeAccumulators()
    const battle = {
      myBrawlerId: 1,
      opponentBrawlerIds: [10, 11, 12],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
    }

    processBattleForMeta(acc, { ...battle, result: 'victory' })
    processBattleForMeta(acc, { ...battle, result: 'victory' })
    processBattleForMeta(acc, { ...battle, result: 'defeat' })

    const stat = acc.stats.get('1|Hard Rock Mine|gemGrab')!
    expect(stat.wins).toBe(2)
    expect(stat.losses).toBe(1)
    expect(stat.total).toBe(3)
  })

  it('skips battles with null map', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: 1,
      opponentBrawlerIds: [10],
      map: null,
      mode: 'gemGrab',
      result: 'victory',
    })

    expect(acc.stats.size).toBe(0)
    expect(acc.matchups.size).toBe(0)
  })

  it('skips draws', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: 1,
      opponentBrawlerIds: [10],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'draw',
    })

    expect(acc.stats.size).toBe(0)
  })

  it('LOG-19: skips battles with sentinel myBrawlerId=0', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: 0, // fallback sentinel from `b.my_brawler?.id ?? 0`
      opponentBrawlerIds: [10],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'victory',
    })
    expect(acc.stats.size).toBe(0)
    expect(acc.matchups.size).toBe(0)
  })

  it('LOG-19: skips battles with negative myBrawlerId', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: -1,
      opponentBrawlerIds: [10],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'victory',
    })
    expect(acc.stats.size).toBe(0)
  })

  it('LOG-19: skips battles with non-finite myBrawlerId (NaN)', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: NaN,
      opponentBrawlerIds: [10],
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'victory',
    })
    expect(acc.stats.size).toBe(0)
  })

  it('LOG-19: drops sentinel opponents from matchups but keeps the brawler stat', () => {
    const acc = makeAccumulators()
    processBattleForMeta(acc, {
      myBrawlerId: 1,
      opponentBrawlerIds: [10, 0, -5, 20], // 0 and -5 dropped
      map: 'Hard Rock Mine',
      mode: 'gemGrab',
      result: 'victory',
    })
    expect(acc.stats.size).toBe(1) // brawler stat is recorded
    expect(acc.matchups.size).toBe(2) // only the 2 valid opponents
  })
})
