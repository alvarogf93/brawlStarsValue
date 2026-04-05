'use client'

import { useEffect, useState } from 'react'

export function AnimatedCounter({ 
  value, 
  duration = 1500,
  className = ""
}: { 
  value: number
  duration?: number
  className?: string
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTime: number | null = null
    const endValue = value

    const updateCounter = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = timestamp - startTime

      if (progress < duration) {
        // Ease-out cubic calculation
        const easeOut = 1 - Math.pow(1 - progress / duration, 3)
        setCount(Math.floor(endValue * easeOut))
        requestAnimationFrame(updateCounter)
      } else {
        setCount(endValue)
      }
    }

    requestAnimationFrame(updateCounter)
  }, [value, duration])

  return (
    <span className={className}>
      {count.toLocaleString()}
    </span>
  )
}
