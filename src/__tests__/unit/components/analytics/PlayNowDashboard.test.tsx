import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { mockNextIntl } from '@/__tests__/helpers/mock-next-intl'

vi.mock('next-intl', () => mockNextIntl({
  playNowTitle: 'Play Now',
  playNowEmpty: 'Play more to unlock recommendations!',
  playNowSubtitle: 'Based on your personal history',
  playNowModeAggregateBadge: 'Mode',
  playNowModeAggregateTooltip: 'No specific map data — showing mode aggregate',
  ended: 'ended',
  confidenceHigh: 'High',
  confidenceMedium: 'Medium',
  confidenceLow: 'Low',
}))

// Mock heavy children to keep tests focused on PlayNowDashboard's own markup.
vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} />,
}))
vi.mock('@/components/ui/ModeIcon', () => ({
  ModeIcon: ({ mode }: { mode: string }) => <span data-testid={`mode-icon-${mode}`} />,
}))

import { PlayNowDashboard } from '@/components/analytics/PlayNowDashboard'
import type { PlayNowRecommendation } from '@/lib/analytics/types'

const futureIso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

const MOCK_RECOMMENDATIONS: PlayNowRecommendation[] = [
  {
    map: 'Sidetrack',
    mode: 'brawlBall',
    eventId: 15000026,
    slotEndTime: futureIso(3600_000),
    source: 'map-specific',
    recommendations: [
      {
        brawlerId: 1,
        brawlerName: 'EDGAR',
        winRate: 72.4,
        gamesPlayed: 24,
        wilsonScore: 62,
        bestTrio: null,
      },
    ],
  },
  {
    map: 'Pit Stop',
    mode: 'heist',
    eventId: 15000050,
    slotEndTime: futureIso(1800_000),
    source: 'mode-aggregate',
    recommendations: [
      {
        brawlerId: 2,
        brawlerName: 'DYNAMIKE',
        winRate: 58.1,
        gamesPlayed: 15,
        wilsonScore: 42,
        bestTrio: null,
      },
    ],
  },
]

describe('PlayNowDashboard — Sprint D Task 2 (dataset clarity)', () => {
  it('renders the playNow subtitle when recommendations are present', () => {
    render(<PlayNowDashboard recommendations={MOCK_RECOMMENDATIONS} />)
    expect(screen.getByText('Based on your personal history')).toBeTruthy()
  })

  it('renders the playNow subtitle in the empty state too', () => {
    render(<PlayNowDashboard recommendations={[]} />)
    expect(screen.getByText('Based on your personal history')).toBeTruthy()
  })

  it('renders the mode-aggregate badge on a slot where source is "mode-aggregate"', () => {
    render(<PlayNowDashboard recommendations={MOCK_RECOMMENDATIONS} />)
    // The mock returns 'Mode' for playNowModeAggregateBadge
    const badges = screen.getAllByText('Mode')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('does NOT render the mode-aggregate badge on a slot where source is "map-specific"', () => {
    // Only the map-specific slot
    const mapSpecificOnly: PlayNowRecommendation[] = [MOCK_RECOMMENDATIONS[0]]
    render(<PlayNowDashboard recommendations={mapSpecificOnly} />)
    expect(screen.queryByText('Mode')).toBeNull()
  })

  it('sets the tooltip title on the mode-aggregate badge', () => {
    const { container } = render(<PlayNowDashboard recommendations={MOCK_RECOMMENDATIONS} />)
    const badge = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'Mode',
    )
    expect(badge).toBeTruthy()
    expect(badge?.getAttribute('title')).toBe('No specific map data — showing mode aggregate')
  })
})
