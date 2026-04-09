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
  if (wr >= 60) return 'text-green-400'
  if (wr >= 45) return 'text-[#FFC91B]'
  return 'text-red-400'
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
    <div className="brawl-card-dark p-5 md:p-6 border-[#090E17]">
      {/* Title */}
      <h3 className="font-['Lilita_One'] text-lg text-white mb-4 flex items-center gap-2">
        <span className="text-xl">&#x1F525;</span> {t('tiltTitle')}
        <InfoTooltip className="ml-1.5" text={t('tipTilt')} />
      </h3>

      {/* ── Hero Banner ────────────────────────────────────── */}
      {tilt.shouldStop && hasData ? (
        <div
          className="rounded-xl p-4 mb-5 border border-red-500/30"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(185,28,28,0.06) 100%)',
          }}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 mt-0.5">&#x26A0;&#xFE0F;</span>
            <div>
              <p className="font-['Lilita_One'] text-base text-red-400">
                {t('tiltAlert')}
              </p>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">
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
          className="rounded-xl p-4 mb-5 border border-green-500/20"
          style={{
            background: 'linear-gradient(135deg, rgba(74,222,128,0.10) 0%, rgba(34,197,94,0.03) 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">&#x2705;</span>
            <p className="font-['Lilita_One'] text-sm text-green-400">
              {t('tiltOk')}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-4 mb-5 border border-white/5"
          style={{
            background: 'linear-gradient(135deg, rgba(100,116,139,0.08) 0%, rgba(71,85,105,0.03) 100%)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl flex-shrink-0">&#x1F4CA;</span>
            <p className="font-['Lilita_One'] text-sm text-slate-400">
              {t('tiltNoData')}
            </p>
          </div>
        </div>
      )}

      {/* ── Stats Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        {/* Normal WR */}
        <div className="brawl-row rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('normalWR')}
          </p>
          <p className={`font-['Lilita_One'] text-2xl tabular-nums ${
            tilt.wrNormal !== null ? wrColor(tilt.wrNormal) : 'text-slate-500'
          }`}>
            {tilt.wrNormal !== null ? `${tilt.wrNormal.toFixed(1)}%` : '--'}
          </p>
        </div>

        {/* Tilt WR */}
        <div className="brawl-row rounded-xl p-4 text-center relative">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('tiltWR')}
          </p>
          <p className={`font-['Lilita_One'] text-2xl tabular-nums ${
            tilt.wrAfterTilt !== null ? wrColor(tilt.wrAfterTilt) : 'text-slate-500'
          }`}>
            {tilt.wrAfterTilt !== null ? `${tilt.wrAfterTilt.toFixed(1)}%` : '--'}
          </p>
          {/* Delta badge */}
          {significantDelta && (
            <span className="absolute top-2 right-2 font-['Lilita_One'] text-xs text-red-400 bg-red-500/10 rounded-md px-1.5 py-0.5 tabular-nums">
              {delta > 0 ? '-' : '+'}{Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Tilt Episodes */}
        <div className="brawl-row rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('tiltEpisodes')}
          </p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#FFC91B]">
            {tilt.tiltEpisodes}
          </p>
        </div>

        {/* Avg Games While Tilted */}
        <div className="brawl-row rounded-xl p-4 text-center">
          <p className="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">
            {t('avgGamesInTilt')}
          </p>
          <p className="font-['Lilita_One'] text-2xl tabular-nums text-[#4EC0FA]">
            {tilt.avgGamesInTilt > 0 ? tilt.avgGamesInTilt.toFixed(1) : '--'}
          </p>
        </div>
      </div>

      {/* ── Recent Sessions ────────────────────────────────── */}
      {recentSessions.length > 0 && (
        <div>
          <h4 className="font-['Lilita_One'] text-sm text-slate-400 mb-2.5">
            {t('recentSessions')}
          </h4>
          <div className="space-y-1.5">
            {recentSessions.map((s, i) => (
              <div
                key={i}
                className="flex items-center gap-3 brawl-row rounded-xl px-4 py-2.5"
              >
                {/* Date range */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-300 truncate">
                    {formatSessionDate(s.start)}
                    <span className="text-slate-600 mx-1">-</span>
                    {formatSessionDate(s.end)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {s.battles} {t('battles')}
                  </p>
                </div>

                {/* Win rate */}
                <span className={`font-['Lilita_One'] text-sm tabular-nums flex-shrink-0 ${wrColor(s.winRate)}`}>
                  {s.winRate.toFixed(1)}%
                </span>

                {/* Trophy change */}
                <span className={`font-['Lilita_One'] text-xs tabular-nums flex-shrink-0 w-10 text-right ${
                  s.trophyChange > 0
                    ? 'text-green-400'
                    : s.trophyChange < 0
                      ? 'text-red-400'
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
