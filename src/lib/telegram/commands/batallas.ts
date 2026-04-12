import { bar, fmtNumber, fmtTimeAgo, section, sparkline } from '../formatters'
import type { BattlesData, CommandHandler } from '../types'

export const handleBatallas: CommandHandler = async ({ queries }) => {
  const b = await queries.getBattles()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  if (b.total === 0) {
    return [
      '⚔️ <b>BATTLES SYNC</b>',
      nowLabel,
      '',
      'No hay batallas registradas aún. El primer user premium debe sincronizar.',
    ].join('\n')
  }

  const volumen = [
    `  Total batallas: ${fmtNumber(b.total)}`,
    `  Hoy:            ${fmtNumber(b.today)}`,
    `  Ayer:           ${fmtNumber(b.yesterday)}`,
    `  Últimos 7d:     ${fmtNumber(b.last7d)}`,
    `  Últimos 30d:    ${fmtNumber(b.last30d)}`,
    '',
    '  Battles/day last 14d',
    `  ${sparkline(b.sparkline14d)}`,
  ].join('\n')

  const modes = renderModeDistribution(b.modeDistribution)
  const results = renderResultDistribution(b.resultDistribution)
  const players = renderTopPlayers(b.topPlayers)

  const syncStatus = [
    `  Última sync exitosa: ${fmtTimeAgo(b.lastSuccessfulSyncAt, now.getTime())}`,
    `  Queue pending:       ${fmtNumber(b.queuePending)}`,
  ].join('\n')

  return [
    '⚔️ <b>BATTLES SYNC</b>',
    nowLabel,
    '',
    section('📦', 'VOLUMEN', volumen),
    '',
    section('🎮', 'DISTRIBUCIÓN POR MODO (últimos 7d)', modes),
    '',
    section('⚖️', 'RESULTADO (últimos 7d)', results),
    '',
    section('👤', 'TOP 5 PLAYERS MÁS ACTIVOS (últimos 7d)', players),
    '',
    section('🔄', 'SYNC STATUS', syncStatus),
  ].join('\n')
}

function renderModeDistribution(rows: BattlesData['modeDistribution']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r) => `  ${r.mode.padEnd(12)} ${fmtNumber(r.count).padStart(5)} (${Math.round(r.pct * 100)}%) ${bar(r.pct, 16)}`)
    .join('\n')
}

function renderResultDistribution(rows: BattlesData['resultDistribution']): string {
  const labels: Record<BattlesData['resultDistribution'][number]['result'], string> = {
    victory: 'Victory',
    defeat:  'Defeat ',
    draw:    'Draw   ',
  }
  return rows
    .map((r) => `  ${labels[r.result]} ${fmtNumber(r.count).padStart(5)} (${Math.round(r.pct * 100)}%) ${bar(r.pct, 10)}`)
    .join('\n')
}

function renderTopPlayers(rows: BattlesData['topPlayers']): string {
  if (rows.length === 0) return '  — sin datos'
  return rows
    .map((r, i) => `  ${i + 1}. ${r.tag.padEnd(12)} ${fmtNumber(r.count)} batallas`)
    .join('\n')
}
