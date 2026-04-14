# Tareas Pendientes

## Google Search Console ✅ COMPLETADO
- Dominio verificado
- Sitemap: `https://www.brawlvision.com/sitemap.xml`

## Cron meta-poll ✅ COMPLETADO + Sprint F refactor
- Oracle VPS crontab cada 30 min → `https://brawlvision.com/api/cron/meta-poll` (apex, NO www — canonical flip 2026-04-14 requiere apex)
- Sprint E (2026-04-14): multi-country pool (~2,100 únicos), preload cumulativo, self-healing cleanup de stragglers
- Sprint F (2026-04-14): sampler probabilístico, sin target/ratio, unidades coherentes (migration 017)
- Defensive error-checks en todas las escrituras críticas de Supabase
- Observabilidad: `cron_heartbeats` table + staleness alerting via healthchecks.io (pending setup)
- Archive tier: `meta_stats_archive` + pg_cron semanal (pending backfill manual antes de activar)
- Ver `docs/crons/README.md` y `docs/17-meta-data-infrastructure.md` para detalles

## Validación IDs BrawlAPI vs Supercell ✅ COMPLETADO
- 96 brawlers con ID idéntico
- 3 diferencias solo en formato de nombre (guiones vs espacios) — no afecta
- 2 brawlers nuevos solo en Supercell (SIRIUS, NAJIA) — se añadirán a BrawlAPI

## Imágenes SP/Gadgets faltantes (~20)
- **Estado**: Pendiente
- **Qué hacer**: Descargar manualmente del Fan Kit de Supercell las imágenes de Star Powers y Gadgets que faltan

## Mejoras futuras (documentadas en spec)
- Bans en el draft (placeholder visual existe)
- Sinergias de equipo (lógica lista, UI "Próximamente")
- Búsqueda multiidioma de brawlers en el draft
- Pantalla resumen post-draft con win probability
- Iconos de ranked (Bronze→Masters) descargados, pendiente integrar en leaderboard
