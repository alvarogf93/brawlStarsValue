import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { fetchPlayerRankings, fetchBattlelog } from '@/lib/api'
import { parseBattleTime } from '@/lib/battle-parser'
import { isDraftMode, META_POLL_BATCH_SIZE, META_POLL_DELAY_MS } from '@/lib/draft/constants'
import { processBattleForMeta, type MetaAccumulators } from '@/lib/draft/meta-accumulator'

/**
 * Cron: Poll top global players' battlelogs and aggregate into meta_stats/meta_matchups.
 * Runs every 2-4 hours. Protected by CRON_SECRET.
 */
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

  let processed = 0
  let skipped = 0
  let errors = 0
  let battlesProcessed = 0

  try {
    // 1. Fetch top players from global rankings
    const rankings = await fetchPlayerRankings('global', META_POLL_BATCH_SIZE)
    const playerTags = rankings.items.map(p => p.tag)

    // 2. Load existing cursors for deduplication
    const { data: cursors } = await supabase
      .from('meta_poll_cursors')
      .select('player_tag, last_battle_time')
      .in('player_tag', playerTags)

    const cursorMap = new Map<string, string>()
    for (const c of cursors ?? []) {
      cursorMap.set(c.player_tag, c.last_battle_time)
    }

    // 3. Process each player's battlelog
    const acc: MetaAccumulators = { stats: new Map(), matchups: new Map() }
    const cursorUpdates: { player_tag: string; last_battle_time: string }[] = []
    const today = new Date().toISOString().slice(0, 10) // UTC date string YYYY-MM-DD

    for (const tag of playerTags) {
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

          // Track latest for cursor update
          if (battleTime > latestBattleTime) latestBattleTime = battleTime

          const battle = entry.battle
          const mode = battle.mode || entry.event.mode
          const map = entry.event.map || null

          // Filter: only 3v3 draft modes, not friendly, has result, has teams of 3
          if (!isDraftMode(mode)) continue
          if (battle.type === 'friendly') continue
          if (battle.result !== 'victory' && battle.result !== 'defeat') continue
          if (!battle.teams || battle.teams.length !== 2) continue
          if (battle.teams[0].length !== 3 || battle.teams[1].length !== 3) continue

          // Find the polled player in the teams (CRITICAL: by tag, not by index)
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

          battlesProcessed++
        }

        // Update cursor for this player
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

    // 4. Bulk upsert meta_stats (single RPC call instead of hundreds)
    if (acc.stats.size > 0) {
      const statRows = Array.from(acc.stats.entries()).map(([key, val]) => {
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

    // 5. Bulk upsert meta_matchups (single RPC call instead of thousands)
    if (acc.matchups.size > 0) {
      const matchupRows = Array.from(acc.matchups.entries()).map(([key, val]) => {
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

    // 6. Update cursors
    if (cursorUpdates.length > 0) {
      await supabase.from('meta_poll_cursors').upsert(cursorUpdates, {
        onConflict: 'player_tag',
      })
    }

    // 7. Cleanup old data (>30 days)
    await supabase.from('meta_stats').delete().lt('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    await supabase.from('meta_matchups').delete().lt('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))

    return NextResponse.json({
      processed,
      skipped,
      errors,
      battlesProcessed,
      statKeys: acc.stats.size,
      matchupKeys: acc.matchups.size,
    })
  } catch (err) {
    console.error('[meta-poll] Fatal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
