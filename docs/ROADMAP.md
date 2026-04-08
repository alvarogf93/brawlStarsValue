# BrawlVision — Roadmap

> Estado actual: MVP completo con draft competitivo, meta data en tiempo real, y analíticas premium.
> Última actualización: 2026-04-08

---

## Fase actual: COMPLETADA

### Lo que tenemos hoy
- Calculadora de valor de cuenta (gemas)
- 27+ métricas de analíticas avanzadas (premium)
- Draft competitivo 1-2-2-1 con recomendaciones en tiempo real
- Meta data global (cron polling top 200 jugadores cada 30 min)
- Página pública de mejores picks por mapa (SSR + ISR)
- Indicadores de confianza estadística en toda la app
- Sistema de pagos PayPal (mensual/trimestral/anual)
- 13 idiomas, SEO completo, Google Search Console
- Notificaciones Telegram para admin

---

## Próximas fases (ordenadas por impacto + viabilidad)

### Fase A — Retención y engagement (Alto impacto, esfuerzo medio)

**Objetivo**: Que los usuarios vuelvan cada día.

| Feature | Descripción | Esfuerzo |
|---------|-------------|----------|
| **Notificaciones post-batalla** | Resumen diario/semanal por email o Telegram: "Hoy jugaste 15 partidas, tu WR fue 67%. Tu mejor brawler: Shelly." | Medio |
| **Racha y logros** | Sistema de badges: "10 victorias seguidas", "100 partidas analizadas", "Dominas Gem Grab". Gamificación del propio tracking. | Medio |
| **Widget de resumen rápido** | Al entrar al perfil, un mini-dashboard: "Desde tu última visita: +5 partidas, +23 copas, nuevo récord con Colt" | Bajo |
| **Comparativa con amigos** | Ya existe la página /compare. Expandirla: gráfica comparativa, quién gana más en cada modo, desafío 1v1 de stats. | Medio |

### Fase B — Monetización y crecimiento (Alto impacto, esfuerzo bajo-medio)

**Objetivo**: Más usuarios premium, más ingresos.

| Feature | Descripción | Esfuerzo |
|---------|-------------|----------|
| **Trial gratuito 3 días** | Dar acceso premium temporal tras registro. El usuario ve lo que pierde al acabar. | Bajo |
| **Referidos** | "Invita a un amigo y ambos ganáis 1 semana premium gratis." Código de referido en el perfil. | Medio |
| **Freemium mejorado** | Mostrar las analíticas premium con blur/lock, no ocultas. El usuario VE lo que no puede tocar. Genera FOMO. | Bajo |
| **Tier Pro** | Segundo nivel premium con: API access, exportar datos CSV, prioridad en sync, badge exclusivo en perfil. | Alto |

### Fase C — Draft & competitivo (Alto impacto, esfuerzo alto)

**Objetivo**: Ser la herramienta de referencia para competitivo.

| Feature | Descripción | Esfuerzo |
|---------|-------------|----------|
| **Bans en el draft** | 2 bans por equipo antes de los picks. UI ya tiene placeholders. Lógica del state machine a extender. | Medio |
| **Sinergias de equipo** | "Shelly + Poco tienen 72% WR juntos en Gem Grab". Datos de meta_matchups + historial propio. UI "Próximamente" ya existe. | Medio |
| **Triple columna recomendaciones** | Tab Analytics: Top Global / Comunidad BrawlVision / Personal lado a lado. Datos ya fluyen (source=global/users). | Medio |
| **Historial de drafts** | Guardar drafts completos en localStorage o Supabase. "Tu último draft: Gem Grab, ganaste con Shelly+Poco+Colt". | Medio |
| **Compartir draft** | Generar imagen del draft completado para compartir en Discord/WhatsApp. | Medio |

### Fase D — Datos y precisión (Impacto medio, esfuerzo medio)

**Objetivo**: Datos más fiables y profundos.

| Feature | Descripción | Esfuerzo |
|---------|-------------|----------|
| **Tracking de Star Powers/Gadgets** | Separar win rates por SP/Gadget equipado. Requiere extraer de battlelog (datos están, falta agregar). | Alto |
| **Meta por rango de copas** | Win rates filtrados por tier de copas (0-500, 500-1000, 1000+). Diferentes metas para diferentes niveles. | Medio |
| **Detección de balance patches** | Cuando los win rates cambian bruscamente, notificar: "Nuevo parche detectado. El meta está cambiando." | Medio |
| **Polling de más jugadores** | Escalar de 50 a 200+ por batch. Requiere optimizar el cron (chunked processing) o múltiples invocaciones. | Medio |

### Fase E — Plataforma y escala (Impacto medio-alto, esfuerzo alto)

**Objetivo**: De herramienta a plataforma.

| Feature | Descripción | Esfuerzo |
|---------|-------------|----------|
| **API pública** | Endpoint REST documentado para que otros developers accedan a nuestros meta stats. Tier Pro. | Alto |
| **App móvil (PWA mejorada)** | Ya tenemos manifest.json. Mejorar: offline support, push notifications, icon en home screen. | Medio |
| **Torneos** | Crear y gestionar torneos con bracket, tracking automático de resultados vía battlelog. | Muy alto |
| **Comunidad** | Foro/chat para jugadores. Compartir estrategias, builds, tier lists. | Muy alto |
| **Multi-juego** | Expandir a Clash Royale, Clash of Clans. Misma arquitectura, diferentes APIs. | Muy alto |

---

## Prioridad recomendada

```
Semana 1-2:  Fase B (monetización rápida — trial, freemium blur, referidos)
Semana 3-4:  Fase A (retención — resumen diario, logros, widget)
Mes 2:       Fase C (competitivo — bans, sinergias, triple columna)
Mes 3:       Fase D (datos — SP tracking, meta por copas)
Mes 4+:      Fase E (plataforma — API, PWA, torneos)
```

---

## Métricas de éxito

| Métrica | Objetivo Mes 1 | Objetivo Mes 3 |
|---------|---------------|---------------|
| Usuarios registrados | 100 | 1,000 |
| Usuarios premium | 10 | 100 |
| Batallas en meta_stats | 100K | 1M |
| Mapas con datos fiables | 30+ | 50+ |
| Retención diaria | 20% | 35% |
| MRR (Monthly Recurring Revenue) | 30€ | 300€ |

---

## Deuda técnica a resolver

| Item | Prioridad |
|------|-----------|
| Traducir hooks a 8 idiomas restantes (tienen EN fallback) | Baja |
| next/image en vez de <img> en draft components | Baja |
| Búsqueda multiidioma de brawlers en draft | Media |
| ~20 imágenes SP/Gadgets faltantes (descarga manual) | Baja |
