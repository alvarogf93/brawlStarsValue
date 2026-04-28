import { NextResponse } from 'next/server'
import { createServiceClientNoCookies } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchPlayerRankings, fetchBattlelog, fetchEventRotation } from '@/lib/api'
import { parseBattleTime } from '@/lib/battle-parser'
import {
  META_POLL_DELAY_MS,
  META_POLL_MAX_DEPTH,
  META_POLL_PRELOAD_DAYS,
  META_POLL_RANKING_COUNTRIES,
  normalizeSupercellMode,
} from '@/lib/draft/constants'
import {
  computeAcceptRate,
  computeMinLive,
  findMapModeStragglers,
  mapModeKey,
  type MapModeCounts,
  type RandomFn,
} from '@/lib/draft/meta-poll-balance'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'
import { writeCronHeartbeat, CRON_JOB_NAMES } from '@/lib/cron/heartbeat'

/**
 * Cron: Poll top pro players from multiple country rankings and
 * aggregate their recent battles into `meta_stats` / `meta_matchups`
 * / `meta_trios`.
 *
 * Strategy — probabilistic weighted sampling (Sprint F, 2026-04-14):
 *
 *   1. Fetch candidate pool by merging `/rankings/{country}/players`
 *      across a fixed list of countries (`META_POLL_RANKING_COUNTRIES`).
 *      Supercell caps each rankings response at 200 items, so a single
 *      global call is wildly insufficient. 11 country rankings yield
 *      ~2,100 unique players with minimal overlap.
 *   2. Fetch the Supercell events rotation to determine the set of
 *      currently-live `(map, mode)` pairs. Out-of-rotation maps are
 *      never accepted — they can't receive new battles regardless of
 *      who we poll.
 *   3. Preload `meta_stats` over `META_POLL_PRELOAD_DAYS` (28 days)
 *      grouped by `(map, mode)` via the `sum_meta_stats_by_map_mode`
 *      RPC. The RPC divides by 6 so the preload is in **real battles**,
 *      not brawler-rows — matching the `+1 per battle` increment that
 *      runs during the player loop. Units are coherent end to end.
 *      (Preload window is intentionally longer than the UI's 14-day
 *      rolling window so maps with slow rotation cadences have memory
 *      of ≥2-3 appearances when deciding priority.)
 *   4. Loop through the candidate pool up to `META_POLL_MAX_DEPTH`
 *      (1000 on Hobby plan, 1500 on Pro) players. For each player,
 *      rebuild a probabilistic sampler
 *      `p = min(1, (minLive + 1) / (current + 1))` and evaluate it
 *      per incoming battle. Scarce live maps (count close to `minLive`)
 *      accept at rate ≈ 1; oversampled live maps (count >> minLive)
 *      accept at rate proportional to their inverse oversupply. No
 *      map is ever dropped from acceptance — the ratio self-balances
 *      as the gap closes. No floor, no ceiling, no target.
 *   5. Bulk upsert meta_stats / meta_matchups / meta_trios in three
 *      single RPC calls.
 *
 * Cursors (`meta_poll_cursors`) advance to `max(battle_time)` of every
 * player's processed battlelog — including battles the sampler chose
 * to discard — so the next cron run does not re-examine them. A
 * discarded battle is *not* a data loss: the DB rows already written
 * for that (map, mode) are untouched. Discarding is a conscious
 * budget reallocation from oversampled maps toward under-sampled
 * ones within the same finite wall-clock of one run.
 *
 * There is no "early exit" state anymore — every live map always has
 * rate > 0, so the loop only terminates by depleting the pool or by
 * tripping the soft wall-clock budget.
 *
 * Runs every 30 min from the Oracle VPS crontab (see `docs/crons/README.md`).
 * Protected by CRON_SECRET.
 */
// Plan-aware hard cap: Vercel Hobby rejects any value > 300 at build
// time ("Builder returned invalid maxDuration value"). When the
// project upgrades to Pro we can raise this back to 600 and widen
// the soft wall-clock guard + META_POLL_MAX_DEPTH to match — see
// the paired constants in `@/lib/draft/constants`.
export const maxDuration = 300

interface ProcessOnePlayerResult {
  processed: boolean
  skipped: boolean
  errored: boolean
  battlesKept: number
}

async function processOnePlayer(
  tag: string,
  cursorMap: Map<string, string>,
  acc: MetaAccumulators,
  battlesByMapMode: MapModeCounts,
  cursorUpdates: Array<{ player_tag: string; last_battle_time: string }>,
  sampler: (key: string) => boolean,
): Promise<ProcessOnePlayerResult> {
  try {
    const response = await fetchBattlelog(tag)
    const entries = response.items ?? []

    if (entries.length === 0) {
      return { processed: false, skipped: true, errored: false, battlesKept: 0 }
    }

    const lastSeen = cursorMap.get(tag)
    let latestBattleTime = lastSeen ?? ''
    let battlesKept = 0

    for (const entry of entries) {
      const battleTime = parseBattleTime(entry.battleTime)

      // Skip already-processed battles
      if (lastSeen && battleTime <= lastSeen) continue

      // Track latest for cursor update — we advance the cursor even for
      // battles we later discard (wrong mode, wrong type, saturated pair)
      // so the next cron run doesn't re-examine them.
      if (battleTime > latestBattleTime) latestBattleTime = battleTime

      const battle = entry.battle
      // Normalize mode via helper: modeId is authoritative when known
      // (Hyperspace is a brawlHockey map but ships with `mode: 'brawlBall'`).
      const rawMode = battle.mode || entry.event.mode
      const rawModeId = (entry.event as { modeId?: number }).modeId
      const mode = normalizeSupercellMode(rawMode, rawModeId)
      const map = entry.event.map || null

      if (!mode) continue
      if (!map) continue
      if (battle.type === 'friendly') continue
      if (battle.result !== 'victory' && battle.result !== 'defeat') continue
      if (!battle.teams || battle.teams.length !== 2) continue
      if (battle.teams[0].length !== 3 || battle.teams[1].length !== 3) continue

      // Probabilistic sampler gate: every live (map, mode) pair has a
      // per-battle accept rate proportional to its inverse oversupply
      // relative to the least-sampled live pair at this moment. See
      // computeAcceptRate in @/lib/draft/meta-poll-balance for the
      // exact formula. Out-of-rotation keys always return false.
      const key = mapModeKey(map, mode)
      if (!sampler(key)) continue

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

      // Trio composition (polled player's team — 3 brawlers sorted canonically)
      const myTeamIdx = battle.teams.findIndex(
        (team: Array<{ tag: string; brawler: { id: number } }>) =>
          team.some(p => p.tag === tag),
      )
      if (myTeamIdx !== -1) {
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
      battlesByMapMode[key] = (battlesByMapMode[key] ?? 0) + 1
    }

    if (latestBattleTime && latestBattleTime !== (lastSeen ?? '')) {
      cursorUpdates.push({ player_tag: tag, last_battle_time: latestBattleTime })
    }

    return { processed: true, skipped: false, errored: false, battlesKept }
  } catch {
    return { processed: false, skipped: false, errored: true, battlesKept: 0 }
  }
}

interface CandidatePool {
  tags: string[]
  /** Per-country diagnostics: how many unique tags each ranking
   *  contributed AFTER dedup. A country returning 0 here means its
   *  ranking endpoint rejected — surfaced in the response body so
   *  silent regional outages are visible in the cron JSON log. */
  perCountry: Record<string, number>
}

async function fetchCandidatePool(): Promise<CandidatePool> {
  // Fetch all rankings in parallel — each call is ~200-400ms and
  // they're independent. Total wall clock ≈ slowest single call.
  const results = await Promise.allSettled(
    META_POLL_RANKING_COUNTRIES.map(c => fetchPlayerRankings(c, 200)),
  )
  const seen = new Set<string>()
  const ordered: string[] = []
  const perCountry: Record<string, number> = {}
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const country = META_POLL_RANKING_COUNTRIES[i]
    if (r.status !== 'fulfilled') {
      console.warn(`[meta-poll] ranking fetch rejected for ${country}:`, r.reason)
      perCountry[country] = 0
      continue
    }
    let added = 0
    for (const p of r.value.items ?? []) {
      if (!seen.has(p.tag)) {
        seen.add(p.tag)
        ordered.push(p.tag)
        added++
      }
    }
    perCountry[country] = added
  }
  return { tags: ordered, perCountry }
}

async function fetchLiveMapModeKeys(): Promise<Set<string>> {
  try {
    const rotation = await fetchEventRotation()
    const live = new Set<string>()
    for (const slot of rotation) {
      const mode = normalizeSupercellMode(slot.event.mode, slot.event.modeId)
      const map = slot.event.map
      if (mode && map) live.add(mapModeKey(map, mode))
    }
    return live
  } catch {
    // If the rotation endpoint is down we fall back to an empty
    // set — the balance algorithm will then consider every key
    // already seen in the preload as live, which is a safe fallback
    // (it's what the old code effectively did).
    return new Set()
  }
}

async function preloadCumulativeCounts(
  supabase: SupabaseClient,
): Promise<MapModeCounts> {
  // Preload window is deliberately longer than the UI's rolling
  // window (META_ROLLING_DAYS = 14). The cron uses 28 days so maps
  // with slow rotation cadences have memory of ≥2-3 appearances
  // when deciding priority. The UI stays at 14 for recency.
  const since = new Date(Date.now() - META_POLL_PRELOAD_DAYS * 86400_000)
    .toISOString()
    .slice(0, 10)
  const { data, error } = await supabase.rpc('sum_meta_stats_by_map_mode', {
    p_since: since,
    p_source: 'global',
  })
  if (error || !data) return {}
  const counts: MapModeCounts = {}
  // Units: migration 017 divides by 6 inside the RPC, so `total`
  // here is in real battles (matching the `+1 per battle` increment
  // later in processOnePlayer). Do NOT re-divide.
  for (const row of data as Array<{ map: string; mode: string; total: number | string }>) {
    counts[mapModeKey(row.map, row.mode)] = Number(row.total)
  }
  return counts
}

async function runBalancedPoll(
  supabase: SupabaseClient,
  rng: RandomFn = Math.random,
) {
  const runStartedAt = Date.now()

  // 1. Fetch candidate pool + rotation keys + cumulative counts in parallel
  const [poolResult, rotationKeys, battlesByMapMode] = await Promise.all([
    fetchCandidatePool(),
    fetchLiveMapModeKeys(),
    preloadCumulativeCounts(supabase),
  ])
  const allPlayerTags = poolResult.tags
  const poolByCountry = poolResult.perCountry

  // `rotationKeys` is the authoritative live-rotation set (possibly empty
  // if Supercell's events endpoint is down). `effectiveLiveKeys` is what
  // the sampler uses — same as rotationKeys when the fetch worked, else
  // fall back to "every key in the preload" so the sampler still has a
  // denominator to compute `minLive` against. The straggler detector
  // MUST only consider rotationKeys (not the fallback) because a fallback
  // containing both `Hyperspace|brawlBall` AND `Hyperspace|brawlHockey`
  // would non-deterministically pick one as canonical and merge in the
  // wrong direction.
  const effectiveLiveKeys =
    rotationKeys.size > 0
      ? rotationKeys
      : new Set(Object.keys(battlesByMapMode))

  // 1b. Self-healing cleanup of mis-classified (map, mode) rows.
  //     Only runs when we have a TRUE rotation from the events endpoint.
  //     See findMapModeStragglers docstring — this handles the Supercell
  //     API quirk where hockey maps ship with `mode: "brawlBall"`. Runs
  //     BEFORE the player-processing loop so the target calculation below
  //     sees the canonical state, not the mis-classified snapshot.
  //     We rely on `cleanup_map_mode_strays` being all-or-nothing on the
  //     DB side (the RPC runs in a single transaction with a CTE DELETE-
  //     RETURNING pattern). If the whole RPC throws, the catch below
  //     leaves the in-memory preload untouched and the next run retries.
  const stragglersMerged: Array<{ map: string; wrongMode: string; canonicalMode: string; mergedRows: number | null }> = []
  const stragglers = rotationKeys.size > 0
    ? findMapModeStragglers(battlesByMapMode, rotationKeys)
    : []
  for (const s of stragglers) {
    try {
      const { data: merged } = await supabase.rpc('cleanup_map_mode_strays', {
        p_map: s.map,
        p_wrong_mode: s.wrongMode,
        p_canonical_mode: s.canonicalMode,
        p_source: 'global',
      })
      // Mirror the change in the in-memory preload so target + underTarget
      // computations below see the post-cleanup state. The wrong-mode count
      // is absorbed into the canonical-mode count (both sum; we don't know
      // the exact per-date/per-brawler split, but the total is correct).
      const wrongKey = mapModeKey(s.map, s.wrongMode)
      const canonicalKey = mapModeKey(s.map, s.canonicalMode)
      const wrongCount = battlesByMapMode[wrongKey] ?? 0
      battlesByMapMode[canonicalKey] = (battlesByMapMode[canonicalKey] ?? 0) + wrongCount
      delete battlesByMapMode[wrongKey]
      stragglersMerged.push({
        map: s.map, wrongMode: s.wrongMode, canonicalMode: s.canonicalMode,
        mergedRows: typeof merged === 'number' ? merged : null,
      })
    } catch (err) {
      // Cleanup is best-effort — a failed RPC (e.g. function not yet
      // applied in prod) must NOT abort the main cron run. Log and skip.
      console.error('[meta-poll] cleanup_map_mode_strays failed', { straggler: s, err })
    }
  }

  // 2. Load cursors for the capped candidate list (one query)
  const cappedTags = allPlayerTags.slice(0, META_POLL_MAX_DEPTH)
  const { data: cursors } = await supabase
    .from('meta_poll_cursors')
    .select('player_tag, last_battle_time')
    .in('player_tag', cappedTags)

  const cursorMap = new Map<string, string>()
  for (const c of (cursors ?? []) as Array<{ player_tag: string; last_battle_time: string }>) {
    cursorMap.set(c.player_tag, c.last_battle_time)
  }

  // 3. Shared state across the single processing loop
  const acc: MetaAccumulators = { stats: new Map(), matchups: new Map(), trios: new Map() }
  const cursorUpdates: { player_tag: string; last_battle_time: string }[] = []

  let processed = 0
  let skipped = 0
  let errors = 0
  let battlesKept = 0
  let playersPolled = 0
  let timeBudgetExit = false

  // Soft wall-clock guard. Vercel's hard `maxDuration = 300` (Hobby plan
  // cap) would return a 504 and lose the batch of battles already
  // accumulated in `acc`. By bailing voluntarily at 270s we still have
  // ~30s to run the 4 bulk upserts and flush the cursor updates before
  // Vercel kills the function. The `timeBudgetExit` flag is surfaced in
  // the response body so it's obvious from the JSON log when we hit
  // this path. On upgrade to Pro raise to 540_000 alongside maxDuration.
  const WALL_CLOCK_BUDGET_MS = 270_000

  // Track the starting minLive so diagnostics can report convergence
  // (how much the gap closed within this single run).
  const initialMinLive = computeMinLive(battlesByMapMode, effectiveLiveKeys)

  // 4. Process players in order with a per-player probabilistic sampler
  for (const tag of cappedTags) {
    if (Date.now() - runStartedAt > WALL_CLOCK_BUDGET_MS) {
      timeBudgetExit = true
      break
    }

    // Rebuild the sampler per player so `minLive` reflects any counts
    // that grew during earlier players in this run. The formula is:
    //
    //   p(accept) = min(1, (minLive + 1) / (current + 1))
    //
    // which is purely monotonic in both arguments — as the gap
    // closes, all rates rise toward 1 and the sampler stops filtering.
    // There is no "early exit" because every live pair always has
    // a non-zero rate (Laplacian smoothing), so we only terminate
    // by pool exhaustion or wall-clock budget.
    const minLive = computeMinLive(battlesByMapMode, effectiveLiveKeys)
    const sampler = (key: string): boolean => {
      if (!effectiveLiveKeys.has(key)) return false
      const current = battlesByMapMode[key] ?? 0
      const rate = computeAcceptRate(current, minLive)
      return rng() < rate
    }

    const result = await processOnePlayer(
      tag, cursorMap, acc, battlesByMapMode, cursorUpdates, sampler,
    )

    if (result.processed) processed++
    if (result.skipped) skipped++
    if (result.errored) errors++
    battlesKept += result.battlesKept
    playersPolled++

    // Rate-limit throttle between Supercell API calls — NOT a poll.
    // Total bounded runtime: META_POLL_MAX_DEPTH (1000) × (~150ms fetch
    // + META_POLL_DELAY_MS) ≈ 250s worst-case, inside maxDuration=300
    // with ~50s margin for the bulk upserts that follow the loop.
    // Deliberately stays in a regular Vercel Function (not Workflow)
    // because the work finishes in a single invocation — Workflow's
    // durable-step model is for multi-minute-to-hour jobs that need
    // crash-safe resume, which this does not.
    await new Promise(r => setTimeout(r, META_POLL_DELAY_MS))
  }

  const finalMinLive = computeMinLive(battlesByMapMode, effectiveLiveKeys)

  return {
    acc, cursorUpdates,
    processed, skipped, errors, battlesKept,
    poolSize: allPlayerTags.length,
    poolByCountry,
    playersPolled,
    liveKeyCount: effectiveLiveKeys.size,
    rotationAvailable: rotationKeys.size > 0,
    timeBudgetExit,
    initialMinLive,
    finalMinLive,
    stragglersMerged,
    finalCountsByMapMode: { ...battlesByMapMode },
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClientNoCookies()

  const handlerStartedAt = Date.now()

  try {
    const result = await runBalancedPoll(supabase)
    const today = new Date().toISOString().slice(0, 10)

    // Bulk upsert meta_stats.
    //
    // We ALWAYS check `.error` on Supabase RPC calls. The JS client does
    // not throw on PostgREST errors — it returns `{ data, error }` — so
    // an unchecked `await rpc(...)` silently eats any RPC failure. Before
    // Sprint F+ we had that exact bug: the cron reported success via the
    // heartbeat while the bulk upserts were failing silently, and nobody
    // noticed until a direct `meta_stats` inspection showed data stuck
    // at 5 days old. Throwing here surfaces the failure as a 500, which
    // skips the heartbeat write (heartbeat lives outside this try/catch
    // — see `writeCronHeartbeat` below) and shows up as a red row in
    // `cron_heartbeats` rather than a phantom-success entry.
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
      const { error: statsErr } = await supabase.rpc('bulk_upsert_meta_stats', { rows: statRows })
      if (statsErr) {
        throw new Error(`bulk_upsert_meta_stats failed: ${statsErr.message} (${statRows.length} rows)`)
      }
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
      const { error: matchupsErr } = await supabase.rpc('bulk_upsert_meta_matchups', { rows: matchupRows })
      if (matchupsErr) {
        throw new Error(`bulk_upsert_meta_matchups failed: ${matchupsErr.message} (${matchupRows.length} rows)`)
      }
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
      const { error: triosErr } = await supabase.rpc('bulk_upsert_meta_trios', { rows: trioRows })
      if (triosErr) {
        throw new Error(`bulk_upsert_meta_trios failed: ${triosErr.message} (${trioRows.length} rows)`)
      }
    }

    // Update cursors. CRITICAL: if this fails silently, the next run
    // re-processes the same battlelogs, which bloats the API call
    // budget and makes the heartbeat's "playersPolled" count misleading.
    // Same destructure+throw pattern as the three bulk upserts above.
    if (result.cursorUpdates.length > 0) {
      const { error: cursorErr } = await supabase
        .from('meta_poll_cursors')
        .upsert(result.cursorUpdates, { onConflict: 'player_tag' })
      if (cursorErr) {
        throw new Error(`meta_poll_cursors.upsert failed: ${cursorErr.message} (${result.cursorUpdates.length} rows)`)
      }
    }

    // Success heartbeat — written AFTER all side-effects commit so a
    // mid-run crash does NOT leave a stale "last_success_at" in the
    // healthcheck table. Best-effort: a failed heartbeat write logs
    // but doesn't fail the cron.
    await writeCronHeartbeat(supabase, CRON_JOB_NAMES.META_POLL, handlerStartedAt, {
      battlesProcessed: result.battlesKept,
      poolSize: result.poolSize,
      playersPolled: result.playersPolled,
      liveKeyCount: result.liveKeyCount,
      stragglersMerged: result.stragglersMerged.length,
      initialMinLive: result.initialMinLive,
      finalMinLive: result.finalMinLive,
      timeBudgetExit: result.timeBudgetExit,
      rotationAvailable: result.rotationAvailable,
    })

    return NextResponse.json({
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
      battlesProcessed: result.battlesKept,
      statKeys: result.acc.stats.size,
      matchupKeys: result.acc.matchups.size,
      trioKeys: result.acc.trios.size,
      adaptive: {
        poolSize: result.poolSize,
        // Per-country breakdown of the dedupe pool. A country reporting
        // 0 means its rankings endpoint rejected or returned nothing —
        // useful for diagnosing regional Supercell outages without
        // needing Vercel function logs.
        poolByCountry: result.poolByCountry,
        playersPolled: result.playersPolled,
        liveKeyCount: result.liveKeyCount,
        // True when `fetchEventRotation` returned live pairs. False
        // means we fell back to "any key in the preload" for the sampler
        // denominator and DID NOT run the straggler cleanup (the fallback
        // can non-deterministically pick the wrong canonical mode).
        rotationAvailable: result.rotationAvailable,
        // True when the soft wall-clock budget (540s) tripped before
        // maxDuration (600s). With the probabilistic sampler there is
        // no "early exit" by balance — only by pool exhaustion or this.
        timeBudgetExit: result.timeBudgetExit,
        // Sampler convergence: `minLive` is the count of the sparsest
        // live (map, mode) pair. If final > initial, the run successfully
        // raised the floor; if equal, the sparsest pair had no supply
        // in this run's battlelogs (real meta-pro supply limitation,
        // not an algorithm failure).
        initialMinLive: result.initialMinLive,
        finalMinLive: result.finalMinLive,
        // Self-healing cleanup: any (map, mode) mis-classifications that
        // were detected and merged at the start of this run. Should be
        // empty in steady state; non-empty means a new rotation just
        // exposed a straggler (e.g. Tip Toe brawlBall → brawlHockey).
        stragglersMerged: result.stragglersMerged,
        // NOTE: this field is the CUMULATIVE state including the preload,
        // so its numbers reflect the 28-day running totals in REAL battles
        // (migration 017 divides by 6 in the RPC), not just this run.
        finalCountsByMapMode: result.finalCountsByMapMode,
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
