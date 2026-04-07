'use client'

import { useState } from 'react'

interface BrawlImgProps {
  src: string
  alt: string
  fallbackText?: string
  className?: string
}

/**
 * Image with automatic fallback on load error.
 * Shows a colored circle with initials when the CDN returns 404.
 */
export function BrawlImg({ src, alt, fallbackText, className = '' }: BrawlImgProps) {
  const [failed, setFailed] = useState(false)

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
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
