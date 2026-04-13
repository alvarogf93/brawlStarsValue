import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { BrawlImg } from '@/components/ui/BrawlImg'

describe('BrawlImg — src prop reactivity', () => {
  it('renders the initial src', () => {
    const { container } = render(
      <BrawlImg src="/a.png" alt="A" fallbackSrc="/a-fallback.png" />
    )
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('/a.png')
  })

  it('updates img src when the src prop changes (reused instance)', () => {
    const { container, rerender } = render(
      <BrawlImg src="/a.png" alt="A" fallbackSrc="/a-fallback.png" />
    )
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/a.png')

    rerender(<BrawlImg src="/b.png" alt="B" fallbackSrc="/b-fallback.png" />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/b.png')
  })

  it('falls back to fallbackSrc after the primary src errors', () => {
    const { container } = render(
      <BrawlImg src="/primary.png" alt="X" fallbackSrc="/fallback.png" />
    )
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/fallback.png')
  })

  it('resets fallback state when src prop changes', () => {
    const { container, rerender } = render(
      <BrawlImg src="/primary.png" alt="X" fallbackSrc="/fallback.png" />
    )
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/fallback.png')

    rerender(<BrawlImg src="/next.png" alt="Y" fallbackSrc="/next-fallback.png" />)
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/next.png')
  })

  it('shows initials placeholder after both primary and fallback fail', () => {
    const { container } = render(
      <BrawlImg src="/primary.png" alt="Edgar" fallbackSrc="/fallback.png" />
    )
    const initialImg = container.querySelector('img')!
    fireEvent.error(initialImg)
    const fallbackImg = container.querySelector('img')!
    fireEvent.error(fallbackImg)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('ED')
  })
})
