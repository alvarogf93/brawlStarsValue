import type { PlayerData, GemScore, BrawlerStat, RarityMap } from './types'
import {
  POWER_LEVEL_GEM_COST,
  GEM_COSTS,
  AVG_MATCH_MINUTES,
  ESTIMATED_WIN_RATE,
} from './constants'

interface CalculateOptions {
  rarityMap?: RarityMap
  /** Win rate 0-1 from battlelog. Falls back to ESTIMATED_WIN_RATE (0.5) */
  winRate?: number
}

function countBuffies(b: BrawlerStat): number {
  if (!b.buffies) return 0
  return [b.buffies.gadget, b.buffies.starPower, b.buffies.hyperCharge].filter(Boolean).length
}

export function calculateValue(playerData: PlayerData, opts: CalculateOptions = {}): GemScore {
  const winRate = opts.winRate && opts.winRate > 0 ? opts.winRate : ESTIMATED_WIN_RATE
  let powerCount = 0, powerGems = 0
  let gadgetCount = 0, gadgetGems = 0
  let spCount = 0, spGems = 0
  let hcCount = 0, hcGems = 0
  let buffieCount = 0, buffieGems = 0
  let gearCount = 0, gearGems = 0

  for (const b of playerData.brawlers) {
    // Power level cost (real gems from verified game data)
    const plCost = POWER_LEVEL_GEM_COST[b.power] ?? 0
    if (plCost > 0) {
      powerCount++
      powerGems += plCost
    }

    // Gadgets (1000 coins = 100 gems)
    gadgetCount += b.gadgets.length
    gadgetGems += b.gadgets.length * GEM_COSTS.gadget

    // Star Powers (2000 coins = 200 gems)
    spCount += b.starPowers.length
    spGems += b.starPowers.length * GEM_COSTS.starPower

    // Hypercharges (5000 coins = 500 gems)
    hcCount += b.hyperCharges.length
    hcGems += b.hyperCharges.length * GEM_COSTS.hypercharge

    // Buffies (1000 coins + 2000 PP = 300 gems)
    const bc = countBuffies(b)
    buffieCount += bc
    buffieGems += bc * GEM_COSTS.buffie

    // Gears (1000 coins = 100 gems each)
    gearCount += b.gears.length
    gearGems += b.gears.length * GEM_COSTS.gear
  }

  // Only verified gem costs — skins are classified by user separately
  const totalGems = powerGems + gadgetGems + spGems + hcGems + buffieGems + gearGems

  // Profile stats
  const totalVictories = playerData.soloVictories + playerData.duoVictories + playerData['3vs3Victories']
  const estimatedTotalMatches = Math.round(totalVictories / winRate)
  const estimatedHoursPlayed = Math.round((estimatedTotalMatches * AVG_MATCH_MINUTES) / 60)

  // Count non-default skins for user classification
  const skinsEquipped = playerData.brawlers.filter(b => b.skin && b.skin.id && b.skin.name !== b.name).length

  return {
    playerTag: playerData.tag,
    playerName: playerData.name,
    totalGems,
    breakdown: {
      powerLevels: { count: powerCount, gems: powerGems },
      gadgets: { count: gadgetCount, gems: gadgetGems },
      starPowers: { count: spCount, gems: spGems },
      hypercharges: { count: hcCount, gems: hcGems },
      buffies: { count: buffieCount, gems: buffieGems },
      gears: { count: gearCount, gems: gearGems },
    },
    userInput: {
      skinsEquipped,
    },
    stats: {
      trophies: playerData.trophies,
      highestTrophies: playerData.highestTrophies,
      totalPrestigeLevel: playerData.totalPrestigeLevel,
      soloVictories: playerData.soloVictories,
      duoVictories: playerData.duoVictories,
      threeVsThreeVictories: playerData['3vs3Victories'],
      totalVictories,
      estimatedTotalMatches,
      estimatedHoursPlayed,
      winRateUsed: winRate,
    },
    timestamp: new Date(),
    cached: false,
  }
}
