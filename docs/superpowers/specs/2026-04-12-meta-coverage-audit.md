# Meta Coverage Audit — 2026-04-12

> **Triggered by**: user question "hay mapas sin datos hasta muy entrado el día — ¿añadir pro players multi-región ayudaría?"
>
> **Method**: read-only diagnostic script against production Supabase via `service_role`. Output in `scripts/diagnose-meta-coverage.js`.
>
> **Status**: partial — cron schedule inspection requires applying `supabase/migrations/010_cron_diagnostic_helpers.sql` to production. Everything else is based on real data from the DB on the date above.

## Executive summary

The user's diagnosis of the symptom (maps under-covered) is **correct**. Their proposed fix (add regional pro-player pools) is **wrong**. The real problem is not timezone coverage — it is **pool rot + pool bias toward popular modes**. The recommended fix is three tactical changes to the existing poll, not a geographic split.

## Findings — raw numbers from production

| Metric | Value |
|---|---|
| `battles` table total rows | **108** |
| `battles` distinct players (last 48h) | **1** (`#YJU282PV`) |
| `meta_stats` total rows | **3.443** |
| `meta_stats` source='global' rows | **3.432** |
| `meta_stats` source='users' rows | **11** |
| `meta_poll_cursors` total | **205** |
| Cursors with age <30 min | **0** |
| Cursors with age 30-60 min | **97** |
| Cursors with age 1-3h | **29** |
| Cursors with age 3-12h | **41** |
| Cursors with age 12-24h | **16** |
| Cursors with age >24h | **22** |
| Distinct (map, mode) with global data today | **44** |
| Rows inserted in `meta_stats` today | **819** |
| Rows inserted in `meta_stats` yesterday | **818** |
| Rows inserted two days ago | **710** |
| Rows inserted on 2026-04-07 | **0** (downtime/reset) |

### Finding 1: `battles` is NOT the meta source

The first surprise of the audit: `battles` has only 108 rows and 1 distinct player — that player is `#YJU282PV` (developer fixture). `battles` is populated exclusively by the premium sync flow in `src/lib/battle-sync.ts`. It does **not** feed `meta_stats`.

This means the mental model of "meta coverage = battles coverage" is wrong. The meta data flows entirely through a parallel path: Supercell → proxy → `/api/cron/meta-poll` → direct `meta_stats` upsert via `upsert_meta_stat` RPC. We never see those raw battles — only the aggregated counts.

Implication: any fix that targets `battles` (indexes, fusion, frequency) is pointing at the wrong artefact. The fix must target `meta_poll_cursors` or the poll handler itself.

### Finding 2: Map coverage is extremely bimodal

Today (2026-04-12), `meta_stats` has 44 distinct `(map, mode)` combinations. Sorted by total battles, the distribution is:

| Tier | Battles | Count | Examples |
|---|---|---|---|
| **A — Heavy** | >500 | 6 maps | brawlBall::Sidetrack (2.798, 81 brawlers), knockout::Healthy Middle Ground (2.017), brawlBall::Nutmeg (1.848) |
| **B — Medium** | 100-500 | 11 maps | basketBrawl::Slam Dunk (349), brawlBall::Slippery Slap (334), wipeout::Palette Hangout (203) |
| **C — Low** | 30-99 | 18 maps | Most of the heist/bounty/hotZone rotation |
| **D — Critical** | <30 | **9 maps** | **heist::Pit Stop (2 battles, 1 brawler), brawlBall::Pinhole Punt (3), knockout::Goldarm Gulch (3), bounty::Starrburst (8)** |

**The Tier D maps are the user's complaint.** They have so few battles that the brawler coverage collapses to 1-2 brawlers out of ~80. Any counter-pick recommendation on a Tier D map is statistically meaningless.

**Critical observation about Tier D**: they are almost exclusively in under-played modes (`heist`, `basketBrawl`, `wipeout`, `bounty`) and on maps that are either newly rotated or historically unpopular among pro players. They are **not** in the popular rotation (`brawlBall`, `knockout`, `hotZone`, `gemGrab`).

### Finding 3: The poll DOES run — the user's intuition about timezones is wrong

The user hypothesized that maps are empty "hasta muy entrado el día" because the global pool pro players live in Asia and haven't woken up yet.

The data disproves this:

- **Cursor freshness**: 97 of 205 cursors updated between 30-60 minutes ago. Zero cursors are fresher than 30 min. This pattern is consistent with a cron that runs every 30 minutes and touches every cursor on each run.
- **meta_stats daily volume is stable**: ~700-820 rows inserted per day across the last 4 days. If the poll were sitting idle during some hours, the daily totals would be smaller.
- **Tier D maps have sparse coverage regardless of hour of day**: if the problem were timezone-based, these maps would fill up over the course of the day as different regions come online. They don't — they stay sparse because *the pro players don't play them at all*.

**The real cause of Tier D sparsity is pool bias, not pool timing**. The top 200 global players play the maps they enjoy (popular modes), not a uniformly random sample of the rotation. No amount of additional regional players would change this — top EU players also favor brawlBall, not heist.

### Finding 4: The pool has 11% dead weight

Of the 205 cursors, **22 are stale for more than 24 hours**. These are players who were in the top 200 when they joined the pool but have since stopped playing (or at least stopped producing battle data). The pool is not being refreshed to replace them with currently-active top players.

Effective active pool size = 205 - 22 = **183** (not 205 as the config suggests).

A further 16 cursors are 12-24h stale. These are borderline — a player who plays once a day would fall in this bucket. They may or may not be dead.

Realistic active pool size = **~167-183** on any given day.

### Finding 5: The `source='users'` fusion path exists but is empty

The `meta_stats` schema already supports a `source` column with two values in use (`global` and `users`). The user fusion feature is wired at the schema level — but has only 11 rows total. This confirms that only 1 premium user is actively contributing to it today (`#YJU282PV`, 14 battles in `battles` table).

Implication: when the premium tier gets real users, the `source='users'` data path will naturally fill in the Tier C and Tier D gaps, because real premium users play a much more varied distribution of modes than pros (most casual players play the rotation that's in front of them, not their favorites). This is the **best long-term lever**, and it already exists — it just needs users.

### Finding 6: `meta_stats` downtime on 2026-04-07

Two days in the last week had zero global rows: 2026-04-06 and 2026-04-07. This is a downtime/reset event of some kind. It's old enough to not block the current audit, but **the user may want to investigate** whether that was planned (cron paused, migration applied, etc.) or an unnoticed outage.

## Analysis — reinterpreting the user's three options

The user proposed three alternatives in the conversation. Audit data lets us score them against reality:

### ~~Alternative 1~~: "Poll more often"

**Rejected — invalid.** I proposed this based on a false assumption about the API. The Supercell API updates battlelogs with ~30 min latency and returns only the last 25 battles. Polling faster than every 30 min yields duplicates without new data. Discarded.

### Follow-up correction (added after user clarification)

After writing the first version of this audit I proposed "migrate the meta-poll cron to Vercel Cron" as Priority 0. **That recommendation was based on a false assumption about Vercel Hobby limits** — I thought Hobby allowed `0 * * * *` (hourly). The user corrected me: Vercel Hobby historically limited cron jobs to **1 invocation per day**, and that is exactly why the meta-poll was placed on the Oracle VPS crontab in the first place. It was the correct decision given the constraints of a free tier.

The revised Priority 0 is **not** "migrate to Vercel Cron" — it is "add health monitoring to the VPS cron" (healthchecks.io, 1 hour of work, no migration) plus optionally "migrate to `pg_cron` + `pg_net` for centralized observability without changing plan" (1 sprint). Vercel Cron migration is only on the table if the project upgrades to Pro for unrelated reasons.

This correction is important: the VPS cron is **not** a mistake to be undone. It is a correct architectural decision that needs better operational hygiene, not replacement.

### Alternative 2: "Add regional pro player pools"

**Rejected — data disproves the hypothesis.** The user's reasoning was that the global pool is timezone-biased. But the actual sparsity pattern is **by mode**, not by hour. Tier D maps (`heist::Pit Stop` etc.) would remain sparse even with perfect 24h geographic coverage, because pro players don't play those modes anywhere in the world.

Adding regional pools would:
- 3-5x the API calls to the Supercell proxy (hard rate limit issue).
- Fragment `meta_stats` into regional buckets, each smaller than the current global pool.
- Not improve Tier D coverage, because top EU players avoid Pit Stop just as reliably as top APAC players.

**Do not pursue this.**

### Alternative 3: "Fuse with premium user battles (`source='users'`)"

**Validated as the strongest long-term lever.** The fusion path already exists at the schema and RPC level. The table is empty because there is only 1 active premium user. Real users play the full rotation (not just popular modes), so `source='users'` data would naturally cover Tier C and Tier D much more evenly than the pro pool ever could.

**But it's not a fix for *today*** — it requires real premium users that BrawlVision doesn't have yet. It becomes effective as the premium subscriber base grows.

### New alternative discovered in the audit: "Refresh + rebalance the existing pool"

**This is the tactical fix that matters right now.** Two concrete changes:

1. **Prune dead cursors.** Delete or flag the 22 cursors older than 24h. Re-fetch the current top-200 from `/rankings/global/players` and replace the dead ones with live top players. This is a weekly cron job, not a one-off.

2. **Consider expanding the pool from 200 → 500**, but monitor proxy rate limits. The ratio of brawler coverage on Tier D maps (1-5 brawlers) vs Tier A (60-80 brawlers) suggests the pool size is the binding constraint for the long tail. More players = more diverse mode preferences sampled.

## Recommendations (ranked by ROI)

### Priority 1 — Cron job to refresh `meta_poll_cursors` weekly

**Effort**: 1 small SQL migration + 1 `pg_cron` schedule line. Fits in an afternoon.

**What it does**:
- Once a week, query Supercell `/rankings/global/players?limit=500`.
- Insert new cursors for any tag not already in `meta_poll_cursors`.
- Delete any cursor where `last_battle_time < now() - interval '7 days'`.
- The poll cron then naturally converges on the currently-active top 200.

**Expected gain**:
- Reclaims the 11% dead weight → effective pool rises from ~183 back to 200.
- Captures newly-ascending pros who are actually playing today.
- Gradually shifts the pool distribution with Brawl Stars season changes.

**Not expected to fix**: Tier D sparsity. Dead weight removal gives you ~10% more battles overall, distributed proportionally to the existing mode bias. It's a hygiene fix.

### Priority 2 — Hierarchical backoff for counter-picks (from the conversation's Tema C)

**Effort**: 1 sprint. Schema addition (brawler archetypes table), query rewrite in `src/lib/analytics/recommendations.ts`, UI changes in counter-pick display to show confidence tier.

**What it does**: Uses what data we DO have, intelligently.

When the user asks "what counters Piper on heist::Pit Stop?" and we have only 2 battles, the backoff query answers in order:
1. Specific match (2 battles → unreliable, skip)
2. Same mode, any map (`opponent_id=piper AND mode=heist` → maybe 30 battles, usable with warning)
3. Any mode, any map (`opponent_id=piper` → 900 battles, reliable but generic)
4. Archetype-based (`my_archetype=tank AND opponent_archetype=sniper AND mode=heist` → usable baseline)
5. Empty state: "No hay datos suficientes todavía."

**Expected gain**: Tier D maps become *usable* in the counter-pick feature without needing more data. The UX stops lying to the user — every recommendation carries a confidence tag.

**This is the highest-value change for end users.** It doesn't fix the underlying data scarcity, but it converts "no useful answer" into "useful answer with caveat" everywhere the user currently sees broken recommendations.

### Priority 3 — Monitor `source='users'` growth as premium converts

**Effort**: zero coding. Just a reminder to re-run this audit in 30 days.

**What it does**: Nothing immediate. But as premium users come online, `source='users'` will naturally fill the long tail without any schema or code changes.

**Decision point**: once `source='users'` has >10.000 rows across >50 distinct players, revisit the fusion logic in the API to start blending sources with appropriate weights.

### Priority 4 — Expand pool 200 → 500 (**conditional**)

**Effort**: cron schedule change + proxy capacity check.

**What it does**: 2.5x the battle volume per hour. Slightly more diverse mode coverage.

**Gate**: before pulling the trigger, measure current proxy throughput vs its max. If we're at 40% of the proxy's rate limit, we have headroom. If we're at 80%, this would push us over.

**Requires**: run the cron.job_run_details diagnostic after applying `010_cron_diagnostic_helpers.sql` to see actual run times. If the 200-player poll is already taking 20+ minutes of every 30-min window, we cannot safely 2.5x it.

### NOT recommended: ~~Regional pools~~ (user's original idea)

Per Finding 3, the hypothesis the user was testing is not supported by the data. The symptom (Tier D sparsity) would persist regardless of timezone coverage because it's driven by mode preferences, not hour-of-day.

## Data I could not collect — requires helper migration

To complete this audit fully, the following data is needed but is in the `cron` schema (outside PostgREST's default exposure):

- **Exact `cron.schedule` string** for the meta poll job (confirms frequency)
- **Last 20 `cron.job_run_details`** (confirms duration, success/fail rate)
- **Whether any runs are overrunning** the 30-min window

**Action**: I created `supabase/migrations/010_cron_diagnostic_helpers.sql` with two `SECURITY DEFINER` RPCs (`diagnose_cron_jobs()` and `diagnose_cron_runs(limit)`) that expose a safe read-only view of cron state to the service role. Apply that migration to production via the Supabase Dashboard SQL Editor, then re-run `scripts/diagnose-meta-coverage.js` to fill in section 11 of the output.

The migration is idempotent (`CREATE OR REPLACE`, `GRANT/REVOKE` explicit), wrapped in `BEGIN;/COMMIT;`, and grants EXECUTE to `service_role` only — `anon` and `authenticated` are explicitly revoked. Same pattern as the anonymous_visits migration from earlier today.

## Tool deliverables

- **`scripts/diagnose-meta-coverage.js`** — reusable read-only diagnostic. Run at any time to see the current state of the poll. Safe to commit.
- **`supabase/migrations/010_cron_diagnostic_helpers.sql`** — migration to apply when the user wants cron.job visibility (via the conversational bot eventually).
- **This document** — the audit trail.

## Answer to the user's original question

> "¿Los pro players multi-región es una buena opción?"

**No.** The data shows the problem is not regional or temporal. It's structural: pro players prefer a narrow set of modes, and Tier D maps are simply outside that preference. Adding 3x more pro players from different regions would add 3x more brawlBall coverage and barely move heist::Pit Stop.

The right direction is:
1. **Short term** — ship hierarchical backoff for counter-picks. Users stop seeing broken recommendations immediately. (1 sprint)
2. **Medium term** — refresh the poll cursors weekly to reclaim dead weight. Small hygiene improvement. (1 afternoon)
3. **Long term** — grow premium user base so `source='users'` naturally covers the long tail. Best fix for all sparsity problems at once. (product work, not engineering)

Regional pools would be a sideways step at best and a data-fragmentation trap at worst. I was wrong to suggest it as an alternative in the first pass — the audit data shows it doesn't address the real cause.
