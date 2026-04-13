import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      topBrawlersTitle: 'Top Brawlers',
      totalBattles: `${params?.count ?? '?'} battles`,
      noDataForMap: 'No data for map',
      sampleSize: `${params?.count ?? '?'} batallas`,
      confidenceHigh: 'High confidence',
      confidenceMedium: 'Medium confidence',
      confidenceLow: 'Low confidence',
      modeFallbackBanner: 'Mostrando datos agregados del modo',
    }
    return map[key] ?? key
  },
}))

vi.mock('@/components/ui/BrawlImg', () => ({
  BrawlImg: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

import { TopBrawlersGrid } from '@/components/analytics/TopBrawlersGrid'
import type { TopBrawlerEntry } from '@/lib/draft/pro-analysis'

const MOCK_BRAWLERS: TopBrawlerEntry[] = [
  { brawlerId: 1, name: 'CROW', winRate: 62.4, pickRate: 8.2, totalBattles: 142, trend7d: 2.3, trend30d: 1.1 },
  { brawlerId: 2, name: 'BULL', winRate: 58.1, pickRate: 7.5, totalBattles: 98, trend7d: null, trend30d: null },
  { brawlerId: 3, name: 'PIPER', winRate: 56.8, pickRate: 6.9, totalBattles: 8, trend7d: -1.1, trend30d: null },
]

describe('TopBrawlersGrid — Task 5 (sample size + confidence)', () => {
  it('renders per-card totalBattles for each brawler', () => {
    render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    expect(screen.getByText(/\b142 batallas\b/)).toBeTruthy()
    expect(screen.getByText(/\b98 batallas\b/)).toBeTruthy()
    expect(screen.getByText(/\b8 batallas\b/)).toBeTruthy()
  })

  it('renders a high-confidence dot for brawlers with ≥10 games', () => {
    const { container } = render(
      <TopBrawlersGrid brawlers={[MOCK_BRAWLERS[0]]} totalBattles={3000} />,
    )
    // ConfidenceBadge renders a data-confidence attribute with the level
    expect(container.querySelector('[data-confidence="high"]')).toBeTruthy()
  })

  it('renders a low-confidence dot for brawlers with <3 games', () => {
    const sparse: TopBrawlerEntry = {
      brawlerId: 99, name: 'TEST', winRate: 70, pickRate: 1, totalBattles: 2, trend7d: null, trend30d: null,
    }
    const { container } = render(
      <TopBrawlersGrid brawlers={[sparse]} totalBattles={10} />,
    )
    expect(container.querySelector('[data-confidence="low"]')).toBeTruthy()
  })

  it('renders the empty state when no brawlers', () => {
    render(<TopBrawlersGrid brawlers={[]} totalBattles={0} />)
    expect(screen.getByText('No data for map')).toBeTruthy()
  })
})

describe('TopBrawlersGrid — Task 6 (mode-fallback banner)', () => {
  it('does NOT render the fallback banner when source is "map-mode"', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        source="map-mode"
      />,
    )
    expect(screen.queryByText(/mode-fallback|datos agregados|fallback/i)).toBeNull()
  })

  it('renders the fallback banner when source is "mode-fallback"', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        source="mode-fallback"
      />,
    )
    // The i18n mock returns the key verbatim when missing, so assert on the key name
    expect(screen.getByText(/modeFallbackBanner|datos agregados/i)).toBeTruthy()
  })

  it('defaults to "map-mode" behaviour when source prop is omitted (backwards compat)', () => {
    render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    expect(screen.queryByText(/modeFallbackBanner/i)).toBeNull()
  })
})
