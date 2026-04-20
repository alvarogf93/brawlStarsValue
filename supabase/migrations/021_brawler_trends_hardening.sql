-- ═══════════════════════════════════════════════════════════════
-- brawler_trends hardening — fixes from code review of migration 020
-- ═══════════════════════════════════════════════════════════════
--
-- C1. Dormant brawlers kept stale rows forever. The old function
-- only UPSERTed brawlers seen in the last 14 days, so when a
-- brawler went 14+ days without a `meta_stats` row its previous
-- `trend_7d` value survived in the table. The bulk endpoint's fast
-- path served that stale value while the single-brawler detail
-- endpoint (which recomputes from live meta_stats) would return
-- `null` for the same brawler — silent divergence. The fix DELETEs
-- orphan rows in the same transaction.
--
-- I2. TZ drift. `meta_stats.date` is written by the application as
-- `new Date().toISOString().slice(0,10)` — always UTC. The old
-- function used `CURRENT_DATE` which depends on the session
-- timezone. Supabase's DB-level default is UTC today, so this was
-- a latent bug rather than an observed one, but the fix is cheap:
-- pin the cutoffs to UTC regardless of connection timezone.
--
-- This migration is idempotent — it only CREATE OR REPLACEs the
-- function; the table, policies, and cron schedule from 020 are
-- untouched. Re-running is safe.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.compute_brawler_trends()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_upserted INTEGER;
  -- TZ-hardened cutoffs — always compute from UTC wall clock,
  -- matching how the application writes `meta_stats.date`.
  cutoff_recent DATE := ((now() AT TIME ZONE 'UTC') - INTERVAL '7 days')::DATE;
  cutoff_prev   DATE := ((now() AT TIME ZONE 'UTC') - INTERVAL '14 days')::DATE;
BEGIN
  -- Aggregate the 14-day window per brawler.
  WITH agg AS (
    SELECT
      brawler_id,
      SUM(CASE WHEN date >= cutoff_recent THEN wins ELSE 0 END)::INTEGER  AS recent_wins,
      SUM(CASE WHEN date >= cutoff_recent THEN total ELSE 0 END)::INTEGER AS recent_total,
      SUM(CASE WHEN date >= cutoff_prev AND date < cutoff_recent THEN wins ELSE 0 END)::INTEGER  AS prev_wins,
      SUM(CASE WHEN date >= cutoff_prev AND date < cutoff_recent THEN total ELSE 0 END)::INTEGER AS prev_total
    FROM public.meta_stats
    WHERE date >= cutoff_prev
    GROUP BY brawler_id
  ),
  computed AS (
    SELECT
      brawler_id,
      recent_total,
      prev_total,
      CASE
        WHEN recent_total < 3 OR prev_total < 3 THEN NULL
        ELSE ROUND(
          ((recent_wins::NUMERIC / recent_total * 100)
           - (prev_wins::NUMERIC / prev_total * 100))::NUMERIC,
          1
        )
      END AS trend_7d
    FROM agg
  )
  INSERT INTO public.brawler_trends (brawler_id, trend_7d, recent_total, prev_total, computed_at)
  SELECT brawler_id, trend_7d, recent_total, prev_total, now()
  FROM computed
  ON CONFLICT (brawler_id) DO UPDATE
    SET trend_7d     = EXCLUDED.trend_7d,
        recent_total = EXCLUDED.recent_total,
        prev_total   = EXCLUDED.prev_total,
        computed_at  = EXCLUDED.computed_at;

  GET DIAGNOSTICS rows_upserted = ROW_COUNT;

  -- C1 fix: evict brawlers whose data fell out of the 14-day
  -- window. Without this, dormant brawlers keep a stale trend
  -- forever. Anchored to `computed_at` rather than brawler_id
  -- membership so that if a single run fails mid-way, the next
  -- successful run still evicts everything the UPSERT didn't
  -- refresh in the same second.
  DELETE FROM public.brawler_trends
  WHERE computed_at < now() - INTERVAL '10 seconds';

  -- Observability.
  INSERT INTO public.cron_heartbeats (job_name, last_success_at, last_duration_ms, last_summary)
  VALUES (
    'compute-brawler-trends',
    now(),
    0,
    jsonb_build_object(
      'computed_count', rows_upserted,
      'non_null_count', (SELECT COUNT(*) FROM public.brawler_trends WHERE trend_7d IS NOT NULL),
      'table_rows',     (SELECT COUNT(*) FROM public.brawler_trends)
    )
  )
  ON CONFLICT (job_name) DO UPDATE
    SET last_success_at  = EXCLUDED.last_success_at,
        last_duration_ms = EXCLUDED.last_duration_ms,
        last_summary     = EXCLUDED.last_summary;

  RETURN rows_upserted;
END;
$$;

-- Re-seed immediately so the hardened function takes effect
-- without waiting for the next 6h cron tick.
SELECT public.compute_brawler_trends();

COMMIT;
