import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      winRate: 'Win Rate',
      pickRate: 'Pick Rate',
      totalBattles: 'Total Battles',
      trending: 'Trending',
      bestMaps: 'Best Maps',
      strongAgainst: 'Strong Against',
      weakAgainst: 'Weak Against',
      bestTeammates: 'Best Teammates',
      insufficientData: 'Datos insuficientes',
      matchupsEmptyContextual: 'No hay matchups registrados',
      bestMapsEmptyContextual: 'No hay datos de mapas',
      bestTeammatesEmptyContextual: 'No hay teammates registrados',
      rising: 'Rising',
      falling: 'Falling',
      stable: 'Stable',
      sampleSize: `${params?.count ?? '?'} batallas`,
      confidenceHigh: 'High',
      confidenceMedium: 'Medium',
      confidenceLow: 'Low',
    }
    return map[key] ?? key
  },
}))

vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock('@/hooks/useMapImages', () => ({
  useMapImages: () => ({}),
}))

vi.mock('@/lib/brawler-name', () => ({
  resolveBrawlerName: (id: number) => `Brawler${id}`,
}))

vi.mock('@/lib/brawler-registry', () => ({
  getCachedRegistry: () => null,
  setCachedRegistry: () => {},
}))

import { MetaIntelligence } from '@/components/brawler-detail/MetaIntelligence'
import type { BrawlerMetaResponse } from '@/lib/brawler-detail/types'

const MOCK_DATA: BrawlerMetaResponse = {
  brawlerId: 1,
  globalStats: {
    winRate: 58,
    pickRate: 8.2,
    totalBattles: 1500,
    trend7d: 2.1,
  },
  bestMaps: [
    { map: 'Sidetrack', mode: 'brawlBall', eventId: null, winRate: 65, totalBattles: 342 },
    { map: 'Nutmeg', mode: 'brawlBall', eventId: null, winRate: 62, totalBattles: 298 },
  ],
  worstMaps: [],
  strongAgainst: [
    { opponentId: 10, opponentName: 'Bull', winRate: 68, totalBattles: 156 },
    { opponentId: 11, opponentName: 'Shelly', winRate: 64, totalBattles: 120 },
  ],
  weakAgainst: [
    { opponentId: 20, opponentName: 'Crow', winRate: 38, totalBattles: 89 },
  ],
  bestTeammates: [
    { teammateId: 30, teammateName: 'Poco', winRate: 62, totalBattles: 54 },
  ],
}

describe('MetaIntelligence — Task 10 (sample size + confidence)', () => {
  it('renders per-row total battles in strongAgainst', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/\b156 batallas\b/)).toBeTruthy()
    expect(screen.getByText(/\b120 batallas\b/)).toBeTruthy()
  })

  it('renders per-row total battles in weakAgainst', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/\b89 batallas\b/)).toBeTruthy()
  })

  it('renders per-row total battles in bestTeammates', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/\b54 batallas\b/)).toBeTruthy()
  })

  it('renders per-card total battles in bestMaps', () => {
    render(<MetaIntelligence data={MOCK_DATA} />)
    expect(screen.getByText(/\b342 batallas\b/)).toBeTruthy()
    expect(screen.getByText(/\b298 batallas\b/)).toBeTruthy()
  })

  it('renders ConfidenceBadge data-confidence attributes on rows', () => {
    const { container } = render(<MetaIntelligence data={MOCK_DATA} />)
    const badges = container.querySelectorAll('[data-confidence]')
    // 2 strongAgainst + 1 weakAgainst + 1 bestTeammates + 2 bestMaps = 6
    expect(badges.length).toBeGreaterThanOrEqual(6)
  })
})

describe('MetaIntelligence — Task 11 (contextual empty states)', () => {
  const EMPTY_DATA: BrawlerMetaResponse = {
    brawlerId: 99,
    globalStats: { winRate: 50, pickRate: 0.5, totalBattles: 12, trend7d: 0 },
    bestMaps: [],
    worstMaps: [],
    strongAgainst: [],
    weakAgainst: [],
    bestTeammates: [],
  }

  it('uses contextual key for empty strongAgainst', () => {
    render(<MetaIntelligence data={EMPTY_DATA} />)
    // Mock returns the key verbatim when missing; the component must reference
    // the new key name, not the old generic "insufficientData".
    expect(screen.queryAllByText(/matchupsEmptyContextual|No hay matchups/i).length).toBeGreaterThan(0)
  })

  it('uses contextual key for empty bestMaps', () => {
    render(<MetaIntelligence data={EMPTY_DATA} />)
    expect(screen.queryAllByText(/bestMapsEmptyContextual|No hay datos de mapas/i).length).toBeGreaterThan(0)
  })

  it('still renders the globalStats grid even when everything else is empty', () => {
    render(<MetaIntelligence data={EMPTY_DATA} />)
    // Win rate and pick rate labels still visible (from the globalStats grid)
    expect(screen.getByText('Win Rate')).toBeTruthy()
    expect(screen.getByText('Pick Rate')).toBeTruthy()
  })
})
