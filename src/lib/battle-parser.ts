import type { BattlelogEntry } from '@/lib/api'
import type { BattleInsert, BrawlerJsonb, TeammateJsonb } from '@/lib/supabase/types'

/**
 * Convert Supercell battleTime format "20260405T171604.000Z"
 * to ISO 8601 "2026-04-05T17:16:04.000Z"
 */
export function parseBattleTime(raw: string): string {
  const y = raw.slice(0, 4)
  const m = raw.slice(4, 6)
  const d = raw.slice(6, 8)
  const rest = raw.slice(8)
  const h = rest.slice(1, 3)
  const min = rest.slice(3, 5)
  const sec = rest.slice(5, 7)
  return `${y}-${m}-${d}T${h}:${min}:${sec}.000Z`
}

/**
 * Parse any Supercell-shaped datetime into a Date, robustly.
 *
 * Supercell APIs serialize times in a compact non-ISO format
 * ("20260413T120000.000Z"). JavaScript's `new Date()` constructor
 * does NOT parse that format — it returns `Invalid Date`, whose
 * `.getTime()` is `NaN`, which then propagates through arithmetic
 * and produces things like "NaNm" in the UI. This helper:
 *
 *  1. Detects the compact Supercell format and converts it to ISO
 *     8601 before `new Date()`.
 *  2. Accepts already-ISO strings (some endpoints normalize early).
 *  3. Returns `null` for empty / invalid / unparseable input so the
 *     caller can hide the UI element instead of rendering NaN.
 */
export function parseSupercellTime(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== 'string') return null
  // Compact Supercell format: YYYYMMDDTHHMMSS(.fff)?Z
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$/
  const match = raw.match(compact)
  if (match) {
    const [, y, mo, d, h, mi, s, ms] = match
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}.${ms ?? '000'}Z`
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
  }
  // Fallback: let Date try its own heuristics (handles ISO 8601 etc.)
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

import type { BattlelogBrawler } from '@/lib/api'

interface BattlePlayer {
  tag: string
  name: string
  brawler: BattlelogBrawler
}

function toBrawlerJsonb(player: BattlePlayer): BrawlerJsonb {
  return {
    id: player.brawler.id,
    name: player.brawler.name,
    power: player.brawler.power,
    trophies: player.brawler.trophies,
    gadgets: player.brawler.gadgets ?? [],
    starPowers: player.brawler.starPowers ?? [],
    hypercharges: player.brawler.hypercharges ?? [],
  }
}

function toTeammateJsonb(player: BattlePlayer): TeammateJsonb {
  return {
    tag: player.tag,
    name: player.name,
    brawler: {
      id: player.brawler.id,
      name: player.brawler.name,
      power: player.brawler.power,
      trophies: player.brawler.trophies,
    },
  }
}

/**
 * Parse a single BattlelogEntry into a database-ready BattleInsert.
 * Returns null if the player is not found in the battle.
 */
export function parseBattle(entry: BattlelogEntry, playerTag: string): BattleInsert | null {
  const battle = entry.battle
  const mode = battle.mode || entry.event.mode
  const map = entry.event.map || null

  let myPlayer: BattlePlayer | null = null
  let teammates: BattlePlayer[] = []
  let opponents: BattlePlayer[] = []

  if (battle.teams) {
    for (let teamIdx = 0; teamIdx < battle.teams.length; teamIdx++) {
      const team = battle.teams[teamIdx]
      const playerInTeam = team.find(p => p.tag === playerTag)

      if (playerInTeam) {
        myPlayer = playerInTeam
        teammates = team.filter(p => p.tag !== playerTag)
        for (let otherIdx = 0; otherIdx < battle.teams.length; otherIdx++) {
          if (otherIdx !== teamIdx) {
            opponents.push(...battle.teams[otherIdx])
          }
        }
        break
      }
    }
  } else if (battle.players) {
    const playerInList = battle.players.find(p => p.tag === playerTag)
    if (playerInList) {
      myPlayer = playerInList
      opponents = battle.players.filter(p => p.tag !== playerTag)
    }
  }

  if (!myPlayer) return null

  return {
    player_tag: playerTag,
    battle_time: parseBattleTime(entry.battleTime),
    event_id: entry.event.id ?? null,
    mode,
    map,
    result: battle.result,
    trophy_change: battle.trophyChange ?? 0,
    duration: battle.duration ?? null,
    is_star_player: battle.starPlayer?.tag === playerTag,
    my_brawler: toBrawlerJsonb(myPlayer),
    teammates: teammates.map(toTeammateJsonb),
    opponents: opponents.map(toTeammateJsonb),
  }
}

/**
 * Parse all battles from a battlelog response.
 * Skips entries where the player is not found.
 */
export function parseBattlelog(entries: BattlelogEntry[], playerTag: string): BattleInsert[] {
  const results: BattleInsert[] = []
  for (const entry of entries) {
    const parsed = parseBattle(entry, playerTag)
    if (parsed) results.push(parsed)
  }
  return results
}
