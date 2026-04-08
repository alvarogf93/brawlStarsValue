# Tareas Pendientes

## Google Search Console — Verificar dominio
- **Estado**: Pendiente (DNS TXT puede tardar hasta 24h)
- **Qué hacer**: Ir a [Google Search Console](https://search.google.com/search-console), abrir la propiedad `www.brawlvision.com` y pulsar "Verificar"
- **Registro DNS añadido**: TXT `google-site-verification=5hdJc9SX6x_bgCe0-kEPzLR8P6WZ2YuaCYuPiRhsrmM`
- **Después de verificar**: Enviar sitemap (`https://www.brawlvision.com/sitemap.xml`) desde la sección Sitemaps
- **Meta tag HTML**: Ya desplegado en el layout como respaldo

## Cron meta-poll — Añadir al Oracle VPS
- **Estado**: Pendiente (requiere SSH al VPS)
- **Qué hacer**: Añadir al crontab de Oracle VPS:
  ```
  0 */2 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://brawl-stars-value-79ko.vercel.app/api/cron/meta-poll > /dev/null 2>&1
  ```
- **Verificar**: Tras la primera ejecución, comprobar que meta_stats tiene datos en Supabase

## Imágenes SP/Gadgets faltantes (~20)
- **Estado**: Pendiente
- **Qué hacer**: Descargar manualmente del Fan Kit de Supercell las imágenes de Star Powers y Gadgets que faltan
