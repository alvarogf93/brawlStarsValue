# 2. Stack Tecnológico (Abril 2026)

| Capa | Tecnología | Justificación |
|------|-----------|---|
| **Framework Core** | Next.js (App Router) + React | Renderizado híbrido (SSR/CSR), SEO técnico perfecto, protección de API Key en servidor |
| **Lenguaje** | TypeScript | Cero errores en producción, tipado estricto para datos de API Supercell |
| **Estilos / CSS** | Tailwind CSS v4 | Motor CSS ultrarrápido, variables dinámicas y temas escalables |
| **Componentes UI** | shadcn/ui + Radix UI | Accesibilidad nativa, componentes modificables 100% para aspecto "Gamer" |
| **Animaciones** | Framer Motion + Rive | Framer para transiciones; Rive para micro-interacciones con peso mínimo en KB |
| **Caché / Estado** | TanStack Query (React Query) | Evitar llamadas repetidas a API de Supercell, ahorro de cuota |
| **Base de Datos** | Upstash (Redis) | Rate Limiting para evitar bots y proteger API Key |

## Detalles Clave

- **SSR/CSR Hybrid**: Los datos públicos se renderizan en servidor (SEO), las interacciones en cliente
- **API Key Segura**: La API Key de Supercell nunca se expone al cliente, solo el backend la usa
- **Rate Limiting**: Implementado en Redis para evitar abuso y baneos de la API Key
- **Performance**: Core Web Vitals optimizados (LCP, FID, CLS)
