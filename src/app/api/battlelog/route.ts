import { NextResponse } from 'next/server'
import { PLAYER_TAG_REGEX } from '@/lib/constants'
import { fetchBattlelog, SuprecellApiError } from '@/lib/api'

export async function POST(req: Request) {
  try {
    const { playerTag } = await req.json()

    if (!playerTag || typeof playerTag !== 'string' || !PLAYER_TAG_REGEX.test(playerTag)) {
      return NextResponse.json({ error: 'Invalid player tag format', code: 400 }, { status: 400 })
    }

    const data = await fetchBattlelog(playerTag)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      return NextResponse.json({ error: error.message, code: error.status }, { status: error.status })
    }
    return NextResponse.json({ error: 'Internal server error', code: 500 }, { status: 500 })
  }
}
