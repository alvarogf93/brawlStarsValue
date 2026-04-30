-- ═══════════════════════════════════════════════════════════════
-- LOG-01 — compute_brawler_trends() must filter source='global'
-- ═══════════════════════════════════════════════════════════════
--
-- meta_stats is multi-source: 'global' (cron meta-poll → top pro
-- players) and 'users' (cron sync → premium users' personal data).
-- The previous version of compute_brawler_trends() summed both, so
-- a premium user's losing streak literally dragged down the "PRO
-- trend" badge served to every home-page visitor.
--
-- All other meta_stats consumers explicitly filter source='global'
-- (see /api/meta/pro-analysis). This migration brings the bulk
-- precomputed function in line.
--
-- The TS inline fallback in /api/meta/brawler-trends/route.ts is
-- patched in the same PR so the two paths cannot diverge.
--
-- Idempotent: only CREATE OR REPLACEs the function. Re-running on
-- a database that already has the global-only version is a no-op.
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
  cutoff_recent DATE := ((now() AT TIME ZONE 'UTC') - INTERVAL '7 days')::DATE;
  cutoff_prev   DATE := ((now() AT TIME ZONE 'UTC') - INTERVAL '14 days')::DATE;
BEGIN
  WITH agg AS (
    SELECT
      brawler_id,
      SUM(CASE WHEN date >= cutoff_recent THEN wins ELSE 0 END)::INTEGER  AS recent_wins,
      SUM(CASE WHEN date >= cutoff_recent THEN total ELSE 0 END)::INTEGER AS recent_total,
      SUM(CASE WHEN date >= cutoff_prev AND date < cutoff_recent THEN wins ELSE 0 END)::INTEGER  AS prev_wins,
      SUM(CASE WHEN date >= cutoff_prev AND date < cutoff_recent THEN total ELSE 0 END)::INTEGER AS prev_total
    FROM public.meta_stats
    WHERE date >= cutoff_prev
      AND source = 'global'   -- ⬅ LOG-01 fix
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

  -- C1 fix from migration 021: evict brawlers whose data fell out
  -- of the 14-day window. With the new source filter this also
  -- evicts brawlers that previously had only 'users' data.
  DELETE FROM public.brawler_trends
  WHERE computed_at < now() - INTERVAL '10 seconds';

  INSERT INTO public.cron_heartbeats (job_name, last_success_at, last_duration_ms, last_summary)
  VALUES (
    'compute-brawler-trends',
    now(),
    0,
    jsonb_build_object(
      'computed_count', rows_upserted,
      'non_null_count', (SELECT COUNT(*) FROM public.brawler_trends WHERE trend_7d IS NOT NULL),
      'table_rows',     (SELECT COUNT(*) FROM public.brawler_trends),
      'source_filter',  'global'
    )
  )
  ON CONFLICT (job_name) DO UPDATE
    SET last_success_at  = EXCLUDED.last_success_at,
        last_duration_ms = EXCLUDED.last_duration_ms,
        last_summary     = EXCLUDED.last_summary;

  RETURN rows_upserted;
END;
$$;

-- Re-seed immediately so the contaminated values are replaced
-- without waiting for the next 6h cron tick.
SELECT public.compute_brawler_trends();

COMMIT;
