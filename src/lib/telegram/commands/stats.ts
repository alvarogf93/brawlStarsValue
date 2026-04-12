import { fmtNumber, fmtTimeAgo, sparkline, section } from '../formatters'
import type { CommandHandler, StatsData } from '../types'

function formatSparkLine(values: number[], label: string): string {
  if (values.every((v) => v === 0)) return '  — sin datos'
  return `  ${sparkline(values)}  → ${label}`
}

export const handleStats: CommandHandler = async ({ queries }) => {
  const s = await queries.getStats()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const users = [
    `  Total registered:    ${fmtNumber(s.totalUsers)}`,
    `  Premium activos:     ${fmtNumber(s.premiumCount)}`,
    `  En trial:            ${fmtNumber(s.trialCount)}`,
    `  Visitantes anónimos: ${fmtNumber(s.anonCount30d)} (últimos 30d)`,
    '',
    '  Anon new / day (7d)',
    formatSparkLine(s.anonSparkline, `${s.anonSparkline[s.anonSparkline.length - 1] ?? 0} new today`),
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
    `  Meta rows hoy:    ${fmtNumber(s.metaRowsToday)}`,
    `  Meta rows total:  ${fmtNumber(s.metaRowsTotal)}`,
    `  Pool efectivo:    ${fmtNumber(s.activeCursors)} / ${fmtNumber(s.activeCursors + s.staleCursors)} cursors`,
    `                    (${fmtNumber(s.staleCursors)} stale &gt;24h)`,
    `  Última actividad: ${fmtTimeAgo(s.latestMetaActivity, now.getTime())}`,
  ].join('\n')

  const topMaps = renderTop3Maps(s.top3Maps)
  const topBrawlers = renderTop3Brawlers(s.top3Brawlers)

  return [
    `📊 <b>BrawlVision Stats</b>`,
    nowLabel,
    '',
    section('👥', 'USUARIOS', users),
    '',
    section('⚔️', 'ACTIVIDAD (battles table — premium sync)', activity),
    '',
    section('🌐', 'META POLL (global pool)', metaPoll),
    '',
    section('🎯', 'TOP 3 MAPAS (hoy)', topMaps),
    '',
    section('🏆', 'TOP 3 BRAWLERS (hoy, por win rate)', topBrawlers),
  ].join('\n')
}

function renderTop3Maps(rows: StatsData['top3Maps']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => `  ${i + 1}. ${r.map.padEnd(24)} ${fmtNumber(r.battles)} battles`)
    .join('\n')
}

function renderTop3Brawlers(rows: StatsData['top3Brawlers']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => `  ${i + 1}. brawler#${r.brawlerId}  WR ${(r.winRate * 100).toFixed(1)}% (${fmtNumber(r.total)} partidas)`)
    .join('\n')
}
