import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mockNextIntl } from '@/__tests__/helpers/mock-next-intl'

vi.mock('next-intl', () => mockNextIntl({
  brawlerTierList: 'Tier List',
  brawlers: 'brawlers',
  tierListSubtitle: 'Tus brawlers agrupados por tier',
  tierListSelectHint: 'Selecciona un brawler',
  tierListEmptyTier: '—',
  // Sample-size label — lock the "N partidas" pattern so a future
  // visual redesign cannot silently drop it from the detail panel.
  gamesCount: '{count} partidas',
  confidenceHigh: 'High',
  confidenceMedium: 'Medium',
  confidenceLow: 'Low',
}))

vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} data-testid="brawl-img" />,
}))

import { BrawlerTierList } from '@/components/analytics/BrawlerTierList'

interface BrawlerPerformance {
  id: number
  name: string
  wins: number
  losses: number
  total: number
  winRate: number
  confidence: 'high' | 'medium' | 'low'
  starPlayerRate: number
  avgTrophyChange: number
}

const MOCK_DATA: BrawlerPerformance[] = [
  // S tier (≥65%)
  { id: 1, name: 'EDGAR', wins: 18, losses: 6, total: 24, winRate: 75, confidence: 'high', starPlayerRate: 18.3, avgTrophyChange: 11 },
  // A tier (≥55%)
  { id: 2, name: 'MICO', wins: 12, losses: 8, total: 20, winRate: 60, confidence: 'high', starPlayerRate: 15, avgTrophyChange: 6 },
  { id: 3, name: 'LEON', wins: 8, losses: 6, total: 14, winRate: 57.1, confidence: 'high', starPlayerRate: 12, avgTrophyChange: 4 },
  // B tier (≥45%)
  { id: 4, name: 'ROSA', wins: 5, losses: 5, total: 10, winRate: 50, confidence: 'high', starPlayerRate: 10, avgTrophyChange: 2 },
  { id: 5, name: 'BULL', wins: 4, losses: 5, total: 9, winRate: 44.4, confidence: 'medium', starPlayerRate: 8, avgTrophyChange: -1 },
  // C tier (≥35%)
  { id: 6, name: 'SHELLY', wins: 3, losses: 5, total: 8, winRate: 37.5, confidence: 'medium', starPlayerRate: 5, avgTrophyChange: -3 },
  // D tier (<35%)
  { id: 7, name: 'JACKY', wins: 2, losses: 8, total: 10, winRate: 20, confidence: 'high', starPlayerRate: 3, avgTrophyChange: -8 },
  // Below threshold — should be filtered
  { id: 8, name: 'HIDDEN', wins: 1, losses: 1, total: 2, winRate: 50, confidence: 'low', starPlayerRate: 0, avgTrophyChange: 0 },
]

describe('BrawlerTierList — tier grouping layout', () => {
  it('returns null for empty data', () => {
    const { container } = render(<BrawlerTierList data={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders all 5 tier rows even when some are empty', () => {
    // Use data with only S-tier brawlers to force empty A/B/C/D rows
    const onlySTier: BrawlerPerformance[] = [
      { id: 1, name: 'EDGAR', wins: 18, losses: 6, total: 24, winRate: 75, confidence: 'high', starPlayerRate: 18, avgTrophyChange: 11 },
    ]
    const { container } = render(<BrawlerTierList data={onlySTier} />)
    // Expect 5 tier-row containers in the DOM
    const tierRows = container.querySelectorAll('[data-tier]')
    expect(tierRows.length).toBe(5)
  })

  it('groups brawlers into the correct tier based on win rate', () => {
    const { container } = render(<BrawlerTierList data={MOCK_DATA} />)
    // S tier should have Edgar
    const sTier = container.querySelector('[data-tier="S"]')
    expect(sTier?.textContent).toContain('EDGAR')
    // A tier should have Mico and Leon
    const aTier = container.querySelector('[data-tier="A"]')
    expect(aTier?.textContent).toContain('MICO')
    expect(aTier?.textContent).toContain('LEON')
    // D tier should have Jacky
    const dTier = container.querySelector('[data-tier="D"]')
    expect(dTier?.textContent).toContain('JACKY')
  })

  it('filters out brawlers below the 3-game threshold', () => {
    const { container } = render(<BrawlerTierList data={MOCK_DATA} />)
    expect(container.textContent).not.toContain('HIDDEN')
  })

  it('shows the select hint when no brawler is selected', () => {
    render(<BrawlerTierList data={MOCK_DATA} />)
    expect(screen.getByText(/Selecciona un brawler/)).toBeTruthy()
  })

  it('shows detail panel when a brawler tile is clicked', () => {
    const { container } = render(<BrawlerTierList data={MOCK_DATA} />)
    // Click the first brawler tile (Edgar, S-tier)
    const edgarTile = container.querySelector('[data-brawler-id="1"]')
    expect(edgarTile).toBeTruthy()
    fireEvent.click(edgarTile!)
    // Select hint is replaced with detail panel showing Edgar's stats
    expect(screen.queryByText(/Selecciona un brawler/)).toBeNull()
    // Detail panel shows the games summary
    expect(screen.getByText(/24 partidas/)).toBeTruthy()
    expect(screen.getByText(/18W/)).toBeTruthy()
  })

  it('deselects when clicking the same tile twice', () => {
    const { container } = render(<BrawlerTierList data={MOCK_DATA} />)
    const edgarTile = container.querySelector('[data-brawler-id="1"]')
    fireEvent.click(edgarTile!)
    fireEvent.click(edgarTile!)
    expect(screen.getByText(/Selecciona un brawler/)).toBeTruthy()
  })

  it('switches detail panel when clicking a different tile', () => {
    const { container } = render(<BrawlerTierList data={MOCK_DATA} />)
    // Click Edgar (S-tier, 24 games)
    fireEvent.click(container.querySelector('[data-brawler-id="1"]')!)
    expect(screen.getByText(/24 partidas/)).toBeTruthy()
    // Click Mico (A-tier, 20 games) — detail panel must now reflect Mico
    fireEvent.click(container.querySelector('[data-brawler-id="2"]')!)
    expect(screen.getByText(/\b20 partidas\b/)).toBeTruthy()
    // Edgar's counts should no longer be visible in the detail panel
    expect(screen.queryByText(/\b24 partidas\b/)).toBeNull()
  })

  it('renders the tile portrait with data-testid', () => {
    const { getAllByTestId } = render(<BrawlerTierList data={MOCK_DATA} />)
    const imgs = getAllByTestId('brawl-img')
    // 7 brawlers pass the threshold
    expect(imgs.length).toBe(7)
  })
})
