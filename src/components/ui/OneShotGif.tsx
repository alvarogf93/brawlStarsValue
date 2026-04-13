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
   * without re-encoding it. Default 6000ms (covers most Brawl Stars
   * win animations which run ~5s).
   */
  durationMs?: number
  /**
   * Called the moment the gif becomes visible (intersection
   * observer fires). Use this to chain other animations off the
   * same trigger — e.g. "show the flame 1s after the gif starts".
   * The callback is captured via ref so a fresh closure on every
   * render does NOT re-trigger the intersection observer effect.
   */
  onStart?: () => void
  /**
   * IntersectionObserver threshold. Default 0.3 — the element has
   * to be at least 30% in view before we kick the animation off.
   */
  threshold?: number
  /**
   * Optional inline style applied to BOTH the playing <img> and
   * the frozen-frame <canvas>. Use this when the gif has whitespace
   * around the subject and you need to crop/offset the visible
   * frame consistently across both phases — without it the freeze
   * frame would shift visually relative to the animation. Default:
   * undefined → both elements use w-full h-full.
   */
  mediaStyle?: React.CSSProperties
  /**
   * Optional partial style override applied ONLY to the frozen
   * canvas. Merged on top of `mediaStyle`. Use when one or two
   * properties (e.g. width) need to change between the playing
   * and frozen phases — the rest of the geometry stays shared.
   */
  frozenStyleOverride?: React.CSSProperties
}

/**
 * Renders an animated gif that plays exactly once per component
 * mount, triggered the first time the element enters the viewport.
 *
 * Mechanism:
 *  1. The component renders an empty placeholder span sized by `className`.
 *  2. An IntersectionObserver fires on first visibility → we mount
 *     an <img src={gif}>. The browser starts playing the gif
 *     immediately (and would loop forever by default).
 *  3. After `durationMs`, we draw the current frame from the <img>
 *     to a sibling <canvas> and hide the <img>. The canvas shows
 *     the frame as it was at `durationMs` (close to the final
 *     frame if the duration is tuned right).
 *  4. The observer is disconnected after the first hit so navigating
 *     out and back into the section re-triggers from the natural
 *     re-mount of the parent component.
 *
 * The container is a <span> (display:inline-block via CSS) so the
 * component is safe to nest inside inline contexts like <p>. Don't
 * change it to <div> — that breaks HTML validation in <p> wrappers.
 */
export function OneShotGif({
  src,
  alt = '',
  className = '',
  durationMs = 6000,
  onStart,
  threshold = 0.3,
  mediaStyle,
  frozenStyleOverride,
}: Props) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'pre' | 'playing' | 'frozen'>('pre')

  // Capture onStart in a ref so the intersection observer effect
  // doesn't depend on the callback identity. Otherwise a parent
  // creating a fresh closure each render would re-run the effect.
  const onStartRef = useRef(onStart)
  useEffect(() => {
    onStartRef.current = onStart
  }, [onStart])

  // Intersection observer — fire once on first visibility
  useEffect(() => {
    if (phase !== 'pre' || !containerRef.current) return
    const node = containerRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setPhase('playing')
            onStartRef.current?.()
            observer.disconnect()
            break
          }
        }
      },
      { threshold },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [phase, threshold])

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
            // Draw error (rare for same-origin images). Fall through
            // to the phase swap so the user gets SOMETHING — the
            // canvas will be blank but the layout stays stable.
          }
        }
      }
      setPhase('frozen')
    }, durationMs)
    return () => clearTimeout(timer)
  }, [phase, durationMs])

  // Compute the merged frozen style (mediaStyle + frozen overrides).
  // If neither is set, the canvas falls back to `w-full h-full` via
  // the className branch below.
  const canvasMergedStyle: React.CSSProperties | undefined =
    mediaStyle || frozenStyleOverride
      ? { ...(mediaStyle ?? {}), ...(frozenStyleOverride ?? {}) }
      : undefined

  return (
    <span ref={containerRef} className={`relative inline-block align-middle ${className}`}>
      {phase !== 'pre' && (
        <>
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className={`block ${mediaStyle ? '' : 'w-full h-full'} object-contain ${phase === 'frozen' ? 'hidden' : ''}`}
            style={mediaStyle}
            // Avoid the browser's lazy-load delay — we want the gif
            // available the instant we enter the viewport.
            loading="eager"
          />
          <canvas
            ref={canvasRef}
            className={`block ${canvasMergedStyle ? '' : 'w-full h-full'} ${phase === 'frozen' ? '' : 'hidden'}`}
            style={canvasMergedStyle}
            aria-hidden="true"
          />
        </>
      )}
    </span>
  )
}
