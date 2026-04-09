# Data Entity Audit — 2026-04-09

> Auditoría exhaustiva de todas las estructuras de datos, entidades y alineación entre capas del proyecto.

## Estado general: 85/100

- 23 analytics computados, 18 mostrados en UI (78%)
- 5 analytics computados pero nunca renderizados
- 1 tipo de dato recopilado pero sin analizar (hypercharges)
- 1 bug de tipo corregido (opponents field structure)

---

## 1. Tablas de Base de Datos

| Tabla | Propósito | Rows actuales |
|-------|-----------|---------------|
| `profiles` | Cuentas, suscripción, trial, referrals | ~usuarios |
| `battles` | Batallas crudas de usuarios premium (retención completa) | ~miles |
| `sync_queue` | Cola de sincronización de battlelogs | variable |
| `meta_stats` | WR agregado por brawler/map/mode/date (PRO + community) | 881+ |
| `meta_matchups` | Matchup WR por brawler vs brawler/mode/date | 7779+ |
| `meta_trios` | Composiciones de tríos PRO por map/mode/date | 157+ |
| `meta_poll_cursors` | Deduplicación del cron de polling | ~100 |

### Campo `source` en meta tables

- `'global'` = datos de top 100 PRO players
- `'users'` = datos de la comunidad de usuarios
- **Hallazgo**: `source='users'` se escribe pero solo se lee en `/api/draft/data`, NO en `/api/meta/pro-analysis`

---

## 2. Datos computados pero NUNCA mostrados

| Dato | Tipo | Valor potencial | Prioridad |
|------|------|-----------------|-----------|
| `byMode` | `ModePerformance[]` | WR por modo de juego (Gem Grab, Heist, etc.) | Alta |
| `byMap` | `MapPerformance[]` | WR por mapa específico | Alta |
| `brawlerModeMatrix` | `BrawlerModeEntry[]` | Heatmap de brawler x modo | Media |
| `byBrawler` (top-level) | `BrawlerPerformance[]` | Tier list personal de brawlers | Alta |
| `my_brawler.hypercharges[]` | JSONB en battles | Impacto de hypercharges en WR | Media |

### Acciones recomendadas

1. **byMode + byMap**: Crear componentes `ModePerformanceChart` y `MapPerformanceChart` en el tab Performance o un nuevo tab
2. **brawlerModeMatrix**: Crear `BrawlerModeHeatmap` similar a `BrawlerMapHeatmap`
3. **byBrawler**: Crear tier list personal en Overview
4. **hypercharges**: Extender `computeGadgetImpact` para incluir hypercharges

---

## 3. Datos en DB no explotados

| Campo | Tabla | Estado | Potencial |
|-------|-------|--------|-----------|
| `opponents[].brawler.power` | battles | No usado | Medir si se gana más vs enemigos de bajo nivel |
| `teammates[].brawler.power` | battles | No usado | Explicar tilt por calidad de compañeros |
| `my_brawler.hypercharges[]` | battles | Recopilado, no analizado | Impacto en WR similar a gadgets/SP |
| `meta_matchups` source='users' | meta_matchups | Escrito, no leído en pro-analysis | Comparar meta comunidad vs PRO |

---

## 4. Alineación de entidades (DB -> Type -> API -> Component)

```
ALIGNED (18/23):
  overview, brawlerMapMatrix, matchups, trioSynergy, teammateSynergy,
  byHour, dailyTrend, brawlerMastery, tilt, sessions, clutch,
  opponentStrength, brawlerComfort, powerLevelImpact, sessionEfficiency,
  warmUp, carry, gadgetImpact, recovery, weeklyPattern, proAnalysis

HIDDEN (5/23 — computados pero sin UI):
  byMode, byMap, brawlerModeMatrix, byBrawler (top-level), hypercharges
```

---

## 5. Bug corregido en esta auditoría

**`/api/meta/pro-analysis` — opponents field**: 
- Antes: `opponents as Array<{ id: number }>` 
- Correcto: `opponents as Array<{ brawler: { id: number } }>`
- Impacto: matchupGaps siempre vacío para usuarios premium
- Commit: `13fb366`

---

## 6. Convenciones de naming

| Capa | Convención | Ejemplo |
|------|------------|---------|
| Database | snake_case | `brawler_id`, `battle_time`, `is_star_player` |
| TypeScript types | camelCase | `brawlerId`, `battleTime`, `isStarPlayer` |
| API responses | camelCase | `winRate`, `totalBattles`, `trend7d` |
| Component props | camelCase | `proAvgWR`, `proData`, `proMatchups` |

Consistente en todo el proyecto.

---

## 7. Estructura de datos JSONB en `battles`

```typescript
my_brawler: {
  id: number
  name: string
  power: number        // 1-11
  trophies: number
  gadgets: { id: number; name: string }[]
  starPowers: { id: number; name: string }[]
  hypercharges: { id: number; name: string }[]  // NUNCA ANALIZADO
}

teammates: Array<{
  tag: string
  name: string
  brawler: { id: number; name: string; power: number; trophies: number }
}>

opponents: Array<{
  tag: string
  name: string
  brawler: { id: number; name: string; power: number; trophies: number }
}>
```
