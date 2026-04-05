# 14. Referencia Oficial API Brawl Stars

Documentación extraída directamente de https://developer.brawlstars.com/#/documentation  
Sesión verificada: Alvaro Gonzalez — April 5, 2026.

---

## 🔗 Base URL y Autenticación

```
Base URL: https://api.brawlstars.com/v1
Auth:     Authorization: Bearer {API_KEY}
Format:   application/json
```

---

## 🚨 ERROR CRÍTICO EN DOCUMENTACIÓN ANTERIOR

**El campo `3v3Victories` NO existe.**  
El nombre real en la API es **`3vs3Victories`** (con "vs", no solo "v").

```typescript
// ❌ INCORRECTO (como lo habíamos documentado):
player['3v3Victories']

// ✅ CORRECTO (nombre real en la API):
player['3vs3Victories']
```

Esto afecta al algoritmo de valoración, los TypeScript types y los tests.

---

## 📋 Endpoints Disponibles

### 1. players — Access player specific information

#### `GET /players/{playerTag}`
Descripción: Get information about a single player by player tag.

**Path Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| playerTag | string | ✅ | Tag of the player (include `#`) |

**Response 200 — Player:**
```typescript
interface Player {
  tag: string
  name: string
  nameColor: string
  trophies: number
  highestTrophies: number
  expLevel: number
  expPoints: number
  totalPrestigeLevel: number
  soloVictories: number
  duoVictories: number
  '3vs3Victories': number          // ⚠️ "vs" no "v"
  bestRoboRumbleTime: number
  bestTimeAsBigBrawler: number
  isQualifiedFromChampionshipChallenge: boolean
  icon: PlayerIcon                  // { id: number }
  club: PlayerClub                  // { tag: string, name: string }
  brawlers: BrawlerStat[]
}
```

**BrawlerStat** (por jugador — SIN rareza):
```typescript
interface BrawlerStat {
  id: number                        // Usado para cruzar con /brawlers y obtener rareza
  name: JsonLocalizedName           // { value: string } localizado
  power: number                     // Nivel de poder: 1–11
  rank: number                      // Rango actual de trofeos
  trophies: number
  highestTrophies: number
  prestigeLevel: number
  currentWinStreak: number
  maxWinStreak: number
  starPowers: StarPower[]           // Array de star powers desbloqueados
  gadgets: Accessory[]              // Array de gadgets desbloqueados
  hyperCharges: HyperCharge[]       // Array de hypercharges
  gears: GearStat[]                 // Array de gears
  buffies: BrawlerBuffies           // Objeto interno de stats extra
  skin: Skin                        // Skin equipada actualmente
}
```

---

#### `GET /players/{playerTag}/battlelog`
Descripción: Get log of recent battles for a player.

**Path Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| playerTag | string | ✅ | Tag of the player |

**Nota BrawlValue**: No usamos este endpoint en el MVP. Potencial uso futuro para mostrar modos de juego favoritos.

---

### 2. clubs — Access club specific information

#### `GET /clubs/{clubTag}`
Descripción: Get club information.

**Nota BrawlValue**: No usamos este endpoint en el MVP.

---

#### `GET /clubs/{clubTag}/members`
Descripción: List club members.

**Nota BrawlValue**: No usamos este endpoint en el MVP.

---

### 3. rankings — Access global and local rankings

#### `GET /rankings/{countryCode}/players`
Descripción: Get player rankings for a country or global rankings.

**Path Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| countryCode | string | ✅ | ISO country code o `global` |

**Nota BrawlValue**: Útil en v1.1 para leaderboard global.

---

#### `GET /rankings/{countryCode}/clubs`
Descripción: Get club rankings for a country or global rankings.

---

#### `GET /rankings/{countryCode}/brawlers/{brawlerId}`
Descripción: Get brawler rankings for a country or global rankings.

---

### 4. brawlers — Access general brawler information ⭐ CRÍTICO

#### `GET /brawlers`
Descripción: Get list of available brawlers.

**⚠️ IMPORTANTÍSIMO para BrawlValue**: Este endpoint devuelve la **rareza (rarity)** de cada brawler, que NO está disponible en `/players/{playerTag}`.

**Response 200:**
```typescript
interface BrawlersResponse {
  items: Brawler[]
  paging: {
    cursors: {
      before: string
      after: string
    }
  }
}

interface Brawler {
  id: number                        // ID único del brawler
  name: string                      // Nombre en inglés
  rarity: BrawlerRarity             // ⭐ AQUÍ ESTÁ LA RAREZA
  starPowers: StarPower[]
  gadgets: Gadget[]
  description: string
}

type BrawlerRarity = {
  id: number
  name: 'Trophy Road'               // Rara
       | 'Rare'                     // Superrara  
       | 'Super Rare'               // Épica
       | 'Epic'                     // Mítica
       | 'Mythic'                   // Legendaria
       | 'Legendary'
       | 'Chromatic'
  color: string                     // Hex color
}
```

---

#### `GET /brawlers/{brawlerId}`
Descripción: Get information about a specific brawler by ID.

---

### 5. events

(Expandir manualmente en portal para ver endpoints — no relevante para BrawlValue MVP)

---

## 🗂️ Modelos Compartidos (Error Responses)

Todos los errores usan el mismo modelo `ClientError`:

```typescript
interface ClientError {
  reason: string        // Código de razón (ej: "accessDenied", "notFound")
  message: string       // Mensaje legible
  type: string          // Tipo de error
  detail: object        // Detalles adicionales (estructura variable)
}
```

**Códigos HTTP:**
| Código | Significado | Causa BrawlValue |
|--------|-------------|-----------------|
| 200 | OK | Éxito |
| 400 | Bad Request | Player tag mal formateado |
| 403 | Access Denied | API Key inválida O IP no whitelisted |
| 404 | Not Found | Player tag no existe |
| 429 | Too Many Requests | Rate limit superado |
| 500 | Internal Server Error | Error de Supercell |
| 503 | Service Unavailable | Mantenimiento de Supercell |

**⚠️ El 403 puede ser IP no whitelisted** (no solo API Key inválida). Esto es diferente a lo que documentamos antes (solo teníamos 401).

---

## 🎯 Estrategia de Rareza para BrawlValue

### El Problema
`GET /players/{playerTag}` devuelve los brawlers del jugador con su `id` y stats, **pero NO devuelve la rareza**.

### La Solución (2 opciones)

#### Opción A: Mapa Estático (Recomendado para MVP)
- Llamar `GET /brawlers` UNA vez al iniciar la app (o en build time)
- Cachear el resultado en Redis con TTL de 24h
- Usar el mapa `{brawlerId → rarity}` para cruzar con los brawlers del jugador

```typescript
// Ejemplo de mapa cacheado
const RARITY_MAP: Record<number, string> = {
  16000000: 'Trophy Road',   // Shelly
  16000001: 'Rare',          // Nita
  16000002: 'Rare',          // Colt
  16000003: 'Rare',          // Bull
  // ... todos los brawlers
  16000058: 'Legendary',     // Spike
  16000059: 'Legendary',     // Crow
  // ...
}
```

#### Opción B: Fetch Dinámico
- Llamar `GET /brawlers` en cada request de `/api/calculate`
- TanStack Query cacha el resultado (rara vez cambia)
- Más actualizado pero más llamadas a la API

**Recomendación**: Opción A para MVP. Solo actualizamos el mapa cuando Supercell lanza brawlers nuevos.

---

## 🔄 Flujo Completo de Cálculo con API Real

```
POST /api/calculate { playerTag: "#2P0Q8C2C0" }
  │
  ├─ 1. Validar regex: /^#[0-9A-Z]{3,20}$/i
  │
  ├─ 2. Rate limit check (Upstash): 5 req/min/IP
  │     └─ Si excede: return 429
  │
  ├─ 3. Cache check (Redis): key = `brawlvalue:player:{tag}`
  │     └─ Si hit: return cached + { cached: true }
  │
  ├─ 4. GET https://api.brawlstars.com/v1/players/{playerTag}
  │     └─ Headers: Authorization: Bearer {BRAWLSTARS_API_KEY}
  │     ├─ 403: return 403 { error: "API key issue or IP not whitelisted" }
  │     ├─ 404: return 404 { error: "Player not found" }
  │     ├─ 429: exponential backoff, retry x2, then return 429
  │     └─ 200: playerData
  │
  ├─ 5. Obtener rareza: Usar RARITY_MAP (estático) o cache de /brawlers
  │
  ├─ 6. calculateValue(playerData, rarityMap) → { totalValue, breakdown }
  │
  ├─ 7. Store in Redis: TTL = 3600s (1 hora)
  │
  └─ 8. return 200 {
         playerTag,
         playerName: playerData.name,
         totalValue,
         breakdown,
         timestamp: new Date(),
         cached: false
       }
```

---

## 📐 TypeScript Types Corregidos

```typescript
// lib/types.ts - VERSIÓN OFICIAL CORREGIDA

export interface SuprecellPlayer {
  tag: string
  name: string
  nameColor: string
  trophies: number
  highestTrophies: number
  expLevel: number
  expPoints: number
  totalPrestigeLevel: number
  soloVictories: number
  duoVictories: number
  '3vs3Victories': number           // ⚠️ CAMPO CORRECTO
  bestRoboRumbleTime: number
  bestTimeAsBigBrawler: number
  isQualifiedFromChampionshipChallenge: boolean
  nameColor: string
  icon: { id: number }
  club: { tag: string; name: string } | Record<string, never>  // Puede estar vacío
  brawlers: SuprecellBrawlerStat[]
}

export interface SuprecellBrawlerStat {
  id: number
  name: { value: string }          // JsonLocalizedName
  power: number
  rank: number
  trophies: number
  highestTrophies: number
  prestigeLevel: number
  currentWinStreak: number
  maxWinStreak: number
  starPowers: Array<{ id: number; name: string }>
  gadgets: Array<{ id: number; name: string }>
  hyperCharges: Array<{ id: number; name: string }>
  gears: Array<{ id: number; name: string; level: number }>
}

export interface SuprecellBrawler {
  id: number
  name: string
  rarity: {
    id: number
    name: BrawlerRarityName
    color: string
  }
  starPowers: Array<{ id: number; name: string }>
  gadgets: Array<{ id: number; name: string }>
  description: string
}

export type BrawlerRarityName =
  | 'Trophy Road'
  | 'Rare'
  | 'Super Rare'
  | 'Epic'
  | 'Mythic'
  | 'Legendary'
  | 'Chromatic'

export interface ClientError {
  reason: string
  message: string
  type: string
  detail: Record<string, unknown>
}
```

---

## 💡 Rareza → Coeficiente de Valoración

```typescript
// lib/constants.ts
export const RARITY_VALUE: Record<BrawlerRarityName, number> = {
  'Trophy Road': 0.5,   // Brawlers iniciales/gratuitos
  'Rare': 1,
  'Super Rare': 2,
  'Epic': 5,
  'Mythic': 10,
  'Legendary': 20,
  'Chromatic': 15,      // Entre Mítico y Legendario
}
```

**Nota**: `Chromatic` es una rareza que no teníamos en el documento original. Son brawlers de Brawl Pass que rotan entre rarezas. Les asignamos 15 (entre Mítico y Legendario).

---

## 🔧 Headers de Request

```typescript
const headers = {
  'Authorization': `Bearer ${process.env.BRAWLSTARS_API_KEY}`,
  'Accept': 'application/json',
}
```

---

## ⚠️ Limitaciones Confirmadas

1. **Rate Limiting**: "Amount of requests above threshold defined for API token" — límite exacto no publicado. Supercell lo gestiona por token.
2. **IP Whitelist**: La API key solo funciona desde IPs whitelisted en developer.brawlstars.com. El error es 403 (no 401).
3. **Sin rareza en `/players`**: La rareza solo está en `GET /brawlers`. Necesita cruce por `id`.
4. **503 Maintenance**: Supercell hace mantenimientos — necesitamos fallback graceful.

---

## 📚 Portal Oficial

- **Developer Portal**: https://developer.brawlstars.com/
- **Documentación**: https://developer.brawlstars.com/#/documentation
- **Términos**: http://supercell.com/en/terms-of-service/
- **Fan Content Policy**: https://supercell.com/en/fan-content-policy/
