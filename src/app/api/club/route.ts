import { NextResponse } from 'next/server'
import { fetchClub, SuprecellApiError } from '@/lib/api'

export async function POST(req: Request) {
  try {
    const { clubTag } = await req.json()

    if (!clubTag || typeof clubTag !== 'string' || !/^#[0-9A-Z]{3,12}$/.test(clubTag.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid or missing clubTag', code: 400 }, { status: 400 })
    }

    const data = await fetchClub(clubTag)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      return NextResponse.json({ error: error.message, code: error.status }, { status: error.status })
    }
    return NextResponse.json({ error: 'Internal server error', code: 500 }, { status: 500 })
  }
}
