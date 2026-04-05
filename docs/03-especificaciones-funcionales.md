# 3. Especificaciones Funcionales - El Flujo del Usuario

El viaje del usuario se divide en **tres fases críticas**:

## Fase 1: Entrada (Landing)

**Objetivo**: Captar el Player Tag del usuario.

- **Input de Texto**: Validado con Regex
  - Formato aceptado: Player Tag de Supercell (ej. `#2P0Q...`)
  - Solo caracteres alfanuméricos + `#`
  - Mínimo 3 caracteres, máximo 20
  
- **Botón CTA**: 
  - Desactivado si el formato es incorrecto (feedback visual inmediato)
  - Activado cuando el input es válido
  - Texto: "Calcular Valor" o similar

- **Diseño**: Minimalista, con fondo oscuro (glassmorphism), sin distracciones

## Fase 2: Procesamiento y Revelación Progresiva ⭐ CRÍTICA

**Objetivo**: Entregar el resultado principal de forma instantánea (LCP < 2.5s), luego revelar métricas detalladas con animaciones ricas que retengan al usuario de forma lícita.

**Flujo Técnico**:
1. Usuario hace clic en CTA
2. Frontend envía Player Tag al backend (`/api/calculate`)
3. Backend consulta API de Supercell y calcula valor en milisegundos
4. **Frontend muestra resultado principal inmediatamente** (Gemas Equivalentes)
5. **Revelación progresiva** del breakdown detallado:
   - Sección 1: Gemas Equivalentes (resultado hero, animación Motion de entrada)
   - Sección 2: Breakdown por vectores (assets, mejoras, prestigio) — aparece con scroll
   - Sección 3: Gráfico de radar de stats del jugador (visualización interactiva)
   - Sección 4: CTA de comparación ("¿Quieres comparar con un amigo?")
   - Ads integrados entre secciones de contenido real

**Razón de la revelación progresiva**: Más secciones exploradas = más impresiones de ads lícitas. LCP < 2.5s = buen SEO. Sin dark patterns.

> **ELIMINADO**: El retraso artificial (`setTimeout 4-5s`) fue eliminado tras la auditoría (doc 15). Viola políticas de AdSense, destruye LCP, y constituye un dark pattern bajo la EU Digital Fairness Act.

## Fase 3: Viral (Resultados)

**Objetivo**: Mostrar resultado de forma épica y compartible.

- **Muestra Principal**: 
  - Número grande y centrado: "Tu cuenta tiene un poder equivalente a **XX,XXX Gemas**"
  - Uso de tipografía display (Lilita One, Righteous)
  - Color de acento: Ámbar/Oro (#FBBF24)

- **Desglose Visual (4 vectores)**:
  - Base: Trofeos totales + Victorias 3vs3
  - Inventario: Brawlers por rareza × nivel de fuerza
  - Mejoras: Gadgets, Star Powers, Hypercharges, Buffies
  - Elite: Brawlers en Prestigio (1, 2, 3)

- **Web Share API** (Compartir):
  ```
  Título: "Mi Puntuación de Poder en Brawl Stars"
  Texto: "¡Mi cuenta tiene un poder equivalente a XX,XXX Gemas! Tengo X Brawlers en Prestigio. ¿Puedes superarme?"
  URL: https://{DOMAIN}/profile/{playerTag}
  Compartible a: WhatsApp, Instagram, TikTok, Twitter
  ```

  > **NOTA LEGAL**: No usar USD ni monedas fiduciarias en el mensaje. Ver doc 15 para justificación.

- **Captura de Pantalla**: 
  - Botón "Descargar como imagen" (usar html2canvas o similar)
  - Para que el usuario compare con amigos
