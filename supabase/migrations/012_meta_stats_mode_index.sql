-- ═══════════════════════════════════════════════════════════════
-- Sprint C — Meta UX Remediation
-- Index for the Tier 2 mode-only fallback query.
-- ═══════════════════════════════════════════════════════════════
--
-- /api/meta/pro-analysis and /api/meta (event rotation) issue a
-- Tier 1 query that filters meta_stats by (map, mode, source, date).
-- When Tier 1 returns no brawlers above the PRO_MIN_BATTLES_DISPLAY
-- threshold (sparse Tier D maps like heist::Pit Stop), the code
-- falls back to Tier 2: the same query WITHOUT the map filter.
--
-- Existing index:
--   idx_meta_stats_lookup ON meta_stats(map, mode, source, date)
--   Leads with `map`, so Tier 2 triggers a skip-scan.
--
-- New index:
--   idx_meta_stats_mode_lookup ON meta_stats(mode, source, date)
--   Leading-column match for Tier 2.
--
-- CREATE INDEX CONCURRENTLY does not lock the table while building,
-- so it is safe to apply on production during any deploy window.
-- Reversible with DROP INDEX.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meta_stats_mode_lookup
  ON meta_stats(mode, source, date);
