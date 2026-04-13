import { getBrawlerName, loadBrawlerNames } from '@/lib/draft/brawler-names'
import { MIN_BATTLES_FOR_RANKING } from '../constants'
import { bar, escapeHtml, fmtNumber, fmtTimeAgo, section, sparkline } from '../formatters'
import type { CommandHandler, MapData, MapListItem } from '../types'

export const handleMapa: CommandHandler = async ({ args, queries }) => {
  if (args.length === 0) {
    const list = await queries.getMapList()
    return renderList(list)
  }

  const prefix = args[0]
  const safePrefix = escapeHtml(prefix)
  const match = await queries.findMapByPrefix(prefix)

  if (match.kind === 'none') {
    return `❌ No hay mapa que empiece por '${safePrefix}'. Usa /mapa para ver el listado completo.`
  }

  if (match.kind === 'ambiguous') {
    const lines = match.candidates
      .map((c) => `  • ${escapeHtml(c.map)} (${escapeHtml(c.mode)})`)
      .join('\n')
    return [
      `⚠️ Ambiguo: '${safePrefix}' matchea varios mapas:`,
      '',
      lines,
      '',
      'Usa el nombre más específico.',
    ].join('\n')
  }

  const [data, brawlerNames] = await Promise.all([
    queries.getMapData(match.map, match.mode),
    loadBrawlerNames(),
  ])
  return renderMapData(data, brawlerNames)
}

function renderList(list: MapListItem[]): string {
  if (list.length === 0) return '🗺️ No hay mapas con datos hoy.'
  const header = `🗺️ <b>MAPAS CON DATOS HOY</b> (${list.length} total)\n`
  const lines = list.map((item, i) => {
    const idx = String(i + 1).padStart(2)
    const combined = `${item.mode} :: ${item.map}`.padEnd(42)
    return `${idx}. ${combined} ${fmtNumber(item.battles).padStart(6)} batallas · ${String(item.brawlerCount).padStart(2)} brawlers`
  })
  const footer = '\nPara detalles de un mapa: /mapa &lt;nombre&gt;\nEjemplo: /mapa sidetrack'
  return [header, lines.join('\n'), footer].join('\n')
}

function renderMapData(data: MapData, names: Map<number, string>): string {
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const density = data.brawlerCovered > 60 ? 'HIGH ✅' : data.brawlerCovered > 30 ? 'MEDIUM 🟡' : 'LOW 🔴'

  const cobertura = [
    `  Batallas hoy:       ${fmtNumber(data.battlesToday)}`,
    `  Batallas 7d:        ${fmtNumber(data.battlesLast7d)}`,
    `  Brawlers cubiertos: ${data.brawlerCovered} / ${data.brawlerTotal}`,
    `  Densidad del pool:  ${density}`,
  ].join('\n')

  const sparkBlock = [
    '  Batallas / día (7d)',
    `  ${sparkline(data.sparkline7d)}`,
  ].join('\n')

  const sections: string[] = [
    `🗺️ <b>${data.map.toUpperCase()}</b> (${data.mode})`,
    nowLabel,
    '',
    section('📊', 'COBERTURA', cobertura),
    '',
    section('📈', 'HISTÓRICO 7d', sparkBlock),
  ]

  if (data.battlesToday < MIN_BATTLES_FOR_RANKING) {
    sections.push(
      '',
      `⚠️ Datos insuficientes para ranking fiable (&lt; ${MIN_BATTLES_FOR_RANKING} batallas). Vuelve más tarde.`,
    )
  } else {
    const topBlock = data.topWinRates
      .map((b, i) => {
        const name = getBrawlerName(names, b.brawlerId).padEnd(14)
        return `  ${i + 1}. ${name} ${(b.winRate * 100).toFixed(1)}%  (${fmtNumber(b.total)} batallas)`
      })
      .join('\n') || '  — sin datos'
    const bottomBlock = data.bottomWinRates
      .map((b, i) => {
        const name = getBrawlerName(names, b.brawlerId).padEnd(14)
        return `  ${i + 1}. ${name} ${(b.winRate * 100).toFixed(1)}%  (${fmtNumber(b.total)} batallas)`
      })
      .join('\n') || '  — sin datos'

    sections.push('', section('🏆', 'TOP 5 BRAWLERS POR WIN RATE (hoy)', topBlock))
    sections.push('', section('💀', `BOTTOM 3 (peor WR hoy, min ${MIN_BATTLES_FOR_RANKING} batallas)`, bottomBlock))
  }

  // Same-mode comparison (always shown if present)
  if (data.sameModeComparison.length > 1) {
    const max = data.sameModeComparison[0].battles
    const rows = data.sameModeComparison
      .slice(0, 6)
      .map((r) => `  ${r.map.padEnd(14)} ${fmtNumber(r.battles).padStart(6)} ${bar(max === 0 ? 0 : r.battles / max, 20)}`)
      .join('\n')
    sections.push('', section('📊', `COMPARACIÓN con otros ${data.mode} maps`, rows))
  }

  sections.push('', `Última actualización: ${fmtTimeAgo(data.lastCursorUpdate, now.getTime())} (meta_poll_cursors)`)

  return sections.join('\n')
}
