import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { ConfidenceBadge } from '@/components/ui/ConfidenceBadge'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      confidenceHigh: 'Dato fiable (10+ partidas)',
      confidenceMedium: 'Dato limitado (3-9 partidas)',
      confidenceLow: 'Dato insuficiente (1-2 partidas)',
    }
    return map[key] ?? key
  },
}))

describe('ConfidenceBadge', () => {
  it('renders green dot for high confidence (≥10 games)', () => {
    const { container } = render(<ConfidenceBadge total={15} />)
    const dot = container.querySelector('[data-confidence="high"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-green-400')
  })

  it('renders yellow dot for medium confidence (3-9 games)', () => {
    const { container } = render(<ConfidenceBadge total={5} />)
    const dot = container.querySelector('[data-confidence="medium"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-amber-400')
  })

  it('renders muted dot for low confidence (1-2 games)', () => {
    const { container } = render(<ConfidenceBadge total={1} />)
    const dot = container.querySelector('[data-confidence="low"]')
    expect(dot).toBeTruthy()
    expect(dot?.className).toContain('bg-slate-600')
  })

  it('renders nothing for 0 games', () => {
    const { container } = render(<ConfidenceBadge total={0} />)
    expect(container.innerHTML).toBe('')
  })

  it('applies opacity class for low confidence', () => {
    const { container } = render(<ConfidenceBadge total={2} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper?.className).toContain('opacity-50')
  })

  it('does not apply opacity for high confidence', () => {
    const { container } = render(<ConfidenceBadge total={12} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper?.className).not.toContain('opacity-50')
  })

  it('does not apply opacity for medium confidence', () => {
    const { container } = render(<ConfidenceBadge total={5} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper?.className).not.toContain('opacity-50')
  })

  it('includes tooltip text via title attribute', () => {
    const { container } = render(<ConfidenceBadge total={15} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper?.getAttribute('title')).toBe('Dato fiable (10+ partidas)')
  })

  it('boundary: exactly 10 games = high', () => {
    const { container } = render(<ConfidenceBadge total={10} />)
    expect(container.querySelector('[data-confidence="high"]')).toBeTruthy()
  })

  it('boundary: exactly 3 games = medium', () => {
    const { container } = render(<ConfidenceBadge total={3} />)
    expect(container.querySelector('[data-confidence="medium"]')).toBeTruthy()
  })
})
