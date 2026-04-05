# 5. Algoritmo de Valoración — Motor Vectorial v2 (Abril 2026)

**Revisión post-auditoría**: Algoritmo completamente reescrito. Ver `docs/15-auditoria-tecnica-legal-algoritmica.md` para justificación.

## Cambios Críticos vs Versión Original

| Aspecto | v1 (Obsoleta) | v2 (Actual) |
|---------|---------------|-------------|
| Unidad de salida | USD ($) | **Gemas Equivalentes Estimadas** |
| expLevel | Usado (× 0.5) | **ELIMINADO** (deprecado en juego) |
| Hypercharges | No existía | **Incluido** (datos API + heurística) |
| Buffies | No existía | **Incluido** (heurística probabilística) |
| Prestigio | No existía | **Incluido** (V_elite, multiplicador exponencial) |
| Rarezas | 5 categorías | **7 categorías** (+ Ultra Legendary) |
| Nivel de Fuerza | No ponderado | **Multiplicador exponencial** (niveles 10-11) |

---

## Ubicación en el Código

**Ruta**: `src/lib/calculate.ts`
**API Route**: `POST /api/calculate` → `src/app/api/calculate/route.ts`

---

## Arquitectura del Motor: 4 Vectores

```
S_total = V_base + V_assets + V_enhance + V_elite

Gemas Equivalentes = S_total / δ
```

Donde `δ = 50` (tasa de conversión puntos → gemas).

---

## Vector 1: Base de Progreso (V_base)

Recompensa constancia y tiempo invertido en la cuenta.

```
V_base = (T_total × 0.02) + (W_3vs3 × 0.08)
```

| Variable | Campo API | Descripción |
|----------|-----------|-------------|
| `T_total` | `trophies` | Trofeos totales actuales |
| `W_3vs3` | `3vs3Victories` | Victorias en modos 3v3 |

**Nota**: `soloVictories` y `duoVictories` NO se incluyen. Las victorias 3vs3 son el indicador de destreza competitiva real.

### Ejemplo

```
Jugador con 35,000 trofeos y 8,500 victorias 3vs3:
V_base = (35000 × 0.02) + (8500 × 0.08)
V_base = 700 + 680 = 1,380 puntos
```

---

## Vector 2: Inventario de Activos (V_assets)

Itera sobre cada brawler desbloqueado. Valor = Rareza Base × Multiplicador de Nivel de Fuerza.

```
V_assets = Σ (R_bi × L_mi)   para cada brawler i
```

### Tabla de Rareza Base (R_b)

| Rareza API | Nombre en Juego | R_b (puntos) |
|------------|----------------|-------------|
| `Trophy Road` | Especial / Iniciador | 100 |
| `Rare` | Raro | 100 |
| `Super Rare` | Superraro | 100 |
| `Epic` | Epico | 300 |
| `Mythic` | Mitico | 750 |
| `Legendary` | Legendario | 1,500 |
| `Chromatic` | Cromatico (Brawl Pass) | 750 |
| `Ultra Legendary` | Ultra Legendario (ej. Sirius) | 2,500 |

**Fuente de rarezas**: `GET /brawlers` → campo `rarity.name`. Cachear en Redis (TTL 24h). Cruzar con brawlers del jugador por `id`.

### Multiplicador de Nivel de Fuerza (L_m)

El coste de recursos escala exponencialmente a partir del nivel 9.

| Power Level | L_m | Justificación |
|-------------|-----|--------------|
| 1 | 1.0 | Base |
| 2 | 1.1 | |
| 3 | 1.2 | |
| 4 | 1.3 | |
| 5 | 1.4 | |
| 6 | 1.5 | |
| 7 | 1.7 | |
| 8 | 2.0 | |
| 9 | 2.5 | Desbloquea Star Powers |
| 10 | 3.5 | Desbloquea Gadgets avanzados |
| 11 | 4.5 | Máximo — desbloquea Hypercharges |

### Ejemplo

```
Brawler Legendario (Pierce), Nivel 11:
Valor = 1500 × 4.5 = 6,750 puntos

Brawler Trophy Road (Shelly), Nivel 9:
Valor = 100 × 2.5 = 250 puntos
```

---

## Vector 3: Mejoras Modernas / Economía End-Game (V_enhance)

Evalúa la densidad económica de mejoras por brawler. Usa datos explícitos cuando existen en la API y heurísticas cuando no.

```
V_enhance = Σ (C_gadget_i + C_star_i + H_est_i + B_est_i)   para cada brawler i
```

### Componentes por Brawler

| Componente | Fuente | Cálculo | Puntos |
|-----------|--------|---------|--------|
| **Gadgets** (`C_gadget`) | API: `gadgets.length` | Exacto: 0, 1 o 2 | × 200 pts |
| **Star Powers** (`C_star`) | API: `starPowers.length` | Exacto: 0, 1 o 2 | × 400 pts |
| **Hypercharge** (`H_est`) | API: `hyperCharges.length` (si disponible) | Exacto si hay datos | × 1,200 pts |
| **Hypercharge** (heurística) | `power == 11 && highestTrophies > 750` | Probabilístico (65%) | × 780 pts (1200 × 0.65) |
| **Buffies** (`B_est`) | API: `buffies` (si disponible) | Exacto si hay datos | × 2,000 pts por Buffie |
| **Buffies** (heurística) | `power == 11 && trophies_cuenta > 30000` | Inferencia base | × 2,000 pts (1 Buffie asumido) |

### Lógica de Decisión para Hypercharges

```typescript
function calcHyperchargeValue(brawler: BrawlerStat, accountTrophies: number): number {
  // Si la API reporta hyperCharges explícitamente
  if (brawler.hyperCharges && brawler.hyperCharges.length > 0) {
    return brawler.hyperCharges.length * 1200
  }
  // Heurística: power 11 + alto rango → probabilidad 65%
  if (brawler.power === 11 && brawler.highestTrophies > 750) {
    return Math.round(1200 * 0.65) // 780 puntos
  }
  return 0
}
```

### Lógica de Decisión para Buffies

```typescript
function calcBuffiesValue(brawler: BrawlerStat, accountTrophies: number): number {
  // Si la API reporta buffies explícitamente
  if (brawler.buffies && typeof brawler.buffies === 'object') {
    // Contar buffies desbloqueados (Gadget Buffie, Star Buffie, Hyper Buffie)
    let count = 0
    // Lógica dependiente de la estructura exacta del campo
    return count * 2000
  }
  // Heurística: power 11 + cuenta veterana → inferir al menos 1 Buffie
  if (brawler.power === 11 && accountTrophies > 30000) {
    return 2000 // 1 Buffie base asumido
  }
  return 0
}
```

**Importante**: Las heurísticas se activan SOLO cuando la API no proporciona datos explícitos. Cuando Supercell exponga los campos completos, las heurísticas se desactivan automáticamente.

---

## Vector 4: Habilidad Elite y Prestigio (V_elite)

Reemplaza al obsoleto `expLevel`. Recompensa el dominio competitivo evaluando el sistema de Prestigio de Brawlers (Temporadas 48-49, 2026).

```
V_elite = Σ RecompensaPrestigio(T_high_i)   para cada brawler i
```

### Tabla de Prestigio

| Nivel | Umbral de highestTrophies | Puntos | Significado |
|-------|--------------------------|--------|-------------|
| Sin Prestigio | < 1,000 | 0 | Normal |
| **Prestigio 1** | 1,000 – 1,999 | 10,000 | Título dorado, protección de trofeos |
| **Prestigio 2** | 2,000 – 2,999 | 25,000 | Iconos neón, matchmaking real (sin bots) |
| **Prestigio 3** | ≥ 3,000 | 75,000 | Títulos neón, equivalente al antiguo Rango 35 |

### Fuente de Datos

```typescript
function calcPrestigeValue(brawler: BrawlerStat): number {
  // Campo directo si está disponible
  if (brawler.prestigeLevel !== undefined && brawler.prestigeLevel > 0) {
    const PRESTIGE_VALUES = [0, 10000, 25000, 75000]
    return PRESTIGE_VALUES[Math.min(brawler.prestigeLevel, 3)]
  }
  // Extrapolación desde highestTrophies
  const t = brawler.highestTrophies
  if (t >= 3000) return 75000
  if (t >= 2000) return 25000
  if (t >= 1000) return 10000
  return 0
}
```

**Nota**: `totalPrestigeLevel` (campo del jugador, no del brawler) es la suma de todos los niveles de prestigio. Útil para la UI pero no para el cálculo per-brawler.

---

## Ensamblaje Final

```typescript
interface GemScore {
  totalScore: number           // S_total (puntos raw)
  gemEquivalent: number        // S_total / δ
  breakdown: {
    base: { trophies: number; victories3vs3: number; value: number }
    assets: { brawlerCount: number; value: number }
    enhance: { gadgets: number; starPowers: number; hypercharges: number; buffies: number; value: number }
    elite: { prestige1: number; prestige2: number; prestige3: number; value: number }
  }
}

const GEM_CONVERSION_DIVISOR = 50 // δ

function calculateGemScore(playerData: PlayerData, rarityMap: RarityMap): GemScore {
  const vBase = calcBaseVector(playerData)
  const vAssets = calcAssetsVector(playerData.brawlers, rarityMap)
  const vEnhance = calcEnhanceVector(playerData.brawlers, playerData.trophies)
  const vElite = calcEliteVector(playerData.brawlers)

  const totalScore = vBase.value + vAssets.value + vEnhance.value + vElite.value
  const gemEquivalent = Math.round(totalScore / GEM_CONVERSION_DIVISOR)

  return {
    totalScore,
    gemEquivalent,
    breakdown: {
      base: vBase,
      assets: vAssets,
      enhance: vEnhance,
      elite: vElite,
    }
  }
}
```

### Invariante Obligatoria (Enforced by Tests)

```
breakdown.base.value + breakdown.assets.value + breakdown.enhance.value + breakdown.elite.value === totalScore
```

---

## Ejemplo Completo

**Jugador**: 35,000 trofeos, 8,500 victorias 3vs3, 60 brawlers (mezcla de rarezas), 5 en Prestigio 1, 2 en Prestigio 2.

```
V_base  = (35000 × 0.02) + (8500 × 0.08) = 700 + 680 = 1,380

V_assets = Σ rareza × nivel
         ≈ 20 × (100×2.5) + 15 × (300×3.5) + 10 × (750×4.5) + 5 × (1500×4.5) + ...
         ≈ 5000 + 15750 + 33750 + 33750 + ... ≈ ~95,000

V_enhance = gadgets (avg 1.5 × 200 × 60) + stars (avg 1 × 400 × 40) + HCs (~15 × 780) + buffies (~5 × 2000)
          ≈ 18000 + 16000 + 11700 + 10000 = ~55,700

V_elite = (5 × 10000) + (2 × 25000) = 50000 + 50000 = 100,000

S_total = 1380 + 95000 + 55700 + 100000 = 252,080

Gemas Equivalentes = 252080 / 50 = 5,042 Gemas
```

**Resultado mostrado**: "Tu cuenta tiene un poder equivalente a **5,042 Gemas**"

Para cuentas top (70k+ trofeos, muchos Prestigio 3): resultado en rango 50,000 – 150,000 Gemas, psicológicamente satisfactorio y viral.

---

## Consideraciones Técnicas

### Rate Limiting
- **Backend**: 5 req/minuto por IP (Upstash, sliding window)
- **Respuesta 429**: "Demasiadas peticiones, intenta en 60 segundos"

### Caching
- **Redis TTL**: 5 minutos (alineado con caché interna Supercell de ~3 min)
- **TanStack Query staleTime**: 3 minutos
- **Rarity map**: Redis TTL 24 horas (raramente cambia)

### Validación de API Key
- **Ubicación**: Variable de entorno `BRAWLSTARS_API_KEY`
- **Nunca exponerla**: Solo servidor
- **Error 403**: API key inválida O IP no whitelisted (NO es 401)
- **Error 503**: Mantenimiento de Supercell — fallback a caché

### Validación del Player Tag
- **Client-side**: `^#[0-9A-Z]{3,20}$/i` (UX)
- **Server-side**: Misma regex + sanitización (seguridad)
- **Validación definitiva**: Respuesta de la API (404 = no existe)

---

## API Response Contract (Actualizado)

### Request
```json
POST /api/calculate
{ "playerTag": "#2P0Q8C2C0" }
```

### Response 200
```json
{
  "playerTag": "#2P0Q8C2C0",
  "playerName": "NombreDelJugador",
  "gemEquivalent": 5042,
  "totalScore": 252080,
  "breakdown": {
    "base": {
      "trophies": 35000,
      "victories3vs3": 8500,
      "value": 1380
    },
    "assets": {
      "brawlerCount": 60,
      "value": 95000
    },
    "enhance": {
      "gadgets": 90,
      "starPowers": 40,
      "hypercharges": 15,
      "buffies": 5,
      "value": 55700
    },
    "elite": {
      "prestige1": 5,
      "prestige2": 2,
      "prestige3": 0,
      "value": 100000
    }
  },
  "timestamp": "2026-04-05T14:30:00Z",
  "cached": false
}
```

### Errores
| Código | Causa |
|--------|-------|
| 400 | Player tag mal formateado |
| 403 | API Key inválida o IP no whitelisted |
| 404 | Jugador no existe |
| 429 | Rate limit excedido |
| 500 | Error interno |
| 503 | Mantenimiento Supercell |

---

## Ajustes Futuros

Los coeficientes y constantes (`δ`, `R_b`, `L_m`, puntos por mejora, umbrales de heurística) son configurables:

- Se pueden ajustar tras analizar distribuciones reales de cuentas
- A/B testing del divisor `δ` para que los números resultantes "se sientan bien"
- Cuando Supercell exponga Buffies en la API → desactivar heurísticas, usar datos reales
- Nuevos brawlers/rarezas → actualizar rarity map (Redis) sin cambiar código
