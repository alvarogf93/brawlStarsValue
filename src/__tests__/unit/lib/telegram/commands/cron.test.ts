import { describe, it, expect } from 'vitest'
import { handleCron } from '@/lib/telegram/commands/cron'
import type { CronData, Queries } from '@/lib/telegram/types'

function makeQueries(c: Partial<CronData> = {}): Queries {
  const nowIso = new Date().toISOString()
  const defaults: CronData = {
    pgCronJobs: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    schedule: '*/15 * * * *', active: true, command: '' },
      { jobid: 2, jobname: 'process-sync-queue',       schedule: '*/5 * * * *',  active: true, command: '' },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', schedule: '0 3 * * *',    active: true, command: '' },
    ],
    cronRuns: [
      { jobid: 1, jobname: 'enqueue-premium-syncs',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 2, jobname: 'process-sync-queue',       status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
    ],
    runsByJob: new Map([
      ['enqueue-premium-syncs', 96],
      ['process-sync-queue', 288],
      ['cleanup-anonymous-visits', 1],
    ]),
    metaPollFreshness: { ageMs: 10 * 60 * 1000, status: 'fresh' },
    syncFreshness:     { ageMs: 18 * 60 * 1000, status: 'fresh' },
  }
  const merged: CronData = {
    ...defaults,
    ...c,
    runsByJob: c.runsByJob ?? defaults.runsByJob,
    pgCronJobs: c.pgCronJobs ?? defaults.pgCronJobs,
    cronRuns: c.cronRuns ?? defaults.cronRuns,
    metaPollFreshness: c.metaPollFreshness ?? defaults.metaPollFreshness,
    syncFreshness: c.syncFreshness ?? defaults.syncFreshness,
  }
  return {
    getStats: () => Promise.reject(new Error('not used')),
    getBattles: () => Promise.reject(new Error('not used')),
    getPremium: () => Promise.reject(new Error('not used')),
    getCronStatus: async () => merged,
    getMapList: () => Promise.reject(new Error('not used')),
    findMapByPrefix: () => Promise.reject(new Error('not used')),
    getMapData: () => Promise.reject(new Error('not used')),
  }
}

describe('handleCron', () => {
  it('renders all 3 pg_cron jobs + VPS freshness — all green', async () => {
    const out = await handleCron({ args: [], queries: makeQueries() })
    expect(out).toContain('PG_CRON JOBS')
    expect(out).toContain('VPS ORACLE')
    expect(out).toContain('enqueue-premium-syncs')
    expect(out).toContain('96 / 96 expected')
    expect(out).toContain('288 / 288 expected')
    expect(out).toContain('✅')
    expect(out).toContain('SETUP-HEALTHCHECKS')
  })

  it('marks failed runs with ❌ and shows return_message', async () => {
    const nowIso = new Date().toISOString()
    const out = await handleCron({ args: [], queries: makeQueries({
      cronRuns: [
        { jobid: 1, jobname: 'enqueue-premium-syncs', status: 'failed', return_message: 'ERROR: duplicate key', start_time: nowIso, end_time: nowIso },
        { jobid: 2, jobname: 'process-sync-queue',    status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
        { jobid: 3, jobname: 'cleanup-anonymous-visits', status: 'succeeded', return_message: null, start_time: nowIso, end_time: nowIso },
      ],
    }) })
    expect(out).toContain('❌')
    expect(out).toContain('duplicate key')
  })

  it('renders stale/dead VPS status correctly', async () => {
    const out = await handleCron({ args: [], queries: makeQueries({
      metaPollFreshness: { ageMs: 45 * 60 * 1000, status: 'stale' },
      syncFreshness:     { ageMs: 90 * 60 * 1000, status: 'dead'  },
    }) })
    expect(out).toContain('🟡')
    expect(out).toContain('🔴')
  })

  it('handles empty pgCronJobs gracefully', async () => {
    const out = await handleCron({ args: [], queries: makeQueries({
      pgCronJobs: [], cronRuns: [], runsByJob: new Map(),
    }) })
    expect(out).toContain('(no disponible)')
  })
})
