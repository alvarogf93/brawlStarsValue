'use client'

import { useState } from 'react'

interface BrawlImgProps {
  src: string
  alt: string
  fallbackText?: string
  fallbackSrc?: string
  className?: string
}

/**
 * Image with automatic fallback chain:
 * 1. Try local src
 * 2. Try fallbackSrc (e.g. Brawlify CDN)
 * 3. Show initials placeholder
 */
export function BrawlImg({ src, alt, fallbackText, fallbackSrc, className = '' }: BrawlImgProps) {
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
    />
  )
}
