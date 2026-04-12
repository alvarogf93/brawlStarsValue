'use client'

import type { BrawlerEntry } from '@/lib/brawler-registry'
import type { Team } from '@/lib/draft/state'

interface Props {
  blueTeam: (number | null)[]
  redTeam: (number | null)[]
  brawlerMap: Map<number, BrawlerEntry>
  currentTeam: Team
  picksCompletedInTurn: number
  phase: string
}

function Slot({ brawlerId, brawlerMap, isActive, team }: {
  brawlerId: number | null
  brawlerMap: Map<number, BrawlerEntry>
  isActive: boolean
  team: 'blue' | 'red'
}) {
  const brawler = brawlerId ? brawlerMap.get(brawlerId) : null
  const borderColor = team === 'blue' ? 'border-blue-500' : 'border-red-500'
  const activeBorder = team === 'blue' ? 'border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.4)]' : 'border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)]'

  return (
    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 overflow-hidden transition-all ${
      isActive ? `${activeBorder} animate-pulse` : brawler ? borderColor : 'border-white/10'
    }`}>
      {brawler ? (
        <img src={brawler.imageUrl} alt={brawler.name} className="w-full h-full object-cover" width={56} height={56} />
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-lg ${
          team === 'blue' ? 'bg-blue-500/10' : 'bg-red-500/10'
        }`}>
          {isActive ? '?' : '·'}
        </div>
      )}
    </div>
  )
}

export function TeamSlots({ blueTeam, redTeam, brawlerMap, currentTeam, phase }: Props) {
  const isDrafting = phase === 'DRAFTING'

  // Find the active slot index for each team
  function getActiveSlot(team: (number | null)[], teamName: Team): number {
    if (!isDrafting || currentTeam !== teamName) return -1
    return team.findIndex(s => s === null)
  }

  const blueActive = getActiveSlot(blueTeam, 'blue')
  const redActive = getActiveSlot(redTeam, 'red')

  return (
    <div className="flex items-center justify-center gap-3 md:gap-6">
      {/* Blue team */}
      <div className="flex items-center gap-1.5">
        <span className="text-blue-400 font-['Lilita_One'] text-sm mr-1">🔵</span>
        {blueTeam.map((id, i) => (
          <Slot key={`b${i}`} brawlerId={id} brawlerMap={brawlerMap} isActive={i === blueActive} team="blue" />
        ))}
      </div>

      <span className="font-['Lilita_One'] text-slate-600 text-lg">VS</span>

      {/* Red team */}
      <div className="flex items-center gap-1.5">
        {redTeam.map((id, i) => (
          <Slot key={`r${i}`} brawlerId={id} brawlerMap={brawlerMap} isActive={i === redActive} team="red" />
        ))}
        <span className="text-red-400 font-['Lilita_One'] text-sm ml-1">🔴</span>
      </div>
    </div>
  )
}
