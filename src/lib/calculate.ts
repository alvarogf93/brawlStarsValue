import type { PlayerData, GemScore, BrawlerStat, RarityMap } from './types'
import {
  POWER_LEVEL_GEM_COST,
  GEM_COSTS,
  RARITY_UNLOCK_COST,
  AVG_MATCH_MINUTES,
  BRAWLER_RARITY_MAP,
} from './constants'

function hasNonDefaultSkin(b: BrawlerStat): boolean {
  return Boolean(b.skin && b.skin.id && b.skin.name !== b.name)
}

function countBuffies(b: BrawlerStat): number {
  if (!b.buffies) return 0
  return [b.buffies.gadget, b.buffies.starPower, b.buffies.hyperCharge].filter(Boolean).length
}

export function calculateValue(playerData: PlayerData, rarityMap: RarityMap = BRAWLER_RARITY_MAP): GemScore {
  let unlockCount = 0, unlockGems = 0
  let powerCount = 0, powerGems = 0
  let gadgetCount = 0, gadgetGems = 0
  let spCount = 0, spGems = 0
  let hcCount = 0, hcGems = 0
  let buffieCount = 0, buffieGems = 0
  let skinCount = 0, skinGems = 0

  for (const b of playerData.brawlers) {
    // Unlock cost by rarity
    const rarity = rarityMap[b.id] ?? 'Trophy Road'
    unlockCount++
    unlockGems += RARITY_UNLOCK_COST[rarity]

    // Power level cost (real gems)
    const plCost = POWER_LEVEL_GEM_COST[b.power] ?? 0
    if (plCost > 0) {
      powerCount++
      powerGems += plCost
    }

    // Gadgets
    gadgetCount += b.gadgets.length
    gadgetGems += b.gadgets.length * GEM_COSTS.gadget

    // Star Powers
    spCount += b.starPowers.length
    spGems += b.starPowers.length * GEM_COSTS.starPower

    // Hypercharges
    hcCount += b.hyperCharges.length
    hcGems += b.hyperCharges.length * GEM_COSTS.hypercharge

    // Buffies
    const bc = countBuffies(b)
    buffieCount += bc
    buffieGems += bc * GEM_COSTS.buffie

    // Skins
    if (hasNonDefaultSkin(b)) {
      skinCount++
      skinGems += GEM_COSTS.skin
    }
  }

  const totalGems = unlockGems + powerGems + gadgetGems + spGems + hcGems + buffieGems + skinGems

  // Profile stats
  const totalVictories = playerData.soloVictories + playerData.duoVictories + playerData['3vs3Victories']
  const estimatedHoursPlayed = Math.round((totalVictories * AVG_MATCH_MINUTES) / 60)

  return {
    playerTag: playerData.tag,
    playerName: playerData.name,
    totalGems,
    breakdown: {
      unlocks: { count: unlockCount, gems: unlockGems },
      powerLevels: { count: powerCount, gems: powerGems },
      gadgets: { count: gadgetCount, gems: gadgetGems },
      starPowers: { count: spCount, gems: spGems },
      hypercharges: { count: hcCount, gems: hcGems },
      buffies: { count: buffieCount, gems: buffieGems },
      skins: { count: skinCount, gems: skinGems },
    },
    stats: {
      trophies: playerData.trophies,
      highestTrophies: playerData.highestTrophies,
      totalPrestigeLevel: playerData.totalPrestigeLevel,
      soloVictories: playerData.soloVictories,
      duoVictories: playerData.duoVictories,
      threeVsThreeVictories: playerData['3vs3Victories'],
      totalVictories,
      estimatedHoursPlayed,
    },
    timestamp: new Date(),
    cached: false,
  }
}
