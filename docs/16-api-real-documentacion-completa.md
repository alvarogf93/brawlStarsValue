# 16. Documentación Real de la API de Brawl Stars (Verificada Abril 2026)

Documentación generada a partir de **llamadas reales** a la API oficial.  
Cuenta de prueba: `#YJU282PV` (LA | Xaxo) — 96,653 trofeos, 101 brawlers.

---

## Base URL y Autenticación

```
Base URL:  https://api.brawlstars.com/v1
Auth:      Authorization: Bearer {API_KEY}
Format:    application/json
```

IP de la key actual: `79.117.119.253` (desarrollo local).

---

## HALLAZGOS CRÍTICOS vs Documentación Anterior

| Hallazgo | Impacto |
|----------|---------|
| **`GET /brawlers` NO devuelve `rarity`** | Nuestra estrategia de obtener rareza vía API es IMPOSIBLE. Necesitamos mapa estático hardcodeado. |
| **`buffies` SÍ existe en `/players`** | `{ gadget: bool, starPower: bool, hyperCharge: bool }` — NO necesitamos heurística, hay datos reales. |
| **`hyperCharges` SÍ viene completo en `/players`** | Array de hypercharges desbloqueados — tampoco necesitamos heurística. |
| **`gears` tiene tipos únicos por brawler** | 15 tipos de gears distintos (no solo los 5 genéricos que asumíamos). |
| **`skin` viene en cada brawler** | `{ id, name }` — potencial para visualización. |
| **`brawler.name` es string, NO objeto** | En `/players`: `"name": "SHELLY"` (string). En doc 14 pusimos `{ value: string }` — **INCORRECTO**. |

---

## Servicio 1: Players

### `GET /players/{playerTag}`

**URL**: `https://api.brawlstars.com/v1/players/%23YJU282PV`  
**Nota**: El `#` debe ser URL-encoded como `%23`.

#### Response DTO: `PlayerResponse`

```typescript
interface PlayerResponse {
  tag: string                          // "#YJU282PV"
  name: string                         // "LA | Xaxo 🇪🇸" (con emojis/unicode)
  nameColor: string                    // "0xffff8afb" (hex con alpha)
  icon: { id: number }                 // { id: 28000318 }
  trophies: number                     // 96653
  highestTrophies: number              // 96653
  totalPrestigeLevel: number           // 68 (suma de todos los brawlers)
  expLevel: number                     // 341 (DEPRECADO — no usar en algoritmo)
  expPoints: number                    // 593023
  isQualifiedFromChampionshipChallenge: boolean  // false
  '3vs3Victories': number              // 36962 — ⚠️ "vs" no "v"
  soloVictories: number                // 809
  duoVictories: number                 // 1159
  bestRoboRumbleTime: number           // 7
  bestTimeAsBigBrawler: number         // 0
  club: PlayerClub                     // { tag, name } o {} si sin club
  brawlers: PlayerBrawler[]            // Array de 101 brawlers
}

interface PlayerClub {
  tag: string                          // "#JG9Y2RJ0"
  name: string                         // "𝐓𝖾αꭑ420" (unicode estilizado)
}
```

#### DTO anidado: `PlayerBrawler`

**Ejemplo real** (Shelly del jugador):

```json
{
  "id": 16000000,
  "name": "SHELLY",
  "power": 11,
  "rank": 4,
  "trophies": 846,
  "highestTrophies": 854,
  "prestigeLevel": 0,
  "currentWinStreak": 0,
  "maxWinStreak": 4,
  "skin": { "id": 29000844, "name": "SQUAD BUSTER\nSHELLY" },
  "gadgets": [
    { "id": 23000255, "name": "FAST FORWARD" },
    { "id": 23000288, "name": "CLAY PIGEONS" }
  ],
  "gears": [
    { "id": 62000002, "name": "DAMAGE", "level": 3 },
    { "id": 62000000, "name": "SPEED", "level": 3 },
    { "id": 62000017, "name": "GADGET COOLDOWN", "level": 3 },
    { "id": 62000004, "name": "SHIELD", "level": 3 }
  ],
  "starPowers": [
    { "id": 23000076, "name": "SHELL SHOCK" },
    { "id": 23000135, "name": "BAND-AID" }
  ],
  "hyperCharges": [
    { "id": 23000613, "name": "DOUBLE BARREL" }
  ],
  "buffies": {
    "gadget": true,
    "starPower": true,
    "hyperCharge": true
  }
}
```

```typescript
interface PlayerBrawler {
  id: number                           // 16000000
  name: string                         // "SHELLY" — ⚠️ ES STRING, no objeto
  power: number                        // 1-11
  rank: number                         // Rango visual (1-35+)
  trophies: number                     // Trofeos actuales del brawler
  highestTrophies: number              // Record histórico
  prestigeLevel: number                // 0, 1, 2 o 3
  currentWinStreak: number             // Racha actual
  maxWinStreak: number                 // Record de racha
  skin: BrawlerSkin                    // Skin equipada
  gadgets: Accessory[]                 // 0-2 gadgets desbloqueados
  starPowers: Accessory[]              // 0-2 star powers desbloqueadas
  hyperCharges: Accessory[]            // 0-1 hypercharges (DATOS REALES, no heurística)
  gears: Gear[]                        // Gears equipados (variable por brawler)
  buffies: Buffies                     // ✅ DISPONIBLE — datos reales, no heurística
}

interface BrawlerSkin {
  id: number                           // 29000844
  name: string                         // "SQUAD BUSTER\nSHELLY" (puede contener \n)
}

interface Accessory {
  id: number
  name: string
}

interface Gear {
  id: number
  name: string                         // "DAMAGE", "SPEED", "SHIELD", etc.
  level: number                        // Siempre 3 en datos observados
}

interface Buffies {
  gadget: boolean                      // true si Gadget Buffie desbloqueado
  starPower: boolean                   // true si Star Power Buffie desbloqueado
  hyperCharge: boolean                 // true si Hyper Buffie desbloqueado
}
```

#### Estadísticas Observadas (cuenta #YJU282PV)

| Dato | Valor |
|------|-------|
| Brawlers totales | 101 |
| Con buffies (campo presente) | 101/101 (SIEMPRE presente) |
| Buffies all-true | Brawlers como Shelly |
| Buffies all-false | Brawlers como Brock |
| Prestige 0 | 33 brawlers |
| Prestige 1 | 68 brawlers |
| Prestige 2+ | 0 brawlers |
| Tipos de gears únicos | 15 |

#### Tipos de Gears Observados

```
DAMAGE, EXHAUSTING STORM, GADGET COOLDOWN, HEALTH, PET POWER,
QUADRUPLETS, RELOAD SPEED, SHIELD, SPEED, STICKY OIL,
SUPER CHARGE, SUPER TURRET, TALK TO THE HAND, THICC HEAD, VISION
```

Nota: Varios gears son específicos de brawler (ej: "PET POWER", "STICKY OIL"), no genéricos.

---

### `GET /players/{playerTag}/battlelog`

**URL**: `https://api.brawlstars.com/v1/players/%23YJU282PV/battlelog`

#### Response DTO: `BattlelogResponse`

```typescript
interface BattlelogResponse {
  items: BattlelogEntry[]
  paging: { cursors: { before?: string; after?: string } }
}

interface BattlelogEntry {
  battleTime: string                   // "20260405T171604.000Z" (ISO-ish)
  event: {
    id: number                         // 15000024
    mode: string                       // "brawlBall"
    modeId: number                     // 5
    map: string                        // "Backyard Bowl"
  }
  battle: {
    mode: string                       // "brawlBall"
    type: string                       // "ranked"
    result: string                     // "victory" | "defeat" | "draw"
    duration: number                   // 192 (segundos)
    trophyChange: number               // 11 (puede ser negativo)
    starPlayer?: {                     // Solo si hay star player
      tag: string
      name: string
      brawler: BattleBrawler
    }
    teams: BattlePlayer[][]            // Array de equipos, cada uno array de jugadores
  }
}

interface BattlePlayer {
  tag: string
  name: string
  brawler: BattleBrawler
}

interface BattleBrawler {
  id: number
  name: string
  power: number
  trophies: number
}
```

---

## Servicio 2: Brawlers

### `GET /brawlers`

**URL**: `https://api.brawlstars.com/v1/brawlers`

**⚠️ HALLAZGO CRÍTICO**: Este endpoint **NO devuelve `rarity`** ni `description`. Solo devuelve id, name, starPowers, hyperCharges, gears, y gadgets.

#### Response DTO: `BrawlersListResponse`

```typescript
interface BrawlersListResponse {
  items: BrawlerInfo[]
  paging: { cursors: { before?: string; after?: string } }
}

interface BrawlerInfo {
  id: number                           // 16000000
  name: string                         // "SHELLY"
  starPowers: Accessory[]              // Todas las star powers posibles
  hyperCharges: Accessory[]            // Todas las hypercharges posibles
  gears: Gear[]                        // Todos los gears posibles
  gadgets: Accessory[]                 // Todos los gadgets posibles
  // ❌ NO tiene: rarity, description, class
}
```

**Total brawlers**: 101 (abril 2026).

#### Implicación para el Algoritmo

**La rareza NO viene de la API.** Necesitamos un mapa estático hardcodeado:

```typescript
// Debe mantenerse manualmente cuando Supercell añade brawlers
const BRAWLER_RARITY: Record<number, BrawlerRarityName> = {
  16000000: 'Trophy Road',   // Shelly
  16000001: 'Rare',          // Colt
  16000002: 'Rare',          // Bull
  // ... 101 entries
}
```

### `GET /brawlers/{brawlerId}`

Devuelve exactamente la misma estructura que un item de `/brawlers`, sin campos adicionales. Sin rarity.

---

## Servicio 3: Clubs

### `GET /clubs/{clubTag}`

**URL**: `https://api.brawlstars.com/v1/clubs/%23JG9Y2RJ0`

```typescript
interface ClubResponse {
  tag: string                          // "#JG9Y2RJ0"
  name: string                         // "𝐓𝖾αꭑ420"
  description: string                  // Texto con emojis
  type: string                         // "open" | "closed" | "inviteOnly"
  badgeId: number                      // 8000023
  requiredTrophies: number             // 100000
  trophies: number                     // 2902886 (suma de todos los miembros)
  members: ClubMember[]                // Array de miembros
  isFamilyFriendly: boolean            // true
}

interface ClubMember {
  tag: string
  name: string
  nameColor: string
  role: string                         // "member" | "senior" | "vicePresident" | "president"
  trophies: number
  icon: { id: number }
}
```

### `GET /clubs/{clubTag}/members`

Devuelve la misma lista de `ClubMember[]` que el endpoint de club pero con paginación.

---

## Servicio 4: Rankings

### `GET /rankings/{countryCode}/players`

**URL**: `https://api.brawlstars.com/v1/rankings/global/players?limit=5`

```typescript
interface RankingPlayerResponse {
  items: RankedPlayer[]
  paging: { cursors: { before?: string; after?: string } }
}

interface RankedPlayer {
  tag: string
  name: string
  nameColor: string
  icon: { id: number }
  trophies: number                     // 235661 (top #1 global)
  rank: number                         // 1-based
  club: { name: string }              // Solo nombre, sin tag
}
```

`countryCode`: ISO 2-letter o `"global"`.

### `GET /rankings/{countryCode}/clubs`

Misma estructura pero para clubs.

### `GET /rankings/{countryCode}/brawlers/{brawlerId}`

Rankings por brawler específico. Misma estructura que rankings de players.

---

## Servicio 5: Events

### `GET /events/rotation`

**URL**: `https://api.brawlstars.com/v1/events/rotation`

```typescript
type EventRotationResponse = EventSlot[]

interface EventSlot {
  startTime: string                    // "20260405T080000.000Z"
  endTime: string                      // "20260406T080000.000Z"
  slotId: number                       // 1
  event: {
    id: number                         // 15000024
    mode: string                       // "brawlBall"
    modeId: number                     // 5
    map: string                        // "Backyard Bowl"
  }
}
```

Nota: Devuelve un **array directo**, no envuelto en `{ items: [] }`.

---

## Códigos HTTP Verificados

| Código | Significado | Verificado |
|--------|-------------|-----------|
| 200 | OK | ✅ Todas las llamadas exitosas |
| 400 | Bad Request | Player tag mal formateado |
| 403 | Access Denied | API Key inválida O IP no whitelisted |
| 404 | Not Found | Player/Club no existe |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Error de Supercell |
| 503 | Service Unavailable | Mantenimiento |

---

## Impacto en el Algoritmo — Correcciones Necesarias

### 1. Buffies: Datos reales, NO heurística

```typescript
// ANTES (heurística — INCORRECTO):
if (power === 11 && accountTrophies > 30000) inferBuffie()

// DESPUÉS (datos reales):
function calcBuffiesValue(brawler: PlayerBrawler): number {
  let count = 0
  if (brawler.buffies.gadget) count++
  if (brawler.buffies.starPower) count++
  if (brawler.buffies.hyperCharge) count++
  return count * ENHANCE_VALUES.buffie  // count * 2000
}
```

### 2. Hypercharges: Datos reales, NO heurística

```typescript
// ANTES (heurística — INCORRECTO):
if (power === 11 && highestTrophies > 750) applyProbability(0.65)

// DESPUÉS (datos reales):
function calcHyperchargeValue(brawler: PlayerBrawler): number {
  return brawler.hyperCharges.length * ENHANCE_VALUES.hypercharge  // length * 1200
}
```

### 3. Rareza: Mapa estático obligatorio

La API no expone rareza. Necesitamos hardcodear los 101 brawlers.

### 4. `brawler.name`: Es string, NO `{ value: string }`

```typescript
// ANTES (doc 14 — INCORRECTO):
interface PlayerBrawler { name: { value: string } }

// DESPUÉS (API real):
interface PlayerBrawler { name: string }  // "SHELLY"
```

### 5. Gears: Más tipos de los asumidos

15 tipos únicos, incluyendo específicos por brawler. No solo los 5 genéricos.

---

## Mapa de Rareza Completo (101 Brawlers)

> **NOTA**: Este mapa debe mantenerse manualmente. La API no expone rareza.
> Fuente: datos del juego, no de la API.

Pendiente de completar con los IDs de los 101 brawlers. Se puede obtener de fuentes comunitarias como https://brawlify.com/ o la wiki oficial.

---

## Resumen de DTOs para TypeScript

```typescript
// === TIPOS CORREGIDOS basados en API real ===

// Player
export interface PlayerResponse {
  tag: string
  name: string
  nameColor: string
  icon: { id: number }
  trophies: number
  highestTrophies: number
  totalPrestigeLevel: number
  expLevel: number           // DEPRECADO
  expPoints: number
  isQualifiedFromChampionshipChallenge: boolean
  '3vs3Victories': number
  soloVictories: number
  duoVictories: number
  bestRoboRumbleTime: number
  bestTimeAsBigBrawler: number
  club: { tag: string; name: string } | Record<string, never>
  brawlers: PlayerBrawler[]
}

export interface PlayerBrawler {
  id: number
  name: string               // ⚠️ STRING, no objeto
  power: number
  rank: number
  trophies: number
  highestTrophies: number
  prestigeLevel: number
  currentWinStreak: number
  maxWinStreak: number
  skin: { id: number; name: string }
  gadgets: Accessory[]
  starPowers: Accessory[]
  hyperCharges: Accessory[]  // ✅ DATOS REALES
  gears: Gear[]
  buffies: Buffies           // ✅ DATOS REALES
}

export interface Accessory { id: number; name: string }
export interface Gear { id: number; name: string; level: number }
export interface Buffies { gadget: boolean; starPower: boolean; hyperCharge: boolean }

// Brawler catalog (sin rarity)
export interface BrawlerInfo {
  id: number
  name: string
  starPowers: Accessory[]
  hyperCharges: Accessory[]
  gears: Gear[]
  gadgets: Accessory[]
}

// Club
export interface ClubResponse {
  tag: string
  name: string
  description: string
  type: 'open' | 'closed' | 'inviteOnly'
  badgeId: number
  requiredTrophies: number
  trophies: number
  members: ClubMember[]
  isFamilyFriendly: boolean
}

export interface ClubMember {
  tag: string
  name: string
  nameColor: string
  role: 'member' | 'senior' | 'vicePresident' | 'president'
  trophies: number
  icon: { id: number }
}

// Battle
export interface BattlelogEntry {
  battleTime: string
  event: { id: number; mode: string; modeId: number; map: string }
  battle: {
    mode: string
    type: string
    result: 'victory' | 'defeat' | 'draw'
    duration: number
    trophyChange: number
    starPlayer?: { tag: string; name: string; brawler: BattleBrawler }
    teams: BattlePlayer[][]
  }
}

export interface BattlePlayer {
  tag: string
  name: string
  brawler: BattleBrawler
}

export interface BattleBrawler { id: number; name: string; power: number; trophies: number }

// Rankings
export interface RankedPlayer {
  tag: string
  name: string
  nameColor: string
  icon: { id: number }
  trophies: number
  rank: number
  club: { name: string }
}

// Events
export interface EventSlot {
  startTime: string
  endTime: string
  slotId: number
  event: { id: number; mode: string; modeId: number; map: string }
}
```
