import { NextResponse } from 'next/server'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { fetchPlayer, fetchBattlelog, SuprecellApiError } from '@/lib/api'
import { calculateValue } from '@/lib/calculate'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { playerTag } = body

    if (!playerTag || typeof playerTag !== 'string' || !PLAYER_TAG_REGEX.test(playerTag)) {
      return NextResponse.json(
        { error: 'Invalid player tag format', code: 400 },
        { status: 400 },
      )
    }

    // Fetch player + battlelog in parallel (battlelog is best-effort for winRate)
    const [playerData, battlelog] = await Promise.all([
      fetchPlayer(playerTag),
      fetchBattlelog(playerTag).catch(() => null),
    ])

    // Extract real win rate from battlelog if available
    let winRate: number | undefined
    if (battlelog?.items?.length) {
      const battles = battlelog.items
      const wins = battles.filter((b: { battle: { result: string } }) => b.battle.result === 'victory').length
      const total = battles.length
      if (total > 0) winRate = wins / total
    }

    const result = calculateValue(playerData, { winRate })

    return NextResponse.json({
      ...result,
      timestamp: result.timestamp.toISOString(),
      player: {
        trophies: playerData.trophies,
        highestTrophies: playerData.highestTrophies,
        totalPrestigeLevel: playerData.totalPrestigeLevel,
        expLevel: playerData.expLevel,
        soloVictories: playerData.soloVictories,
        duoVictories: playerData.duoVictories,
        '3vs3Victories': playerData['3vs3Victories'],
        club: playerData.club,
        icon: playerData.icon,
        brawlers: playerData.brawlers,
      },
    })
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      const messages: Record<number, string> = {
        403: 'API access denied — key or IP not whitelisted',
        404: 'Player not found',
        429: 'Rate limit exceeded, try again later',
        503: 'Brawl Stars servers under maintenance',
      }
      return NextResponse.json(
        { error: messages[error.status] ?? error.message, code: error.status },
        { status: error.status },
      )
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message, code: 500 }, { status: 500 })
  }
}
