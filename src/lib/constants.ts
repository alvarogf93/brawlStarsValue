import type { BrawlerRarityName, RarityMap } from './types'

export const PLAYER_TAG_REGEX = /^#[0-9A-Z]{3,20}$/i

/**
 * Real gem cost per power level — based on actual in-game upgrade costs.
 * Source: Power Points + Coins totals, converted at 300 coins = 30 gems (1:0.1 ratio).
 */
export const POWER_LEVEL_GEM_COST: Record<number, number> = {
  1: 0,
  2: 4,
  3: 11,
  4: 23,
  5: 45,
  6: 87,
  7: 156,
  8: 270,
  9: 450,
  10: 727,
  11: 1151,
}

/** Real gem costs per upgrade item — verified from in-game data */
export const GEM_COSTS = {
  /** 1000 coins = 100 gems */
  gadget: 100,
  /** 2000 coins = 200 gems */
  starPower: 200,
  /** 5000 coins = 500 gems */
  hypercharge: 500,
  /** 1000 coins + 2000 PP = 300 gems */
  buffie: 300,
  /** 1000 coins = 100 gems */
  gear: 100,
} as const

/** Per-brawler maxes for upgrade slots that are NOT returned by the
 *  Supercell /brawlers endpoint. Multiplied by the live brawler count
 *  from useBrawlerRegistry() to compute completion denominators. */
export const PER_BRAWLER_MAX = {
  /** 6 gear slots per brawler (verified in-game as of April 2026) */
  gears: 6,
  /** Each brawler can have up to 1 hypercharge once released */
  hypercharges: 1,
} as const

/**
 * Buffies in Brawl Stars are:
 *  - 3 "regular" slots per brawler (gadget, star power, hypercharge)
 *  - +1 extra slot bought with Blins (currency)
 *
 * As of April 2026, only a subset of brawlers have any buffies
 * released. This constant tracks the GAME-WIDE max buffies currently
 * unlockable — bump it up when Supercell releases more.
 *
 * Current count (April 2026): 12 brawlers have buffies released,
 * giving us 12 × 3 = 36 regular-slot buffies in the wild. The +1
 * Blins buffy type is NOT yet tracked in the data pipeline (the
 * `BrawlerStat.buffies` shape only has gadget/SP/HC), so it is
 * excluded from this max until the model is extended.
 */
export const CURRENT_MAX_BUFFIES = 36

/** Trophy road cap — the highest trophy total a player can reach
 *  on the current season. Used to normalize the trophy road bar. */
export const TROPHY_ROAD_MAX = 100_000

/**
 * Skin gem prices by rarity tier.
 * Users classify their own skins — the API doesn't expose skin rarity.
 */
export const SKIN_TIER_PRICES: Record<string, number> = {
  none: 0,
  special: 29,
  superSpecial: 79,
  epic: 149,
  mythic: 199,
  legendary: 299,
  hypercharge: 700,
}

export const SKIN_TIER_LABELS: Record<string, Record<string, string>> = {
  es: { none: 'Sin clasificar', special: 'Especial (29💎)', superSpecial: 'Superespecial (79💎)', epic: 'Épica (149💎)', mythic: 'Mítica (199💎)', legendary: 'Legendaria (299💎)', hypercharge: 'Hipercarga (700💎)' },
  en: { none: 'Unclassified', special: 'Special (29💎)', superSpecial: 'Super Special (79💎)', epic: 'Epic (149💎)', mythic: 'Mythic (199💎)', legendary: 'Legendary (299💎)', hypercharge: 'Hypercharge (700💎)' },
}

/** Pin (reaction) gem prices by rarity tier */
export const PIN_TIER_PRICES: Record<string, number> = {
  pinSpecial: 19,
  pinEpic: 39,
  pinCollector: 29,
}

export const PIN_TIER_LABELS: Record<string, Record<string, string>> = {
  es: { pinSpecial: 'Especiales', pinEpic: 'Épicas', pinCollector: 'Coleccionista' },
  en: { pinSpecial: 'Special', pinEpic: 'Epic', pinCollector: 'Collector' },
}

/** Centralized display names for game modes (universal game terms, not translated) */
export const MODE_DISPLAY_NAMES: Record<string, string> = {
  gemGrab: 'Gem Grab', heist: 'Heist', bounty: 'Bounty', brawlBall: 'Brawl Ball',
  hotZone: 'Hot Zone', knockout: 'Knockout', wipeout: 'Wipeout',
  brawlHockey: 'Brawl Hockey', basketBrawl: 'Basket Brawl',
  soloShowdown: 'Solo SD', duoShowdown: 'Duo SD',
}

/** Canonical rarity → color map for UI badges, borders, etc. */
export const RARITY_COLORS: Record<BrawlerRarityName, string> = {
  'Trophy Road': '#95A5A6',
  'Rare': '#27AE60',
  'Super Rare': '#3498DB',
  'Epic': '#8E44AD',
  'Mythic': '#E74C3C',
  'Legendary': '#F39C12',
  'Chromatic': '#E91E63',
  'Ultra Legendary': '#FFD700',
}

/** Average match duration in minutes for time-played estimation */
export const AVG_MATCH_MINUTES = 2

/** Estimated global win rate — 3v3 is zero-sum (50%), showdown varies */
export const ESTIMATED_WIN_RATE = 0.5

/**
 * Brawler ID → Rarity. Maintained manually — API does NOT expose rarity.
 * Source: in-game data, community wikis. Generated April 2026, 101 brawlers.
 */
export const BRAWLER_RARITY_MAP: RarityMap = {
  16000000: 'Trophy Road',
  16000001: 'Rare',
  16000002: 'Rare',
  16000003: 'Rare',
  16000004: 'Super Rare',
  16000005: 'Legendary',
  16000006: 'Super Rare',
  16000007: 'Super Rare',
  16000008: 'Rare',
  16000009: 'Super Rare',
  16000010: 'Rare',
  16000011: 'Mythic',
  16000012: 'Legendary',
  16000013: 'Rare',
  16000014: 'Epic',
  16000015: 'Epic',
  16000016: 'Epic',
  16000017: 'Mythic',
  16000018: 'Super Rare',
  16000019: 'Super Rare',
  16000020: 'Epic',
  16000021: 'Mythic',
  16000022: 'Super Rare',
  16000023: 'Legendary',
  16000024: 'Rare',
  16000025: 'Super Rare',
  16000026: 'Epic',
  16000027: 'Super Rare',
  16000028: 'Legendary',
  16000029: 'Epic',
  16000030: 'Epic',
  16000031: 'Mythic',
  16000032: 'Mythic',
  16000034: 'Super Rare',
  16000035: 'Chromatic',
  16000036: 'Epic',
  16000037: 'Mythic',
  16000038: 'Chromatic',
  16000039: 'Chromatic',
  16000040: 'Legendary',
  16000041: 'Chromatic',
  16000042: 'Mythic',
  16000043: 'Epic',
  16000044: 'Chromatic',
  16000045: 'Epic',
  16000046: 'Chromatic',
  16000047: 'Mythic',
  16000048: 'Epic',
  16000049: 'Chromatic',
  16000050: 'Epic',
  16000051: 'Epic',
  16000052: 'Legendary',
  16000053: 'Chromatic',
  16000054: 'Chromatic',
  16000056: 'Chromatic',
  16000057: 'Chromatic',
  16000058: 'Chromatic',
  16000059: 'Chromatic',
  16000060: 'Chromatic',
  16000061: 'Epic',
  16000062: 'Chromatic',
  16000063: 'Legendary',
  16000064: 'Mythic',
  16000065: 'Chromatic',
  16000066: 'Chromatic',
  16000067: 'Mythic',
  16000068: 'Chromatic',
  16000069: 'Epic',
  16000070: 'Mythic',
  16000071: 'Chromatic',
  16000072: 'Chromatic',
  16000073: 'Chromatic',
  16000074: 'Mythic',
  16000075: 'Mythic',
  16000076: 'Legendary',
  16000077: 'Chromatic',
  16000078: 'Chromatic',
  16000079: 'Chromatic',
  16000080: 'Legendary',
  16000081: 'Legendary',
  16000082: 'Chromatic',
  16000083: 'Chromatic',
  16000084: 'Chromatic',
  16000085: 'Legendary',
  16000086: 'Mythic',
  16000087: 'Mythic',
  16000089: 'Chromatic',
  16000090: 'Chromatic',
  16000091: 'Chromatic',
  16000092: 'Epic',
  16000093: 'Chromatic',
  16000094: 'Mythic',
  16000095: 'Chromatic',
  16000096: 'Chromatic',
  16000097: 'Epic',
  16000098: 'Chromatic',
  16000099: 'Legendary',
  16000100: 'Chromatic',
  16000101: 'Mythic',
  16000102: 'Ultra Legendary',
  16000103: 'Mythic',
}