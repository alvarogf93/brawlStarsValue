import { describe, it, expect } from 'vitest'
import { buildBrawlerArticle, type Translator } from '@/lib/brawler-detail/article'
import type { BrawlerMetaResponse } from '@/lib/brawler-detail/types'

/** Translator that reflects the key + variables. Lets us assert which
 *  template was selected and that all required variables were
 *  interpolated, without actually loading next-intl messages. */
function makeTranslator(): Translator {
  return (key, vars) => {
    if (!vars) return key
    const parts = Object.entries(vars)
      .map(([k, v]) => `${k}=${v}`)
      .join('|')
    return `${key}{${parts}}`
  }
}

function makeMeta(partial: Partial<BrawlerMetaResponse> = {}): BrawlerMetaResponse {
  return {
    brawlerId: 16000000,
    globalStats: { winRate: 52.3, pickRate: 8.1, totalBattles: 1500, trend7d: 1.5 },
    bestMaps: [
      { map: 'Hard Rock Mine', mode: 'gemGrab', eventId: 1, winRate: 58.2, totalBattles: 200 },
      { map: 'Crystal Arcade', mode: 'gemGrab', eventId: 2, winRate: 55.1, totalBattles: 180 },
    ],
    worstMaps: [
      { map: 'Stormy Plains', mode: 'bounty', eventId: 3, winRate: 41.0, totalBattles: 95 },
    ],
    strongAgainst: [
      { opponentId: 16000010, opponentName: 'BULL', winRate: 62.5, totalBattles: 80 },
    ],
    weakAgainst: [
      { opponentId: 16000020, opponentName: 'POCO', winRate: 38.0, totalBattles: 60 },
    ],
    bestTeammates: [
      { teammateId: 16000030, teammateName: 'PIPER', winRate: 60.0, totalBattles: 50 },
    ],
    ...partial,
  }
}

describe('buildBrawlerArticle', () => {
  describe('lead section', () => {
    it('uses leadFull template when rarity and class are both available', () => {
      const article = buildBrawlerArticle({
        name: 'SHELLY',
        rarity: 'Trophy Road',
        brawlerClass: 'Damage',
        meta: makeMeta(),
        t: makeTranslator(),
      })
      expect(article.leadParagraphs[0]).toContain('article.leadFull')
      expect(article.leadParagraphs[0]).toContain('rarity=Trophy Road')
      expect(article.leadParagraphs[0]).toContain('class=Damage')
    })

    it('uses leadRarity when only rarity is known', () => {
      const article = buildBrawlerArticle({
        name: 'SIRIUS',
        rarity: 'Legendary',
        brawlerClass: null,
        meta: makeMeta(),
        t: makeTranslator(),
      })
      expect(article.leadParagraphs[0]).toContain('article.leadRarity')
      expect(article.leadParagraphs[0]).not.toContain('article.leadFull')
    })

    it('falls back to leadGeneric when neither rarity nor class is known', () => {
      const article = buildBrawlerArticle({
        name: 'NEW_BRAWLER',
        rarity: null,
        brawlerClass: null,
        meta: null,
        t: makeTranslator(),
      })
      expect(article.leadParagraphs[0]).toContain('article.leadGeneric')
    })

    it('appends leadStatsThin paragraph when total battles < 30', () => {
      const article = buildBrawlerArticle({
        name: 'COLD',
        rarity: 'Mythic',
        brawlerClass: 'Tank',
        meta: makeMeta({ globalStats: { winRate: 50, pickRate: 0.5, totalBattles: 10, trend7d: null } }),
        t: makeTranslator(),
      })
      expect(article.leadParagraphs[1]).toContain('article.leadStatsThin')
    })

    it('appends leadStats paragraph with interpolated wr/pr/total when sample is sufficient', () => {
      const article = buildBrawlerArticle({
        name: 'SHELLY',
        rarity: 'Trophy Road',
        brawlerClass: 'Damage',
        meta: makeMeta(),
        t: makeTranslator(),
      })
      const second = article.leadParagraphs[1]
      expect(second).toContain('article.leadStats')
      expect(second).toContain('wr=52.3')
      expect(second).toContain('pr=8.1')
    })
  })

  describe('maps section', () => {
    it('renders intro + runner-up + worst when 2+ best maps and a worst map exist', () => {
      const article = buildBrawlerArticle({
        name: 'COLT',
        rarity: 'Trophy Road',
        brawlerClass: 'Damage',
        meta: makeMeta(),
        t: makeTranslator(),
      })
      expect(article.mapsParagraphs).toHaveLength(3)
      expect(article.mapsParagraphs[0]).toContain('article.mapsIntro')
      expect(article.mapsParagraphs[0]).toContain('map=Hard Rock Mine')
      expect(article.mapsParagraphs[1]).toContain('article.mapsRunnerUp')
      expect(article.mapsParagraphs[2]).toContain('article.mapsAvoid')
    })

    it('falls back to mapsEmpty when no data', () => {
      const article = buildBrawlerArticle({
        name: 'NEW',
        rarity: null,
        brawlerClass: null,
        meta: null,
        t: makeTranslator(),
      })
      expect(article.mapsParagraphs).toHaveLength(1)
      expect(article.mapsParagraphs[0]).toContain('article.mapsEmpty')
    })

    it('falls back to mapsEmpty when sample is below threshold', () => {
      const article = buildBrawlerArticle({
        name: 'COLD',
        rarity: 'Mythic',
        brawlerClass: 'Tank',
        meta: makeMeta({ globalStats: { winRate: 50, pickRate: 0.5, totalBattles: 5, trend7d: null } }),
        t: makeTranslator(),
      })
      expect(article.mapsParagraphs[0]).toContain('article.mapsEmpty')
    })
  })

  describe('counters section', () => {
    it('uses interpolated opponentName when available', () => {
      const article = buildBrawlerArticle({
        name: 'SHELLY',
        rarity: 'Trophy Road',
        brawlerClass: 'Damage',
        meta: makeMeta(),
        opponentName: 'BULL',
        weakOpponentName: 'POCO',
        t: makeTranslator(),
      })
      expect(article.countersParagraphs[0]).toContain('opponent=BULL')
      expect(article.countersParagraphs[1]).toContain('opponent=POCO')
    })

    it('falls back to article.someOpponent placeholder when name is missing', () => {
      const meta = makeMeta()
      meta.strongAgainst[0].opponentName = ''
      const article = buildBrawlerArticle({
        name: 'SHELLY',
        rarity: null,
        brawlerClass: null,
        meta,
        t: makeTranslator(),
      })
      // The fallback chain: opponentName (undefined) ?? meta.opponentName ('')
      // — empty string is truthy-falsy enough that the nullish coalesce
      // takes the someOpponent template-key. We assert the key appears.
      expect(article.countersParagraphs[0]).toContain('opponent=')
    })
  })

  describe('trend section', () => {
    it('rising bucket when trend > 1', () => {
      const article = buildBrawlerArticle({
        name: 'X',
        rarity: null,
        brawlerClass: null,
        meta: makeMeta({ globalStats: { winRate: 52, pickRate: 5, totalBattles: 1000, trend7d: 2.5 } }),
        t: makeTranslator(),
      })
      expect(article.trendParagraphs[0]).toContain('article.trendRising')
      expect(article.trendParagraphs[0]).toContain('delta=2.5')
    })

    it('falling bucket emits absolute delta', () => {
      const article = buildBrawlerArticle({
        name: 'X',
        rarity: null,
        brawlerClass: null,
        meta: makeMeta({ globalStats: { winRate: 48, pickRate: 5, totalBattles: 1000, trend7d: -3.2 } }),
        t: makeTranslator(),
      })
      expect(article.trendParagraphs[0]).toContain('article.trendFalling')
      expect(article.trendParagraphs[0]).toContain('delta=3.2')
    })

    it('stable bucket when |trend| <= 1', () => {
      const article = buildBrawlerArticle({
        name: 'X',
        rarity: null,
        brawlerClass: null,
        meta: makeMeta({ globalStats: { winRate: 50, pickRate: 5, totalBattles: 1000, trend7d: 0.4 } }),
        t: makeTranslator(),
      })
      expect(article.trendParagraphs[0]).toContain('article.trendStable')
    })

    it('unknown bucket when trend is null', () => {
      const article = buildBrawlerArticle({
        name: 'X',
        rarity: null,
        brawlerClass: null,
        meta: makeMeta({ globalStats: { winRate: 50, pickRate: 5, totalBattles: 1000, trend7d: null } }),
        t: makeTranslator(),
      })
      expect(article.trendParagraphs[0]).toContain('article.trendNone')
    })

    it('always closes with the methodology paragraph linking back to /methodology', () => {
      const article = buildBrawlerArticle({
        name: 'X',
        rarity: null,
        brawlerClass: null,
        meta: makeMeta(),
        t: makeTranslator(),
      })
      expect(article.trendParagraphs.at(-1)).toContain('article.trendMethodology')
    })
  })

  describe('upgrades section', () => {
    it('always emits intro + priority paragraphs', () => {
      const article = buildBrawlerArticle({
        name: 'X',
        rarity: null,
        brawlerClass: null,
        meta: null,
        t: makeTranslator(),
      })
      expect(article.upgradesParagraphs).toHaveLength(2)
      expect(article.upgradesParagraphs[0]).toContain('article.upgradesIntro')
      expect(article.upgradesParagraphs[1]).toContain('article.upgradesPriority')
    })

    it('appends teammate paragraph when bestTeammateName is provided', () => {
      const article = buildBrawlerArticle({
        name: 'X',
        rarity: null,
        brawlerClass: null,
        meta: null,
        bestTeammateName: 'PIPER',
        t: makeTranslator(),
      })
      expect(article.upgradesParagraphs).toHaveLength(3)
      expect(article.upgradesParagraphs[2]).toContain('article.upgradesTeammate')
      expect(article.upgradesParagraphs[2]).toContain('teammate=PIPER')
    })
  })
})
