# Prompt para la próxima sesión

Copia y pega esto como primer mensaje:

---

## Contexto

Soy el desarrollador de BrawlVision (brawlvision.com), una plataforma de analítica avanzada de Brawl Stars. En la sesión anterior completamos:

### Hoy se hizo (2026-04-09):
- **Rebrand**: Nuevo logo (BRAWL rojo + VISION blanco + Tara) aplicado en header, sidebar, landing, favicon, OG image
- **Phase B Monetization**: Rama `feat/phase-b-monetization` con subscribe page, referrals, trial, security (pendiente de merge a main — ver pasos de lanzamiento en `docs/superpowers/plans/2026-04-09-monetization-phase-b-v3.md`)
- **Tríos de equipo**: Nuevo `computeTrioSynergy` con filtro por mapa, fondo de mapa en cards, integrado en PlayNowDashboard
- **UI mobile**: Tabs dropdown en analytics, scroll lock sidebar, z-index fixes, hamburguesa blanca
- **Auditoría de calidad**: 259 tests pasando, fetch .ok checks, dead code eliminado, 5 tests nuevos para trioSynergy
- **Documentación**: `docs/17-meta-data-infrastructure.md` (referencia técnica del pipeline de datos PRO)
- **Phase C diseñada**: Spec + 3 planes de implementación listos

### Lo que hay que hacer AHORA:

**Prioridad 1: Mergear Phase B**
La rama `feat/phase-b-monetization` tiene la subscribe page, referrals y trial. Antes de mergear:
1. Resolver conflictos de merge con main (trioSynergy reemplazó brawlerSynergy después de crear la rama)
2. Verificar que `detect-segment.ts`, `ReferralToast.tsx`, `PersonalizedHook.tsx`, `FeatureShowcase.tsx`, `subscribe/page.tsx` existen en la rama
3. Tomar screenshots reales del dashboard premium para `public/assets/premium-previews/`
4. Ejecutar migration 007 (protect_trial_fields) en Supabase producción
5. Testing manual de los 6 estados de usuario (ver SQL scripts en el spec v3)

**Prioridad 2: Implementar Phase C — Pro Meta Analytics**
Spec: `docs/superpowers/specs/2026-04-09-phase-c-pro-meta-analytics-design.md`

Ejecutar en orden:
1. `docs/superpowers/plans/2026-04-09-phase-c-plan-1-data-infrastructure.md` (5 tasks: meta_trios table, cron trio accumulation, eliminar data cleanup, constantes)
2. `docs/superpowers/plans/2026-04-09-phase-c-plan-2-pro-analysis-api.md` (5 tasks: endpoint /api/meta/pro-analysis, tipos, trend calculation, gap analysis, useProAnalysis hook)
3. `docs/superpowers/plans/2026-04-09-phase-c-plan-3-meta-pro-ui.md` (12 tasks: 9 componentes, Meta PRO tab, inline badges en 5 tabs, traducciones)

Usar `superpowers:subagent-driven-development` para cada plan.

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

---
