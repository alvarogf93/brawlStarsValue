'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  alt?: string
  className?: string
  /**
   * Approximate duration of the gif in ms. After this elapses we
   * snapshot whatever frame is currently on screen to a canvas and
   * swap the visible element from the looping <img> to the static
   * canvas — that's how we get "play once" out of an animated gif
   * without re-encoding it. Default 3000ms.
   */
  durationMs?: number
  /**
   * Called the moment the gif becomes visible (intersection
   * observer fires). Use this to chain other animations off the
   * same trigger — e.g. "show the flame 1s after the gif starts".
   */
  onStart?: () => void
  /**
   * IntersectionObserver threshold. Default 0.3 — the element has
   * to be at least 30% in view before we kick the animation off.
   */
  threshold?: number
  /**
   * Optional inline style override for the frozen-frame canvas.
   * Useful when the canvas needs to be sized/positioned differently
   * from the playing <img> — e.g. when the gif has whitespace
   * around the subject and you want to crop/offset the static
   * frame to match the rest of the layout.
   */
  canvasStyle?: React.CSSProperties
}

/**
 * Renders an animated gif that plays exactly once per component
 * mount, triggered the first time the element enters the viewport.
 *
 * Mechanism:
 *  1. The component renders a placeholder div sized by `className`.
 *  2. An IntersectionObserver fires on first visibility → we mount
 *     an <img src={gif}>. The browser starts playing the gif
 *     immediately (and would loop forever by default).
 *  3. After `durationMs`, we draw the current frame from the <img>
 *     to a sibling <canvas> and hide the <img>. The canvas shows
 *     the frozen final frame.
 *  4. The observer is disconnected after the first hit so navigating
 *     out and back into the section re-triggers from the natural
 *     re-mount of the parent component.
 */
export function OneShotGif({
  src,
  alt = '',
  className = '',
  durationMs = 6000,
  onStart,
  threshold = 0.3,
  canvasStyle,
}: Props) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'pre' | 'playing' | 'frozen'>('pre')

  // Intersection observer — fire once on first visibility
  useEffect(() => {
    if (phase !== 'pre' || !containerRef.current) return
    const node = containerRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setPhase('playing')
            onStart?.()
            observer.disconnect()
            break
          }
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [phase, threshold, onStart])

  // Freeze the gif after durationMs by snapshotting the current
  // visible frame to the canvas, then hiding the <img>.
  useEffect(() => {
    if (phase !== 'playing') return
    const timer = setTimeout(() => {
      const img = imgRef.current
      const canvas = canvasRef.current
      if (img && canvas && img.complete && img.naturalWidth > 0) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          try {
            ctx.drawImage(img, 0, 0)
          } catch {
            // CORS or other draw error — fall through to phase swap
            // anyway. The img will keep looping but at least we tried.
          }
        }
      }
      setPhase('frozen')
    }, durationMs)
    return () => clearTimeout(timer)
  }, [phase, durationMs])

  // Span (not div) so the component is safe to nest inside inline
  // contexts like <p>. CSS gives it block-ish behavior internally.
  return (
    <span ref={containerRef} className={`relative inline-block align-middle ${className}`}>
      {phase !== 'pre' && (
        <>
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            crossOrigin="anonymous"
            className={`block w-full h-full object-contain ${phase === 'frozen' ? 'hidden' : ''}`}
            // Avoid the browser's lazy-load delay — we want the gif
            // available the instant we enter the viewport.
            loading="eager"
          />
          <canvas
            ref={canvasRef}
            className={`block ${canvasStyle ? '' : 'w-full h-full'} ${phase === 'frozen' ? '' : 'hidden'}`}
            style={canvasStyle}
            aria-hidden="true"
          />
        </>
      )}
    </span>
  )
}
