import { EXPECTED_CRON_RUNS_24H, FRESHNESS_EMOJI, FRESHNESS_THRESHOLDS } from '../constants'
import { escapeHtml, fmtTimeAgo, section } from '../formatters'
import type { CommandHandler, CronData, PgCronJob, PgCronRun } from '../types'

export const handleCron: CommandHandler = async ({ queries }) => {
  const c = await queries.getCronStatus()
  const now = new Date()
  const nowLabel = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC'

  const pgCronBlock = renderPgCron(c, now.getTime())
  const vpsBlock = renderVps(c, now.getTime())

  return [
    '🔄 <b>CRON STATUS</b>',
    nowLabel,
    '',
    section('📅', 'PG_CRON JOBS (Supabase — directo)', pgCronBlock),
    '',
    section('🖥️', 'VPS ORACLE CRONS (inferencia por frescura)', vpsBlock),
    '',
    '⚠️ Nota: los 2 crons del VPS no son visibles directamente',
    'desde aquí. El status mostrado es inferencia por la frescura',
    'de los datos que cada cron produce. Para status directo y',
    'alertas en tiempo real, configurar healthchecks.io siguiendo',
    'docs/crons/SETUP-HEALTHCHECKS.md',
  ].join('\n')
}

function latestRunFor(jobname: string, runs: PgCronRun[]): PgCronRun | null {
  let latest: PgCronRun | null = null
  for (const r of runs) {
    if (r.jobname !== jobname) continue
    if (!latest || new Date(r.start_time).getTime() > new Date(latest.start_time).getTime()) {
      latest = r
    }
  }
  return latest
}

function durationSeconds(run: PgCronRun): string {
  if (!run.end_time) return '?'
  const ms = new Date(run.end_time).getTime() - new Date(run.start_time).getTime()
  return `${(ms / 1000).toFixed(1)}s`
}

function renderPgCron(c: CronData, nowMs: number): string {
  if (c.pgCronJobs.length === 0) return '  (no disponible)'
  const blocks: string[] = []
  for (const job of c.pgCronJobs) {
    const latest = latestRunFor(job.jobname, c.cronRuns)
    const emoji = statusEmojiForRun(latest)
    const expected = EXPECTED_CRON_RUNS_24H[job.jobname]
    const actual = c.runsByJob.get(job.jobname) ?? 0
    const runsLine = expected !== undefined
      ? `     Runs 24h:    ${actual} / ${expected} expected`
      : `     Runs 24h:    ${actual}`
    const lastLine = latest
      ? `     Last run:    ${fmtTimeAgo(latest.start_time, nowMs)}  (${latest.status}, ${durationSeconds(latest)})`
      : `     Last run:    (ninguna)`
    const errorLine = latest?.status === 'failed' && latest.return_message
      ? `     Error:       ${escapeHtml(latest.return_message.slice(0, 100))}`
      : null
    blocks.push(
      [
        `  ${emoji} ${job.jobname}`,
        `     Schedule:    ${job.schedule}`,
        lastLine,
        runsLine,
        errorLine,
      ].filter(Boolean).join('\n'),
    )
  }
  return blocks.join('\n\n')
}

function statusEmojiForRun(run: PgCronRun | null): string {
  if (!run) return FRESHNESS_EMOJI.unknown
  if (run.status === 'succeeded') return FRESHNESS_EMOJI.fresh
  if (run.status === 'failed') return '❌'
  return FRESHNESS_EMOJI.unknown
}

function renderVps(c: CronData, nowMs: number): string {
  const metaPollLine = [
    `  ${FRESHNESS_EMOJI[c.metaPollFreshness.status]} meta-poll   (expected: */${FRESHNESS_THRESHOLDS['meta-poll'].expectedMin} min)`,
    `     Proxy:  meta_poll_cursors latest update`,
    `     Latest: ${fmtTimeAgoFromAgeMs(c.metaPollFreshness.ageMs)}`,
    `     Status: ${c.metaPollFreshness.status}`,
  ].join('\n')

  const syncLine = [
    `  ${FRESHNESS_EMOJI[c.syncFreshness.status]} sync        (expected: */${FRESHNESS_THRESHOLDS['sync'].expectedMin} min)`,
    `     Proxy:  profiles.last_sync latest (premium)`,
    `     Latest: ${fmtTimeAgoFromAgeMs(c.syncFreshness.ageMs)}`,
    `     Status: ${c.syncFreshness.status}`,
  ].join('\n')

  return [metaPollLine, '', syncLine].join('\n')
}

function fmtTimeAgoFromAgeMs(ageMs: number | null): string {
  if (ageMs === null) return '(desconocido)'
  const iso = new Date(Date.now() - ageMs).toISOString()
  return fmtTimeAgo(iso)
}

// Suppress unused-import lint when type is only used narratively above.
export type _UnusedPgCronJob = PgCronJob
