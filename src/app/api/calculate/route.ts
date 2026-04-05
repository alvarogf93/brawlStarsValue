import { NextResponse } from 'next/server'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { fetchPlayer, SuprecellApiError } from '@/lib/api'
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

    const playerData = await fetchPlayer(playerTag)
    const result = calculateValue(playerData)

    return NextResponse.json({
      ...result,
      timestamp: result.timestamp.toISOString(),
      // Include raw player data for brawlers/stats pages (persisted in localStorage)
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
