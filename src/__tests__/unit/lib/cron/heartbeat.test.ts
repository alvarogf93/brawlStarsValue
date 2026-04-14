import { describe, it, expect, vi, beforeEach } from 'vitest'
import { writeCronHeartbeat, CRON_JOB_NAMES } from '@/lib/cron/heartbeat'

interface UpsertCall {
  table: string
  row: Record<string, unknown>
  options: Record<string, unknown>
}

function buildSupabaseMock(upsertOutcome: { error: unknown } | Error | null = null) {
  const calls: UpsertCall[] = []
  const from = vi.fn((table: string) => ({
    upsert: vi.fn((row: Record<string, unknown>, options: Record<string, unknown>) => {
      calls.push({ table, row, options })
      if (upsertOutcome instanceof Error) return Promise.reject(upsertOutcome)
      return Promise.resolve(upsertOutcome ?? { error: null })
    }),
  }))
  return { from, calls } as unknown as {
    from: ReturnType<typeof vi.fn>
    calls: UpsertCall[]
  }
}

describe('writeCronHeartbeat', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('upserts a row with job_name, last_success_at, last_duration_ms, last_summary', async () => {
    const supabase = buildSupabaseMock()
    const startedAt = Date.now() - 5000 // 5 seconds ago
    await writeCronHeartbeat(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      CRON_JOB_NAMES.META_POLL,
      startedAt,
      { battlesProcessed: 571, poolSize: 2094 },
    )

    expect(supabase.calls).toHaveLength(1)
    const call = supabase.calls[0]
    expect(call.table).toBe('cron_heartbeats')
    expect(call.row.job_name).toBe('meta-poll')
    expect(call.row.last_duration_ms).toBeGreaterThanOrEqual(5000)
    expect(call.row.last_duration_ms).toBeLessThan(6000) // sanity
    expect(call.row.last_summary).toEqual({ battlesProcessed: 571, poolSize: 2094 })
    expect(call.options).toEqual({ onConflict: 'job_name' })
    // last_success_at should be an ISO string parsable back to a Date
    const successAt = new Date(call.row.last_success_at as string)
    expect(Number.isFinite(successAt.getTime())).toBe(true)
  })

  it('uses the sync job name constant for the sync cron', async () => {
    const supabase = buildSupabaseMock()
    await writeCronHeartbeat(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      CRON_JOB_NAMES.SYNC,
      Date.now(),
      { processed: 10 },
    )
    expect(supabase.calls[0].row.job_name).toBe('sync')
  })

  it('clamps negative durations to 0 when startedAt is in the future (clock skew defense)', async () => {
    const supabase = buildSupabaseMock()
    const startedAt = Date.now() + 10_000 // ficticiously in the future
    await writeCronHeartbeat(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase as any,
      CRON_JOB_NAMES.META_POLL,
      startedAt,
      {},
    )
    expect(supabase.calls[0].row.last_duration_ms).toBe(0)
  })

  it('swallows Supabase error responses without throwing (best-effort contract)', async () => {
    const supabase = buildSupabaseMock({ error: { message: 'permission denied' } })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      writeCronHeartbeat(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        CRON_JOB_NAMES.META_POLL,
        Date.now(),
        {},
      ),
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      '[cron/heartbeat] upsert returned error',
      expect.objectContaining({ jobName: 'meta-poll' }),
    )
    errorSpy.mockRestore()
  })

  it('swallows thrown errors without throwing (best-effort contract)', async () => {
    const supabase = buildSupabaseMock(new Error('network is down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      writeCronHeartbeat(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase as any,
        CRON_JOB_NAMES.META_POLL,
        Date.now(),
        {},
      ),
    ).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      '[cron/heartbeat] write threw',
      expect.objectContaining({ jobName: 'meta-poll' }),
    )
    errorSpy.mockRestore()
  })
})
