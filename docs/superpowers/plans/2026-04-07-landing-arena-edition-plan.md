# Landing Page "Arena Edition" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal landing page with an immersive 7-section "Arena Edition" landing that showcases BrawlVision's capabilities and drives login/signup.

**Architecture:** The landing page (`src/app/[locale]/page.tsx`) is a server component that composes 7 client/server sub-components. Each section is a standalone component in `src/components/landing/`. Animations use framer-motion (already installed, v12.38) for viewport reveals and floating brawlers, CSS keyframes for the brawler parade. All text goes through next-intl with keys under `landing.*`.

**Tech Stack:** Next.js 16.2, React 19, framer-motion 12, next-intl 4.9, Tailwind CSS 4, lucide-react, next/image with cdn.brawlify.com

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/[locale]/page.tsx` | Modify | Orchestrate all 7 sections |
| `src/app/globals.css` | Modify | Add parade scroll keyframes |
| `src/components/landing/HeroBrawlers.tsx` | Create | Floating brawler portraits flanking hero |
| `src/components/landing/StatsTicker.tsx` | Create | Animated stat counters bar |
| `src/components/landing/FeaturesGrid.tsx` | Create | 6 feature cards grid |
| `src/components/landing/BrawlerParade.tsx` | Create | Auto-scrolling brawler strip |
| `src/components/landing/HowItWorks.tsx` | Create | 3-step explanation |
| `src/components/landing/PremiumTeaser.tsx` | Create | Free vs Premium comparison |
| `src/components/landing/FinalCTA.tsx` | Create | Final sign-in CTA |
| `scripts/update-landing-arena-i18n.js` | Create | Add new i18n keys to all 13 locales |
| `messages/*.json` (13 files) | Modify (via script) | New landing.* keys |

**Existing files used (not modified):**
- `src/components/landing/InputForm.tsx` — existing form, untouched
- `src/components/auth/AuthModal.tsx` — reused for sign-in triggers
- `src/components/ui/AnimatedCounter.tsx` — reused in StatsTicker
- `src/components/common/LocaleSwitcher.tsx` — stays in hero
- `src/lib/utils.ts` — `getBrawlerPortraitUrl(id)` helper
- `src/lib/constants.ts` — `BRAWLER_RARITY_MAP` for rarity colors

---

## Task 1: Add i18n keys to all 13 locales

**Files:**
- Create: `scripts/update-landing-arena-i18n.js`
- Modify: `messages/*.json` (13 files, via script)

- [ ] **Step 1: Create the i18n update script**

```js
// scripts/update-landing-arena-i18n.js
const fs = require('fs')
const path = require('path')

// New keys to ADD to landing.* (keeps existing keys intact)
const NEW_KEYS = {
  en: {
    heroSignIn: 'Or sign in with Google',
    statsBrawlers: 'Brawlers Analyzed',
    statsPlayers: 'Players',
    statsBattles: 'Battles Tracked',
    feature1Title: 'Gem Power Score',
    feature1Desc: 'Calculate the real gem value of every brawler, gadget, and skin',
    feature2Title: 'Battle Analytics',
    feature2Desc: 'Deep dive into win rates, modes, and performance trends',
    feature3Title: 'Team Synergies',
    feature3Desc: 'Find your best teammate combos and brawler pairs',
    feature4Title: 'Counter-Picks',
    feature4Desc: 'Know exactly which brawler beats your enemy',
    feature5Title: 'Tilt Detector',
    feature5Desc: 'Know when to stop before losing trophies',
    feature6Title: 'Play Now',
    feature6Desc: 'Real-time brawler recommendations based on YOUR data',
    paradeTitle: 'Every Brawler. Every Stat.',
    step1Title: 'Enter your #TAG',
    step1Desc: 'Find it in-game under your profile',
    step2Title: 'Get instant analysis',
    step2Desc: 'We crunch every brawler, battle, and upgrade',
    step3Title: 'Dominate the arena',
    step3Desc: 'Use data-driven insights to climb trophies',
    premiumTitle: 'Unlock your full potential',
    premiumFree: 'Free',
    premiumPro: 'Premium',
    premiumFrom: 'From €2.99/mo',
    premiumCTA: 'Activate Premium',
    premiumFreeF1: 'Gem Calculator',
    premiumFreeF2: 'Basic Stats',
    premiumFreeF3: 'Club View',
    premiumProF1: 'Battle History',
    premiumProF2: 'AI Analytics',
    premiumProF3: 'Counter-Picks',
    premiumProF4: 'Tilt Detector',
    premiumProF5: 'No Ads',
    finalTitle: 'Ready to dominate?',
    finalSubtitle: 'Free forever. Premium for pros.',
    finalGoogle: 'Sign in with Google',
  },
  es: {
    heroSignIn: 'O inicia sesión con Google',
    statsBrawlers: 'Brawlers Analizados',
    statsPlayers: 'Jugadores',
    statsBattles: 'Batallas Rastreadas',
    feature1Title: 'Puntuación de Gemas',
    feature1Desc: 'Calcula el valor real en gemas de cada brawler, gadget y skin',
    feature2Title: 'Analytics de Batallas',
    feature2Desc: 'Analiza a fondo win rates, modos y tendencias de rendimiento',
    feature3Title: 'Sinergias de Equipo',
    feature3Desc: 'Encuentra tus mejores combos de compañeros y brawlers',
    feature4Title: 'Counter-Picks',
    feature4Desc: 'Sabe exactamente qué brawler gana al enemigo',
    feature5Title: 'Detector de Tilt',
    feature5Desc: 'Sabe cuándo parar antes de perder trofeos',
    feature6Title: 'Juega Ahora',
    feature6Desc: 'Recomendaciones en tiempo real basadas en TUS datos',
    paradeTitle: 'Cada Brawler. Cada Estadística.',
    step1Title: 'Ingresa tu #TAG',
    step1Desc: 'Encuéntralo en el juego, en tu perfil',
    step2Title: 'Análisis instantáneo',
    step2Desc: 'Procesamos cada brawler, batalla y mejora',
    step3Title: 'Domina la arena',
    step3Desc: 'Usa datos reales para subir trofeos',
    premiumTitle: 'Desbloquea todo el potencial',
    premiumFree: 'Gratis',
    premiumPro: 'Premium',
    premiumFrom: 'Desde 2,99€/mes',
    premiumCTA: 'Activar Premium',
    premiumFreeF1: 'Calculadora de Gemas',
    premiumFreeF2: 'Estadísticas Básicas',
    premiumFreeF3: 'Vista de Club',
    premiumProF1: 'Historial de Batallas',
    premiumProF2: 'Analytics con IA',
    premiumProF3: 'Counter-Picks',
    premiumProF4: 'Detector de Tilt',
    premiumProF5: 'Sin Anuncios',
    finalTitle: '¿Listo para dominar?',
    finalSubtitle: 'Gratis para siempre. Premium para pros.',
    finalGoogle: 'Iniciar sesión con Google',
  },
  fr: {
    heroSignIn: 'Ou connectez-vous avec Google',
    statsBrawlers: 'Brawlers Analysés',
    statsPlayers: 'Joueurs',
    statsBattles: 'Batailles Suivies',
    feature1Title: 'Score de Gemmes',
    feature1Desc: 'Calculez la valeur en gemmes de chaque brawler, gadget et skin',
    feature2Title: 'Analyse de Batailles',
    feature2Desc: 'Analysez vos taux de victoire, modes et tendances',
    feature3Title: 'Synergies d\'Équipe',
    feature3Desc: 'Trouvez vos meilleurs combos de coéquipiers',
    feature4Title: 'Counter-Picks',
    feature4Desc: 'Sachez exactement quel brawler bat l\'ennemi',
    feature5Title: 'Détecteur de Tilt',
    feature5Desc: 'Sachez quand arrêter avant de perdre des trophées',
    feature6Title: 'Jouer Maintenant',
    feature6Desc: 'Recommandations en temps réel basées sur VOS données',
    paradeTitle: 'Chaque Brawler. Chaque Stat.',
    step1Title: 'Entrez votre #TAG',
    step1Desc: 'Trouvez-le dans le jeu sous votre profil',
    step2Title: 'Analyse instantanée',
    step2Desc: 'On analyse chaque brawler, bataille et amélioration',
    step3Title: 'Dominez l\'arène',
    step3Desc: 'Utilisez des données pour monter en trophées',
    premiumTitle: 'Débloquez tout le potentiel',
    premiumFree: 'Gratuit',
    premiumPro: 'Premium',
    premiumFrom: 'À partir de 2,99€/mois',
    premiumCTA: 'Activer Premium',
    premiumFreeF1: 'Calculateur de Gemmes',
    premiumFreeF2: 'Stats de Base',
    premiumFreeF3: 'Vue du Club',
    premiumProF1: 'Historique de Batailles',
    premiumProF2: 'Analytics IA',
    premiumProF3: 'Counter-Picks',
    premiumProF4: 'Détecteur de Tilt',
    premiumProF5: 'Sans Pubs',
    finalTitle: 'Prêt à dominer ?',
    finalSubtitle: 'Gratuit pour toujours. Premium pour les pros.',
    finalGoogle: 'Se connecter avec Google',
  },
  pt: {
    heroSignIn: 'Ou entre com Google',
    statsBrawlers: 'Brawlers Analisados',
    statsPlayers: 'Jogadores',
    statsBattles: 'Batalhas Rastreadas',
    feature1Title: 'Pontuação de Gemas',
    feature1Desc: 'Calcule o valor real em gemas de cada brawler, gadget e skin',
    feature2Title: 'Analytics de Batalhas',
    feature2Desc: 'Analise taxas de vitória, modos e tendências',
    feature3Title: 'Sinergias de Equipe',
    feature3Desc: 'Encontre seus melhores combos de companheiros',
    feature4Title: 'Counter-Picks',
    feature4Desc: 'Saiba exatamente qual brawler vence o inimigo',
    feature5Title: 'Detector de Tilt',
    feature5Desc: 'Saiba quando parar antes de perder troféus',
    feature6Title: 'Jogue Agora',
    feature6Desc: 'Recomendações em tempo real baseadas nos SEUS dados',
    paradeTitle: 'Cada Brawler. Cada Estatística.',
    step1Title: 'Digite sua #TAG',
    step1Desc: 'Encontre no jogo, no seu perfil',
    step2Title: 'Análise instantânea',
    step2Desc: 'Processamos cada brawler, batalha e melhoria',
    step3Title: 'Domine a arena',
    step3Desc: 'Use dados reais para subir troféus',
    premiumTitle: 'Desbloqueie todo o potencial',
    premiumFree: 'Grátis',
    premiumPro: 'Premium',
    premiumFrom: 'A partir de €2,99/mês',
    premiumCTA: 'Ativar Premium',
    premiumFreeF1: 'Calculadora de Gemas',
    premiumFreeF2: 'Estatísticas Básicas',
    premiumFreeF3: 'Visão do Clube',
    premiumProF1: 'Histórico de Batalhas',
    premiumProF2: 'Analytics com IA',
    premiumProF3: 'Counter-Picks',
    premiumProF4: 'Detector de Tilt',
    premiumProF5: 'Sem Anúncios',
    finalTitle: 'Pronto para dominar?',
    finalSubtitle: 'Grátis para sempre. Premium para pros.',
    finalGoogle: 'Entrar com Google',
  },
  de: {
    heroSignIn: 'Oder melde dich mit Google an',
    statsBrawlers: 'Brawler Analysiert',
    statsPlayers: 'Spieler',
    statsBattles: 'Kämpfe Verfolgt',
    feature1Title: 'Edelstein-Score',
    feature1Desc: 'Berechne den Edelstein-Wert jedes Brawlers, Gadgets und Skins',
    feature2Title: 'Kampf-Analytics',
    feature2Desc: 'Analysiere Siegesraten, Modi und Leistungstrends',
    feature3Title: 'Team-Synergien',
    feature3Desc: 'Finde deine besten Teamkameraden-Kombinationen',
    feature4Title: 'Counter-Picks',
    feature4Desc: 'Wisse genau, welcher Brawler den Feind schlägt',
    feature5Title: 'Tilt-Detektor',
    feature5Desc: 'Wisse, wann du aufhören solltest, bevor du Trophäen verlierst',
    feature6Title: 'Jetzt Spielen',
    feature6Desc: 'Echtzeit-Empfehlungen basierend auf DEINEN Daten',
    paradeTitle: 'Jeder Brawler. Jede Statistik.',
    step1Title: 'Gib deinen #TAG ein',
    step1Desc: 'Finde ihn im Spiel unter deinem Profil',
    step2Title: 'Sofort-Analyse',
    step2Desc: 'Wir analysieren jeden Brawler, Kampf und Upgrade',
    step3Title: 'Dominiere die Arena',
    step3Desc: 'Nutze datenbasierte Erkenntnisse für mehr Trophäen',
    premiumTitle: 'Schalte dein volles Potenzial frei',
    premiumFree: 'Kostenlos',
    premiumPro: 'Premium',
    premiumFrom: 'Ab 2,99€/Monat',
    premiumCTA: 'Premium Aktivieren',
    premiumFreeF1: 'Edelstein-Rechner',
    premiumFreeF2: 'Basis-Statistiken',
    premiumFreeF3: 'Club-Ansicht',
    premiumProF1: 'Kampfverlauf',
    premiumProF2: 'KI-Analytics',
    premiumProF3: 'Counter-Picks',
    premiumProF4: 'Tilt-Detektor',
    premiumProF5: 'Keine Werbung',
    finalTitle: 'Bereit zu dominieren?',
    finalSubtitle: 'Für immer kostenlos. Premium für Profis.',
    finalGoogle: 'Mit Google anmelden',
  },
  it: {
    heroSignIn: 'O accedi con Google',
    statsBrawlers: 'Brawler Analizzati',
    statsPlayers: 'Giocatori',
    statsBattles: 'Battaglie Tracciate',
    feature1Title: 'Punteggio Gemme',
    feature1Desc: 'Calcola il valore in gemme di ogni brawler, gadget e skin',
    feature2Title: 'Analytics Battaglie',
    feature2Desc: 'Analizza tassi di vittoria, modalità e tendenze',
    feature3Title: 'Sinergie di Squadra',
    feature3Desc: 'Trova i tuoi migliori combo di compagni di squadra',
    feature4Title: 'Counter-Picks',
    feature4Desc: 'Sappi esattamente quale brawler batte il nemico',
    feature5Title: 'Rilevatore di Tilt',
    feature5Desc: 'Sappi quando fermarti prima di perdere trofei',
    feature6Title: 'Gioca Ora',
    feature6Desc: 'Raccomandazioni in tempo reale basate sui TUOI dati',
    paradeTitle: 'Ogni Brawler. Ogni Statistica.',
    step1Title: 'Inserisci il tuo #TAG',
    step1Desc: 'Trovalo nel gioco sotto il tuo profilo',
    step2Title: 'Analisi istantanea',
    step2Desc: 'Analizziamo ogni brawler, battaglia e potenziamento',
    step3Title: 'Domina l\'arena',
    step3Desc: 'Usa dati reali per salire nei trofei',
    premiumTitle: 'Sblocca tutto il potenziale',
    premiumFree: 'Gratis',
    premiumPro: 'Premium',
    premiumFrom: 'Da €2,99/mese',
    premiumCTA: 'Attiva Premium',
    premiumFreeF1: 'Calcolatrice Gemme',
    premiumFreeF2: 'Statistiche Base',
    premiumFreeF3: 'Vista Club',
    premiumProF1: 'Storico Battaglie',
    premiumProF2: 'Analytics IA',
    premiumProF3: 'Counter-Picks',
    premiumProF4: 'Rilevatore di Tilt',
    premiumProF5: 'Senza Pubblicità',
    finalTitle: 'Pronto a dominare?',
    finalSubtitle: 'Gratis per sempre. Premium per i pro.',
    finalGoogle: 'Accedi con Google',
  },
  ru: {
    heroSignIn: 'Или войдите через Google',
    statsBrawlers: 'Бойцов Проанализировано',
    statsPlayers: 'Игроков',
    statsBattles: 'Битв Отслежено',
    feature1Title: 'Счёт Самоцветов',
    feature1Desc: 'Рассчитайте реальную стоимость в самоцветах каждого бойца, гаджета и скина',
    feature2Title: 'Аналитика Битв',
    feature2Desc: 'Глубокий анализ процента побед, режимов и трендов',
    feature3Title: 'Синергия Команды',
    feature3Desc: 'Найдите лучшие комбинации напарников и бойцов',
    feature4Title: 'Контрпики',
    feature4Desc: 'Точно знайте, какой боец побеждает противника',
    feature5Title: 'Детектор Тильта',
    feature5Desc: 'Знайте, когда остановиться, прежде чем потерять трофеи',
    feature6Title: 'Играть Сейчас',
    feature6Desc: 'Рекомендации в реальном времени на основе ВАШИХ данных',
    paradeTitle: 'Каждый Боец. Каждая Статистика.',
    step1Title: 'Введите ваш #TAG',
    step1Desc: 'Найдите его в игре в вашем профиле',
    step2Title: 'Мгновенный анализ',
    step2Desc: 'Мы анализируем каждого бойца, битву и улучшение',
    step3Title: 'Доминируйте на арене',
    step3Desc: 'Используйте данные для подъёма в трофеях',
    premiumTitle: 'Раскройте весь потенциал',
    premiumFree: 'Бесплатно',
    premiumPro: 'Премиум',
    premiumFrom: 'От €2,99/мес',
    premiumCTA: 'Активировать Премиум',
    premiumFreeF1: 'Калькулятор Самоцветов',
    premiumFreeF2: 'Базовая Статистика',
    premiumFreeF3: 'Обзор Клуба',
    premiumProF1: 'История Битв',
    premiumProF2: 'ИИ Аналитика',
    premiumProF3: 'Контрпики',
    premiumProF4: 'Детектор Тильта',
    premiumProF5: 'Без Рекламы',
    finalTitle: 'Готовы доминировать?',
    finalSubtitle: 'Бесплатно навсегда. Премиум для профи.',
    finalGoogle: 'Войти через Google',
  },
  tr: {
    heroSignIn: 'Veya Google ile giriş yap',
    statsBrawlers: 'Brawler Analiz Edildi',
    statsPlayers: 'Oyuncu',
    statsBattles: 'Savaş Takip Edildi',
    feature1Title: 'Elmas Puanı',
    feature1Desc: 'Her brawler, gadget ve skin\'in gerçek elmas değerini hesapla',
    feature2Title: 'Savaş Analitiği',
    feature2Desc: 'Kazanma oranları, modlar ve performans trendlerini analiz et',
    feature3Title: 'Takım Sinerjileri',
    feature3Desc: 'En iyi takım arkadaşı kombinasyonlarını bul',
    feature4Title: 'Counter-Pick\'ler',
    feature4Desc: 'Hangi brawler\'ın düşmanı yendiğini tam olarak bil',
    feature5Title: 'Tilt Dedektörü',
    feature5Desc: 'Kupa kaybetmeden önce ne zaman durman gerektiğini bil',
    feature6Title: 'Şimdi Oyna',
    feature6Desc: 'SENİN verilerine dayalı gerçek zamanlı öneriler',
    paradeTitle: 'Her Brawler. Her İstatistik.',
    step1Title: '#TAG\'ını Gir',
    step1Desc: 'Oyun içinde profilinde bul',
    step2Title: 'Anlık analiz',
    step2Desc: 'Her brawler, savaş ve yükseltmeyi işliyoruz',
    step3Title: 'Arenaya hükmet',
    step3Desc: 'Kupa çıkmak için veri odaklı bilgiler kullan',
    premiumTitle: 'Tüm potansiyeli aç',
    premiumFree: 'Ücretsiz',
    premiumPro: 'Premium',
    premiumFrom: '€2,99/ay\'dan',
    premiumCTA: 'Premium\'u Etkinleştir',
    premiumFreeF1: 'Elmas Hesaplayıcı',
    premiumFreeF2: 'Temel İstatistikler',
    premiumFreeF3: 'Kulüp Görünümü',
    premiumProF1: 'Savaş Geçmişi',
    premiumProF2: 'Yapay Zeka Analitiği',
    premiumProF3: 'Counter-Pick\'ler',
    premiumProF4: 'Tilt Dedektörü',
    premiumProF5: 'Reklamsız',
    finalTitle: 'Domine etmeye hazır mısın?',
    finalSubtitle: 'Sonsuza kadar ücretsiz. Profesyoneller için Premium.',
    finalGoogle: 'Google ile giriş yap',
  },
  pl: {
    heroSignIn: 'Lub zaloguj się przez Google',
    statsBrawlers: 'Przeanalizowanych Brawlerów',
    statsPlayers: 'Graczy',
    statsBattles: 'Śledzonych Bitew',
    feature1Title: 'Wynik Klejnotów',
    feature1Desc: 'Oblicz wartość w klejnotach każdego brawlera, gadżetu i skina',
    feature2Title: 'Analityka Bitew',
    feature2Desc: 'Głęboka analiza współczynników wygranych, trybów i trendów',
    feature3Title: 'Synergie Zespołu',
    feature3Desc: 'Znajdź najlepsze kombinacje współpracowników',
    feature4Title: 'Counter-Picki',
    feature4Desc: 'Wiedz dokładnie, który brawler pokona wroga',
    feature5Title: 'Detektor Tiltu',
    feature5Desc: 'Wiedz, kiedy przestać, zanim stracisz trofea',
    feature6Title: 'Graj Teraz',
    feature6Desc: 'Rekomendacje w czasie rzeczywistym na podstawie TWOICH danych',
    paradeTitle: 'Każdy Brawler. Każda Statystyka.',
    step1Title: 'Wpisz swój #TAG',
    step1Desc: 'Znajdź go w grze pod swoim profilem',
    step2Title: 'Natychmiastowa analiza',
    step2Desc: 'Analizujemy każdego brawlera, bitwę i ulepszenie',
    step3Title: 'Zdominuj arenę',
    step3Desc: 'Użyj danych, aby zdobywać trofea',
    premiumTitle: 'Odblokuj pełny potencjał',
    premiumFree: 'Darmowe',
    premiumPro: 'Premium',
    premiumFrom: 'Od €2,99/mies.',
    premiumCTA: 'Aktywuj Premium',
    premiumFreeF1: 'Kalkulator Klejnotów',
    premiumFreeF2: 'Podstawowe Statystyki',
    premiumFreeF3: 'Widok Klubu',
    premiumProF1: 'Historia Bitew',
    premiumProF2: 'Analityka AI',
    premiumProF3: 'Counter-Picki',
    premiumProF4: 'Detektor Tiltu',
    premiumProF5: 'Bez Reklam',
    finalTitle: 'Gotowy do dominacji?',
    finalSubtitle: 'Na zawsze za darmo. Premium dla profesjonalistów.',
    finalGoogle: 'Zaloguj się przez Google',
  },
  ar: {
    heroSignIn: 'أو سجّل الدخول بواسطة Google',
    statsBrawlers: 'شخصيات تم تحليلها',
    statsPlayers: 'لاعبون',
    statsBattles: 'معارك تم تتبعها',
    feature1Title: 'نقاط الجواهر',
    feature1Desc: 'احسب القيمة الحقيقية بالجواهر لكل شخصية وأداة وسكن',
    feature2Title: 'تحليلات المعارك',
    feature2Desc: 'تعمّق في معدلات الفوز والأوضاع واتجاهات الأداء',
    feature3Title: 'تآزر الفريق',
    feature3Desc: 'اعثر على أفضل تركيبات زملاء الفريق',
    feature4Title: 'الاختيارات المضادة',
    feature4Desc: 'اعرف بالضبط أي شخصية تهزم العدو',
    feature5Title: 'كاشف الإمالة',
    feature5Desc: 'اعرف متى تتوقف قبل خسارة الكؤوس',
    feature6Title: 'العب الآن',
    feature6Desc: 'توصيات فورية بناءً على بياناتك أنت',
    paradeTitle: 'كل شخصية. كل إحصائية.',
    step1Title: 'أدخل #TAG الخاص بك',
    step1Desc: 'ابحث عنه في اللعبة تحت ملفك الشخصي',
    step2Title: 'تحليل فوري',
    step2Desc: 'نحلل كل شخصية ومعركة وترقية',
    step3Title: 'سيطر على الساحة',
    step3Desc: 'استخدم البيانات لزيادة الكؤوس',
    premiumTitle: 'أطلق العنان لإمكاناتك',
    premiumFree: 'مجاني',
    premiumPro: 'بريميوم',
    premiumFrom: 'من €2.99/شهر',
    premiumCTA: 'تفعيل بريميوم',
    premiumFreeF1: 'حاسبة الجواهر',
    premiumFreeF2: 'إحصائيات أساسية',
    premiumFreeF3: 'عرض النادي',
    premiumProF1: 'سجل المعارك',
    premiumProF2: 'تحليلات ذكاء اصطناعي',
    premiumProF3: 'الاختيارات المضادة',
    premiumProF4: 'كاشف الإمالة',
    premiumProF5: 'بدون إعلانات',
    finalTitle: 'مستعد للسيطرة؟',
    finalSubtitle: 'مجاني للأبد. بريميوم للمحترفين.',
    finalGoogle: 'تسجيل الدخول بواسطة Google',
  },
  ko: {
    heroSignIn: '또는 Google로 로그인',
    statsBrawlers: '분석된 브롤러',
    statsPlayers: '플레이어',
    statsBattles: '추적된 전투',
    feature1Title: '보석 점수',
    feature1Desc: '모든 브롤러, 가젯, 스킨의 실제 보석 가치를 계산합니다',
    feature2Title: '전투 분석',
    feature2Desc: '승률, 모드, 성과 추세를 심층 분석합니다',
    feature3Title: '팀 시너지',
    feature3Desc: '최고의 팀원 조합과 브롤러 페어를 찾습니다',
    feature4Title: '카운터 픽',
    feature4Desc: '어떤 브롤러가 적을 이기는지 정확히 알 수 있습니다',
    feature5Title: '틸트 감지기',
    feature5Desc: '트로피를 잃기 전에 멈출 때를 알 수 있습니다',
    feature6Title: '지금 플레이',
    feature6Desc: '당신의 데이터를 기반으로 한 실시간 추천',
    paradeTitle: '모든 브롤러. 모든 통계.',
    step1Title: '#TAG를 입력하세요',
    step1Desc: '게임 내 프로필에서 찾을 수 있습니다',
    step2Title: '즉시 분석',
    step2Desc: '모든 브롤러, 전투, 업그레이드를 분석합니다',
    step3Title: '아레나를 지배하세요',
    step3Desc: '데이터 기반 인사이트로 트로피를 올리세요',
    premiumTitle: '잠재력을 최대한 발휘하세요',
    premiumFree: '무료',
    premiumPro: '프리미엄',
    premiumFrom: '€2.99/월부터',
    premiumCTA: '프리미엄 활성화',
    premiumFreeF1: '보석 계산기',
    premiumFreeF2: '기본 통계',
    premiumFreeF3: '클럽 보기',
    premiumProF1: '전투 기록',
    premiumProF2: 'AI 분석',
    premiumProF3: '카운터 픽',
    premiumProF4: '틸트 감지기',
    premiumProF5: '광고 없음',
    finalTitle: '지배할 준비가 되셨나요?',
    finalSubtitle: '영원히 무료. 프로를 위한 프리미엄.',
    finalGoogle: 'Google로 로그인',
  },
  ja: {
    heroSignIn: 'またはGoogleでログイン',
    statsBrawlers: '分析されたブロウラー',
    statsPlayers: 'プレイヤー',
    statsBattles: '追跡されたバトル',
    feature1Title: 'ジェムスコア',
    feature1Desc: 'すべてのブロウラー、ガジェット、スキンの実際のジェム価値を計算',
    feature2Title: 'バトル分析',
    feature2Desc: '勝率、モード、パフォーマンストレンドを深く分析',
    feature3Title: 'チームシナジー',
    feature3Desc: '最高のチームメイトの組み合わせを見つけよう',
    feature4Title: 'カウンターピック',
    feature4Desc: 'どのブロウラーが敵に勝つか正確に把握',
    feature5Title: 'ティルト検出器',
    feature5Desc: 'トロフィーを失う前に止めるべきタイミングを把握',
    feature6Title: '今すぐプレイ',
    feature6Desc: 'あなたのデータに基づくリアルタイム推奨',
    paradeTitle: 'すべてのブロウラー。すべての統計。',
    step1Title: '#TAGを入力',
    step1Desc: 'ゲーム内のプロフィールで見つけてください',
    step2Title: '即時分析',
    step2Desc: 'すべてのブロウラー、バトル、アップグレードを分析',
    step3Title: 'アリーナを支配',
    step3Desc: 'データに基づく洞察でトロフィーを上げよう',
    premiumTitle: '全ポテンシャルを解放',
    premiumFree: '無料',
    premiumPro: 'プレミアム',
    premiumFrom: '€2.99/月から',
    premiumCTA: 'プレミアムを有効化',
    premiumFreeF1: 'ジェム計算機',
    premiumFreeF2: '基本統計',
    premiumFreeF3: 'クラブ表示',
    premiumProF1: 'バトル履歴',
    premiumProF2: 'AI分析',
    premiumProF3: 'カウンターピック',
    premiumProF4: 'ティルト検出器',
    premiumProF5: '広告なし',
    finalTitle: '支配する準備はできましたか？',
    finalSubtitle: '永遠に無料。プロのためのプレミアム。',
    finalGoogle: 'Googleでログイン',
  },
  zh: {
    heroSignIn: '或使用Google登录',
    statsBrawlers: '已分析的英雄',
    statsPlayers: '玩家',
    statsBattles: '已追踪的战斗',
    feature1Title: '宝石评分',
    feature1Desc: '计算每个英雄、小工具和皮肤的真实宝石价值',
    feature2Title: '战斗分析',
    feature2Desc: '深入分析胜率、模式和表现趋势',
    feature3Title: '团队协同',
    feature3Desc: '找到最佳的队友组合和英雄搭配',
    feature4Title: '克制选择',
    feature4Desc: '精确知道哪个英雄能击败敌人',
    feature5Title: '倾斜检测器',
    feature5Desc: '在失去奖杯之前知道何时停下',
    feature6Title: '现在游戏',
    feature6Desc: '基于你的数据的实时推荐',
    paradeTitle: '每个英雄。每项统计。',
    step1Title: '输入你的#TAG',
    step1Desc: '在游戏中的个人资料里找到它',
    step2Title: '即时分析',
    step2Desc: '我们分析每个英雄、战斗和升级',
    step3Title: '统治竞技场',
    step3Desc: '利用数据驱动的洞察来提升奖杯',
    premiumTitle: '释放你的全部潜力',
    premiumFree: '免费',
    premiumPro: '高级版',
    premiumFrom: '起价€2.99/月',
    premiumCTA: '激活高级版',
    premiumFreeF1: '宝石计算器',
    premiumFreeF2: '基础统计',
    premiumFreeF3: '俱乐部视图',
    premiumProF1: '战斗历史',
    premiumProF2: 'AI分析',
    premiumProF3: '克制选择',
    premiumProF4: '倾斜检测器',
    premiumProF5: '无广告',
    finalTitle: '准备好统治了吗？',
    finalSubtitle: '永久免费。专业版为职业玩家。',
    finalGoogle: '使用Google登录',
  },
}

const dir = path.join(__dirname, '..', 'messages')
const locales = ['es', 'en', 'fr', 'pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh']

for (const locale of locales) {
  const filePath = path.join(dir, locale + '.json')
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const keys = NEW_KEYS[locale] || NEW_KEYS.en
  content.landing = { ...content.landing, ...keys }
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
}
console.log('Done: landing arena i18n keys added to all 13 locales')
```

- [ ] **Step 2: Run the script**

Run: `node scripts/update-landing-arena-i18n.js`
Expected: "Done: landing arena i18n keys added to all 13 locales"

- [ ] **Step 3: Verify en.json has the new keys**

Run: `node -e "const j=require('./messages/en.json'); console.log(Object.keys(j.landing).length, j.landing.heroSignIn, j.landing.finalTitle)"`
Expected: key count > 10, prints "Or sign in with Google" and "Ready to dominate?"

- [ ] **Step 4: Commit**

```bash
git add scripts/update-landing-arena-i18n.js messages/
git commit -m "feat(i18n): add landing arena edition keys for all 13 locales"
```

---

## Task 2: Add CSS animations for BrawlerParade

**Files:**
- Modify: `src/app/globals.css` (append at end)

- [ ] **Step 1: Add parade keyframes and utility classes to globals.css**

Append these rules at the end of `src/app/globals.css`:

```css
/* Brawler Parade — infinite scroll */
@keyframes parade-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes parade-right {
  0% { transform: translateX(-50%); }
  100% { transform: translateX(0); }
}
.parade-row-left {
  animation: parade-left 40s linear infinite;
}
.parade-row-right {
  animation: parade-right 40s linear infinite;
}
.parade-row-left:hover,
.parade-row-right:hover {
  animation-play-state: paused;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(css): add brawler parade scroll keyframes"
```

---

## Task 3: Create HeroBrawlers component

**Files:**
- Create: `src/components/landing/HeroBrawlers.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { getBrawlerPortraitUrl } from '@/lib/utils'

const LEFT_BRAWLERS = [
  { id: 16000000, name: 'Shelly', top: '15%', left: '2%', size: 100, delay: 0 },
  { id: 16000005, name: 'Spike', top: '45%', left: '8%', size: 90, delay: 0.5 },
  { id: 16000011, name: 'Mortis', top: '72%', left: '3%', size: 95, delay: 1.0 },
]

const RIGHT_BRAWLERS = [
  { id: 16000012, name: 'Crow', top: '12%', right: '2%', size: 100, delay: 0.3 },
  { id: 16000023, name: 'Leon', top: '43%', right: '7%', size: 90, delay: 0.8 },
  { id: 16000010, name: 'El Primo', top: '70%', right: '3%', size: 105, delay: 1.2 },
]

export function HeroBrawlers() {
  return (
    <>
      {/* Left brawlers */}
      {LEFT_BRAWLERS.map((b) => (
        <motion.div
          key={b.id}
          className="absolute hidden lg:block pointer-events-none md:block md:opacity-20 lg:opacity-100"
          style={{ top: b.top, left: b.left }}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: b.delay }}
        >
          <Image
            src={getBrawlerPortraitUrl(b.id)}
            alt={b.name}
            width={b.size}
            height={b.size}
            className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
          />
        </motion.div>
      ))}
      {/* Right brawlers */}
      {RIGHT_BRAWLERS.map((b) => (
        <motion.div
          key={b.id}
          className="absolute hidden lg:block pointer-events-none md:block md:opacity-20 lg:opacity-100"
          style={{ top: b.top, right: 'right' in b ? b.right : undefined }}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: b.delay }}
        >
          <Image
            src={getBrawlerPortraitUrl(b.id)}
            alt={b.name}
            width={b.size}
            height={b.size}
            className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
          />
        </motion.div>
      ))}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/HeroBrawlers.tsx
git commit -m "feat: add HeroBrawlers floating portraits component"
```

---

## Task 4: Create StatsTicker component

**Files:**
- Create: `src/components/landing/StatsTicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useRef, useState, useEffect } from 'react'
import { Swords, Users, Zap } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { useTranslations } from 'next-intl'

export function StatsTicker() {
  const t = useTranslations('landing')
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const stats = [
    { icon: Swords, value: 101, suffix: '+', label: t('statsBrawlers') },
    { icon: Users, value: 10000, suffix: '+', label: t('statsPlayers') },
    { icon: Zap, value: 1000000, suffix: '+', label: t('statsBattles') },
  ]

  return (
    <div ref={ref} className="brawl-card-dark px-6 py-5 max-w-[900px] w-full mx-auto">
      <div className="flex items-center justify-around gap-4 flex-wrap">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 min-w-[140px]">
            <s.icon className="w-7 h-7 text-[var(--color-brawl-gold)] shrink-0" />
            <div>
              <div className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)]">
                {visible ? <AnimatedCounter value={s.value} fromZero duration={2000} /> : '0'}
                {s.suffix}
              </div>
              <div className="text-xs text-slate-300 font-['Inter'] font-medium">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/StatsTicker.tsx
git commit -m "feat: add StatsTicker animated counters component"
```

---

## Task 5: Create FeaturesGrid component

**Files:**
- Create: `src/components/landing/FeaturesGrid.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useTranslations } from 'next-intl'

const FEATURES = [
  { key: '1', emoji: '💎', color: 'var(--color-brawl-gold)' },
  { key: '2', emoji: '📊', color: 'var(--color-brawl-sky)' },
  { key: '3', emoji: '🤝', color: '#4ade80' },
  { key: '4', emoji: '🛡️', color: 'var(--color-brawl-red)' },
  { key: '5', emoji: '📈', color: 'var(--color-brawl-purple)' },
  { key: '6', emoji: '⚡', color: 'var(--color-brawl-gold)' },
] as const

export function FeaturesGrid() {
  const t = useTranslations('landing')

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[900px] w-full mx-auto">
      {FEATURES.map((f) => (
        <div
          key={f.key}
          className="brawl-card-dark p-5 text-center transition-transform hover:scale-[1.03]"
        >
          <div
            className="w-14 h-14 mx-auto mb-3 rounded-xl border-4 border-[var(--color-brawl-dark)] flex items-center justify-center shadow-[0_3px_0_0_rgba(18,26,47,1)]"
            style={{ backgroundColor: f.color + '30' }}
          >
            <span className="text-3xl">{f.emoji}</span>
          </div>
          <h3 className="font-['Lilita_One'] text-base text-white tracking-wide mb-1">
            {t(`feature${f.key}Title`)}
          </h3>
          <p className="text-xs text-slate-400 font-['Inter']">
            {t(`feature${f.key}Desc`)}
          </p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/FeaturesGrid.tsx
git commit -m "feat: add FeaturesGrid 6-card component"
```

---

## Task 6: Create BrawlerParade component

**Files:**
- Create: `src/components/landing/BrawlerParade.tsx`

- [ ] **Step 1: Create the component**

Uses BRAWLER_RARITY_MAP from constants to assign border colors. Renders two rows scrolling in opposite directions. Images are duplicated for seamless loop.

```tsx
'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { getBrawlerPortraitUrl } from '@/lib/utils'
import { BRAWLER_RARITY_MAP } from '@/lib/constants'
import type { BrawlerRarityName } from '@/lib/types'

const RARITY_COLORS: Record<BrawlerRarityName, string> = {
  'Trophy Road': '#9CA3AF',
  'Rare': '#4ADE80',
  'Super Rare': '#3B82F6',
  'Epic': '#A855F7',
  'Mythic': '#EF4444',
  'Legendary': '#FFC91B',
  'Chromatic': '#E879F9',
  'Ultra Legendary': '#FF6B35',
}

const ALL_IDS = Object.keys(BRAWLER_RARITY_MAP).map(Number)
const ROW1_IDS = ALL_IDS.filter((_, i) => i % 2 === 0)
const ROW2_IDS = ALL_IDS.filter((_, i) => i % 2 === 1)

function ParadeRow({ ids, direction }: { ids: number[]; direction: 'left' | 'right' }) {
  const cls = direction === 'left' ? 'parade-row-left' : 'parade-row-right'
  const items = [...ids, ...ids] // duplicate for seamless loop

  return (
    <div className="overflow-hidden">
      <div className={`flex gap-3 w-max ${cls}`}>
        {items.map((id, i) => {
          const rarity = BRAWLER_RARITY_MAP[id] ?? 'Rare'
          const borderColor = RARITY_COLORS[rarity] ?? '#9CA3AF'
          return (
            <div
              key={`${id}-${i}`}
              className="w-16 h-16 shrink-0 rounded-xl overflow-hidden"
              style={{ border: `3px solid ${borderColor}` }}
            >
              <Image
                src={getBrawlerPortraitUrl(id)}
                alt={`Brawler ${id}`}
                width={64}
                height={64}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BrawlerParade() {
  const t = useTranslations('landing')

  return (
    <section className="w-full max-w-[1200px] mx-auto">
      <h2 className="text-4xl font-['Lilita_One'] text-white text-stroke-brawl text-center mb-8">
        {t('paradeTitle')}
      </h2>
      <div className="flex flex-col gap-3">
        <ParadeRow ids={ROW1_IDS} direction="left" />
        <ParadeRow ids={ROW2_IDS} direction="right" />
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/BrawlerParade.tsx
git commit -m "feat: add BrawlerParade auto-scrolling component"
```

---

## Task 7: Create HowItWorks component

**Files:**
- Create: `src/components/landing/HowItWorks.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Search, BarChart3, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'

const STEPS = [
  { num: 1, icon: Search, key: 'step1' },
  { num: 2, icon: BarChart3, key: 'step2' },
  { num: 3, icon: Trophy, key: 'step3' },
] as const

export function HowItWorks() {
  const t = useTranslations('landing')

  return (
    <div className="flex flex-col md:flex-row items-stretch gap-4 max-w-[900px] w-full mx-auto">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex-1 flex flex-col items-center relative">
          <div className="brawl-card p-6 text-center w-full h-full flex flex-col items-center">
            <span className="text-5xl font-['Lilita_One'] text-stroke-brawl text-[var(--color-brawl-gold)] mb-3">
              {s.num}
            </span>
            <s.icon className="w-10 h-10 text-[var(--color-brawl-blue)] mb-3" />
            <h3 className="font-['Lilita_One'] text-lg text-[var(--color-brawl-dark)] mb-1">
              {t(`${s.key}Title`)}
            </h3>
            <p className="text-sm text-slate-600 font-['Inter']">
              {t(`${s.key}Desc`)}
            </p>
          </div>
          {/* Arrow between steps (desktop only) */}
          {i < STEPS.length - 1 && (
            <span className="hidden md:block absolute -right-5 top-1/2 -translate-y-1/2 text-3xl text-[var(--color-brawl-gold)] font-['Lilita_One'] z-10">
              →
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/HowItWorks.tsx
git commit -m "feat: add HowItWorks 3-step component"
```

---

## Task 8: Create PremiumTeaser component

**Files:**
- Create: `src/components/landing/PremiumTeaser.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'

export function PremiumTeaser() {
  const t = useTranslations('landing')
  const [authOpen, setAuthOpen] = useState(false)

  const freeFeatures = [
    t('premiumFreeF1'),
    t('premiumFreeF2'),
    t('premiumFreeF3'),
  ]

  const proFeatures = [
    t('premiumProF1'),
    t('premiumProF2'),
    t('premiumProF3'),
    t('premiumProF4'),
    t('premiumProF5'),
  ]

  return (
    <>
      <div className="brawl-card p-8 max-w-[800px] w-full mx-auto" style={{ borderTop: '4px solid var(--color-brawl-gold)' }}>
        <h2 className="text-3xl md:text-4xl font-['Lilita_One'] text-stroke-brawl text-white text-center mb-8">
          {t('premiumTitle')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free column */}
          <div className="brawl-card-dark p-5 rounded-xl">
            <h3 className="font-['Lilita_One'] text-xl text-center text-white mb-4">
              {t('premiumFree')}
            </h3>
            <ul className="space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300 font-['Inter']">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Premium column */}
          <div className="brawl-card-dark p-5 rounded-xl relative" style={{ border: '2px solid var(--color-brawl-gold)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--color-brawl-gold)] text-[var(--color-brawl-dark)] font-['Lilita_One'] text-xs px-3 py-1 rounded-full">
              {t('premiumFrom')}
            </div>
            <h3 className="font-['Lilita_One'] text-xl text-center text-[var(--color-brawl-gold)] mb-4">
              {t('premiumPro')}
            </h3>
            <ul className="space-y-3">
              {[...freeFeatures, ...proFeatures].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300 font-['Inter']">
                  <Check className="w-4 h-4 text-[var(--color-brawl-gold)] shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => setAuthOpen(true)}
            className="brawl-button px-8 py-3 text-lg"
          >
            {t('premiumCTA')}
          </button>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/PremiumTeaser.tsx
git commit -m "feat: add PremiumTeaser comparison component"
```

---

## Task 9: Create FinalCTA component

**Files:**
- Create: `src/components/landing/FinalCTA.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'

export function FinalCTA() {
  const t = useTranslations('landing')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <div className="brawl-card p-10 max-w-[500px] w-full mx-auto text-center">
        <h2 className="text-4xl font-['Lilita_One'] text-stroke-brawl-brand text-white mb-6">
          {t('finalTitle')}
        </h2>

        <button
          onClick={() => setAuthOpen(true)}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-800 font-semibold rounded-xl hover:bg-gray-100 transition-colors border-4 border-[var(--color-brawl-dark)] shadow-[0_4px_0_0_rgba(18,26,47,1)] mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {t('finalGoogle')}
        </button>

        <p className="text-sm text-slate-500 font-['Inter']">
          {t('finalSubtitle')}
        </p>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/FinalCTA.tsx
git commit -m "feat: add FinalCTA sign-in component"
```

---

## Task 10: Rewrite page.tsx to orchestrate all sections

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 1: Replace page.tsx with full landing layout**

Replace the entire contents of `src/app/[locale]/page.tsx` with:

```tsx
import { useTranslations, useLocale } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'
import { HeroBrawlers } from '@/components/landing/HeroBrawlers'
import { StatsTicker } from '@/components/landing/StatsTicker'
import { FeaturesGrid } from '@/components/landing/FeaturesGrid'
import { BrawlerParade } from '@/components/landing/BrawlerParade'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { PremiumTeaser } from '@/components/landing/PremiumTeaser'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher'
import Link from 'next/link'

export default function LandingPage() {
  const t = useTranslations('landing')
  const locale = useLocale()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Language selector */}
      <div className="absolute top-4 right-4 z-50">
        <LocaleSwitcher />
      </div>

      {/* Section 1: Hero */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
        <HeroBrawlers />

        <div className="text-center brawl-card p-10 max-w-[500px] w-full animate-fade-in relative z-10">
          <div className="mb-6 flex justify-center">
            <div className="w-24 h-24 rounded-full bg-[var(--color-brawl-sky)] border-4 border-[var(--color-brawl-dark)] flex items-center justify-center p-[2px] shadow-[0_6px_0_rgba(18,26,47,1)] overflow-hidden">
              <span className="text-5xl translate-y-1">💎</span>
            </div>
          </div>

          <h1 className="text-5xl leading-[1.1] font-bold font-['Lilita_One'] mb-2 text-stroke-brawl text-white">
            {t('title')}
          </h1>
          <p className="mt-4 text-[var(--color-brawl-dark)] font-['Inter'] font-semibold mb-8 text-lg">
            {t('subtitle')}
          </p>

          <InputForm />

          <p className="mt-4 text-sm text-slate-500">
            <button className="text-[var(--color-brawl-sky)] hover:underline font-['Inter'] font-medium hero-sign-in-btn">
              {t('heroSignIn')} →
            </button>
          </p>
        </div>
      </section>

      {/* Section 2: Stats Ticker */}
      <section className="px-4 -mt-6 relative z-20">
        <StatsTicker />
      </section>

      {/* Section 3: Features Grid */}
      <section className="px-4 py-16">
        <FeaturesGrid />
      </section>

      {/* Section 4: Brawler Parade */}
      <section className="py-16 px-4 overflow-hidden">
        <BrawlerParade />
      </section>

      {/* Section 5: How It Works */}
      <section className="px-4 py-16">
        <HowItWorks />
      </section>

      {/* Section 6: Premium Teaser */}
      <section className="px-4 py-16">
        <PremiumTeaser />
      </section>

      {/* Section 7: Final CTA */}
      <section className="px-4 py-16">
        <FinalCTA />
      </section>

      {/* Footer */}
      <footer className="py-4 px-4">
        <div className="brawl-card-dark px-6 py-3 max-w-[720px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-xs font-['Lilita_One']">
            <Link href={`/${locale}/privacy`} className="text-slate-400 hover:text-[var(--color-brawl-gold)] transition-colors">
              {t('privacyLink')}
            </Link>
            <span className="text-slate-600">·</span>
            <a href="mailto:contact@brawlvision.com" className="text-slate-400 hover:text-[var(--color-brawl-gold)] transition-colors">
              {t('contact')}
            </a>
          </div>
          <p className="text-[10px] text-slate-500 text-center sm:text-right">
            © {new Date().getFullYear()} BrawlVision · {t('disclaimer')}
          </p>
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Wire up the hero sign-in button**

The "Or sign in with Google" text in the hero needs to open AuthModal. Since page.tsx is a server component, the hero sign-in button needs to be a client component. Create a small wrapper:

Update `src/app/[locale]/page.tsx` — replace the `<p className="mt-4 text-sm text-slate-500">` block in the hero with a client component reference. Instead, import and use a new `HeroSignIn` component.

Add to `src/components/landing/HeroBrawlers.tsx` (or create a separate tiny file). Simplest approach: make the hero card area a client component. Since InputForm is already `'use client'`, the cleanest way is to create a small `HeroSignIn.tsx`:

Create `src/components/landing/HeroSignIn.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AuthModal } from '@/components/auth/AuthModal'

export function HeroSignIn() {
  const t = useTranslations('landing')
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <p className="mt-4 text-sm text-slate-500">
        <button
          onClick={() => setAuthOpen(true)}
          className="text-[var(--color-brawl-sky)] hover:underline font-['Inter'] font-medium"
        >
          {t('heroSignIn')} →
        </button>
      </p>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
```

Then in `page.tsx`, replace the hardcoded `<p className="mt-4 text-sm text-slate-500">...` block with:

```tsx
import { HeroSignIn } from '@/components/landing/HeroSignIn'
// ... and in the JSX, after <InputForm />:
<HeroSignIn />
```

Remove the inline `<p>` + `<button>` block that was there before.

- [ ] **Step 3: Verify the build compiles**

Run: `npx next build 2>&1 | head -30`
Expected: no TypeScript or import errors

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/page.tsx src/components/landing/HeroSignIn.tsx
git commit -m "feat: rewrite landing page with 7-section Arena Edition layout"
```

---

## Task 11: Visual verification and polish

**Files:**
- Possibly adjust: any component from Tasks 3-10

- [ ] **Step 1: Start dev server and visually inspect**

Run: `npx next dev`

Open `http://localhost:3000/en` in the browser. Check:
1. Hero section fills viewport, brawlers float on desktop, hidden on mobile
2. Stats ticker shows animated counters when scrolled into view
3. Features grid shows 6 cards in correct layout
4. Brawler parade scrolls smoothly in both directions
5. How It Works shows 3 steps with arrows between on desktop
6. Premium teaser shows Free vs Premium columns
7. Final CTA shows Google sign-in button
8. Footer is correct
9. Mobile responsive — check at 375px width

- [ ] **Step 2: Fix any visual issues found**

Adjust spacing, sizing, or responsive classes as needed based on visual inspection.

- [ ] **Step 3: Test i18n by switching to Spanish**

Navigate to `http://localhost:3000/es` and verify all new text appears in Spanish.

- [ ] **Step 4: Final commit if any polish was needed**

```bash
git add -u
git commit -m "fix: landing page visual polish and responsive adjustments"
```
