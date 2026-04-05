# 6. Preguntas Pendientes - Clarificaciones Necesarias

## 🔴 Críticas (Bloquean desarrollo)

### 1. API Key de Supercell
- **Pregunta**: ¿Ya tienes una API Key válida de Supercell para producción?
- **Impacto**: Sin esta clave, no podemos hacer llamadas a la API
- **Acción**: Necesito que:
  - Confirmes que tienes acceso a https://developer.brawlstars.com/
  - Generes una API Key
  - La almacenes en `.env.local`

### 2. Monetización: Red Publicitaria
- **Pregunta**: ¿Qué red publicitaria usarás? (Google AdSense, AdMob, etc.)
- **Impacto**: Afecta la estructura del HTML y los espacios reservados
- **Opciones**:
  - Google AdSense (más directo, requiere aprobación)
  - Google AdMob (móvil nativo)
  - Redes directas (Mediavine, AdThrive - requieren tráfico mínimo)
  - Custom banners (vender anuncios directamente a sponsors de Brawl Stars)

### 3. Dominio y Hosting
- **Pregunta**: ¿Ya tienes dominio reservado? ¿Dónde hostearás?
- **Impacto**: Necesario para Google Analytics, API calls, SSL
- **Recomendación**: 
  - Dominio: `.com` o `.co`
  - Hosting: Vercel (gratis, optimizado para Next.js)

## 🟡 Importantes (Guían arquitectura)

### 4. Base de Datos para Usuarios (¿Tracking?)
- **Pregunta**: ¿Quieres guardar historiales de usuarios que consultan?
  - ¿Base de datos de cuentas valoradas?
  - ¿Rankings de cuentas más valiosas?
- **Impacto**: Si SÍ, necesito agregar Supabase (PostgreSQL)
- **Por ahora**: Asumiendo que NO (solo Redis para rate limiting)

### 5. Autenticación / Usuarios
- **Pregunta**: ¿Los usuarios necesitan crear cuenta?
- **Opciones**:
  - Anonimous (actual): Cualquiera puede entrar, calcular y listo
  - Con login: Guardar búsquedas, comparar cuentas de amigos
- **Por ahora**: Asumiendo Anónimo (sin auth)

### 6. Funcionalidades Sociales Extra
- **Pregunta**: ¿Quieres agregar después?
  - Comparar mi valor vs. valor de mis amigos (multiplayer)
  - Leaderboard global (top 100 cuentas más valiosas)
  - Historial de mis búsquedas
- **Por ahora**: Solo sharing simple con Web Share API

### 7. Internacionalización (i18n)
- **Pregunta**: ¿Múltiples idiomas o solo español/inglés?
- **Impacto**: Requiere `next-intl` o similar si SÍ
- **Por ahora**: Asumiendo español principal + inglés como fallback

## 🟢 Detalles de Implementación

### 8. Coeficientes de la Fórmula
- **Pregunta**: ¿Los coeficientes actuales se sienten correctos?
  - ¿Un Brawler Legendario "vale" realmente 20 veces un Raro?
  - ¿Los Trofeos con 0.005× se sienten justos?
- **Acción**: Podemos A/B testing después del MVP

### 9. Retraso Artificial de Carga
- **Pregunta**: ¿4-5 segundos es el rango correcto para anuncios?
  - ¿O necesitas más/menos tiempo?
- **Impacto**: Afecta UX y percepción de "velocidad de cálculo"

### 10. Mensajes Rotativos de Carga
- **Pregunta**: ¿Estos mensajes suenan bien o necesitan cambios?
  - "Contando gemas..."
  - "Calculando valor de brawlers legendarios..."
  - "Analizando trofeos..."
  - "Verificando victorias..."
- **Acción**: Podemos agregar más o hacerlos más divertidos

### 11. Framing del "Valor"
- **Pregunta**: ¿Quieres disclaimers legales?
  - "Este es un valor ficticio de entretenimiento, no es el precio real de venta"
  - Dónde colocarlo: ¿Footer? ¿Modal antes de compartir?
- **Impacto**: Protección legal, no afecta UX

## 📋 Checklist de Configuración Inicial

- [ ] Confirmar API Key de Supercell
- [ ] Elegir red publicitaria
- [ ] Reservar dominio
- [ ] Configurar Upstash Redis (rate limiting)
- [ ] Crear repositorio GitHub
- [ ] Configurar Vercel (o hosting elegido)
- [ ] Crear `.env.local` con variables de entorno
- [ ] Definir User-Agent para requests a Supercell API

## 📌 Nota Importante

Este documento se irá completando conforme respondas estas preguntas. Algunas decisiones pueden cambiar la arquitectura, así que es mejor confirmarlas YA que durante el desarrollo.
