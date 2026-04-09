# Prompt para la próxima sesión

Copia y pega esto como primer mensaje:

---

## Contexto

Soy el desarrollador de BrawlVision (brawlvision.com), una plataforma de analítica avanzada de Brawl Stars. En la sesión anterior completamos:

### Hoy se hizo (2026-04-09, sesión 2 — maratón):

#### Phase B Monetization — MERGEADA A MAIN
- Rama `feat/phase-b-monetization` mergeada con conflicto resuelto en `analytics/page.tsx`

#### Phase C Pro Meta Analytics — IMPLEMENTADA COMPLETA (3 planes, 20+ commits)

**Plan 1 — Data Infrastructure:**
- Migration 008: `meta_trios` table + index + RLS + `bulk_upsert_meta_trios` RPC (ejecutada en producción)
- `MetaAccumulators` con campo `trios`, constantes PRO (20/7/14/30)
- Cron: extrae tríos, bulk upsert, eliminado cleanup (retención infinita)
- `basketBrawl` añadido a DRAFT_MODES
- Hockey Brawl: `modeId: 45` mapeado de `"unknown"` a `"brawlHockey"` en MapSelector

**Plan 2 — Pro Analysis API:**
- `pro-analysis.ts`: tipos + 5 helpers puros con 22 tests TDD
- `/api/meta/pro-analysis`: endpoint completo con Bayesian WR, trends, counters, gap analysis
- `brawler-names.ts`: resolver Brawlify con cache
- `useProAnalysis.ts`: hook con cache client-side
- Bug fix: `opponents` field corregido de `{ id }` a `{ brawler: { id } }`

**Plan 3 — Meta PRO UI:**
- 10 componentes: ProBadge, MapSelector (visual con imágenes de mapa), TopBrawlersGrid, TrendingSection, CounterQuickView, ProTrendChart (SVG), ProTrioGrid, GapAnalysisCards, MatchupGapTable, MetaProTab
- MapSelector: filtro `isDraftMode() + duración >= 12h` (excluye Beach Ball sin trofeos)
- Meta PRO wired como 7th tab en analytics
- Inline PRO badges en 5 tabs existentes CON datos reales via `useProAnalysis`
- Traducciones `metaPro` (30 keys) nativas en 13 locales

**Datos ocultos surfaced (3 nuevos componentes):**
- `ModePerformanceChart`: WR por modo de juego con barras horizontales
- `MapPerformanceList`: WR por mapa con cartas visuales
- `BrawlerTierList`: tier list personal S/A/B/C/D con confianza

**Consistencia visual (font audit):**
- Lilita_One labels arriba del dato en: OverviewStats, TiltDetector, ClutchCard, WarmUpCard, CarryCard, RecoveryCard, GadgetImpactCard
- Header logo: `w-[120px] md:w-[11%]`

**Bugfixes:**
- `router.replace` movido a useEffect (React 18+)
- MapSelector: lectura `event.map`/`event.mode` de estructura anidada
- opponents field structure en pro-analysis

**Datos:**
- Cron ejecutado: 100 players, 472 battles → stats + matchups + 157 trios
- Migration 008 ejecutada en Supabase producción
- CRON_SECRET añadido a .env.local

**Documentación:**
- `docs/18-data-entity-audit.md`: auditoría completa de entidades
- `docs/NEXT-SESSION-PROMPT.md`: actualizado

### Lo que hay que hacer AHORA:

**Prioridad 1: Pendientes de Phase B (launch)**
1. Tomar screenshots reales del dashboard premium para `public/assets/premium-previews/`
2. Testing manual de los 6 estados de usuario (ver SQL scripts en el spec v3)

**Prioridad 2: Deploy y cron en producción**
- Verificar que `CRON_SECRET` está configurado en Vercel env vars
- Verificar cron schedule en Vercel (o pg_cron) incluye el nuevo código de tríos
- Push a producción y verificar Meta PRO tab funciona con datos reales

**Prioridad 3: Auditar más componentes para font consistency**
El patrón correcto es `font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1` para labels, ARRIBA del dato. Componentes candidatos: SessionEfficiencyCard (ya OK), BrawlerComfortList, TimeOfDayChart, MasteryChart (ya OK).

**Prioridad 4: Datos ocultos restantes**
Del audit (`docs/18-data-entity-audit.md`):
- `brawlerModeMatrix`: heatmap de brawler × modo (data computed, sin UI)
- `hypercharges`: data en DB pero sin compute ni UI

**Prioridad 5: Mejoras Meta PRO**
- Historical maps en MapSelector (premium): cargar mapas pasados de meta_stats
- Cuando no hay datos para un mapa: mostrar mensaje más informativo
- Wipeout5V5 cuando entre en rotación estándar

### Archivos clave de referencia:
- **Spec Phase C**: `docs/superpowers/specs/2026-04-09-phase-c-pro-meta-analytics-design.md`
- **Data audit**: `docs/18-data-entity-audit.md`
- **Meta data reference**: `docs/17-meta-data-infrastructure.md`
- **Design system**: font Lilita_One, gold #FFC91B, sky #4EC0FA, dark #121A2F
- **AGENTS.md**: Leer `node_modules/next/dist/docs/` antes de escribir código Next.js
- **API Hockey Brawl**: modeId 45, mode "unknown" → mapear a "brawlHockey"

### Reglas:
- TDD siempre: tests primero, implementación después
- Calidad de producción: fetch .ok checks, no dead code, no hardcoded strings (i18n)
- 13 locales: ar, de, en, es, fr, it, ja, ko, pl, pt, ru, tr, zh
- Datos PRO: cocinar y agregar, nunca guardar battlelogs crudos. Retención infinita.
- Datos premium users: guardar todo, son suyos.
- Core vision: capturar TODOS los datos con valor, analítica exhaustiva, "de un vistazo" saber qué jugar
- Labels con Lilita_One arriba del dato, nunca fuente por defecto debajo
- MapSelector: filtro isDraftMode + duración >= 12h + modeId 45 → brawlHockey
- Deduplicación PRO: cursor por player_tag en meta_poll_cursors

---
