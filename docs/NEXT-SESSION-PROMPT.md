# Prompt para la próxima sesión

Copia y pega esto como primer mensaje:

---

## Contexto

Soy el desarrollador de BrawlVision (brawlvision.com), una plataforma de analítica avanzada de Brawl Stars.

### Estado actual del proyecto (2026-04-14, tras Sprint F+):

**Producción estable** — 703 tests en 71 archivos, typecheck limpio, código auditado.

#### Funcionalidades implementadas:

**1. Analítica Premium (7 tabs):**
- Overview: stats, tier list personal (S/A/B/C/D), Play Now, tilt detector, clutch, warm-up
- Performance: rendimiento por modo, por mapa (cards visuales), heatmap brawler×mapa, hora del día, patrón semanal, power level, gadget impact, brawler comfort
- Matchups: matriz de enfrentamientos, fuerza de oponentes
- Team: sinergia de tríos (filtro por mapa, fondo de mapa), compañeros, carry
- Trends: tendencia WR + trofeos (líneas interactivas), maestría, eficiencia de sesión, recuperación
- Draft: simulador 1-2-2-1 con scoring meta
- **Meta PRO (NUEVO)**: top brawlers PRO, trending, counter-picks, trend chart 30d (SVG), tríos PRO, gap analysis (tu vs PRO), matchup gaps

**2. Inline PRO Badges:**
- OverviewStats: PRO avg WR
- BrawlerMapHeatmap: PRO WR por brawler/mapa
- MatchupMatrix: PRO matchup WR
- TeamSynergyView: PRO trio WR
- TrendsChart: PRO avg WR en header

**3. Monetización (Phase B):**
- Subscribe page con hooks personalizados por segmento de jugador
- Feature showcase en carrusel (5 screenshots reales)
- 3 tiers: monthly, quarterly, yearly (PayPal checkout)
- Trial automático: 3 días al registrarse
- Referrals: +3 días por referral (ambos), máximo 5, collision-safe
- Security: migration 007 protege campos trial/referral de modificación por API

**4. Infraestructura de datos PRO (Sprint F+ 2026-04-14):**
- Cron meta-poll cada 30 min desde VPS Oracle crontab → fetchea 11 country rankings (~2,100 pro players únicos), carga rotación live, procesa hasta 1,000 players por run
- **Algoritmo Sprint F**: sampler probabilístico `p = min(1, (minLive+1)/(current+1))` — sin target, sin floor, sin ratio. Atenúa maps oversampleados, garantiza rate=1 para el más escaso. Ver `docs/crons/README.md` sección Sprint F.
- Migration 017 corrigió bug de unidades (preload dividía `SUM(total)/6` → batallas reales, no brawler-rows)
- Pool separado del UI: `META_POLL_PRELOAD_DAYS = 28` (cron) vs `META_ROLLING_DAYS = 14` (UI)
- Hot retention: **90 días** en `meta_stats`. Migrations 018+019 introducen `meta_stats_archive` con agregación semanal y pg_cron lunes 04:00 UTC (pendiente backfill manual para activar). Ver `docs/crons/archive-runbook.md`.
- Tables: `meta_stats`, `meta_matchups`, `meta_trios`, `meta_poll_cursors`, `meta_stats_archive`, `cron_heartbeats`
- Defensive error-checks en TODAS las escrituras críticas de Supabase (cron sync + meta-poll) — Supabase JS no throws, `.error` debe destructurarse y lanzarse. Regla codebase-wide desde 2026-04-14. Ver `docs/crons/README.md` Issue 7.
- Bayesian WR en todas las tasas mostradas
- modeId 45 → brawlHockey (API devuelve "unknown")
- `DRAFT_MODES` = 9 modos 3v3: gemGrab, heist, bounty, brawlBall, hotZone, knockout, wipeout, brawlHockey, basketBrawl
- Filtro de mapas: isDraftMode + duración >= 12h (excluye Beach Ball sin trofeos)

**5. Calidad visual:**
- Lilita_One en ALL labels, posicionados ARRIBA del dato
- Header logo: w-[120px] md:w-[11%]
- MapSelector con cards visuales (imagen de mapa + overlay + icono de modo)
- 13 locales con traducciones nativas (en/es/de/fr/it/pt/ja/ko/zh/ar/ru/tr/pl)

**6. Auditoría de calidad (completada):**
- fetch .ok checks en todas las llamadas
- Sin hardcoded strings user-facing
- Console.log sanitizado (no PII en logs)
- Sin dead code ni imports no usados
- Documentado en docs/18-data-entity-audit.md

### Datos ocultos aún sin UI (oportunidades futuras):
- `brawlerModeMatrix`: heatmap brawler × modo (computed, sin componente)
- `hypercharges`: datos en DB, sin compute ni UI

### Archivos clave:
- `docs/18-data-entity-audit.md` — auditoría completa de entidades
- `docs/superpowers/specs/2026-04-09-phase-c-pro-meta-analytics-design.md` — spec Phase C
- `docs/17-meta-data-infrastructure.md` — referencia técnica del pipeline PRO
- `supabase/migrations/006_trial_referrals.sql` — sistema trial + referral
- `supabase/migrations/008_meta_trios.sql` — tabla de tríos PRO

### Reglas del proyecto:
- TDD siempre: tests primero, implementación después
- fetch .ok checks obligatorios
- i18n obligatorio (13 locales), no hardcoded strings
- font-['Lilita_One'] labels arriba del dato, tracking-wider, text-slate-400
- Datos PRO: cocinar y agregar, nunca raw battlelogs. Retención infinita.
- Datos premium: guardar todo, son del usuario
- MapSelector: isDraftMode + duración >= 12h + modeId 45 → brawlHockey
- Deduplicación PRO: cursor por player_tag en meta_poll_cursors

---
