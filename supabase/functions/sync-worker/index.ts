// Supabase Edge Function — sync-worker
// Polls sync_queue for pending jobs and processes them.
// Deployed via: supabase functions deploy sync-worker
//
// IMPORTANT: This duplicates parseBattle logic from src/lib/battle-parser.ts
// adapted for Deno. If the parser changes, update BOTH files.
// The canonical source is the Next.js version (which has TDD tests).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPERCELL_API_BASE = Deno.env.get('BRAWLSTARS_API_URL') || 'http://141.253.197.60:3001/v1'
const SUPERCELL_API_KEY = Deno.env.get('BRAWLSTARS_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface BattlePlayer {
  tag: string
  name: string
  brawler: { id: number; name: string; power: number; trophies: number }
}

function parseBattleTime(raw: string): string {
  const y = raw.slice(0, 4), m = raw.slice(4, 6), d = raw.slice(6, 8)
  const h = raw.slice(9, 11), min = raw.slice(11, 13), sec = raw.slice(13, 15)
  return `${y}-${m}-${d}T${h}:${min}:${sec}.000Z`
}

function findPlayer(battle: Record<string, unknown>, tag: string) {
  const teams = battle.teams as BattlePlayer[][] | undefined
  const players = battle.players as BattlePlayer[] | undefined

  if (teams) {
    for (let i = 0; i < teams.length; i++) {
      const p = teams[i].find(x => x.tag === tag)
      if (p) {
        const teammates = teams[i].filter(x => x.tag !== tag)
        const opponents: BattlePlayer[] = []
        for (let j = 0; j < teams.length; j++) {
          if (j !== i) opponents.push(...teams[j])
        }
        return { player: p, teammates, opponents }
      }
    }
  } else if (players) {
    const p = players.find(x => x.tag === tag)
    if (p) return { player: p, teammates: [], opponents: players.filter(x => x.tag !== tag) }
  }
  return null
}

async function processTag(playerTag: string): Promise<{ fetched: number; inserted: number }> {
  const encoded = encodeURIComponent(playerTag)
  const res = await fetch(`${SUPERCELL_API_BASE}/players/${encoded}/battlelog`, {
    headers: { Authorization: `Bearer ${SUPERCELL_API_KEY}`, Accept: 'application/json' },
  })

  if (!res.ok) throw new Error(`Supercell API ${res.status}`)
  const data = await res.json()
  const items = data.items ?? []
  if (items.length === 0) return { fetched: 0, inserted: 0 }

  // deno-lint-ignore no-explicit-any
  const rows: any[] = []
  for (const entry of items) {
    const found = findPlayer(entry.battle, playerTag)
    if (!found) continue

    rows.push({
      player_tag: playerTag,
      battle_time: parseBattleTime(entry.battleTime),
      mode: entry.battle.mode || entry.event?.mode || 'unknown',
      map: entry.event?.map || null,
      result: entry.battle.result,
      trophy_change: entry.battle.trophyChange ?? 0,
      duration: entry.battle.duration ?? null,
      is_star_player: entry.battle.starPlayer?.tag === playerTag,
      my_brawler: {
        id: found.player.brawler.id, name: found.player.brawler.name,
        power: found.player.brawler.power, trophies: found.player.brawler.trophies,
        gadgets: [], starPowers: [], hypercharges: [],
      },
      teammates: found.teammates.map((t: BattlePlayer) => ({
        tag: t.tag, name: t.name,
        brawler: { id: t.brawler.id, name: t.brawler.name, power: t.brawler.power, trophies: t.brawler.trophies },
      })),
      opponents: found.opponents.map((o: BattlePlayer) => ({
        tag: o.tag, name: o.name,
        brawler: { id: o.brawler.id, name: o.brawler.name, power: o.brawler.power, trophies: o.brawler.trophies },
      })),
    })
  }

  if (rows.length > 0) {
    await supabase.from('battles').upsert(rows, { onConflict: 'player_tag,battle_time', ignoreDuplicates: true })
  }

  await supabase.from('profiles').update({ last_sync: new Date().toISOString() }).eq('player_tag', playerTag)

  return { fetched: items.length, inserted: rows.length }
}

Deno.serve(async (_req) => {
  try {
    // Claim up to 5 pending jobs using RPC
    const { data: jobs, error: claimErr } = await supabase.rpc('claim_sync_jobs', { batch_size: 5 })

    if (claimErr || !jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    const results = []
    for (const job of jobs) {
      try {
        const result = await processTag(job.player_tag)
        await supabase.from('sync_queue').update({ completed_at: new Date().toISOString() }).eq('id', job.id)
        results.push({ tag: job.player_tag, ...result })
      } catch (err) {
        await supabase.from('sync_queue').update({ error: String(err) }).eq('id', job.id)
        results.push({ tag: job.player_tag, error: String(err) })
      }

      // Rate limit: 200ms between tags
      await new Promise(r => setTimeout(r, 200))
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
