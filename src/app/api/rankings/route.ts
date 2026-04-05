import { NextResponse } from 'next/server'
import { fetchPlayerRankings, SuprecellApiError } from '@/lib/api'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const country = searchParams.get('country') || 'global'
    const limit = Math.min(Number(searchParams.get('limit') || 200), 200)

    const data = await fetchPlayerRankings(country, limit)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      return NextResponse.json({ error: error.message, code: error.status }, { status: error.status })
    }
    return NextResponse.json({ error: 'Internal server error', code: 500 }, { status: 500 })
  }
}
