# 12. Especificación Detallada: Componentes, Hooks & Funciones

Especificación **exacta** de qué crear. Sin código, solo definiciones.

---

## 📁 Estructura de Carpetas Definitiva

```
src/
├── app/
│   ├── layout.tsx                     (Root layout + metadata)
│   ├── page.tsx                       (Landing page)
│   ├── globals.css                    (Tailwind imports + custom CSS)
│   ├── api/
│   │   └── calculate/
│   │       └── route.ts               (POST /api/calculate)
│   └── (future: results page)
│
├── components/
│   ├── ui/                            (shadcn/ui copied components)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   └── [otros...]
│   │
│   ├── landing/                       (Landing page components)
│   │   ├── InputForm.tsx              (Player tag input form)
│   │   ├── CTA.tsx                    (Call-to-action button)
│   │   └── ValidatedInput.tsx         (Wrapper with regex validation)
│   │
│   ├── results/                       (Results page components - future)
│   │   ├── ResultCard.tsx             (Main value display)
│   │   ├── Breakdown.tsx              (Trophies, brawlers, victories breakdown)
│   │   ├── ShareButton.tsx            (Web Share API)
│   │   └── LoadingState.tsx           (Animated loading 4-5 seconds)
│   │
│   └── common/                        (Reusable components)
│       ├── Header.tsx                 (Navigation header)
│       ├── Footer.tsx                 (Footer with disclaimer)
│       ├── LoadingSpinner.tsx         (Loading indicator)
│       └── ErrorBoundary.tsx          (Error handling)
│
├── lib/
│   ├── types.ts                       (TypeScript types & interfaces)
│   ├── constants.ts                   (App constants & config)
│   ├── api.ts                         (Supercell API client - FUTURE)
│   ├── calculate.ts                   (Valorization algorithm)
│   ├── ratelimit.ts                   (Upstash rate limiting - FUTURE)
│   └── utils.ts                       (Utility functions)
│
├── hooks/
│   ├── useCalculateValue.ts           (Hook for value calculation - with mock)
│   ├── useShare.ts                    (Web Share API hook)
│   ├── useAnalytics.ts                (GA4 events - FUTURE)
│   └── useRateLimit.ts                (Rate limit status - FUTURE)
│
├── test/
│   ├── setup.ts                       (Vitest setup)
│   └── utils.ts                       (Testing utilities)
│
└── __tests__/
    ├── unit/
    │   ├── lib/calculate.test.ts
    │   ├── lib/utils.test.ts
    │   └── hooks/useShare.test.ts
    │
    └── integration/
        └── api/calculate.test.ts
```

---

## 📝 Archivos Exactos a Crear

### **1. src/lib/types.ts** (TypeScript Types)

**Contenido Exacto**:

```
// Player tag validation
export type PlayerTag = string & { readonly __brand: 'PlayerTag' }

// API Response from Supercell (FUTURE - when API integrated)
export interface PlayerData {
  tag: PlayerTag
  name: string
  trophies: number
  expLevel: number
  soloVictories: number
  duoVictories: number
  '3v3Victories': number
  brawlers: Brawler[]
}

export interface Brawler {
  id: number
  name: string
  power: number
  rank: number
  trophies: number
  highestTrophies: number
}

// Calculation response
export interface CalculatedValue {
  playerTag: PlayerTag
  playerName: string
  totalValue: number
  breakdown: {
    trophies: { amount: number; value: number }
    experience: { level: number; value: number }
    brawlers: {
      rare: number
      superRare: number
      epic: number
      mythic: number
      legendary: number
      value: number
    }
    victories: { threeVsThree: number; value: number }
  }
  timestamp: Date
  cached: boolean
}

// API Error types
export type ApiError = 
  | { code: 400; message: 'Invalid player tag format' }
  | { code: 404; message: 'Player not found' }
  | { code: 429; message: 'Rate limited' }
  | { code: 500; message: 'Server error' }

// UI State
export type CalculationState = 'idle' | 'loading' | 'success' | 'error'
```

---

### **2. src/lib/constants.ts** (App Constants)

**Contenido Exacto**:

```
// Colors (Cyber-Brawl palette)
export const COLORS = {
  dark: '#0F172A',
  blue: '#3B82F6',
  gold: '#FBBF24',
  purple: '#A855F7',
  light: '#F8FAFC'
} as const

// Player tag regex validation
export const PLAYER_TAG_REGEX = /^#[0-9A-Z]{3,20}$/i

// Artificial delay during calculation (ms)
export const LOADING_DELAY_MIN = 4000
export const LOADING_DELAY_MAX = 5000

// Loading messages (rotate every 1 second)
export const LOADING_MESSAGES = [
  'Contando gemas...',
  'Calculando valor de brawlers legendarios...',
  'Analizando trofeos...',
  'Verificando victorias...'
] as const

// Brawler rarities mapping (static until API provides)
export const BRAWLER_RARITY = {
  'Shelly': 'RARE',
  'Nita': 'RARE',
  'Colt': 'RARE',
  // ... full list (60+ brawlers)
} as const

// Rate limiting config
export const RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60000 // 1 minute
} as const

// SEO metadata static values
export const SEO = {
  title: '¿Cuánto vale tu cuenta de Brawl Stars?',
  description: 'Calcula el valor ficticio de tu cuenta de Brawl Stars. Resultado instantáneo.',
  siteName: 'BrawlValue',
  twitterHandle: '@brawlvalue' // FUTURE
} as const
```

---

### **3. src/lib/utils.ts** (Utility Functions)

**Contenido Exacto**:

```
// Validation functions
export function isValidPlayerTag(tag: string): boolean
  // Return: PLAYER_TAG_REGEX.test(tag)

export function normalizePlayerTag(tag: string): string
  // Return: tag.toUpperCase().trim()
  // Add # if missing

// Formatting functions
export function formatCurrency(value: number): string
  // Return: `$${value.toFixed(2)}`
  // Example: 450.75 → "$450.75"

export function formatTrophies(num: number): string
  // Return: num with thousands separator
  // Example: 35000 → "35,000"

// UI helper
export function getLoadingMessage(): string
  // Return: Random message from LOADING_MESSAGES

// Error handling
export class ApiError extends Error {
  constructor(public code: number, message: string)
}

export function handleApiError(error: unknown): ApiError
  // Convert fetch errors to ApiError with proper codes
```

---

### **4. src/hooks/useCalculateValue.ts** (Main Hook - With Mock)

**Contenido Exacto**:

```
// Hook signature:
export function useCalculateValue(playerTag: string | null) {
  // Returns: {
  //   data: CalculatedValue | null
  //   isLoading: boolean
  //   isError: boolean
  //   error: ApiError | null
  //   mutate: () => Promise<void>
  // }
  
  // Implementation:
  // - Use TanStack Query
  // - queryKey: ['calculateValue', playerTag]
  // - staleTime: 5 minutes
  // - gcTime: 10 minutes
  // - POST to /api/calculate with { playerTag }
  // - FOR MVP: Return MOCK data (hardcoded)
  //   - Override with real API when Supercell key available
  //   - Placeholder: { totalValue: 450.75, breakdown: {...} }
  // - Error handling: catch 404, 429, 500 → proper errors
  // - Mutation: mutate() triggers fresh calculation
}
```

---

### **5. src/hooks/useShare.ts** (Web Share API)

**Contenido Exacto**:

```
// Hook signature:
export function useShare() {
  // Returns: {
  //   share: (title: string, text: string, url: string) => Promise<void>
  //   canShare: boolean
  // }
  
  // Implementation:
  // - Check if navigator.share exists (Web Share API)
  // - If yes: Use native share menu (mobile)
  // - If no (desktop): Copy to clipboard + show toast
  // - Message template:
  //   Title: "¡Mi cuenta vale $XXX! ¿Y la tuya?"
  //   Text: "Acabo de usar BrawlValue para tasar mi cuenta..."
  //   URL: window.location.href (with utm params?)
}
```

---

### **6. src/components/landing/InputForm.tsx**

**Contrato Exacto**:

```
// Props:
interface InputFormProps {
  onSubmit: (playerTag: string) => Promise<void>
  isLoading?: boolean
}

// Features:
// - Player tag input field (shadcn/ui Input)
// - Real-time regex validation (PLAYER_TAG_REGEX)
// - Show/hide validation message (red if invalid, green if valid)
// - Submit button (disabled if invalid or loading)
// - Button text: "Calcular Valor"
// - Loading state: Button shows spinner + disabled
// - On submit: Call onSubmit(playerTag)
// - Keyboard: Enter key also submits
```

---

### **7. src/components/landing/CTA.tsx**

**Contrato Exacto**:

```
// Props:
interface CTAProps {
  isDisabled: boolean
  isLoading: boolean
  onClick: () => void
}

// Features:
// - shadcn/ui Button component
// - Size: Large
// - Color: Gold (brawl-gold #FBBF24)
// - Text: "Calcular Valor"
// - When disabled: Opacity 50%, no pointer events
// - When loading: Show spinner inside, disable button
// - Tailwind classes: w-full h-12 text-lg font-bold
```

---

### **8. src/components/results/ResultCard.tsx** (FUTURE)

**Contrato Exacto**:

```
// Props:
interface ResultCardProps {
  value: number
  playerTag: string
  breakdown: CalculatedValue['breakdown']
}

// Features (NO CODE YET - FUTURE):
// - Large display of value: "$XXX.XX"
// - Font: Lilita One or Righteous (display font)
// - Size: 48px or larger
// - Color: Gold accent
// - Glassmorphism: backdrop-blur-md, rgba(255,255,255,0.1) border
// - Animation: Fade in with Motion
// - Below: Breakdown sub-components
```

---

### **9. src/components/results/LoadingState.tsx** (FUTURE)

**Contrato Exacto**:

```
// Props:
interface LoadingStateProps {
  messageIndex: number // 0-3 (rotating message)
}

// Features (NO CODE YET - FUTURE):
// - Show rotating messages from LOADING_MESSAGES
// - Update message every ~1 second
// - Spinning loader (CSS animation or Rive)
// - Duration: 4-5 seconds (configurable)
// - Display: "Contando gemas..." → "Calculando valor..." etc
// - Animation: Fade in/out messages smoothly
```

---

### **10. src/app/page.tsx** (Landing Page)

**Contrato Exacto**:

```
// Layout:
// ┌─────────────────────────────────────┐
// │ HEADER (Logo, Dark Mode Toggle)     │
// │─────────────────────────────────────│
// │                                     │
// │  ┌─ Landing Container (max-600px) ─┐│
// │  │                                 ││
// │  │  Title: "¿Cuánto vale tu       ││
// │  │           cuenta de             ││
// │  │           Brawl Stars?"         ││
// │  │                                 ││
// │  │  Subtitle: "Calcula el valor   ││
// │  │  ficticio de tu cuenta"         ││
// │  │                                 ││
// │  │  [Input Player Tag]             ││
// │  │  [Calculate Button]             ││
// │  │                                 ││
// │  └─────────────────────────────────┘│
// │                                     │
// │ Footer: Disclaimer                  │
// └─────────────────────────────────────┘

// State:
// - playerTag: string (input value)
// - isLoading: boolean
// - calculationData: CalculatedValue | null

// Behavior:
// 1. User enters player tag
// 2. Submit form
// 3. Show loading state (4-5 seconds artificial delay)
// 4. Fetch /api/calculate
// 5. Display results OR error message
```

---

### **11. src/app/api/calculate/route.ts** (API Endpoint)

**Contrato Exacto**:

```
// Method: POST
// Path: /api/calculate
// Body: { playerTag: string }

// Logic Flow:
// 1. Parse request body: { playerTag }
// 2. Validate player tag format (PLAYER_TAG_REGEX)
//    → If invalid: Return 400 { error: 'Invalid format' }
// 3. Check rate limit (Upstash) - FUTURE, skip MVP
//    → If exceeded: Return 429 { error: 'Rate limited' }
// 4. Check cache (Redis) - FUTURE, skip MVP
//    → If found: Return cached result
// 5. Fetch from Supercell API - FUTURE
//    → playerTag → call https://api.brawlstars.com/v1/players/{playerTag}
//    → Handle 401 (invalid key), 404 (not found), 500 (server error)
// 6. Calculate value using lib/calculate.ts
// 7. Store in cache (TTL: 1 hour) - FUTURE
// 8. Return JSON: { playerTag, playerName, totalValue, breakdown, timestamp, cached }
// 9. Error responses: JSON with { error, code } + HTTP status

// For MVP (No Supercell API Yet):
// - Return mock data: 
//   { playerTag, playerName: "Test Player", totalValue: 450.75, breakdown: {...} }
```

---

### **12. src/app/layout.tsx** (Root Layout)

**Contrato Exacto**:

```
// Imports:
// - fonts (Lilita One, Righteous, Inter from Google Fonts)
// - globals.css (Tailwind)
// - Metadata export (static + dynamic via generateMetadata)

// Features:
// - Lang: "es" or "en" (negotiation based on browser)
// - Meta tags: title, description, robots, og:image
// - Font loading: font-display: "swap" (performance)
// - Dark mode: Class-based (future: CMP compliance)
// - Analytics: GA4 script (FUTURE - when CMP ready)

// generateMetadata():
// - Default meta tags (landing)
// - og:image: Static OG image (public/og-image.png)

// RootLayout Component:
// - children wrapped in main tag
// - Header component
// - Footer component (disclaimer)
```

---

### **13. src/app/globals.css** (Styling)

**Contrato Exacto**:

```css
/* Imports */
@import "tailwindcss";

/* Custom variables */
:root {
  --color-brawl-dark: #0F172A;
  --color-brawl-blue: #3B82F6;
  --color-brawl-gold: #FBBF24;
  --color-brawl-purple: #A855F7;
}

/* Font imports (Google Fonts) */
@import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Righteous&display=swap');

/* Body defaults */
body {
  @apply bg-slate-900 text-white;
  font-family: 'Inter', system-ui, sans-serif;
}

/* Glassmorphism utility */
.glass {
  @apply bg-opacity-80 backdrop-blur-md border border-white border-opacity-10;
  background-color: rgba(15, 23, 42, 0.8);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
```

---

## 🧪 Testing Files Structure

### **src/test/setup.ts** (Vitest Setup)

```
// Imports:
// - @testing-library/jest-dom
// - vitest cleanup

// Features:
// - Configure jsdom
// - Setup DOM matchers
// - Mock localStorage (if needed)
// - Mock next/router (if needed)
```

---

### **src/__tests__/unit/lib/calculate.test.ts** (Algorithm Tests)

```
// Test suite: calculateValue()
// Tests:
// 1. Valid input → correct output
// 2. Edge cases: 0 trophies, max trophies
// 3. Brawler rarity mapping
// 4. Formula accuracy (trofeos * 0.005, etc)
```

---

### **src/__tests__/unit/hooks/useShare.test.ts**

```
// Test suite: useShare()
// Tests:
// 1. canShare true when navigator.share exists
// 2. canShare false when navigator.share doesn't exist
// 3. share() calls navigator.share with correct data
// 4. share() falls back to clipboard on desktop
```

---

## 📊 Component Composition Tree

```
app/page.tsx (Landing)
  ├── Header
  │   └── Logo + Navigation
  ├── main
  │   └── InputForm
  │       ├── ValidatedInput
  │       │   └── Input (shadcn/ui)
  │       └── CTA Button (shadcn/ui)
  └── Footer
      └── Disclaimer text

(FUTURE) app/results/page.tsx
  ├── Header
  ├── main
  │   ├── LoadingState
  │   │   └── Spinner
  │   └── ResultCard
  │       ├── Value display
  │       ├── Breakdown
  │       │   ├── Trophies stat
  │       │   ├── Brawlers stat
  │       │   └── Victories stat
  │       └── ShareButton
  └── Footer
```

---

## ✅ Files Summary

### Created Immediately (No Code, Just Shells):
- [x] src/lib/types.ts (TypeScript types only)
- [x] src/lib/constants.ts (Constants only)
- [x] src/lib/utils.ts (Function signatures + docstrings)
- [x] src/lib/api.ts (Stub - marked FUTURE)
- [x] src/lib/calculate.ts (Function signature - marked for testing)
- [x] src/lib/ratelimit.ts (Stub - marked FUTURE)

### Components (Shells with Props):
- [x] src/components/ui/* (Copy from shadcn/ui visual builder)
- [x] src/components/landing/InputForm.tsx (Props defined)
- [x] src/components/landing/CTA.tsx (Props defined)
- [x] src/components/results/* (Props defined - FUTURE)
- [x] src/components/common/* (Stubs - FUTURE)

### Hooks:
- [x] src/hooks/useCalculateValue.ts (With mock data MVP)
- [x] src/hooks/useShare.ts (Web Share API)
- [x] src/hooks/useAnalytics.ts (Stub - FUTURE)

### Pages:
- [x] src/app/page.tsx (Landing page - MVP)
- [x] src/app/layout.tsx (Root layout + metadata)
- [x] src/app/globals.css (Tailwind + custom CSS)
- [x] src/app/api/calculate/route.ts (With mock data MVP)

### Testing:
- [x] src/test/setup.ts
- [x] src/__tests__/unit/* (Test files structure)

### Config:
- [x] package.json (Dependencies)
- [x] tsconfig.json (Strict mode)
- [x] next.config.ts (Optimizations)
- [x] tailwind.config.ts (Cyber-Brawl colors)
- [x] vitest.config.ts (Testing config)
- [x] .eslintrc.json (Linting rules)
- [x] .env.example (Template)
- [x] .gitignore (Complete)

---

## 🚀 Ready for Development

Once this specification is approved, creating the actual code becomes **mechanical** - just follow the contracts defined above.

No ambiguity. No design decisions. Just implementation.
