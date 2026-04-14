import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Known cron job identifiers. Keep this list aligned with the
 * VPS crontab lines in `docs/crons/README.md` + any pg_cron jobs
 * that also write heartbeats. The names are used as the primary
 * key of the `cron_heartbeats` table, so a typo here would land
 * as a new row instead of updating the existing one.
 */
export const CRON_JOB_NAMES = {
  META_POLL: 'meta-poll',
  SYNC: 'sync',
} as const

export type CronJobName = (typeof CRON_JOB_NAMES)[keyof typeof CRON_JOB_NAMES]

/**
 * Write a success heartbeat for a cron job.
 *
 * Called at the very END of a successful cron run — after all
 * side-effects (bulk upserts, cursor updates, notifications)
 * have committed. The point is to record "this job finished
 * end-to-end at time T", not "the handler started". A run that
 * crashes halfway should NOT write a heartbeat.
 *
 * This is a BEST-EFFORT write. Failures are logged and swallowed
 * because:
 *
 *   - The run itself already succeeded; the heartbeat is just
 *     metadata. A failed metadata write should not turn a good
 *     run into a bad one.
 *   - The caller's other side-effects (meta_stats upserts, etc.)
 *     have already committed at this point, so there's nothing
 *     to roll back.
 *
 * The v2 alerting cron that reads `cron_heartbeats` should
 * tolerate occasional staleness — one missed heartbeat every
 * now and then is not an outage. Tune its threshold to ≥ 2×
 * the expected cron interval to avoid false positives.
 *
 * @param supabase   service-role Supabase client (needed to write
 *                   past the RLS policy that allows only service-
 *                   role writes to `cron_heartbeats`)
 * @param jobName    one of `CRON_JOB_NAMES.*`
 * @param startedAt  `Date.now()` captured at the start of the run
 * @param summary    small JSON payload with the run's diagnostics.
 *                   Keep it to primitives + counts (< 1 KB) — this
 *                   is for at-a-glance observability, not full logs.
 */
export async function writeCronHeartbeat(
  supabase: SupabaseClient,
  jobName: CronJobName,
  startedAt: number,
  summary: Record<string, unknown>,
): Promise<void> {
  const now = Date.now()
  const durationMs = Math.max(0, now - startedAt)
  try {
    const { error } = await supabase.from('cron_heartbeats').upsert(
      {
        job_name: jobName,
        last_success_at: new Date(now).toISOString(),
        last_duration_ms: durationMs,
        last_summary: summary,
      },
      { onConflict: 'job_name' },
    )
    if (error) {
      console.error('[cron/heartbeat] upsert returned error', { jobName, error })
    }
  } catch (err) {
    console.error('[cron/heartbeat] write threw', { jobName, err })
  }
}
