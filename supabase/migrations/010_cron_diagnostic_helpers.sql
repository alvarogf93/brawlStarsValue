-- ═══════════════════════════════════════════════════════════════
-- Cron diagnostic helpers
-- ═══════════════════════════════════════════════════════════════
--
-- Exposes read-only access to `cron.job` and `cron.job_run_details`
-- via SECURITY DEFINER RPCs so that scripts/diagnose-meta-coverage.js
-- (and the Telegram conversational bot when it lands) can inspect
-- the scheduler without granting direct access to the `cron` schema.
--
-- Access is granted only to `service_role`. Neither `anon` nor
-- `authenticated` can call these RPCs.

BEGIN;

-- ── diagnose_cron_jobs ──────────────────────────────────────────
-- Returns every registered pg_cron job with its schedule and
-- active flag. The `command` field is intentionally excluded to
-- avoid leaking secrets (some jobs call net.http_post with bearer
-- tokens in their bodies).

CREATE OR REPLACE FUNCTION public.diagnose_cron_jobs()
RETURNS TABLE (
  jobid BIGINT,
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  username TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jobid, jobname, schedule, active, username
  FROM cron.job
  ORDER BY jobid;
$$;

REVOKE ALL     ON FUNCTION public.diagnose_cron_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.diagnose_cron_jobs() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.diagnose_cron_jobs() TO service_role;

-- ── diagnose_cron_runs ──────────────────────────────────────────
-- Returns recent run details across all jobs. Each row includes
-- start_time, end_time, status, and return_message. Use this to
-- detect slow runs, failed runs, and skipped runs.
--
-- The `return_message` column can contain error text — leaving
-- it in is fine because we only expose to service_role.

CREATE OR REPLACE FUNCTION public.diagnose_cron_runs(p_limit INT DEFAULT 20)
RETURNS TABLE (
  jobid BIGINT,
  jobname TEXT,
  runid BIGINT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  return_message TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.jobid,
    j.jobname,
    r.runid,
    r.start_time,
    r.end_time,
    r.status,
    r.return_message
  FROM cron.job_run_details r
  LEFT JOIN cron.job j USING (jobid)
  ORDER BY r.start_time DESC
  LIMIT p_limit;
$$;

REVOKE ALL     ON FUNCTION public.diagnose_cron_runs(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.diagnose_cron_runs(INT) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.diagnose_cron_runs(INT) TO service_role;

COMMIT;
