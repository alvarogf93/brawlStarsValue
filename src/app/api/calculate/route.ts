import { NextResponse } from 'next/server'
import { PLAYER_TAG_REGEX } from '@/lib/constants'

// Mock data to simulate API response for MVP
const MOCK_GEM_SCORE = {
  playerTag: '#2P0Q8C2C0',
  playerName: 'CyberBrawler',
  gemEquivalent: 15420,
  totalScore: 771000,
  breakdown: {
    base: { trophies: 7000, victories3vs3: 840, value: 7840 },
    assets: { brawlerCount: 65, value: 250000 },
    enhance: { 
      gadgets: 80, 
      starPowers: 60, 
      hypercharges: 10, 
      buffies: 5, 
      value: 13160 },
    elite: { 
      prestige1: 20, 
      prestige2: 5, 
      prestige3: 1, 
      value: 500000 }
  },
  timestamp: new Date().toISOString(),
  cached: false
}

export async function POST(req: Request) {
  try {
    const { playerTag } = await req.json()

    if (!playerTag || !PLAYER_TAG_REGEX.test(playerTag)) {
      return NextResponse.json(
        { error: 'Invalid format', code: 400 },
        { status: 400 }
      )
    }

    // Since we are mocking, we won't actually wait to prevent LCP issues.
    // The design specifies LCP < 2.5s, so respond immediately.
    
    // Customize mock slightly to reflect input tag
    const result = {
      ...MOCK_GEM_SCORE,
      playerTag: playerTag.toUpperCase()
    }

    return NextResponse.json(result)

  } catch (error) {
    return NextResponse.json(
      { error: 'Server error', code: 500 },
      { status: 500 }
    )
  }
}
