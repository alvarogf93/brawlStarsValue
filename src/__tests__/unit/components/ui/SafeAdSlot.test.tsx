import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// `SafeAdSlot` only renders an `<AdPlaceholder>` when `hasContent` is
// true. Mock the AdPlaceholder so tests stay isolated from AdSense /
// `useAuth` / Supabase wiring — we just need to know whether the
// placeholder was rendered at all.
vi.mock('@/components/ui/AdPlaceholder', () => ({
  AdPlaceholder: ({ className }: { className?: string }) => (
    <div data-testid="ad-placeholder-stub" className={className} />
  ),
}))

import { SafeAdSlot } from '@/components/ui/SafeAdSlot'

describe('SafeAdSlot — ARQ-05 hasContent gate', () => {
  it('returns null when hasContent is false (loading/empty state)', () => {
    const { container, queryByTestId } = render(<SafeAdSlot hasContent={false} />)
    expect(queryByTestId('ad-placeholder-stub')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('renders the underlying AdPlaceholder when hasContent is true', () => {
    const { getByTestId } = render(<SafeAdSlot hasContent />)
    expect(getByTestId('ad-placeholder-stub')).toBeTruthy()
  })

  it('forwards className to the underlying AdPlaceholder when active', () => {
    const { getByTestId } = render(
      <SafeAdSlot hasContent className="mt-8 max-w-4xl mx-auto" />,
    )
    expect(getByTestId('ad-placeholder-stub').className).toBe('mt-8 max-w-4xl mx-auto')
  })

  it('does not render when hasContent flips false even if a className is passed', () => {
    // Defends against a regression where a future refactor makes the
    // className path render the wrapper unconditionally — a real bug
    // we want the test to catch.
    const { container } = render(<SafeAdSlot hasContent={false} className="mb-6" />)
    expect(container.firstChild).toBeNull()
  })
})
