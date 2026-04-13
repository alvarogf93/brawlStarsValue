'use client'

import { useEffect, useState } from 'react'

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

  // Reset failure state when src prop changes so the same instance
  // can be reused across brawlers (e.g. BrawlerTierList detail panel).
  useEffect(() => {
    setUseFallback(false)
    setFailed(false)
  }, [src])

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
