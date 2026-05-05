'use client'

import { memo, useState } from 'react'

interface BrawlImgProps {
  src: string
  alt: string
  fallbackText?: string
  fallbackSrc?: string
  className?: string
  style?: React.CSSProperties
  /**
   * Intrinsic dimensions for the underlying <img>. Defaults to a
   * generic 100×100 — the actual on-screen size is usually overridden
   * by `className` (e.g. `w-12 h-12`). The point of these props is to
   * give the browser a stable aspect-ratio box BEFORE the lazy image
   * resolves, which prevents the "elements blink in and out on scroll"
   * symptom caused by reflow on every image load. (2026-05-05.)
   */
  width?: number
  height?: number
}

/**
 * Image with automatic fallback chain:
 * 1. Try local src
 * 2. Try fallbackSrc (e.g. Brawlify CDN)
 * 3. Show initials placeholder
 *
 * Memoized — parent grids (104 brawler cards, 30 club rows, etc.) re-render
 * frequently as their owning page filters/sorts. Without `memo`, every
 * BrawlImg unmounts/remounts and resets its internal `useFallback`/`failed`
 * state mid-load, producing a visible flash. The memo gate is shallow:
 * it relies on stable string `src`/`fallbackSrc` props, which the callers
 * already provide via pure URL builders.
 */
function BrawlImgImpl({
  src,
  alt,
  fallbackText,
  fallbackSrc,
  className = '',
  width = 100,
  height = 100,
}: BrawlImgProps) {
  const [useFallback, setUseFallback] = useState(false)
  const [failed, setFailed] = useState(false)
  const [prevSrc, setPrevSrc] = useState(src)

  // Reset state DURING render when the src prop changes. React handles
  // this pattern specially — the reset is applied before the first render
  // with the new src, so there's no transient frame with stale state.
  // See https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
  if (prevSrc !== src) {
    setPrevSrc(src)
    setUseFallback(false)
    setFailed(false)
  }

  const currentSrc = useFallback && fallbackSrc ? fallbackSrc : src

  const handleError = () => {
    if (!useFallback && fallbackSrc) {
      setUseFallback(true)
    } else {
      setFailed(true)
    }
  }

  if (failed) {
    const initials = (fallbackText || alt || '?').slice(0, 2).toUpperCase()
    return (
      <div
        className={`flex items-center justify-center bg-[#1C5CF1]/30 border-2 border-[#1C5CF1]/50 text-white font-['Lilita_One'] text-xs ${className}`}
        title={alt}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleError}
      width={width}
      height={height}
    />
  )
}

export const BrawlImg = memo(BrawlImgImpl)
