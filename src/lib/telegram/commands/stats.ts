import { getBrawlerName, loadBrawlerNames } from '@/lib/draft/brawler-names'
import { MIN_BATTLES_FOR_RANKING } from '../constants'
import { fmtNumber, fmtTimeAgo, sparkline, section } from '../formatters'
import type { CommandHandler, StatsData } from '../types'

function formatSparkLine(values: number[], label: string): string {
  if (values.every((v) => v === 0)) return '  — sin datos'
  return `  ${sparkline(values)}  → ${label}`
}

export const handleStats: CommandHandler = async ({ queries }) => {
  const [s, brawlerNames] = await Promise.all([
    queries.getStats(),
    loadBrawlerNames(),
  ])
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const users = [
    `  Registrados:         ${fmtNumber(s.totalUsers)}`,
    `  Premium activos:     ${fmtNumber(s.premiumCount)}`,
    `  En trial:            ${fmtNumber(s.trialCount)}`,
    `  Visitantes anónimos: ${fmtNumber(s.anonCount30d)} (últimos 30d)`,
    '',
    '  Anón nuevos / día (7d)',
    formatSparkLine(s.anonSparkline, `${s.anonSparkline[s.anonSparkline.length - 1] ?? 0} nuevos hoy`),
  ].join('\n')

  const battlesLast7d = s.battleSparkline.reduce((sum, n) => sum + n, 0)
  const activity = [
    `  Total batallas: ${fmtNumber(s.totalBattles)}`,
    `  Hoy:            ${fmtNumber(s.battlesToday)}`,
    `  Últimos 7 días: ${fmtNumber(battlesLast7d)}`,
    '',
    '  Batallas / día (7d)',
    formatSparkLine(s.battleSparkline, `${s.battlesToday} hoy`),
  ].join('\n')

  const metaPoll = [
    `  Filas meta hoy:   ${fmtNumber(s.metaRowsToday)}`,
    `  Filas meta total: ${fmtNumber(s.metaRowsTotal)}`,
    `  Pool efectivo:    ${fmtNumber(s.activeCursors)} / ${fmtNumber(s.activeCursors + s.staleCursors)} cursores`,
    `                    (${fmtNumber(s.staleCursors)} obsoletos &gt;24h)`,
    `  Última actividad: ${fmtTimeAgo(s.latestMetaActivity, now.getTime())}`,
  ].join('\n')

  const topMaps = renderTop3Maps(s.top3Maps)
  const topBrawlers = renderTop3Brawlers(s.top3Brawlers, brawlerNames)

  return [
    `📊 <b>BrawlVision Stats</b>`,
    nowLabel,
    '',
    section('👥', 'USUARIOS', users),
    '',
    section('⚔️', 'ACTIVIDAD (tabla battles — sync premium)', activity),
    '',
    section('🌐', 'META POLL (pool global)', metaPoll),
    '',
    section('🎯', 'TOP 3 MAPAS (hoy)', topMaps),
    '',
    section('🏆', `TOP 3 BRAWLERS (hoy, min ${MIN_BATTLES_FOR_RANKING} partidas, por win rate)`, topBrawlers),
  ].join('\n')
}

function renderTop3Maps(rows: StatsData['top3Maps']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => `  ${i + 1}. ${r.map.padEnd(24)} ${fmtNumber(r.battles)} batallas`)
    .join('\n')
}

function renderTop3Brawlers(
  rows: StatsData['top3Brawlers'],
  names: Map<number, string>,
): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => {
      const name = getBrawlerName(names, r.brawlerId).padEnd(14)
      return `  ${i + 1}. ${name} WR ${(r.winRate * 100).toFixed(1)}% (${fmtNumber(r.total)} partidas)`
    })
    .join('\n')
}
