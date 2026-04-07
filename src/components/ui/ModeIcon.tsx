'use client'

import { useState } from 'react'
import { getGameModeImageUrl } from '@/lib/utils'

const FALLBACK_EMOJI: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀', soloShowdown: '💀',
  heist: '🔒', bounty: '⭐', hotZone: '🔥', knockout: '🥊', wipeout: '💥',
  payload: '🚚', paintBrawl: '🎨', duels: '⚔️', basketBrawl: '🏀', volleyBrawl: '🏐',
  hunters: '🎯', botDrop: '🤖', trophyEscape: '🏆', brawlHockey: '🏒', dodgebrawl: '🏐',
  lastStand: '🛡️', trioShowdown: '💀',
}

interface Props {
  mode: string
  size?: number
  className?: string
}

export function ModeIcon({ mode, size = 16, className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const url = getGameModeImageUrl(mode)

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={mode}
        width={size}
        height={size}
        className={`inline-block ${className}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }

  return <span className={className}>{FALLBACK_EMOJI[mode] || '🎮'}</span>
}
