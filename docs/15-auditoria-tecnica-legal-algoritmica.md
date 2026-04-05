# 15. Auditoría Técnica, Legal y Algorítmica del Proyecto

Fecha: 5 de abril de 2026 — Auditoría post-documentación, pre-desarrollo.

---

## Resumen Ejecutivo

La infraestructura tecnológica (Next.js App Router, Tailwind v4, shadcn/ui, Upstash Redis) es **sólida**. Sin embargo, la auditoría ha identificado **4 vulnerabilidades críticas** que amenazan la viabilidad del proyecto:

| # | Vulnerabilidad | Severidad | Estado |
|---|---------------|-----------|--------|
| 1 | Tasación en USD viola TOS de Supercell | **CRÍTICA** | Corregida → Gemas Equivalentes |
| 2 | Marca "Brawl" en dominio infringe IP | **CRÍTICA** | Corregida → Dominio neutro |
| 3 | Retraso artificial = dark pattern | **ALTA** | Corregida → Entrega instantánea |
| 4 | Algoritmo obsoleto (expLevel, sin Buffies/Prestigio) | **ALTA** | Corregida → 4 vectores |

---

## 1. Riesgo Legal: Tasación en Moneda Fiduciaria (USD)

### El Problema

Asignar un valor en USD a un Player Tag posiciona la app como herramienta de tasación para el mercado negro de cuentas. Supercell TOS Sección 1.1: la licencia es intransferible, los bienes virtuales carecen de valor económico real.

**Consecuencia**: Revocación inmediata de API Key + Cease & Desist.

### La Solución

**Eliminar toda referencia a USD/EUR/moneda fiduciaria.** Reemplazar con:

- **"Gemas Equivalentes Estimadas"** — moneda interna del juego
- **"Puntuación de Poder de Cuenta"** — métrica abstracta de prestigio

Esto mantiene la gratificación psicológica ("¡85,000 Gemas!") sin incitar a la venta de cuentas.

### Cambios Requeridos en Documentación

| Documento | Antes | Después |
|-----------|-------|---------|
| 01-vision | "tasar valor ficticio en USD" | "calcular Puntuación de Poder en Gemas" |
| 03-especificaciones | "$XXX.XX" | "XX,XXX Gemas Equivalentes" |
| 04-diseño | formatCurrency "$450.75" | formatGems "85,000 Gemas" |
| 05-algoritmo | Fórmula USD | 4 vectores → Gemas |
| 12-componentes | CalculatedValue con USD | GemScore con Gemas |
| CLAUDE.md | Valuation Formula USD | Nuevo algoritmo vectorial |

---

## 2. Riesgo Legal: Marca Registrada en Dominio

### El Problema

"BrawlValue" y cualquier dominio con "Brawl"/"Brawl Stars"/"Supercell" infringe la **Política de Contenido de Fans** de Supercell. Precedente: caso OMPI D2022-0113 (supercell-brawlstars.com — transferencia forzada).

### La Solución

1. **Dominio neutro** sin marcas registradas (ej: `starstats.gg`, `mystarpower.com`, etc.)
2. **Disclaimer obligatorio** visible en footer de todas las páginas:

> "Este material no es oficial y no está respaldado por Supercell. Para obtener más información, consulte la Política de contenido de los fans de Supercell: www.supercell.com/fan-content-policy"

3. El nombre interno del proyecto ("BrawlValue") puede mantenerse como código, pero **no como marca pública ni dominio**.

---

## 3. Riesgo UX/Monetización: Retraso Artificial

### El Problema

`setTimeout(4000-5000)` con datos ya disponibles en cliente = **dark pattern**.

**Triple riesgo**:
- **AdSense**: Manipulación de inventario → suspensión de cuenta
- **LCP > 2.5s**: Google penaliza SEO → destruye tráfico orgánico
- **EU DFA (Digital Fairness Act)**: Clasifica como práctica engañosa

### La Solución

**Eliminar el retraso artificial.** La retención se logra mediante:

1. **Entrega instantánea** del resultado principal (LCP < 2.5s)
2. **Revelación progresiva** de métricas detalladas (breakdown animado con Motion)
3. **Visualizaciones interactivas** (gráficos de radar de stats, comparativas)
4. **Exploración social** ("¿Quieres comparar con un amigo? Ingresa otro tag")
5. **Ads entre secciones de contenido real**, no durante esperas fabricadas

**Resultado**: Más páginas vistas por sesión = más impresiones lícitas. Mejor LCP = mejor SEO = más tráfico orgánico.

### Cambios Requeridos

| Documento | Cambio |
|-----------|--------|
| 03-especificaciones | Eliminar Fase 2 "Retención/setTimeout". Reemplazar con revelación progresiva |
| 04-diseño | Eliminar "retraso artificial" de Core Web Vitals. LCP < 2.5s obligatorio |
| 08-arquitectura | Eliminar Loading State artificial del flujo de datos |
| 09-plan | Eliminar Sprint 1.4 Loading State con setTimeout |
| 12-componentes | LoadingState.tsx: ya no es "4-5 segundos", sino transición natural |
| 13-tdd | Eliminar tests de delay artificial |
| CLAUDE.md | Eliminar referencia al delay intencional |

---

## 4. Algoritmo Obsoleto → Nuevo Motor Vectorial

### Métricas Eliminadas del Juego

| Métrica | Estado en Abril 2026 |
|---------|---------------------|
| `expLevel` | **DEPRECADO** — solo visible en "Legado", no aumenta |
| Gears (Épicos/Míticos) | **ELIMINADOS** — reembolsados, reemplazados por Buffies |

### Mecánicas Nuevas NO Contempladas

| Mecánica | Introducción | Impacto en Valor |
|----------|-------------|-----------------|
| **Buffies** (Gadget, Star, Hyper) | Actualización 65 (Dic 2025 - Feb 2026) | MASIVO — 3 por brawler, ~300 nodos nuevos. Coste: 149-199 Gemas o 1000 Monedas + 2000 PP cada uno |
| **Prestigio de Brawlers** | Temporada 48-49 (Mar-Abr 2026) | MASIVO — 3 niveles (1000/2000/3000 trofeos). Protección permanente contra reinicio |
| **Hypercharges** (consolidadas) | 2025 | ALTO — 5000 monedas por HC, altera competitividad |
| **Ultra Legendario** (nueva rareza) | 2026, con Sirius | ALTO — Rareza superior a Legendary |

### Disponibilidad en API Oficial (Abril 2026)

| Dato | API Status | Estrategia |
|------|-----------|------------|
| `power` (nivel fuerza) | Totalmente soportado | Cálculo exacto |
| `starPowers`, `gadgets` | Totalmente soportado | Conteo exacto de arrays |
| `hyperCharges` | **Intermitente/Incompleto** | Heurística: si `power==11` Y `highestTrophies>750` → 65% probabilidad |
| `buffies` | **Ausente/No documentado** | Heurística: si `power==11` Y `trophies_cuenta>30000` → inferir base |
| `prestigeLevel` | Soportado (campo nuevo) | Lectura directa + extrapolación de `highestTrophies` |

### Nuevo Algoritmo: 4 Vectores → Gemas Equivalentes

Ver **doc 05-algoritmo-valoracion.md** (reescrito completamente).

Fórmula resumida:

```
S_total = V_base + V_assets + V_enhance + V_elite

Gemas Equivalentes = S_total / δ   (δ = 50)
```

Donde:
- **V_base** = (trofeos_totales × 0.02) + (victorias_3vs3 × 0.08)
- **V_assets** = Σ (rareza_base × multiplicador_nivel_fuerza) por brawler
- **V_enhance** = Σ (gadgets + star_powers + hypercharges_est + buffies_est) por brawler
- **V_elite** = Σ RecompensaPrestigio(highestTrophies) por brawler

---

## 5. Correcciones Técnicas de API (de doc 14)

Errores descubiertos al verificar la documentación oficial:

| Error | Documentos Afectados | Corrección |
|-------|---------------------|------------|
| `3v3Victories` | docs 05, 10, 12, 13, CLAUDE.md | → `3vs3Victories` (con "vs") |
| Error 401 para auth | docs 05, 10 | → 403 (Access Denied, incluye IP no whitelisted) |
| Falta código 503 | docs 10, CLAUDE.md | → Añadir 503 (mantenimiento Supercell) |
| Falta rareza Trophy Road | docs 05, 10, 12 | → Añadir como primera rareza |
| Falta rareza Chromatic | docs 05, 10, 12 | → Añadir (Brawl Pass, valor entre Mythic y Legendary) |
| Brawler.name como string | docs 10, 12 | → `{ value: string }` (JsonLocalizedName) |
| StarPowers como IDs | doc 10 | → `Array<{ id: number; name: string }>` |
| Faltan campos BrawlerStat | doc 12 | → Añadir prestigeLevel, currentWinStreak, maxWinStreak, hyperCharges, gears, buffies, skin |
| Cache key inconsistente | docs 08, 10, 14 | → Unificar: `brawlvalue:player:{tag}` |
| `swcMinify` en next.config | doc 11 | → Eliminar (default en Next.js 16) |
| `@types/react` v18 con React 19 | doc 11 | → Actualizar a `@types/react: ^19.x` |
| Tailwind v4 con JS config | docs 08, 11 | → Documentar que v4 usa CSS-native config |

---

## 6. Riesgo de Player Tag Regex

### Regex Actual (docs)
```
^#[0-9A-Z]{3,20}$   (case-insensitive)
```

### Regex Óptima para Supercell
Supercell usa un subset de caracteres alfanuméricos que excluye 'O' (vocal) e 'I':
```
^#[0289PYLQGRJCUV]{3,12}$
```

**Decisión**: Mantener la regex permisiva `^#[0-9A-Z]{3,20}$/i` para validación client-side (UX), pero documentar que Supercell internamente usa un charset más restrictivo. La validación definitiva la hace el endpoint (404 si no existe).

---

## 7. Disclaimer Legal Obligatorio

### Texto Requerido (Supercell Fan Content Policy)

Debe aparecer en **TODAS las páginas**, visible en footer:

> "Este material no es oficial y no está respaldado por Supercell. Para obtener más información, consulte la Política de contenido de los fans de Supercell: www.supercell.com/fan-content-policy"

### Implementación

- Componente `Footer.tsx` debe incluir este texto siempre
- Font size mínimo legible (12px/0.75rem)
- Link clickable a la Fan Content Policy
- No puede estar oculto detrás de scroll, modal o toggle

---

## 8. Caché: Sincronización con API Supercell

La API de Supercell tiene una caché interna de ~3 minutos. Implicación:

| Capa | TTL | Razón |
|------|-----|-------|
| **Supercell interna** | ~3 min | No controlable |
| **Redis backend** | 5 min (300s) | Alineado con caché Supercell + margen |
| **TanStack Query frontend** | 3 min staleTime | Alineado con caché Supercell |

**Cambio**: El TTL de Redis baja de 1 hora a 5 minutos. Una hora era excesivo y daba datos muy desactualizados.

---

## 9. Monetización: Estrategia Post-Eliminación del Delay

Sin el retraso artificial, las impresiones de ads se generan así:

1. **Banner en Landing** (mientras el usuario escribe el tag)
2. **Ads integrados en resultados** (entre secciones del breakdown)
3. **Ads en página de comparación** (explorar tags de amigos)
4. **Ads en perfil compartido** (cada click de Web Share = nueva visita)

**Filosofía**: Más páginas vistas por sesión > retener al usuario en una sola página artificialmente.

---

## 10. Mensaje de Web Share API (Corregido)

### Antes (Viola TOS)
```
"¡Mi cuenta vale $300! ¿Y la tuya?"
```

### Después (Legal y Viral)
```typescript
const shareData = {
  title: 'Mi Puntuación de Poder en Brawl Stars',
  text: `¡Mi cuenta tiene un poder equivalente a ${gemValue.toLocaleString()} Gemas! ` +
        `Tengo ${prestigeCount} Brawlers en Prestigio. ¿Puedes superarme?`,
  url: `https://${DOMAIN}/profile/${playerTag}`
}
```

---

## 11. Resumen de Acciones Ejecutadas

| # | Acción | Documentos Modificados |
|---|--------|----------------------|
| 1 | USD → Gemas Equivalentes | 01, 03, 04, 05, 06, 08, 12, CLAUDE.md |
| 2 | Dominio neutro + disclaimer | 01, 04, 06, 08, 12 |
| 3 | Eliminar retraso artificial | 03, 04, 08, 09, 12, 13, CLAUDE.md |
| 4 | Nuevo algoritmo 4 vectores | 05 (reescrito), 12, 13, CLAUDE.md |
| 5 | 3vs3Victories (no 3v3) | 05, 10, 12, 13, CLAUDE.md |
| 6 | 403 (no 401) | 05, 10 |
| 7 | Añadir 503 | 10, CLAUDE.md |
| 8 | Nuevas rarezas (Trophy Road, Chromatic, Ultra Legendary) | 05, 10, 12, 14 |
| 9 | Campos BrawlerStat completos | 12, 14 |
| 10 | Cache TTL 5min (no 1h) | 08, 10, CLAUDE.md |
| 11 | Heurísticas de inferencia | 05, 10, 14 |

---

## Referencias Legales

- [Supercell Terms of Service](https://supercell.com/en/terms-of-service/) — Sección 1.1 (licencia intransferible)
- [Supercell Fan Content Policy](https://supercell.com/en/fan-content-policy/) — Disclaimer obligatorio, prohibición de marcas en dominios
- [OMPI Case D2022-0113](https://www.wipo.int/amc/en/domains/search/text.jsp?case=D2022-0113) — Precedente de transferencia forzada de dominio
- [EU Digital Fairness Act (DFA)](https://digital-strategy.ec.europa.eu/en/policies/digital-fairness) — Regulación de dark patterns
- [Google AdSense Program Policies](https://support.google.com/adsense/answer/48182) — Prohibición de manipulación de inventario
