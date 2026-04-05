export const COLORS = {
  dark: '#0F172A',
  blue: '#3B82F6',
  gold: '#FBBF24',
  purple: '#A855F7',
  light: '#F8FAFC'
} as const

export const PLAYER_TAG_REGEX = /^#[0-9A-Z]{3,20}$/i

export const LOADING_DELAY_MIN = 4000
export const LOADING_DELAY_MAX = 5000

export const LOADING_MESSAGES = [
  'Contando gemas...',
  'Calculando valor de brawlers legendarios...',
  'Analizando trofeos...',
  'Verificando victorias...'
] as const

export const BRAWLER_RARITY: Record<string, string> = {
  'Shelly': 'Rare',
  'Nita': 'Rare',
  'Colt': 'Rare',
  'Bull': 'Rare',
  'Brock': 'Rare',
  'El Primo': 'Rare',
  'Barley': 'Rare',
  'Poco': 'Rare',
  'Rosa': 'Rare',
  // ... can be expanded
} as const

export const RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60000 
} as const

export const SEO = {
  title: '¿Cuánto vale tu cuenta de Brawl Stars?',
  description: 'Calcula el valor ficticio de tu cuenta de Brawl Stars. Resultado instantáneo.',
  siteName: 'BrawlValue',
  twitterHandle: '@brawlvalue'
} as const
