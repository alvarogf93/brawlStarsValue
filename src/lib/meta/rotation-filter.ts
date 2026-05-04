/**
 * Pure helpers for the public-facing "live rotation" view.
 *
 * Supercell's `/events/rotation` returns a mix of two distinct event
 * classes that have the same JSON shape but very different gameplay
 * meaning:
 *
 *   - **Regular rotation slots** (slotId 1..15 typically) — the maps
 *     the player sees in the main game tabs. Duration ≈ 24h, refreshed
 *     daily. These are what "in rotation" means to a player.
 *
 *   - **Extended / Ranked / Power League slots** (slotId 20+ typically)
 *     — long-running maps for ranked play. Duration is 7-9 days. They
 *     do NOT appear in the regular rotation tab in the game.
 *
 *   - **Short special events** (≈2h) — flashlight-tier brief modes
 *     (Healthy Middle Ground etc). Not what the user expects to see
 *     under "live rotation" either.
 *
 * The legacy filter `durationH >= 12` only excluded the 2h specials
 * but let the 216h ranked maps through, producing two visible bugs
 * reported on 2026-05-04 by user #YJU282PV:
 *   1. "Spiraling Out duplicated" — slot 1 brawlBall (24h) +
 *      slot 21 brawlBall (216h) both passed the filter.
 *   2. "Gem Fort listed but not in-game" — slot 22 gemGrab (216h)
 *      passed the filter even though the player only sees Local
 *      Restaurants (slot 3) for gemGrab in their actual game tab.
 *
 * `filterRegularRotation` applies BOTH a duration window
 * (12h ≤ d ≤ REGULAR_ROTATION_MAX_HOURS) AND a (map, mode) dedupe
 * preferring the shortest-duration slot. The dedupe is a defensive
 * second pass — if Supercell ever ships a regular-rotation duplicate
 * inside the 12-48h window, we still collapse it.
 */

import { parseSupercellTime } from '@/lib/battle-parser'

/** Maximum duration in hours for an event to count as "regular
 *  rotation". Daily slots are 24h, occasional weekend slots may be
 *  ~48h. Beyond that, the slot is a ranked / extended event. */
export const REGULAR_ROTATION_MAX_HOURS = 48

/** Minimum duration in hours. Below this, the event is a brief
 *  special / flashlight mode that doesn't belong in the rotation
 *  picker either. */
export const REGULAR_ROTATION_MIN_HOURS = 12

/** Subset of fields we read; matches both the raw Supercell payload
 *  shape and the `EventSlot` type from `src/lib/api.ts`. */
export interface RotationCandidate {
  startTime?: string
  endTime?: string
  slotId?: number
  event?: { id?: number; mode?: string; modeId?: number; map?: string }
  // Some legacy callsites flattened the event fields onto the root.
  // We accept both to keep the helper compatible with `/api/events`
  // (rich shape) and any direct-from-Supercell consumer.
  id?: number
  mode?: string
  map?: string
}

export function durationHours(event: Pick<RotationCandidate, 'startTime' | 'endTime'>): number | null {
  if (!event.startTime || !event.endTime) return null
  const start = parseSupercellTime(event.startTime)
  const end = parseSupercellTime(event.endTime)
  if (!start || !end) return null
  return (end.getTime() - start.getTime()) / 3_600_000
}

/**
 * True when the event falls inside the regular-rotation duration
 * window. Used both as a filter and from tests.
 */
export function isRegularRotation(event: Pick<RotationCandidate, 'startTime' | 'endTime'>): boolean {
  const d = durationHours(event)
  if (d === null) return true // can't compute → leave it in (matches old behavior for malformed times)
  return d >= REGULAR_ROTATION_MIN_HOURS && d <= REGULAR_ROTATION_MAX_HOURS
}

/**
 * Apply the rotation filter and dedupe by (map, mode), keeping the
 * shortest-duration occurrence. Stable with respect to input order
 * for events that survive the filter unchanged.
 */
export function filterRegularRotation<T extends RotationCandidate>(events: T[]): T[] {
  const passing = events.filter(isRegularRotation)

  // (map, mode) dedupe — defensive second pass. If two events for
  // the same key make it through the duration window, prefer the
  // shorter one (closer to "today's rotation" semantics).
  const bestByKey = new Map<string, T>()
  for (const e of passing) {
    const map = e.event?.map ?? e.map
    const mode = e.event?.mode ?? e.mode
    if (!map || !mode) continue
    const key = `${map}|${mode}`
    const existing = bestByKey.get(key)
    if (!existing) {
      bestByKey.set(key, e)
      continue
    }
    const dExisting = durationHours(existing) ?? Infinity
    const dCurrent = durationHours(e) ?? Infinity
    if (dCurrent < dExisting) bestByKey.set(key, e)
  }

  // Preserve original order for events that weren't deduped against.
  const winners = new Set(bestByKey.values())
  return passing.filter(e => winners.has(e))
}
