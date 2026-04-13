import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

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
      teammatesLabel: 'COMPAÑEROS',
      teammatesSeeMore: `Ver más (${params?.count ?? '?'})`,
      teammatesSeeLess: 'Ver menos',
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

describe('TopBrawlersGrid — Sprint D (inline teammates + ver más)', () => {
  const MOCK_TEAMMATES = [
    {
      brawlerId: 1, // CROW
      trios: [
        { teammates: [{ id: 20, name: 'FRANK' }, { id: 21, name: 'TARA' }], winRate: 68.4, total: 23 },
        { teammates: [{ id: 22, name: 'BYRON' }, { id: 23, name: 'POCO' }], winRate: 62.1, total: 11 },
        { teammates: [{ id: 24, name: 'STU' }, { id: 25, name: 'MORTIS' }], winRate: 60.0, total: 7 },
      ],
    },
    {
      brawlerId: 2, // BULL
      trios: [
        { teammates: [{ id: 30, name: 'ROSA' }, { id: 31, name: 'JACKY' }], winRate: 55.2, total: 9 },
      ],
    },
  ]

  it('renders the teammates label and the top 1 trio by default', () => {
    render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[0]]}
        totalBattles={3000}
        topBrawlerTeammates={MOCK_TEAMMATES}
      />,
    )
    expect(screen.getByText('COMPAÑEROS')).toBeTruthy()
    // Default visible trio for CROW: FRANK + TARA
    expect(screen.getByText('FRANK + TARA')).toBeTruthy()
    // Hidden trio should NOT appear by default
    expect(screen.queryByText('BYRON + POCO')).toBeNull()
  })

  it('renders a "Ver más (N)" button when multiple trios are available', () => {
    render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[0]]}
        totalBattles={3000}
        topBrawlerTeammates={MOCK_TEAMMATES}
      />,
    )
    // CROW has 3 trios total; default shows 1 → button reveals 2 more
    expect(screen.getByText('Ver más (2)')).toBeTruthy()
  })

  it('does NOT render a "Ver más" button when only 1 trio exists', () => {
    render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[1]]}
        totalBattles={3000}
        topBrawlerTeammates={MOCK_TEAMMATES}
      />,
    )
    // BULL has only 1 trio — no expand button
    expect(screen.queryByText(/Ver más/)).toBeNull()
  })

  it('expands to show all trios when "Ver más" is clicked', () => {
    render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[0]]}
        totalBattles={3000}
        topBrawlerTeammates={MOCK_TEAMMATES}
      />,
    )
    const button = screen.getByText('Ver más (2)')
    fireEvent.click(button)
    // All three trios should now be visible
    expect(screen.getByText('FRANK + TARA')).toBeTruthy()
    expect(screen.getByText('BYRON + POCO')).toBeTruthy()
    expect(screen.getByText('STU + MORTIS')).toBeTruthy()
    // Button toggles to "Ver menos"
    expect(screen.getByText('Ver menos')).toBeTruthy()
  })

  it('collapses back to 1 trio when "Ver menos" is clicked', () => {
    render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[0]]}
        totalBattles={3000}
        topBrawlerTeammates={MOCK_TEAMMATES}
      />,
    )
    fireEvent.click(screen.getByText('Ver más (2)'))
    fireEvent.click(screen.getByText('Ver menos'))
    expect(screen.getByText('FRANK + TARA')).toBeTruthy()
    expect(screen.queryByText('BYRON + POCO')).toBeNull()
  })

  it('does not render a teammates block when the prop is missing', () => {
    render(<TopBrawlersGrid brawlers={MOCK_BRAWLERS} totalBattles={3000} />)
    expect(screen.queryByText('COMPAÑEROS')).toBeNull()
  })

  it('does not render a teammates block for a brawler with no trio entry', () => {
    // PIPER (id 3) is not in MOCK_TEAMMATES
    render(
      <TopBrawlersGrid
        brawlers={[MOCK_BRAWLERS[2]]}
        totalBattles={3000}
        topBrawlerTeammates={MOCK_TEAMMATES}
      />,
    )
    expect(screen.queryByText('COMPAÑEROS')).toBeNull()
  })
})
