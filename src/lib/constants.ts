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

/** Real gem costs per unlock/upgrade item */
export const GEM_COSTS = {
  /** 1000 coins = 100 gems */
  gadget: 100,
  /** 2000 coins = 200 gems */
  starPower: 200,
  /** 5000 coins = 500 gems */
  hypercharge: 500,
  /** 1000 coins + 2000 PP = 300 gems */
  buffie: 300,
  /** Conservative average for non-default equipped skin (real: 29–700) */
  skin: 79,
} as const

/** Approximate gem cost to unlock a brawler by rarity (shop equivalent) */
export const RARITY_UNLOCK_COST: Record<BrawlerRarityName, number> = {
  'Trophy Road': 0,
  'Rare': 30,
  'Super Rare': 80,
  'Epic': 170,
  'Mythic': 350,
  'Legendary': 700,
  'Chromatic': 170,
  'Ultra Legendary': 1000,
}

/** Average match duration in minutes for time-played estimation */
export const AVG_MATCH_MINUTES = 2

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

export const SEO = {
  title: '¿Cuánto poder tiene tu cuenta de Brawl Stars?',
  description: 'Calcula el valor real en Gemas de tu cuenta de Brawl Stars. Resultado instantáneo.',
  siteName: 'BrawlValue',
} as const
