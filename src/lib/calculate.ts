import type { PlayerData, GemScore, BrawlerStat, RarityMap, PlayerTag } from './types'
import {
  GEM_DIVISOR,
  RARITY_BASE_VALUE,
  POWER_LEVEL_GEM_COST,
  ENHANCE_VALUES,
  PRESTIGE_REWARDS,
  BASE_COEFFICIENTS,
  BRAWLER_RARITY_MAP,
} from './constants'

function calcBaseVector(player: PlayerData) {
  const trophies = Math.floor(player.trophies * BASE_COEFFICIENTS.trophies)
  const victories3vs3 = Math.floor(player['3vs3Victories'] * BASE_COEFFICIENTS.victories3vs3)
  return { trophies, victories3vs3, value: trophies + victories3vs3 }
}

function calcPrestigeReward(brawler: BrawlerStat): number {
  const level = brawler.prestigeLevel > 0
    ? brawler.prestigeLevel
    : brawler.highestTrophies >= 3000 ? 3
    : brawler.highestTrophies >= 2000 ? 2
    : brawler.highestTrophies >= 1000 ? 1
    : 0

  return PRESTIGE_REWARDS[level] ?? 0
}

function calcAssetsVector(brawlers: BrawlerStat[], rarityMap: RarityMap) {
  let value = 0
  for (const b of brawlers) {
    const rarityName = rarityMap[b.id] ?? 'Trophy Road'
    const rarityBase = RARITY_BASE_VALUE[rarityName]
    const powerGemCost = POWER_LEVEL_GEM_COST[b.power] ?? 0
    // Asset value = rarity base + actual gem investment in upgrades
    value += rarityBase + powerGemCost
  }
  return { brawlerCount: brawlers.length, value }
}

function hasNonDefaultSkin(brawler: BrawlerStat): boolean {
  if (!brawler.skin || !brawler.skin.id) return false
  // Default skins have the same name as the brawler or id 0
  return brawler.skin.name !== brawler.name
}

function calcEnhanceVector(brawlers: BrawlerStat[]) {
  let gadgets = 0
  let starPowers = 0
  let hypercharges = 0
  let buffies = 0
  let skins = 0
  let value = 0

  for (const b of brawlers) {
    gadgets += b.gadgets.length
    starPowers += b.starPowers.length
    hypercharges += b.hyperCharges.length

    value += b.gadgets.length * ENHANCE_VALUES.gadget
    value += b.starPowers.length * ENHANCE_VALUES.starPower
    value += b.hyperCharges.length * ENHANCE_VALUES.hypercharge

    // Buffies: real data from API (3 booleans)
    if (b.buffies) {
      const count = [b.buffies.gadget, b.buffies.starPower, b.buffies.hyperCharge].filter(Boolean).length
      buffies += count
      value += count * ENHANCE_VALUES.buffie
    }

    // Skins: count non-default equipped skins (conservative lower bound)
    if (hasNonDefaultSkin(b)) {
      skins++
      value += ENHANCE_VALUES.skinEquipped
    }
  }

  return { gadgets, starPowers, hypercharges, buffies, skins, value }
}

function calcEliteVector(brawlers: BrawlerStat[]) {
  let prestige1 = 0
  let prestige2 = 0
  let prestige3 = 0
  let value = 0

  for (const b of brawlers) {
    const reward = calcPrestigeReward(b)
    if (reward === PRESTIGE_REWARDS[3]) prestige3++
    else if (reward === PRESTIGE_REWARDS[2]) prestige2++
    else if (reward === PRESTIGE_REWARDS[1]) prestige1++
    value += reward
  }

  return { prestige1, prestige2, prestige3, value }
}

export function calculateValue(playerData: PlayerData, rarityMap: RarityMap = BRAWLER_RARITY_MAP): GemScore {
  const base = calcBaseVector(playerData)
  const assets = calcAssetsVector(playerData.brawlers, rarityMap)
  const enhance = calcEnhanceVector(playerData.brawlers)
  const elite = calcEliteVector(playerData.brawlers)

  const totalScore = base.value + assets.value + enhance.value + elite.value
  const gemEquivalent = Math.floor(totalScore / GEM_DIVISOR)

  return {
    playerTag: playerData.tag as PlayerTag,
    playerName: playerData.name,
    gemEquivalent,
    totalScore,
    breakdown: { base, assets, enhance, elite },
    timestamp: new Date(),
    cached: false,
  }
}
