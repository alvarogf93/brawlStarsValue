const fs = require('fs')
const path = require('path')

const LANDING = {
  es: {
    title: '¿Cuánto poder tiene tu cuenta?',
    subtitle: 'Ingresa tu Player Tag y descubre tu Puntuación de Poder en Gemas',
    placeholder: '#2P0Q8C2C0',
    cta: 'Calcular Poder',
    calculating: 'Calculando...',
    invalidTag: 'Formato inválido. Ejemplo: #2P0Q8C2C0',
    error: 'Error de conexión',
    feature1: 'Valor en Gemas',
    feature2: 'Analytics Avanzados',
    feature3: 'Sinergias de Equipo',
    feature4: 'Counter-Picks',
    privacyLink: 'Política de Privacidad',
    contact: 'Contacto',
    disclaimer: 'BrawlVision no está afiliado con Supercell Oy. Brawl Stars es marca registrada de Supercell.',
  },
  en: {
    title: 'How powerful is your account?',
    subtitle: 'Enter your Player Tag and discover your Gem Power Score',
    placeholder: '#2P0Q8C2C0',
    cta: 'Calculate Power',
    calculating: 'Calculating...',
    invalidTag: 'Invalid format. Example: #2P0Q8C2C0',
    error: 'Connection error',
    feature1: 'Gem Value',
    feature2: 'Advanced Analytics',
    feature3: 'Team Synergies',
    feature4: 'Counter-Picks',
    privacyLink: 'Privacy Policy',
    contact: 'Contact',
    disclaimer: 'BrawlVision is not affiliated with Supercell Oy. Brawl Stars is a trademark of Supercell.',
  },
}

const dir = path.join(__dirname, '..', 'messages')
for (const locale of ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']) {
  const filePath = path.join(dir, locale + '.json')
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  content.landing = LANDING[locale] || LANDING.en
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
}
console.log('Done: landing i18n updated')
