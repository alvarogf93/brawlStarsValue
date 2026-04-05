import { NextResponse } from 'next/server'
import { fetchEventRotation, SuprecellApiError } from '@/lib/api'

export async function GET() {
  try {
    const data = await fetchEventRotation()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof SuprecellApiError) {
      return NextResponse.json({ error: error.message, code: error.status }, { status: error.status })
    }
    return NextResponse.json({ error: 'Internal server error', code: 500 }, { status: 500 })
  }
}
