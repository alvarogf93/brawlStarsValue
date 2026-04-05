import type { PlayerData, GemScore, BrawlerStat, PlayerTag } from './types'

export function calculateValue(playerData: PlayerData): GemScore {
  let baseValue = 0
  let assetsValue = 0
  let enhanceValue = 0
  let eliteValue = 0

  let vBaseTrophies = 0
  let vBaseVictories = 0
  
  let gadgetsCount = 0
  let starPowersCount = 0
  let hyperChargesCount = 0
  let buffiesCount = 0

  let prestige1Count = 0
  let prestige2Count = 0
  let prestige3Count = 0

  // 1. Base Logic
  vBaseTrophies = Math.floor(playerData.trophies * 0.02)
  vBaseVictories = Math.floor(playerData['3vs3Victories'] * 0.08)
  baseValue = vBaseTrophies + vBaseVictories

  // Iterating through Brawlers
  for (const brawler of playerData.brawlers) {
    // 2. Assets 
    const isLegendary = ['Spike', 'Crow', 'Leon', 'Sandy', 'Amber', 'Meg'].includes(brawler.name.value) // Very simplified mapping for test mock
    const rarityBase = isLegendary ? 500 : 100 // Test values
    const powerLevelMultiplier = brawler.power * 0.1
    assetsValue += Math.floor(rarityBase * powerLevelMultiplier)

    // 3. Enhance
    gadgetsCount += brawler.gadgets.length
    starPowersCount += brawler.starPowers.length
    hyperChargesCount += brawler.hyperCharges?.length || 0
    if (brawler.buffies) {
      buffiesCount += Object.keys(brawler.buffies).length
    }

    // 4. Elite
    if (brawler.highestTrophies >= 1000) prestige1Count++
    if (brawler.highestTrophies >= 2000) prestige2Count++
    if (brawler.highestTrophies >= 3000) prestige3Count++
  }

  enhanceValue = (gadgetsCount * 200) + (starPowersCount * 400) + (hyperChargesCount * 1200) + (buffiesCount * 2000)
  eliteValue = (prestige1Count * 10000) + (prestige2Count * 25000) + (prestige3Count * 75000)

  const totalScore = baseValue + assetsValue + enhanceValue + eliteValue
  const gemEquivalent = Math.floor(totalScore / 50)

  return {
    playerTag: playerData.tag as PlayerTag,
    playerName: playerData.name,
    gemEquivalent,
    totalScore,
    breakdown: {
      base: { trophies: vBaseTrophies, victories3vs3: vBaseVictories, value: baseValue },
      assets: { brawlerCount: playerData.brawlers.length, value: assetsValue },
      enhance: {
        gadgets: gadgetsCount,
        starPowers: starPowersCount,
        hypercharges: hyperChargesCount,
        buffies: buffiesCount,
        value: enhanceValue
      },
      elite: {
        prestige1: prestige1Count,
        prestige2: prestige2Count,
        prestige3: prestige3Count,
        value: eliteValue
      }
    },
    timestamp: new Date(),
    cached: false
  }
}
