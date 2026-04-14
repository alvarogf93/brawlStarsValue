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
  const isBlue = team === 'blue'
  const neonColor = isBlue ? '#4EC0FA' : '#FF3366'
  
  const borderColor = isBlue ? 'border-[#4EC0FA]/50' : 'border-[#FF3366]/50'
  const activeBorder = isBlue ? 'border-[#4EC0FA] shadow-[0_0_20px_rgba(78,192,250,0.6)]' : 'border-[#FF3366] shadow-[0_0_20px_rgba(255,51,102,0.6)]'

  return (
    <div className={`relative w-14 h-14 md:w-16 md:h-16 border-2 overflow-hidden transition-all duration-300 ${
      isActive ? `${activeBorder} scale-110 z-10 animate-pulse` : brawler ? borderColor : 'border-white/10 opacity-70'
    }`}
    style={{ clipPath: 'polygon(15% 0, 100% 0, 85% 100%, 0 100%)' }}
    >
      {brawler ? (
        <div className="absolute inset-0 animate-[ping_0.3s_ease-out_1_reverse] overflow-hidden bg-[#0A0E1A]">
          <img src={brawler.imageUrl} alt={brawler.name} className="w-full h-full object-cover scale-[1.15]" width={64} height={64} />
          {/* Inner scanline effect for selected character */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[length:100%_4px]" />
          {/* Stamp border */}
          <div className="absolute inset-0 border-2 border-white/20 pointer-events-none" />
        </div>
      ) : (
        <div className={`w-full h-full flex items-center justify-center text-lg relative ${
          isBlue ? 'bg-[#4EC0FA]/5' : 'bg-[#FF3366]/5'
        }`}>
          {/* Holographic static noise background */}
          <div className="absolute inset-0 opacity-[0.15] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwMCIvPgo8cmVjdCB3aWR0aD0iMiIgaGVpZ2h0PSIyIiBmaWxsPSIjZmZmZiIvPjwvN3ZnPg==')] pointer-events-none animate-[pulse_0.5s_infinite]" />
          
          <span className={`font-['Lilita_One'] relative z-10 tracking-widest ${isActive ? 'text-white text-2xl drop-shadow-[0_0_8px_currentColor]' : 'text-slate-600'}`} style={{ color: isActive ? neonColor : undefined }}>
            {isActive ? '?' : '·'}
          </span>
          {isActive && (
            <div className="absolute inset-0 border border-white/50 animate-[ping_1.5s_infinite]" style={{ borderColor: neonColor }} />
          )}
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
    <div className="relative">
      {/* Tactical table background texture */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[length:20px_20px] pointer-events-none" />

      <div className="flex items-center justify-center gap-4 md:gap-8 relative z-10 px-2 py-4">
        {/* Blue team strategy layout */}
        <div className="flex items-center gap-1">
          <div className="flex flex-col items-end mr-3">
            <span className="text-[#4EC0FA] font-black uppercase text-[10px] tracking-widest drop-shadow-[0_0_5px_rgba(78,192,250,0.8)]">Blue</span>
            <span className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">Squad</span>
          </div>
          {blueTeam.map((id, i) => (
            <Slot key={`b${i}`} brawlerId={id} brawlerMap={brawlerMap} isActive={i === blueActive} team="blue" />
          ))}
        </div>

        {/* Versus Divider */}
        <div className="flex flex-col items-center justify-center relative">
          <span className="font-['Lilita_One'] text-slate-700 text-2xl z-10 bg-[#1A2744] px-1 rounded">VS</span>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-16 bg-gradient-to-b from-transparent via-slate-500/50 to-transparent" />
        </div>

        {/* Red team strategy layout */}
        <div className="flex items-center gap-1">
          {redTeam.map((id, i) => (
            <Slot key={`r${i}`} brawlerId={id} brawlerMap={brawlerMap} isActive={i === redActive} team="red" />
          ))}
          <div className="flex flex-col items-start ml-3">
            <span className="text-[#FF3366] font-black uppercase text-[10px] tracking-widest drop-shadow-[0_0_5px_rgba(255,51,102,0.8)]">Red</span>
            <span className="text-slate-500 font-bold text-[8px] uppercase tracking-widest">Squad</span>
          </div>
        </div>
      </div>
      
      {/* Table bottom LED edge */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#4EC0FA]/20 to-transparent mt-2 opacity-50" />
    </div>
  )
}
