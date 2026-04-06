'use client'

import { useEffect, useRef, useState } from 'react'

export function AnimatedCounter({
  value,
  duration = 1500,
  fromZero = false,
  className = ""
}: {
  value: number
  duration?: number
  /** Animate from 0 on first mount */
  fromZero?: boolean
  className?: string
}) {
  // When fromZero: show nothing until effect runs, then animate 0→value
  // When not fromZero: show value immediately, animate on changes
  const [display, setDisplay] = useState(fromZero ? null : value)
  const prevRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = display === null ? 0 : prevRef.current
    const to = value
    prevRef.current = value

    cancelAnimationFrame(rafRef.current)

    if (from === to) {
      setDisplay(to)
      return
    }

    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const t = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.floor(from + (to - from) * ease))
      if (t < 1) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)

    return () => cancelAnimationFrame(rafRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  // Show nothing during SSR/first frame when fromZero, then the effect kicks in
  const shown = display ?? 0

  return <span className={className}>{shown.toLocaleString()}</span>
}
