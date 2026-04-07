import { getGameModeImageUrl } from '@/lib/utils'

const FALLBACK_EMOJI: Record<string, string> = {
  brawlBall: '⚽', gemGrab: '💎', showdown: '💀', duoShowdown: '💀', soloShowdown: '💀',
  heist: '🔒', bounty: '⭐', hotZone: '🔥', knockout: '🥊', wipeout: '💥',
  payload: '🚚', paintBrawl: '🎨', duels: '⚔️', basketBrawl: '🏀', volleyBrawl: '🏐',
  hunters: '🎯', botDrop: '🤖', trophyEscape: '🏆', brawlHockey: '🏒',
}

interface Props {
  mode: string
  size?: number
  className?: string
}

export function ModeIcon({ mode, size = 16, className = '' }: Props) {
  const url = getGameModeImageUrl(mode)

  if (url) {
    return (
      <img
        src={url}
        alt={mode}
        width={size}
        height={size}
        className={`inline-block ${className}`}
        loading="lazy"
      />
    )
  }

  return <span className={className}>{FALLBACK_EMOJI[mode] || '🎮'}</span>
}
