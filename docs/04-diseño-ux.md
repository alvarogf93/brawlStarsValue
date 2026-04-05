# 4. Especificaciones de Diseño y UX

## Paleta de Colores (Cyber-Brawl)

| Uso | Color | Hex | Notas |
|-----|-------|-----|-------|
| Fondo Principal | Slate 900 con degradados radiales | #0F172A | Base oscura con tonos azules neón sutiles |
| Fondo Secundario | Azul neón (degradado) | #3B82F6 | Para overlays y acentos radiales |
| Texto Principal | Blanco roto | #F8FAFC | Legible sobre fondo oscuro |
| Botones / Valores | Ámbar (Oro) | #FBBF24 | Principal CTA y números destacados |
| Acentos Míticos | Morado | #A855F7 | Para brawlers legendarios y elementos premium |
| Bordes Sutiles | Blanco semitransparente | rgba(255,255,255,0.1) | Para cards glassmorphism |

## Tipografía

### Fuentes Seleccionadas

| Elemento | Fuente | Peso | Tamaño | Caso |
|----------|--------|------|--------|------|
| UI General (botones, labels) | Inter o Geist | 400, 600 | 14px-16px | Sentence case |
| Números (valor, trofeos) | Lilita One o Righteous | 700 | 28px-48px | UPPERCASE |
| Títulos | Righteous | 700 | 24px-32px | UPPERCASE |
| Subtítulos | Inter | 500 | 16px-18px | Sentence case |
| Body text | Inter | 400 | 14px | Sentence case |

**Nota**: Las fuentes Lilita One y Righteous son de Google Fonts gratuitas y dan ese toque arcade/gaming necesario.

## Estética Visual: Glassmorphism

### Componentes de Tarjeta (Cards)

```css
/* Ejemplo conceptual */
.result-card {
  background: rgba(15, 23, 42, 0.8);  /* Fondo semitransparente */
  backdrop-filter: blur(12px);         /* Desenfoque de fondo */
  border: 1px solid rgba(255, 255, 255, 0.1);  /* Borde sutil */
  border-radius: 16px;                 /* Redondeado */
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}
```

### Elementos Clave

- ✅ Fondos semitransparentes con desenfoque
- ✅ Bordes finos en blanco/gris con opacidad baja
- ✅ Sombras sutiles (no pesadas)
- ✅ Espaciado generoso (padding/gap)
- ✅ Transiciones suaves (Framer Motion)

## Core Web Vitals: Optimización para Anuncios

### ⚠️ Cero CLS (Cumulative Layout Shift)

**Problema**: Al cargar un anuncio dinámico, la página se desplaza, destruyendo UX y posicionamiento SEO.

**Solución**: Reservar espacios fijos en CSS para banners.

```css
/* Ejemplo: Banner publicitario fijo */
.ad-banner-container {
  min-height: 250px;  /* Reserva espacio aunque no haya anuncio cargado */
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
}

/* Para intersticiales */
.ad-interstitial {
  min-height: 480px;  /* Móvil estándar */
}
```

## Responsive Design

- **Mobile First** (98% del tráfico)
  - Viewport: 320px mínimo
  - Cards: full-width con padding
  - Textos: escalables con clamp()

- **Desktop** (2% del tráfico, pero importante para SEO)
  - Max-width: 600px (mantener focus)
  - Layout: centrado
  - No ocupar pantalla completa (evitar sensación de "app web cheapy")

## Animaciones

- **Framer Motion**: Transiciones entre fases (entrada → carga → resultados)
- **Rive**: Micro-interacciones (monedas girando, números contando)
- **CSS**: Spinners y animaciones de carga simples

**Principio**: Animaciones deben servir a la retención, no ser decorativas.
