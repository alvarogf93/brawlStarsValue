import type { BrawlerRarityName, RarityMap } from './types'

export const PLAYER_TAG_REGEX = /^#[0-9A-Z]{3,20}$/i

/** Gem conversion divisor: totalScore / GEM_DIVISOR = gemEquivalent */
export const GEM_DIVISOR = 50

/** V_base coefficients */
export const BASE_COEFFICIENTS = {
  trophies: 0.02,
  victories3vs3: 0.08,
} as const

/** Rarity base values (points) for V_assets vector */
export const RARITY_BASE_VALUE: Record<BrawlerRarityName, number> = {
  'Trophy Road': 100,
  'Rare': 100,
  'Super Rare': 100,
  'Epic': 300,
  'Mythic': 750,
  'Legendary': 1500,
  'Chromatic': 750,
  'Ultra Legendary': 2500,
}

/**
 * Real gem cost per power level — based on actual in-game upgrade costs.
 * Source: Power Points + Coins totals, converted at 300 coins = 30 gems (1:0.1 ratio).
 * PP and Coins have equal gem value per the in-game shop.
 */
export const POWER_LEVEL_GEM_COST: Record<number, number> = {
  1: 0,       // Free (starting level)
  2: 4,       // 40 resources / 10
  3: 11,      // 105 / 10 (rounded)
  4: 23,      // 230 / 10
  5: 45,      // 450 / 10
  6: 87,      // 870 / 10
  7: 156,     // 1560 / 10
  8: 270,     // 2700 / 10
  9: 450,     // 4500 / 10
  10: 727,    // 7265 / 10 (rounded)
  11: 1151,   // 11505 / 10 (rounded)
}

/** V_enhance constants (points per item) */
export const ENHANCE_VALUES = {
  /** 1000 coins = 100 gems */
  gadget: 100,
  /** 2000 coins = 200 gems */
  starPower: 200,
  /** 5000 coins = 500 gems */
  hypercharge: 500,
  /** 1000 coins + 2000 PP = 3000 resources = 300 gems (at 10:1 ratio) */
  buffie: 300,
  /** Conservative estimate per non-default equipped skin.
   *  Real prices: Special=29, SuperSpecial=79, Epic=149, Mythic=199, Legendary=299, Hypercharge=700.
   *  API only shows equipped skin, not inventory or rarity. 79 is a conservative median. */
  skinEquipped: 79,
} as const

/** V_elite prestige rewards (points per brawler at that level) */
export const PRESTIGE_REWARDS: Record<number, number> = {
  1: 10000,
  2: 25000,
  3: 75000,
}

/**
 * Brawler ID → Rarity. Maintained manually — API does NOT expose rarity.
 * Source: in-game data, community wikis. Generated April 2026, 101 brawlers.
 */
export const BRAWLER_RARITY_MAP: RarityMap = {
  // Trophy Road / Starting
  16000000: 'Trophy Road',   // SHELLY
  16000001: 'Rare',          // COLT
  16000002: 'Rare',          // BULL
  16000003: 'Rare',          // BROCK
  16000004: 'Super Rare',    // RICO
  16000005: 'Legendary',     // SPIKE
  16000006: 'Super Rare',    // BARLEY
  16000007: 'Super Rare',    // JESSIE
  16000008: 'Rare',          // NITA
  16000009: 'Super Rare',    // DYNAMIKE
  16000010: 'Rare',          // EL PRIMO
  16000011: 'Mythic',        // MORTIS
  16000012: 'Legendary',     // CROW
  16000013: 'Rare',          // POCO
  16000014: 'Epic',          // BO
  16000015: 'Epic',          // PIPER
  16000016: 'Epic',          // PAM
  16000017: 'Mythic',        // TARA
  16000018: 'Super Rare',    // DARRYL
  16000019: 'Super Rare',    // PENNY
  16000020: 'Epic',          // FRANK
  16000021: 'Mythic',        // GENE
  16000022: 'Super Rare',    // TICK
  16000023: 'Legendary',     // LEON
  16000024: 'Rare',          // ROSA
  16000025: 'Super Rare',    // CARL
  16000026: 'Epic',          // BIBI
  16000027: 'Super Rare',    // 8-BIT
  16000028: 'Legendary',     // SANDY
  16000029: 'Epic',          // BEA
  16000030: 'Epic',          // EMZ
  16000031: 'Mythic',        // MR. P
  16000032: 'Mythic',        // MAX
  16000034: 'Super Rare',    // JACKY
  16000035: 'Chromatic',     // GALE
  16000036: 'Epic',          // NANI
  16000037: 'Mythic',        // SPROUT
  16000038: 'Chromatic',     // SURGE
  16000039: 'Chromatic',     // COLETTE
  16000040: 'Legendary',     // AMBER
  16000041: 'Chromatic',     // LOU
  16000042: 'Mythic',        // BYRON
  16000043: 'Epic',          // EDGAR
  16000044: 'Chromatic',     // RUFFS
  16000045: 'Epic',          // STU
  16000046: 'Chromatic',     // BELLE
  16000047: 'Mythic',        // SQUEAK
  16000048: 'Epic',          // GROM
  16000049: 'Chromatic',     // BUZZ
  16000050: 'Epic',          // GRIFF
  16000051: 'Epic',          // ASH
  16000052: 'Legendary',     // MEG
  16000053: 'Chromatic',     // LOLA
  16000054: 'Chromatic',     // FANG
  16000056: 'Chromatic',     // EVE
  16000057: 'Chromatic',     // JANET
  16000058: 'Chromatic',     // BONNIE
  16000059: 'Chromatic',     // OTIS
  16000060: 'Chromatic',     // SAM
  16000061: 'Epic',          // GUS
  16000062: 'Chromatic',     // BUSTER
  16000063: 'Legendary',     // CHESTER
  16000064: 'Mythic',        // GRAY
  16000065: 'Chromatic',     // MANDY
  16000066: 'Chromatic',     // R-T
  16000067: 'Mythic',        // WILLOW
  16000068: 'Chromatic',     // MAISIE
  16000069: 'Epic',          // HANK
  16000070: 'Mythic',        // CORDELIUS
  16000071: 'Chromatic',     // DOUG
  16000072: 'Chromatic',     // PEARL
  16000073: 'Chromatic',     // CHUCK
  16000074: 'Mythic',        // CHARLIE
  16000075: 'Mythic',        // MICO
  16000076: 'Legendary',     // KIT
  16000077: 'Chromatic',     // LARRY & LAWRIE
  16000078: 'Chromatic',     // MELODIE
  16000079: 'Chromatic',     // ANGELO
  16000080: 'Legendary',     // DRACO
  16000081: 'Legendary',     // LILY
  16000082: 'Chromatic',     // BERRY
  16000083: 'Chromatic',     // CLANCY
  16000084: 'Chromatic',     // MOE
  16000085: 'Legendary',     // KENJI
  16000086: 'Mythic',        // SHADE
  16000087: 'Mythic',        // JUJU
  16000089: 'Chromatic',     // MEEPLE
  16000090: 'Chromatic',     // OLLIE
  16000091: 'Chromatic',     // LUMI
  16000092: 'Epic',          // FINX
  16000093: 'Chromatic',     // JAE-YONG
  16000094: 'Mythic',        // KAZE
  16000095: 'Chromatic',     // ALLI
  16000096: 'Chromatic',     // TRUNK
  16000097: 'Epic',          // MINA
  16000098: 'Chromatic',     // ZIGGY
  16000099: 'Legendary',     // PIERCE
  16000100: 'Chromatic',     // GIGI
  16000101: 'Mythic',        // GLOWBERT
  16000102: 'Ultra Legendary', // SIRIUS
  16000103: 'Mythic',        // NAJIA
}

export const SEO = {
  title: '¿Cuánto poder tiene tu cuenta de Brawl Stars?',
  description: 'Calcula tu Puntuación de Poder en Gemas Equivalentes. Resultado instantáneo.',
  siteName: 'BrawlValue',
} as const
