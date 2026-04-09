# Prompt para la próxima sesión

Copia y pega esto como primer mensaje:

---

## Contexto

Soy el desarrollador de BrawlVision (brawlvision.com), una plataforma de analítica avanzada de Brawl Stars. En la sesión anterior completamos:

### Hoy se hizo (2026-04-09, sesión 2):

#### Phase B Monetization — MERGEADA
- Rama `feat/phase-b-monetization` mergeada a main
- Conflicto resuelto en `analytics/page.tsx` (mobile dropdown tabs + premium celebration)
- Archivos verificados: detect-segment, ReferralToast, PersonalizedHook, FeatureShowcase, subscribe/page

#### Phase C Pro Meta Analytics — IMPLEMENTADA COMPLETA
**Plan 1 — Data Infrastructure (3 commits):**
- Migration 008: `meta_trios` table + index + RLS + `bulk_upsert_meta_trios` RPC
- `MetaAccumulators` interface: campo `trios` añadido
- Constantes PRO: `PRO_MIN_BATTLES_DISPLAY=20`, `PRO_TREND_DAYS_SHORT/MEDIUM/LONG` (7/14/30)
- Cron: extrae tríos de batallas (canonical sort), bulk upsert, eliminado cleanup de datos (retención infinita)

**Plan 2 — Pro Analysis API (2 commits):**
- `pro-analysis.ts`: tipos `ProAnalysisResponse` + 5 helpers puros (computeTrendDelta, computeGapVerdict, filterByMinBattles, canonicalizeTrioKey, computePickRate)
- `/api/meta/pro-analysis`: endpoint completo — Bayesian WR, trends 7d/30d, counters, gap analysis, premium gating server-side
- `brawler-names.ts`: resolver Brawlify con cache en memoria
- `useProAnalysis.ts`: hook con cache client-side por map+mode+window, abort-on-unmount

**Plan 3 — Meta PRO UI (7 commits):**
- 10 componentes nuevos: ProBadge, MapSelector, TopBrawlersGrid, TrendingSection, CounterQuickView, ProTrendChart (SVG), ProTrioGrid, GapAnalysisCards, MatchupGapTable, MetaProTab
- Meta PRO wired como 7th tab en analytics
- Traducciones `metaPro` (30 keys) en 13 locales (en/es/de/fr nativas, resto placeholder EN)
- Inline PRO badges en 5 tabs existentes (OverviewStats, BrawlerMapHeatmap, MatchupMatrix, TeamSynergyView, TrendsChart)

#### Bugfixes y mejoras visuales:
- `router.replace` en analytics movido a useEffect (React 18+ compliance)
- MapSelector: fix lectura `event.map`/`event.mode` de estructura anidada
- OverviewStats + TiltDetector: labels con Lilita_One arriba del dato (consistencia fuentes)
- Migration 008 ejecutada en Supabase producción
- Cron ejecutado: 100 players, 472 battles → 105 stats + 782 matchups + 157 trios

#### Datos actuales:
- `meta_stats`: 881+ rows
- `meta_matchups`: 7779+ rows
- `meta_trios`: 157 rows (primer batch)

### Lo que hay que hacer AHORA:

**Prioridad 1: Pendientes de Phase B (launch)**
1. Tomar screenshots reales del dashboard premium para `public/assets/premium-previews/`
2. Testing manual de los 6 estados de usuario (ver SQL scripts en el spec v3: `docs/superpowers/specs/2026-04-09-monetization-phase-b-v3-design.md`)

**Prioridad 2: Consistencia visual de fuentes**
El fix de Lilita_One se aplicó a OverviewStats y TiltDetector. Auditar y aplicar el mismo patrón a OTROS componentes que usen labels con fuente por defecto en vez de Lilita_One. El patrón correcto es:
```
<!-- ANTES (incorrecto): -->
<p class="font-['Lilita_One'] text-2xl">DATA</p>
<p class="text-[10px] uppercase font-bold text-slate-500 mt-1">LABEL</p>

<!-- DESPUÉS (correcto): -->
<p class="font-['Lilita_One'] text-[10px] uppercase tracking-wider text-slate-400 mb-1">LABEL</p>
<p class="font-['Lilita_One'] text-2xl">DATA</p>
```
Componentes candidatos a auditar: ClutchCard, WarmUpCard, CarryCard, SessionEfficiencyCard, RecoveryCard, OpponentStrengthCard, PowerLevelChart, GadgetImpactCard.

**Prioridad 3: Traducciones nativas**
Los 9 locales con placeholder (ar, it, ja, ko, pl, pt, ru, tr, zh) tienen el namespace `metaPro` en inglés. Necesitan traducción nativa.

**Prioridad 4: Inline badges — pasar datos PRO reales**
Los 5 componentes con inline ProBadge aceptan props opcionales (`proAvgWR`, `proData`, `proMatchups`, `proTrios`), pero analytics/page.tsx aún no les pasa datos. Hay que:
1. Hacer que analytics/page.tsx consuma `useProAnalysis` cuando el usuario está en tabs existentes
2. Pasar los datos PRO como props a cada componente

**Prioridad 5: Deploy y cron en producción**
- El cron de producción (Vercel Cron o pg_cron) ahora acumula tríos automáticamente
- Verificar que `CRON_SECRET` está configurado en Vercel env vars
- Verificar que la tabla `meta_trios` se llena en producción

### Archivos clave de referencia:
- **Spec Phase C**: `docs/superpowers/specs/2026-04-09-phase-c-pro-meta-analytics-design.md`
- **Spec Phase B v3**: `docs/superpowers/specs/2026-04-09-monetization-phase-b-v3-design.md`
- **Meta data reference**: `docs/17-meta-data-infrastructure.md`
- **Design system**: font Lilita_One, gold #FFC91B, sky #4EC0FA, dark #121A2F, clases brawl-card/brawl-row/brawl-button
- **AGENTS.md**: Leer `node_modules/next/dist/docs/` antes de escribir código Next.js

### Reglas:
- TDD siempre: tests primero, implementación después
- Calidad de producción: fetch .ok checks, no dead code, no hardcoded strings (i18n)
- 13 locales: ar, de, en, es, fr, it, ja, ko, pl, pt, ru, tr, zh
- Datos PRO: cocinar y agregar, nunca guardar battlelogs crudos. Retención infinita.
- Datos premium users: guardar todo, son suyos.
- Core vision: capturar TODOS los datos con valor, analítica exhaustiva, "de un vistazo" saber qué jugar
- Labels con Lilita_One arriba del dato, nunca fuente por defecto debajo

---
