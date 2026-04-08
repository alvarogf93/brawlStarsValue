-- ═══════════════════════════════════════════════════════════════
-- Meta Data Infrastructure for Draft & Counter-Pick
-- ═══════════════════════════════════════════════════════════════

-- Win rate counters per brawler/map/mode (anonymous, aggregated)
CREATE TABLE IF NOT EXISTS meta_stats (
  brawler_id INT NOT NULL,
  map TEXT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,         -- 'global' | 'users'
  date DATE NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brawler_id, map, mode, source, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_stats_lookup
  ON meta_stats(map, mode, source, date);

-- Matchup counters: brawler vs brawler at MODE level (not map)
CREATE TABLE IF NOT EXISTS meta_matchups (
  brawler_id INT NOT NULL,
  opponent_id INT NOT NULL,
  mode TEXT NOT NULL,
  source TEXT NOT NULL,         -- 'global' | 'users'
  date DATE NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  PRIMARY KEY (brawler_id, opponent_id, mode, source, date)
);

CREATE INDEX IF NOT EXISTS idx_meta_matchups_lookup
  ON meta_matchups(mode, source, date);

-- Polling cursors for deduplication (one row per polled player)
CREATE TABLE IF NOT EXISTS meta_poll_cursors (
  player_tag TEXT PRIMARY KEY,
  last_battle_time TIMESTAMPTZ NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- RPC: Atomic increment upsert for meta_stats
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION upsert_meta_stat(
  p_brawler_id INT,
  p_map TEXT,
  p_mode TEXT,
  p_source TEXT,
  p_date TEXT,
  p_wins INT,
  p_losses INT,
  p_total INT
) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO meta_stats (brawler_id, map, mode, source, date, wins, losses, total)
  VALUES (p_brawler_id, p_map, p_mode, p_source, p_date::date, p_wins, p_losses, p_total)
  ON CONFLICT (brawler_id, map, mode, source, date)
  DO UPDATE SET
    wins = meta_stats.wins + EXCLUDED.wins,
    losses = meta_stats.losses + EXCLUDED.losses,
    total = meta_stats.total + EXCLUDED.total;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RPC: Atomic increment upsert for meta_matchups
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION upsert_meta_matchup(
  p_brawler_id INT,
  p_opponent_id INT,
  p_mode TEXT,
  p_source TEXT,
  p_date TEXT,
  p_wins INT,
  p_losses INT,
  p_total INT
) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO meta_matchups (brawler_id, opponent_id, mode, source, date, wins, losses, total)
  VALUES (p_brawler_id, p_opponent_id, p_mode, p_source, p_date::date, p_wins, p_losses, p_total)
  ON CONFLICT (brawler_id, opponent_id, mode, source, date)
  DO UPDATE SET
    wins = meta_matchups.wins + EXCLUDED.wins,
    losses = meta_matchups.losses + EXCLUDED.losses,
    total = meta_matchups.total + EXCLUDED.total;
$$;

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE meta_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_poll_cursors ENABLE ROW LEVEL SECURITY;

-- meta_stats: public read, service-only write
CREATE POLICY "meta_stats_select" ON meta_stats FOR SELECT USING (true);
CREATE POLICY "meta_stats_all_service" ON meta_stats FOR ALL USING (
  (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
);

-- meta_matchups: public read, service-only write
CREATE POLICY "meta_matchups_select" ON meta_matchups FOR SELECT USING (true);
CREATE POLICY "meta_matchups_all_service" ON meta_matchups FOR ALL USING (
  (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
);

-- meta_poll_cursors: service-only everything
CREATE POLICY "meta_poll_cursors_service" ON meta_poll_cursors FOR ALL USING (
  (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role'
);
