import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchPlayerRankings, fetchBattlelog } from '@/lib/api'
import { parseBattleTime } from '@/lib/battle-parser'
import {
  isDraftMode,
  META_POLL_BATCH_SIZE,
  META_POLL_DELAY_MS,
  META_POLL_MAX_DEPTH,
  META_POLL_CHUNK_SIZE,
} from '@/lib/draft/constants'
import { computeModeTarget, findUnderTargetModes, type ModeCounts } from '@/lib/draft/meta-poll-balance'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'

/**
 * Cron: Poll top global players' battlelogs and aggregate into
 * meta_stats / meta_matchups / meta_trios.
 *
 * Strategy (Sprint D — 2026-04-13): adaptive top-up.
 *
 * 1. Fetch the top META_POLL_MAX_DEPTH players from global rankings in
 *    a single call (Supercell returns a list).
 * 2. Process the first META_POLL_BATCH_SIZE (200) — the "base batch".
 *    Every draft-mode battle from these players is kept.
 * 3. Count battles per mode in a side map.
 * 4. Compute target = max(MIN_TARGET, bestMode * RATIO).
 *    If any draft mode is below target AND we have not yet exhausted
 *    META_POLL_MAX_DEPTH, pull the next META_POLL_CHUNK_SIZE (100)
 *    players and process their battlelogs. On top-up iterations we
 *    ONLY keep battles whose mode is under target — no point
 *    amplifying modes that are already saturated.
 * 5. Loop on (step 4) until all modes are balanced or depth is hit.
 * 6. Bulk upsert meta_stats / meta_matchups / meta_trios in three
 *    single RPC calls as before.
 *
 * Cursors advance for every battle the player has — including the
 * ones we discard — so the next cron run does not re-examine them.
 *
 * Runs every 2-4 hours. Protected by CRON_SECRET.
 */
export const maxDuration = 300

interface ChunkResult {
  processed: number
  skipped: number
  errors: number
  battlesKept: number
}

async function processPlayerChunk(
  tags: string[],
  cursorMap: Map<string, string>,
  acc: MetaAccumulators,
  battlesByMode: Map<string, number>,
  cursorUpdates: Array<{ player_tag: string; last_battle_time: string }>,
  acceptMode: (mode: string) => boolean,
): Promise<ChunkResult> {
  let processed = 0
  let skipped = 0
  let errors = 0
  let battlesKept = 0

  for (const tag of tags) {
    try {
      const response = await fetchBattlelog(tag)
      const entries = response.items ?? []

      if (entries.length === 0) {
        skipped++
        continue
      }

      const lastSeen = cursorMap.get(tag)
      let latestBattleTime = lastSeen ?? ''

      for (const entry of entries) {
        const battleTime = parseBattleTime(entry.battleTime)

        // Skip already-processed battles
        if (lastSeen && battleTime <= lastSeen) continue

        // Track latest for cursor update — we advance the cursor even for
        // battles we later discard (wrong mode, wrong type, saturated mode)
        // so the next cron run doesn't re-examine them.
        if (battleTime > latestBattleTime) latestBattleTime = battleTime

        const battle = entry.battle
        const mode = battle.mode || entry.event.mode
        const map = entry.event.map || null

        if (!isDraftMode(mode)) continue
        if (battle.type === 'friendly') continue
        if (battle.result !== 'victory' && battle.result !== 'defeat') continue
        if (!battle.teams || battle.teams.length !== 2) continue
        if (battle.teams[0].length !== 3 || battle.teams[1].length !== 3) continue

        // Adaptive top-up filter: on top-up iterations only keep battles
        // from under-sampled modes. The base batch passes `() => true`.
        if (!acceptMode(mode)) continue

        let myBrawlerId: number | null = null
        let opponentBrawlerIds: number[] = []

        for (let teamIdx = 0; teamIdx < battle.teams.length; teamIdx++) {
          const playerInTeam = battle.teams[teamIdx].find(p => p.tag === tag)
          if (playerInTeam) {
            myBrawlerId = playerInTeam.brawler.id
            const otherTeamIdx = 1 - teamIdx
            opponentBrawlerIds = battle.teams[otherTeamIdx].map(p => p.brawler.id)
            break
          }
        }

        if (myBrawlerId === null) continue

        processBattleForMeta(acc, {
          myBrawlerId,
          opponentBrawlerIds,
          map,
          mode,
          result: battle.result,
        })

        // Extract trio composition (polled player's team — 3 brawlers sorted canonically)
        const myTeamIdx = battle.teams.findIndex(
          (team: Array<{ tag: string; brawler: { id: number } }>) =>
            team.some(p => p.tag === tag),
        )
        if (myTeamIdx !== -1 && map) {
          const teamBrawlerIds = battle.teams[myTeamIdx]
            .map((p: { brawler: { id: number } }) => p.brawler.id)
            .sort((a: number, b: number) => a - b)

          if (teamBrawlerIds.length === 3) {
            const trioKey = `${teamBrawlerIds[0]}|${teamBrawlerIds[1]}|${teamBrawlerIds[2]}|${map}|${mode}`
            const existing = acc.trios.get(trioKey) ?? {
              wins: 0, losses: 0, total: 0,
              ids: teamBrawlerIds, map, mode,
            }
            existing.total++
            if (battle.result === 'victory') existing.wins++
            else existing.losses++
            acc.trios.set(trioKey, existing)
          }
        }

        battlesKept++
        battlesByMode.set(mode, (battlesByMode.get(mode) ?? 0) + 1)
      }

      // Update cursor for this player (even if we discarded all battles)
      if (latestBattleTime && latestBattleTime !== (lastSeen ?? '')) {
        cursorUpdates.push({ player_tag: tag, last_battle_time: latestBattleTime })
      }

      processed++
    } catch {
      errors++
    }

    // Throttle API calls
    await new Promise(r => setTimeout(r, META_POLL_DELAY_MS))
  }

  return { processed, skipped, errors, battlesKept }
}

async function runAdaptivePoll(supabase: SupabaseClient) {
  // 1. Fetch up to META_POLL_MAX_DEPTH players in a single ranking call
  const rankings = await fetchPlayerRankings('global', META_POLL_MAX_DEPTH)
  const allPlayerTags: string[] = rankings.items.map((p: { tag: string }) => p.tag)

  // 2. Load cursors for every candidate tag (one query, not per-chunk)
  const { data: cursors } = await supabase
    .from('meta_poll_cursors')
    .select('player_tag, last_battle_time')
    .in('player_tag', allPlayerTags)

  const cursorMap = new Map<string, string>()
  for (const c of (cursors ?? []) as Array<{ player_tag: string; last_battle_time: string }>) {
    cursorMap.set(c.player_tag, c.last_battle_time)
  }

  // 3. Shared state across base + top-up iterations
  const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
  const battlesByMode = new Map<string, number>()
  const cursorUpdates: { player_tag: string; last_battle_time: string }[] = []

  // 4. Base batch — accept all draft modes
  const baseTags = allPlayerTags.slice(0, META_POLL_BATCH_SIZE)
  const baseResult = await processPlayerChunk(
    baseTags, cursorMap, acc, battlesByMode, cursorUpdates,
    () => true,
  )

  let processed = baseResult.processed
  let skipped = baseResult.skipped
  let errors = baseResult.errors
  let battlesKept = baseResult.battlesKept
  let iterationsRun = 1
  let offset = Math.min(META_POLL_BATCH_SIZE, allPlayerTags.length)

  // 5. Adaptive top-up loop
  while (offset < META_POLL_MAX_DEPTH && offset < allPlayerTags.length) {
    const counts: ModeCounts = {}
    for (const [mode, n] of battlesByMode) counts[mode] = n

    const target = computeModeTarget(counts)
    const underTarget = findUnderTargetModes(counts, target)

    if (underTarget.size === 0) break // fully balanced

    const chunkEnd = Math.min(
      offset + META_POLL_CHUNK_SIZE,
      META_POLL_MAX_DEPTH,
      allPlayerTags.length,
    )
    const chunkTags = allPlayerTags.slice(offset, chunkEnd)
    offset = chunkEnd

    const chunkResult = await processPlayerChunk(
      chunkTags, cursorMap, acc, battlesByMode, cursorUpdates,
      (mode: string) => underTarget.has(mode),
    )

    processed += chunkResult.processed
    skipped += chunkResult.skipped
    errors += chunkResult.errors
    battlesKept += chunkResult.battlesKept
    iterationsRun++
  }

  // 6. Final counts snapshot for the response diagnostics
  const finalCountsByMode: Record<string, number> = {}
  for (const [mode, n] of battlesByMode) finalCountsByMode[mode] = n

  return {
    acc, cursorUpdates,
    processed, skipped, errors, battlesKept,
    iterationsRun, playersPolled: offset,
    finalCountsByMode,
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )

  try {
    const result = await runAdaptivePoll(supabase)
    const today = new Date().toISOString().slice(0, 10)

    // Bulk upsert meta_stats
    if (result.acc.stats.size > 0) {
      const statRows = Array.from(result.acc.stats.entries()).map(([key, val]) => {
        const [brawlerId, map, mode] = key.split('|')
        return {
          brawler_id: Number(brawlerId),
          map,
          mode,
          source: 'global',
          date: today,
          wins: val.wins,
          losses: val.losses,
          total: val.total,
        }
      })
      await supabase.rpc('bulk_upsert_meta_stats', { rows: statRows })
    }

    // Bulk upsert meta_matchups
    if (result.acc.matchups.size > 0) {
      const matchupRows = Array.from(result.acc.matchups.entries()).map(([key, val]) => {
        const [brawlerId, opponentId, mode] = key.split('|')
        return {
          brawler_id: Number(brawlerId),
          opponent_id: Number(opponentId),
          mode,
          source: 'global',
          date: today,
          wins: val.wins,
          losses: val.losses,
          total: val.total,
        }
      })
      await supabase.rpc('bulk_upsert_meta_matchups', { rows: matchupRows })
    }

    // Bulk upsert meta_trios
    if (result.acc.trios.size > 0) {
      const trioRows = Array.from(result.acc.trios.entries()).map(([, val]) => ({
        brawler1_id: val.ids[0],
        brawler2_id: val.ids[1],
        brawler3_id: val.ids[2],
        map: val.map,
        mode: val.mode,
        source: 'global',
        date: today,
        wins: val.wins,
        losses: val.losses,
        total: val.total,
      }))
      await supabase.rpc('bulk_upsert_meta_trios', { rows: trioRows })
    }

    // Update cursors
    if (result.cursorUpdates.length > 0) {
      await supabase.from('meta_poll_cursors').upsert(result.cursorUpdates, {
        onConflict: 'player_tag',
      })
    }

    return NextResponse.json({
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
      battlesProcessed: result.battlesKept,
      statKeys: result.acc.stats.size,
      matchupKeys: result.acc.matchups.size,
      trioKeys: result.acc.trios.size,
      adaptive: {
        iterationsRun: result.iterationsRun,
        playersPolled: result.playersPolled,
        finalCountsByMode: result.finalCountsByMode,
      },
    })
  } catch (err) {
    console.error('[meta-poll] Fatal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
