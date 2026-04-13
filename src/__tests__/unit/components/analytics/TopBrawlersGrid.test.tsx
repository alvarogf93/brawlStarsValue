import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const map: Record<string, string> = {
      topBrawlersTitle: 'Top Brawlers',
      topBrawlersSubtitle: 'Based on top pros',
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

describe('TopBrawlersGrid — Sprint D Task 2 (dataset clarity subtitle)', () => {
  it('renders the topBrawlers subtitle in the header block', () => {
    render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    expect(screen.getByText('Based on top pros')).toBeTruthy()
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

describe('TopBrawlersGrid — Task 7 (inline counters)', () => {
  const MOCK_COUNTERS = [
    {
      brawlerId: 1,  // CROW (first in MOCK_BRAWLERS)
      name: 'CROW',
      bestCounters: [
        { opponentId: 10, name: 'DYNAMIKE', winRate: 58, total: 120 },
        { opponentId: 11, name: 'PIPER', winRate: 56, total: 110 },
        { opponentId: 12, name: 'COLT', winRate: 54, total: 95 },
      ],
      worstMatchups: [],
    },
    {
      brawlerId: 2,  // BULL
      name: 'BULL',
      bestCounters: [
        { opponentId: 13, name: 'LEON', winRate: 61, total: 80 },
      ],
      worstMatchups: [],
    },
    // Note: no entry for brawlerId 3 (PIPER) — component should handle gracefully
  ]

  it('renders inline counter names for brawlers that have counter data', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        counters={MOCK_COUNTERS}
      />,
    )
    // CROW's counters
    expect(screen.getByText(/DYNAMIKE/)).toBeTruthy()
    // PIPER appears both as a brawler row AND as a counter to CROW — getAllByText to disambiguate
    expect(screen.getAllByText(/PIPER/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/COLT/)).toBeTruthy()
    // BULL's counter
    expect(screen.getByText(/LEON/)).toBeTruthy()
  })

  it('does not crash when counters array is missing', () => {
    expect(() => {
      render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    }).not.toThrow()
  })

  it('does not crash when a brawler has no corresponding counter entry', () => {
    render(
      <TopBrawlersGrid
        brawlers={MOCK_BRAWLERS}
        totalBattles={3000}
        counters={MOCK_COUNTERS}
      />,
    )
    // PIPER is brawler 3 in MOCK_BRAWLERS but not in MOCK_COUNTERS — should render without error
    expect(screen.getAllByText(/PIPER/).length).toBeGreaterThan(0)  // at least the card itself
  })

  it('shows ConfidenceBadge on each counter entry', () => {
    const { container } = render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[0]]}
        totalBattles={3000}
        counters={[MOCK_COUNTERS[0]]}
      />,
    )
    // 1 badge for the brawler card + 3 for the counters = 4 total
    const badges = container.querySelectorAll('[data-confidence]')
    expect(badges.length).toBeGreaterThanOrEqual(4)
  })
})
