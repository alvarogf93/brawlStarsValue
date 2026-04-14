'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

interface TiltData {
  wrAfterTilt: number | null
  wrNormal: number | null
  tiltEpisodes: number
  avgGamesInTilt: number
  shouldStop: boolean
}

interface Session {
  start: string
  end: string
  battles: number
  wins: number
  winRate: number
  trophyChange: number
}

interface Props {
  tilt: TiltData
  sessions: Session[]
}

function wrColor(wr: number): string {
  if (wr >= 60) return 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]'
}

function formatSessionDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export function TiltDetector({ tilt, sessions }: Props) {
  const t = useTranslations('advancedAnalytics')
  const hasData = tilt.wrNormal !== null && tilt.wrAfterTilt !== null
  const delta = hasData ? (tilt.wrNormal! - tilt.wrAfterTilt!) : 0
  const significantDelta = hasData && Math.abs(delta) >= 5

  const recentSessions = useMemo(
    () => [...sessions].reverse().slice(0, 5),
    [sessions],
  )

  return (
    <div className="relative overflow-hidden bg-[#090E17]/80 backdrop-blur-md rounded-xl p-5 md:p-6 border-b-[4px] border-[#06090E] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]">
      {/* Dynamic Background Pattern (Level 2 Alert) */}
      {(tilt.shouldStop && hasData) && (
        <div className="absolute inset-0 opacity-[0.02] bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#ef4444_10px,#ef4444_20px)] pointer-events-none" />
      )}

      {/* Title */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
        <span className="text-xl drop-shadow-md">&#x1F525;</span> {t('tiltTitle')}
        <InfoTooltip className="ml-1.5 opacity-70 hover:opacity-100" text={t('tipTilt')} />
      </h3>

      {/* ── Hero Banner ────────────────────────────────────── */}
      {tilt.shouldStop && hasData ? (
        <div
          className="relative overflow-hidden rounded-xl p-4 mb-5 border-t border-x border-red-500/50 border-b-[4px] border-b-red-700/80 shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-pulse"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(185,28,28,0.08) 100%)',
          }}
        >
          {/* Glitch overlay */}
          <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(transparent_50%,#ff0000_50%)] bg-[length:100%_4px] pointer-events-none mix-blend-color-dodge" />
          <div className="flex items-start gap-4 relative z-10">
            <span className="text-3xl flex-shrink-0 mt-0.5 drop-shadow-[0_0_10px_rgba(239,68,68,1)]">&#x26A0;&#xFE0F;</span>
            <div>
              <p className="font-['Lilita_One'] text-lg text-red-500 tracking-wide drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                {t('tiltAlert')}
              </p>
              <p className="text-[13px] text-red-200 mt-1 leading-relaxed bg-black/30 p-2 rounded-md border border-red-500/20">
                {t('tiltAlertDesc', {
                  normal: tilt.wrNormal!.toFixed(1),
                  tilt: tilt.wrAfterTilt!.toFixed(1),
                })}
              </p>
            </div>
          </div>
        </div>
      ) : hasData ? (
        <div
          className="relative overflow-hidden rounded-xl p-4 mb-5 border-t border-x border-green-500/30 border-b-[4px] border-b-green-700/50 shadow-[0_0_15px_rgba(34,197,94,0.15)] group hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(74,222,128,0.12) 0%, rgba(34,197,94,0.03) 100%)',
          }}
        >
          {/* Flame aura */}
          <div className="absolute -inset-4 bg-gradient-to-r from-transparent via-green-400/10 to-transparent group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <span className="text-2xl flex-shrink-0 drop-shadow-[0_0_8px_rgba(34,197,94,1)]">&#x2705;</span>
            <p className="font-['Lilita_One'] text-base text-green-400 tracking-wide">
              {t('tiltOk')}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-4 mb-5 border border-white/5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
          style={{
            background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(71,85,105,0.03) 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0 grayscale opacity-50">&#x1F4CA;</span>
            <p className="font-['Lilita_One'] text-sm text-slate-500 tracking-wide">
              {t('tiltNoData')}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Normal WR */}
        <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border-t border-x border-white/5 border-b-[3px] border-b-[#06090E] shadow-[0_4px_8px_rgba(0,0,0,0.4)]">
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-500 mb-2">
            {t('normalWR')}
          </p>
          <p className={`font-['Lilita_One'] text-3xl tabular-nums tracking-wide ${
            tilt.wrNormal !== null ? wrColor(tilt.wrNormal) : 'text-slate-600'
          }`}>
            {tilt.wrNormal !== null ? `${tilt.wrNormal.toFixed(1)}%` : '--'}
          </p>
        </div>

        {/* Tilt WR */}
        <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border-t border-x border-white/5 border-b-[3px] border-b-[#06090E] shadow-[0_4px_8px_rgba(0,0,0,0.4)] relative">
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-500 mb-2">
            {t('tiltWR')}
          </p>
          <p className={`font-['Lilita_One'] text-3xl tabular-nums tracking-wide ${
            tilt.wrAfterTilt !== null ? wrColor(tilt.wrAfterTilt) : 'text-slate-600'
          }`}>
            {tilt.wrAfterTilt !== null ? `${tilt.wrAfterTilt.toFixed(1)}%` : '--'}
          </p>
          {/* Delta badge */}
          {significantDelta && (
            <span className="absolute top-2 right-2 font-['Lilita_One'] text-[10px] text-red-100 bg-red-500/80 rounded-md px-1.5 py-0.5 tabular-nums shadow-[0_0_5px_rgba(239,68,68,0.8)]">
              {delta > 0 ? '-' : '+'}{Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Tilt Episodes */}
        <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border-t border-x border-white/5 border-b-[3px] border-b-[#06090E] shadow-[0_4px_8px_rgba(0,0,0,0.4)]">
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-500 mb-2">
            {t('tiltEpisodes')}
          </p>
          <p className="font-['Lilita_One'] text-3xl tabular-nums text-[#FFC91B] drop-shadow-[0_0_8px_rgba(255,201,27,0.3)]">
            {tilt.tiltEpisodes}
          </p>
        </div>

        {/* Avg Games While Tilted */}
        <div className="bg-[#0A0E1A] rounded-xl p-4 text-center border-t border-x border-white/5 border-b-[3px] border-b-[#06090E] shadow-[0_4px_8px_rgba(0,0,0,0.4)]">
          <p className="font-['Lilita_One'] text-[11px] uppercase tracking-widest text-slate-500 mb-2">
            {t('avgGamesInTilt')}
          </p>
          <p className="font-['Lilita_One'] text-3xl tabular-nums text-[#00E3FF] drop-shadow-[0_0_8px_rgba(0,227,255,0.3)]">
            {tilt.avgGamesInTilt > 0 ? tilt.avgGamesInTilt.toFixed(1) : '--'}
          </p>
        </div>
      </div>

      {/* ── Recent Sessions ────────────────────────────────── */}
      {recentSessions.length > 0 && (
        <div>
          <h4 className="font-['Lilita_One'] text-[12px] uppercase tracking-widest text-slate-500 mb-3 border-b border-white/5 pb-2">
            {t('recentSessions')}
          </h4>
          <div className="space-y-2">
            {recentSessions.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-white/5 rounded-xl px-4 py-3"
              >
                {/* Date range */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-slate-300 font-medium truncate drop-shadow-md">
                    {formatSessionDate(s.start)}
                    <span className="text-slate-600 mx-1.5">-</span>
                    {formatSessionDate(s.end)}
                  </p>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mt-1">
                    {s.battles} {t('battles')}
                  </p>
                </div>

                {/* Win rate */}
                <span className={`font-['Lilita_One'] text-lg tabular-nums flex-shrink-0 ${wrColor(s.winRate)}`}>
                  {s.winRate.toFixed(1)}%
                </span>

                {/* Trophy change */}
                <span className={`font-['Lilita_One'] text-sm tabular-nums flex-shrink-0 w-12 text-right ${
                  s.trophyChange > 0
                    ? 'text-green-400 drop-shadow-[0_0_5px_rgba(34,197,94,0.5)]'
                    : s.trophyChange < 0
                      ? 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]'
                      : 'text-slate-500'
                }`}>
                  {s.trophyChange > 0 ? '+' : ''}{s.trophyChange}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
