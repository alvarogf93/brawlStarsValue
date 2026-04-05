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

## Fase 2: Retención (La Mina de Oro Publicitaria) ⭐ CRÍTICA

**Objetivo**: Retener al usuario exactamente el tiempo suficiente para mostrar anuncios.

**Flujo Técnico**:
1. Usuario hace clic en CTA
2. Frontend envía Player Tag al backend (`/api/calculate`)
3. Backend consulta API de Supercell y calcula valor en milisegundos
4. **Frontend fuerza retraso artificial** con `setTimeout(4000-5000)`
5. Durante esta espera:
   - Se muestran mensajes rotativos cada ~1 segundo:
     - "Contando gemas..."
     - "Calculando valor de brawlers legendarios..."
     - "Analizando trofeos..."
     - "Verificando victorias..."
   - Se cargan anuncios intersticiales o banners centrales
   - Animación de carga (ej. spinner, barra de progreso)

**Razón del retraso artificial**: Crear ventana de exposición para anuncios sin que se note "artificial"

## Fase 3: Viral (Resultados)

**Objetivo**: Mostrar resultado de forma épica y compartible.

- **Muestra Principal**: 
  - Número grande y centrado: "Tu cuenta vale **$XXX.XX**"
  - Uso de tipografía display (Lilita One, Righteous)
  - Color de acento: Ámbar/Oro (#FBBF24)

- **Desglose Visual**:
  - Trofeos totales
  - Brawlers maxeados
  - Victorias 3v3
  - Rareza de Brawlers (cuenta de Legendarios, Míticos, etc.)

- **Web Share API** (Compartir):
  ```
  Título: "¡Mi cuenta vale $XXX! ¿Y la tuya?"
  Texto: "Acabo de usar BrawlValue para tasar mi cuenta de Brawl Stars. ¿Cuánto vale la tuya? [LINK]"
  Compartible a: WhatsApp, Instagram, TikTok, Twitter
  ```

- **Captura de Pantalla**: 
  - Botón "Descargar como imagen" (usar html2canvas o similar)
  - Para que el usuario compare con amigos
