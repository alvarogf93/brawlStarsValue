'use client'

import { useTranslations } from 'next-intl'
import { DRAFT_MODES, type DraftMode } from '@/lib/draft/constants'
import { getGameModeImageUrl } from '@/lib/utils'

interface Props {
  onSelect: (mode: DraftMode) => void
}

const MODE_LABELS: Record<DraftMode, string> = {
  gemGrab: 'Gem Grab',
  heist: 'Heist',
  bounty: 'Bounty',
  brawlBall: 'Brawl Ball',
  hotZone: 'Hot Zone',
  knockout: 'Knockout',
  wipeout: 'Wipeout',
  brawlHockey: 'Brawl Hockey',
}

export function ModeSelector({ onSelect }: Props) {
  const t = useTranslations('draft')

  return (
    <div className="text-center">
      <h3 className="font-['Lilita_One'] text-xl text-white mb-4">{t('selectMode')}</h3>
      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {DRAFT_MODES.map(mode => {
          const iconUrl = getGameModeImageUrl(mode)
          return (
            <button
              key={mode}
              onClick={() => onSelect(mode)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border-2 border-white/10 bg-white/[0.03] hover:border-[#FFC91B]/50 hover:bg-[#FFC91B]/5 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              {iconUrl ? (
                <img src={iconUrl} alt={MODE_LABELS[mode]} className="w-10 h-10" width={40} height={40} />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-lg">🎮</div>
              )}
              <span className="font-['Lilita_One'] text-[10px] text-slate-300 leading-tight">{MODE_LABELS[mode]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
