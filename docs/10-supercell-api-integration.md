# 10. Integración con API de Supercell - Brawl Stars

Documentación técnica para integración con la API oficial de Supercell (Brawl Stars).

---

## 📍 Endpoints y Documentación

### Portal Oficial
- **URL**: https://developer.brawlstars.com/
- **Documentación**: Acceso al portal interactivo con todos los endpoints
- **Autenticación**: API Key (Bearer token)
- **Rate Limiting**: No está documentado públicamente

### Endpoints Principales Requeridos para BrawlValue

#### 1. **GET /players/{playerTag}**
Obtiene datos completos de un jugador.

**Path Parameter**:
- `playerTag`: String formato `#ABCDEF123` (case-insensitive)

**Response Fields (Relevantes)**:
```json
{
  "tag": "#2P0Q8C2C0",
  "name": "NombreDelJugador",
  "trophies": 35000,                    // Trofeos totales
  "highestTrophies": 37500,             // Record histórico
  "expLevel": 420,                      // Nivel de experiencia
  "expPoints": 1250000,                 // Puntos de experiencia
  "soloVictories": 500,                 // Victorias 1v1
  "duoVictories": 300,                  // Victorias 2v2
  "3vs3Victories": 8500,                 // ��� CRITICO: "vs" no "v"
  "brawlers": [
    {
      "id": 16000000,                   // ID único del brawler
      "name": "Shelly",
      "power": 9,                       // Nivel de poder (1-11)
      "rank": 25,                       // Rango actual
      "trophies": 500,                  // Trofeos individuales
      "highestTrophies": 600,
      "starPowers": [1, 2],             // IDs de Star Powers
      "gadgets": [1, 2]                 // IDs de gadgets
    }
    // ... más brawlers
  ]
}
```

**Códigos de Error**:
- `200`: Éxito
- `400`: Invalid player tag format
- `403`: Access Denied — API key inválida O IP no whitelisted (NO es 401)
- `404`: Player not found
- `429`: Rate limit exceeded
- `500`: Server error
- `503`: Service Unavailable — mantenimiento Supercell

---

## 🎲 Rareza de Brawlers

Para el algoritmo de valoración, necesitamos mapear cada brawler a su rareza.

**Mapping de Rareza** (basado en game data):

```typescript
const BRAWLER_RARITY = {
  // RARA (Común)
  "Shelly": "RARE",
  "Nita": "RARE",
  "Colt": "RARE",
  "Bull": "RARE",
  "Brock": "RARE",
  
  // SUPERRARA
  "Poco": "SUPER_RARE",
  "Rosa": "SUPER_RARE",
  "Barley": "SUPER_RARE",
  "Tick": "SUPER_RARE",
  
  // ÉPICA
  "Piper": "EPIC",
  "Pam": "EPIC",
  "Frank": "EPIC",
  "Jacky": "EPIC",
  
  // MÍTICA
  "Mortis": "MYTHIC",
  "Tara": "MYTHIC",
  "Gene": "MYTHIC",
  
  // LEGENDARIA
  "Spike": "LEGENDARY",
  "Crow": "LEGENDARY",
  "Leon": "LEGENDARY",
  // ... agregar más
}
```

**Problema**: El endpoint `/players/{playerTag}` NO devuelve la rareza de los brawlers.

**Solución** (confirmada vía API oficial — ver doc 14):
1. Llamar `GET /brawlers` para obtener lista completa con rarezas
2. Cachear mapa `{brawlerId → rarity}` en Redis (TTL 24h)
3. Cruzar por `id` con los brawlers del jugador
4. Rarezas disponibles: Trophy Road, Rare, Super Rare, Epic, Mythic, Legendary, Chromatic, Ultra Legendary

---

## 🔐 Seguridad de API Key

### Setup en Supercell Developer Portal

1. **Login** a https://developer.brawlstars.com/
2. **Create Application** → Nombre: "BrawlValue"
3. **Generate API Key** → Guardar token
4. **Whitelist IPs**:
   - Vercel Edge IPs (estáticas)
   - IP de desarrollo local (temporal)

### Vercel IPs

Las IPs de salida de Vercel son estáticas por región:
```
Ejemplo IPs (varían por región):
- 34.212.x.x
- 52.34.x.x
- ...
```

**Obtenerlas**:
```bash
# Deployan una función simple que devuelve IP
curl https://api.ipify.org/?format=json
```

### .env.local Recomendado

```env
# Brawl Stars API
BRAWLSTARS_API_KEY=your_api_key_here
BRAWLSTARS_API_BASE_URL=https://api.brawlstars.com/v1

# Estas NO deben ir en .env.local:
# - IP whitelisting (configurar en Supercell portal)
```

---

## 📊 Rate Limiting Strategy

### Limitaciones Desconocidas de Supercell

Supercell **no publica** públicamente sus rate limits. 

**Casos registrados en comunidad**:
- ~1000 requests/día parece seguro
- Bursts >100 req/minuto causan 429
- Ban temporal de 30-60 minutos si se excede

### Implementación en BrawlValue

**Estrategia defensiva**:
1. **Upstash Rate Limiting**: 5 req/minuto por IP (propio)
2. **Caché Agresivo**: 1 hora TTL en Redis
3. **Exponential Backoff**: Si 429, esperar 60s antes de reintentar
4. **Fallback**: Si Supercell cae, mostrar datos en caché

```typescript
// lib/api.ts
async function fetchPlayerWithRetry(playerTag: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`${API_BASE}/players/${playerTag}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        }
      })
      
      if (response.status === 429) {
        // Rate limit: wait exponentially
        await sleep(Math.pow(2, i) * 1000)
        continue
      }
      
      if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      if (i === retries - 1) throw error
      await sleep(1000 * (i + 1))
    }
  }
}
```

---

## ✅ Validación de Player Tag

### Formato válido

- Comienza con `#`
- Alfanuméricos: `A-Z`, `0-9`
- Longitud: 3-20 caracteres
- Case-insensitive (API maneja ambos)

### Regex Recomendado

```typescript
const PLAYER_TAG_REGEX = /^#[0-9A-Z]{3,20}$/i
```

### Validación en Flujo

```
Frontend: Validación Regex (UX, feedback inmediato)
   ↓
Backend: Validación nuevamente + llamada API (seguridad)
   ↓
Si API retorna 404: "Jugador no encontrado"
```

---

## 🔄 Caché Strategy

### Backend Cache (Redis)

```typescript
const CACHE_KEY = `brawlvalue:player:${playerTag.toLowerCase()}`
const CACHE_TTL = 300 // 5 minutos (alineado con caché interna Supercell ~3min)

// Get
const cached = await redis.get(CACHE_KEY)
if (cached) return JSON.parse(cached)

// Fetch desde API
const data = await fetchPlayer(playerTag)

// Store
await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data))
```

### Frontend Cache (TanStack Query)

```typescript
const usePlayerValue = (playerTag: string) => {
  return useQuery({
    queryKey: ['player', playerTag],
    queryFn: () => fetchCalculateValue(playerTag),
    staleTime: 5 * 60 * 1000,      // 5 minutos
    gcTime: 10 * 60 * 1000,        // 10 minutos
  })
}
```

---

## 📝 Logging & Monitoring

### Eventos a Trackear

```typescript
// En /api/calculate/route.ts
const logApiCall = (playerTag: string, success: boolean, error?: Error) => {
  console.log({
    timestamp: new Date(),
    playerTag,
    success,
    error: error?.message,
    source: 'supercell_api'
  })
  
  // Sentry tracking
  if (!success) {
    captureException(error, {
      tags: { playerTag, source: 'supercell_api' }
    })
  }
}
```

### Métricas Importantes

- Tasa de éxito API
- Tiempo de respuesta Supercell
- Rate limit hits
- Cache hit ratio
- Errores 404 (player not found)

---

## 🧪 Testing API Integration

### Mock para Desarrollo

```typescript
// lib/__mocks__/api.ts
export const mockPlayerData = {
  tag: "#2P0Q8C2C0",
  name: "TestPlayer",
  trophies: 35000,
  expLevel: 420,
  soloVictories: 500,
  duoVictories: 300,
  "3vs3Victories": 8500,
  brawlers: [
    {
      id: 16000000,
      name: "Shelly",
      power: 9,
      trophies: 500,
      starPowers: [1],
      gadgets: [1]
    }
    // ... más
  ]
}

export async function fetchPlayer(playerTag: string) {
  return mockPlayerData
}
```

### Casos de Test

- [x] Valid player tag → datos correctos
- [x] Invalid format → 400 error
- [x] Non-existent player → 404
- [x] Rate limited → 429 + retry
- [x] Cached response → retorna cache
- [x] Network error → fallback a último cache

---

## 🔔 Alertas Críticas

### Situaciones que Requieren Investigación

1. **429 Frequently**: Ajustar rate limiting propio
2. **403 Errors**: Validar API Key en Vercel secrets Y verificar IPs whitelisted
3. **404 Spike**: Posible ataque con tags falsos (mitigation: rate limit)
4. **API Latency >5s**: Problema con Supercell, considerar timeout
5. **503 Errors**: Mantenimiento Supercell — servir desde caché si disponible
6. **Cache Hit Ratio <70%**: Ajustar TTL

---

## 🚀 Deployment Checklist

- [ ] API Key guardada en Vercel secrets (NO en .env.local)
- [ ] Vercel IPs whitelisted en Supercell portal
- [ ] Rate limiting en Upstash configurado
- [ ] Caché Redis configurado
- [ ] Error handling para todos los códigos HTTP
- [ ] Logging/Sentry integrado
- [ ] Tests pasando (mock API)
- [ ] Timeout de 10s configurado en fetch
- [ ] Exponential backoff implementado

---

## 📚 Recursos

- [Brawl Stars Developer Portal](https://developer.brawlstars.com/)
- [Supercell Fan Content Policy](https://supercell.com/en/fan-content-policy/)
- [BrawlAPI (Unofficial, no rate limits)](https://brawlapi.com/) - Para fallback emergencias
