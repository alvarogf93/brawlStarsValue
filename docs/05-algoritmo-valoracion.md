# 5. Algoritmo de Valoración (Backend)

## Ubicación en el Código

**Ruta de la API**: `/app/api/calculate/route.ts` (Next.js)

## Fórmula Base Propuesta (Ajustable)

```
Valor Total = 
  (Trofeos Totales × 0.005) +
  (Nivel de Experiencia × 0.5) +
  (Brawlers Raros × 1) + (Superraros × 2) + (Épicos × 5) + (Míticos × 10) + (Legendarios × 20) +
  (Victorias 3v3 × 0.01)

Total = Valor en USD ($)
```

## Desglose por Componente

### 1. Trofeos Totales
- **Coeficiente**: 0.005
- **Justificación**: Los trofeos son el indicador más "visible" de progreso
- **Ejemplo**: 30,000 trofeos = $150

### 2. Nivel de Experiencia
- **Coeficiente**: 0.5
- **Justificación**: Refleja tiempo invertido
- **Ejemplo**: Nivel 400 = $200

### 3. Brawlers por Rareza
- **Rara**: 1× valor base
- **Superrara**: 2× valor base
- **Épica**: 5× valor base
- **Mítica**: 10× valor base
- **Legendaria**: 20× valor base
- **Justificación**: Los brawlers legendarios son raros y valiosos

### 4. Victorias 3v3
- **Coeficiente**: 0.01
- **Justificación**: Indicador de skill del jugador
- **Ejemplo**: 10,000 victorias = $100

## Cálculo del Backend

### Entrada (Request)

```json
{
  "playerTag": "#2P0Q8C2C0"
}
```

### Proceso

1. **Validar Player Tag** (formato regex)
2. **Llamar API de Supercell** (https://api.brawlstars.com/v1/players/{playerTag})
3. **Extraer datos necesarios**:
   - `trophies` (trofeos totales)
   - `expLevel` (nivel de experiencia)
   - `players[]` (array de brawlers)
   - `soloVictories` (victorias individuales)
   - `duoVictories` (victorias dúo)
   - `3v3Victories` (victorias 3v3)

4. **Procesar rareza de Brawlers**:
   - Mapear cada brawler a su rareza
   - Sumar según coeficiente

5. **Aplicar fórmula**
6. **Retornar resultado**

### Salida (Response)

```json
{
  "playerTag": "#2P0Q8C2C0",
  "playerName": "NombreDelJugador",
  "totalValue": 450.75,
  "breakdown": {
    "trophies": {
      "amount": 35000,
      "value": 175.00
    },
    "experience": {
      "level": 420,
      "value": 210.00
    },
    "brawlers": {
      "rare": 2,
      "superRare": 4,
      "epic": 8,
      "mythic": 5,
      "legendary": 1,
      "value": 50.00
    },
    "victories": {
      "threeVsThree": 8500,
      "value": 85.00
    }
  },
  "timestamp": "2026-04-05T14:30:00Z",
  "cached": false
}
```

## Consideraciones Técnicas

### Rate Limiting
- **Máximo**: 5 peticiones por IP por minuto
- **Backend**: Redis (Upstash) almacena contador
- **Respuesta 429**: "Demasiadas peticiones, intenta en 60 segundos"

### Caching
- **TTL**: 1 hora por Player Tag
- **Razón**: Mismo jugador consultando múltiples veces no debe llamar API cada vez
- **Implementación**: React Query en frontend, Redis en backend

### Validación de API Key
- **Ubicación**: Variable de entorno `BRAWLSTARS_API_KEY`
- **Nunca exponerla**: El frontend no debe ver esta clave
- **Error handling**: Si Supercell devuelve 401, revisar key; si 404, player no existe

## Ajustes Futuros

Los coeficientes pueden ajustarse según:
- Datos de mercado real de cuentas Brawl Stars
- A/B testing de lo que "se siente" como precio justo
- Inflación de progreso en el juego (si suben trofeos globales)
