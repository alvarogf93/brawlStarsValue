#!/usr/bin/env node
// SEO + AdSense compliance — /methodology page i18n batch.
//
// Adds a top-level `methodology` namespace × 13 locales. The page
// at /[locale]/methodology is the E-E-A-T anchor of the site
// (Experience, Expertise, Authoritativeness, Trustworthiness):
// it explains every analytic the site presents, with the actual
// formulas and update cadences. Required by AdSense reviewers
// (the human ones) to classify the site as a real publisher
// rather than a thin landing.
//
// Idempotent: re-running overwrites existing keys. This file is
// the single source of truth for /methodology copy.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    metaTitle: 'Metodología de BrawlVision — cómo calculamos cada estadística',
    metaDescription: 'Las fórmulas, las fuentes y las cadencias detrás de cada número que ves en BrawlVision: Bayesian Win Rate, Comfort Score, sampling PRO, ventanas temporales y filtros source=global.',
    breadcrumbLabel: 'Metodología',
    homeAriaLabel: 'Ir a la página principal',
    eyebrow: 'Metodología',
    heroTitle: 'Cómo construimos cada estadística que ves',
    heroLead: 'BrawlVision combina la API oficial de Supercell, una capa propia de muestreo de jugadores PRO y varios pasos de smoothing estadístico para mostrarte números que sean estables, comparables y honestos sobre su propia incertidumbre. Esta página describe esos pasos uno por uno, con las fórmulas exactas y las cadencias de actualización.',
    lastUpdated: 'Última actualización: {date}',
    tocTitle: 'En esta página',
    sections: [
      {
        id: 'data-sources',
        title: 'Fuentes de datos',
        paragraphs: [
          'Toda la información que mostramos viene de tres fuentes que mantenemos auditables: la API pública de Supercell (developer.brawlstars.com), la CDN de Brawlify (cdn.brawlify.com) y nuestra propia base de datos en Supabase, que persiste batallas y agregados que la API oficial no expone más allá de las últimas 25 partidas por jugador.',
          'La API de Supercell es la fuente canónica para la información estructural —brawlers, gadgets, star powers, hypercharges, gears y rotación de eventos— pero deja fuera elementos críticos como las imágenes de los brawlers, la rareza y las descripciones largas. Para esos campos cruzamos con la CDN de Brawlify, que opera independientemente y a veces se actualiza con un retraso de uno a tres días respecto a Supercell. Cuando detectamos un brawler nuevo en la API oficial que aún no existe en Brawlify, mantenemos un mapa local de rareza (BRAWLER_RARITY_MAP) para que la página del brawler se sirva igual el día del lanzamiento.',
          'Nuestra base de datos guarda dos clases de filas en la tabla meta_stats: source=user (batallas reales de usuarios premium que activaron sincronización) y source=global (muestreo automático de los rankings de top jugadores PRO). Toda estadística pública que ves en el sitio se calcula filtrando por source=global, para que no se filtre información personal de un usuario individual hacia las páginas públicas.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'Cómo construimos los datos PRO',
        paragraphs: [
          'La capa "PRO" de BrawlVision son agregados calculados sobre las batallas recientes de los mejores jugadores del mundo. Cada seis horas, un cron job (meta-poll) consulta los rankings oficiales de Supercell para once países —los que concentran la actividad competitiva— y construye una pool deduplicada de aproximadamente 2 100 jugadores únicos del top-200 de cada uno.',
          'Sobre esa pool aplicamos un sampler probabilístico para evitar que las combinaciones (mapa, modo) más populares dominen el dataset y enmascaren a las menos frecuentes. La probabilidad de aceptar una batalla individual es p = min(1, (minLive + 1) / (current + 1)), donde minLive es el número actual de batallas registradas en la combinación con menos representación y current es el número en la combinación de la batalla candidata. Las combinaciones poco vistas reciben más peso, y las saturadas dejan de crecer.',
          'El cron itera hasta META_POLL_MAX_DEPTH = 1000 jugadores por ejecución con un presupuesto blando de 270 segundos para no exceder el maxDuration de 300 s de la función serverless. Cada respuesta del endpoint incluye un bloque "adaptive" con métricas de iteraciones, jugadores consultados y conteos por modo, para que cualquier comportamiento anómalo del sampler quede observable en producción.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Bayesian Win Rate',
        paragraphs: [
          'El Win Rate ingenuo (victorias / partidas) es engañoso cuando hay pocas partidas: un brawler con 3-0 en un mapa nuevo tiene "100 % WR" sin que eso signifique nada. BrawlVision usa Bayesian smoothing para corregir esa distorsión y devolver un número que se pueda comparar entre brawlers con muestras muy distintas.',
          'La fórmula es WR_bayesian = (wins + α) / (battles + α + β), donde α y β son hiperparámetros que codifican una creencia previa centrada en 50 % de WR. En la práctica, α = β = 25, lo que equivale a "asumir 50 batallas previas con resultado 50/50 antes de ver datos". Un brawler con 3 wins y 0 losses pasa de 100 % naive a (3 + 25) / (3 + 50) = 52.8 %, que es mucho más representativo del estado real del muestreo.',
          'A medida que la muestra crece, el peso del prior decae: con 1 000 batallas y 530 wins, el WR bayesiano queda en (530 + 25) / (1 000 + 50) = 52.9 %, prácticamente idéntico al naive 53.0 %. El smoothing solo "duele" cuando la muestra es genuinamente pequeña. Esa es exactamente la propiedad deseada: penalizar el ruido, no la señal.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'El Comfort Score es el indicador propio de BrawlVision para responder a la pregunta "¿con qué brawler juegas mejor que con la media?". No es un Win Rate puro: combina tres componentes con pesos 60/30/10 para cubrir distintas dimensiones del rendimiento personal.',
          'El componente principal (60 %) es el WR del jugador con ese brawler, ajustado por Bayesian smoothing igual que el meta global, para que un brawler jugado pocas veces no domine el ranking. El componente intermedio (30 %) es la diferencia entre ese WR personal y el WR meta del brawler en general: un jugador con 55 % en SHELLY cuando el meta global está en 48 % gana más comfort que uno que tiene 55 % en un brawler con 53 % de meta, porque la mejora relativa es mayor.',
          'El componente final (10 %) es la frecuencia de uso normalizada: a igualdad del resto, jugar un brawler 100 veces vale más que jugarlo 10, porque la consistencia se valora. Las fórmulas exactas y los pesos viven en src/lib/analytics/compute.ts y se aplican igual en cada llamada al endpoint, para que el ranking sea reproducible.',
        ],
      },
      {
        id: 'weekly-trends',
        title: 'Tendencias 7 días',
        paragraphs: [
          'Cada brawler público tiene un indicador de tendencia "+X.Y%" o "−X.Y%" que mide cómo ha cambiado su WR meta en los últimos 7 días respecto a los 7 anteriores (una ventana de 14 días en total). El cálculo se hace sobre source=global, con un mínimo de MIN_BATTLES_PER_TREND_WINDOW = 3 batallas en cada mitad de la ventana —si una de las dos mitades no llega al umbral, devolvemos null y la UI no muestra flecha, en lugar de inventar un número con poca señal.',
          'La tendencia se precomputa cada seis horas en una tabla pequeña (public.brawler_trends, una fila por brawler) mediante un job pg_cron. Hacerlo en la base de datos —y no en la respuesta del endpoint— evita escanear las decenas de miles de filas del slice de 14 días en cada ISR refresh. Si la tabla precomputada lleva más de 12 horas sin actualizarse o si está vacía, el endpoint cae en una ruta inline paginada sobre meta_stats que da la misma respuesta a costa de ser más lenta. La paginación es necesaria porque PostgREST trunca silenciosamente las queries no paginadas a 1 000 filas, lo que en su día provocó que la mayoría de brawlers retornaran null por falsa insuficiencia de muestra.',
          'La lógica vive duplicada por diseño: una versión TypeScript en src/lib/brawler-detail/trend.ts (ruta de detalle) y una versión SQL en supabase/migrations/022_*.sql (ruta bulk). Ambas usan el mismo umbral, la misma ventana y el mismo filtro source=global. Si en algún momento divergen, la página individual del brawler y la página agregada darían números distintos para el mismo brawler, así que cualquier cambio se aplica en las dos.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Frecuencia de actualización',
        paragraphs: [
          'La cadencia con la que se refresca cada dato influye en cómo lo interpretas, así que la documentamos explícitamente. Las paginas estáticas (incluida esta) usan ISR (Incremental Static Regeneration) con revalidación cada 24 horas. Las páginas con datos dinámicos cachean la respuesta del API hasta que el job correspondiente la invalida.',
          'Los brawlers, gadgets y star powers se sincronizan desde la API de Supercell con un cache de servidor de 24 horas. El meta-poll (datos PRO) ejecuta cada 6 horas y produce filas frescas en meta_stats. La precomputación de tendencias 7d corre en pg_cron a "17 */6 * * *" (los minutos 17 de cada sexta hora) para no chocar con el meta-poll. La rotación de eventos del juego se refresca cada 30 minutos.',
          'Las batallas individuales de usuarios premium que activan sincronización se descargan inmediatamente después de cada partida en una ventana móvil, gracias al cron de sync. Una vez en nuestra base, contribuyen a meta_stats con source=user y son la base de los análisis privados de la sección de perfil; nunca aparecen en agregados públicos ni se mezclan con source=global.',
        ],
      },
    ],
    faqTitle: 'Preguntas frecuentes',
    faq: [
      {
        q: '¿Por qué el WR de un brawler con poca muestra no es 0 % o 100 %?',
        a: 'Porque aplicamos Bayesian smoothing con un prior centrado en 50 %. Con muy pocas partidas el número que se muestra está cerca del 50 %; a medida que la muestra crece, se acerca al WR real. Es deliberado: 100 % con 3 partidas no es información, es ruido.',
      },
      {
        q: '¿Las páginas públicas usan datos de usuarios reales?',
        a: 'No. Cada agregado público filtra por source=global, que solo contiene batallas tomadas del muestreo automático de top jugadores. Las batallas privadas de usuarios premium se guardan con source=user y nunca cruzan a las páginas públicas.',
      },
      {
        q: '¿Qué pasa cuando Supercell publica un brawler nuevo?',
        a: 'La rotación de brawlers viene de la API oficial, así que la lista completa aparece en el sitio el mismo día del lanzamiento. La rareza y la imagen vienen de Brawlify, que puede tardar uno a tres días en actualizarse; mantenemos un mapa local de rareza (BRAWLER_RARITY_MAP) como fallback para esos primeros días.',
      },
      {
        q: '¿Por qué algunas tendencias muestran una raya en lugar de un porcentaje?',
        a: 'Mostramos la tendencia solo si cada mitad de la ventana de 14 días tiene al menos 3 batallas en source=global. Cuando un brawler está poco visto, preferimos no mostrar nada antes que un número con baja señal.',
      },
      {
        q: '¿El sitio usa IA para generar las descripciones?',
        a: 'Las descripciones se generan dinámicamente a partir de nuestros propios datos (mejor mapa, mejor modo, WR bayesiano por brawler). No copiamos texto de Brawlify ni del wiki, y no usamos modelos de lenguaje para inflar el contenido.',
      },
    ],
    contactTitle: '¿Preguntas o correcciones?',
    contactBody: 'Si encuentras un error metodológico o quieres sugerir una mejora, contáctanos. Mantenemos esta página al día con cada cambio relevante en cómo calculamos los datos.',
    aboutLink: 'Sobre BrawlVision',
    privacyLink: 'Política de privacidad',
  },

  en: {
    metaTitle: 'BrawlVision Methodology — How Every Stat Is Computed',
    metaDescription: 'The formulas, sources and update cadences behind every number you see on BrawlVision: Bayesian Win Rate, Comfort Score, PRO sampling, time windows and source=global filters.',
    breadcrumbLabel: 'Methodology',
    homeAriaLabel: 'Go to the home page',
    eyebrow: 'Methodology',
    heroTitle: 'How we build every stat you see',
    heroLead: 'BrawlVision combines Supercell\'s official API, our own PRO-player sampling layer and several statistical smoothing steps to give you numbers that are stable, comparable, and honest about their own uncertainty. This page documents each of those steps, with the exact formulas and update cadences.',
    lastUpdated: 'Last updated: {date}',
    tocTitle: 'On this page',
    sections: [
      {
        id: 'data-sources',
        title: 'Data sources',
        paragraphs: [
          'Everything we display comes from three sources we keep auditable: Supercell\'s public API (developer.brawlstars.com), the Brawlify CDN (cdn.brawlify.com), and our own Supabase database, which persists battles and aggregates that the official API doesn\'t expose past the last 25 matches per player.',
          'Supercell\'s API is the canonical source for structural data — brawlers, gadgets, star powers, hypercharges, gears and event rotation — but it leaves out critical fields like brawler images, rarity, and long descriptions. We cross-reference those with the Brawlify CDN, which operates independently and sometimes lags Supercell by one to three days. When we detect a new brawler on the official API that doesn\'t exist on Brawlify yet, we keep a local rarity map (BRAWLER_RARITY_MAP) so the brawler\'s page renders correctly on launch day.',
          'Our database stores two classes of rows in the meta_stats table: source=user (real battles from premium users who enabled sync) and source=global (automated sampling from the top PRO leaderboards). Every public statistic on the site is computed filtering by source=global, so personal data from any single user never leaks into public pages.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'How we build the PRO data',
        paragraphs: [
          'The "PRO" layer of BrawlVision is a set of aggregates computed over recent battles from the world\'s top players. Every six hours a cron job (meta-poll) queries Supercell\'s official rankings for eleven countries — the ones that concentrate competitive activity — and builds a deduplicated pool of roughly 2,100 unique players from each top 200.',
          'Over that pool we apply a probabilistic sampler to keep popular (map, mode) combinations from dominating the dataset and masking the rare ones. The probability of accepting an individual battle is p = min(1, (minLive + 1) / (current + 1)), where minLive is the count for the least-represented combination and current is the count for the candidate battle\'s combination. Under-sampled combinations get higher acceptance; saturated ones stop growing.',
          'The cron iterates up to META_POLL_MAX_DEPTH = 1,000 players per run with a soft 270-second budget so it stays inside the serverless function\'s 300-second maxDuration. Each response includes an "adaptive" diagnostic block with iteration counts, players sampled, and per-mode counts, so any anomalous sampler behavior is observable in production.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Bayesian Win Rate',
        paragraphs: [
          'Naive Win Rate (wins / matches) is misleading on small samples: a brawler going 3-0 on a new map shows "100 % WR" without that meaning anything. BrawlVision uses Bayesian smoothing to correct that and return a number that is comparable across brawlers with very different sample sizes.',
          'The formula is WR_bayesian = (wins + α) / (battles + α + β), where α and β are hyperparameters encoding a 50 %-WR prior. In practice α = β = 25, equivalent to "assume 50 prior battles split 50/50 before seeing real data". A brawler with 3 wins and 0 losses goes from naive 100 % to (3 + 25) / (3 + 50) = 52.8 %, much more representative of the actual sampling state.',
          'As the sample grows, the prior\'s weight decays: with 1,000 battles and 530 wins, the Bayesian WR sits at (530 + 25) / (1,000 + 50) = 52.9 %, essentially identical to the naive 53.0 %. Smoothing only "hurts" when the sample is genuinely small. That is exactly the desired property: penalize noise, not signal.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score is BrawlVision\'s in-house metric answering the question "which brawler are you actually better with than with average?". It is not a raw Win Rate: it combines three components with weights 60/30/10 to cover different dimensions of personal performance.',
          'The main component (60 %) is the player\'s WR with that brawler, Bayesian-smoothed exactly like the global meta, so a rarely-played brawler doesn\'t game the ranking. The middle component (30 %) is the difference between that personal WR and the brawler\'s overall meta WR: a player at 55 % on SHELLY when the global meta sits at 48 % earns more comfort than someone at 55 % on a brawler whose meta is 53 %, because the relative lift is bigger.',
          'The final component (10 %) is normalized usage frequency: all else equal, playing a brawler 100 times counts more than playing it 10, because consistency is rewarded. The exact formulas and weights live in src/lib/analytics/compute.ts and apply identically on every endpoint call, so the ranking is reproducible.',
        ],
      },
      {
        id: 'weekly-trends',
        title: '7-day trends',
        paragraphs: [
          'Every public brawler has a "+X.Y%" or "−X.Y%" trend indicator showing how its meta WR has changed in the last 7 days versus the previous 7 (a 14-day window total). The computation runs on source=global with a minimum of MIN_BATTLES_PER_TREND_WINDOW = 3 battles in each half of the window — if either half is below the threshold, we return null and the UI hides the arrow rather than fabricating a low-signal number.',
          'The trend is precomputed every six hours in a small table (public.brawler_trends, one row per brawler) by a pg_cron job. Doing it in the database — instead of in the endpoint response — avoids scanning tens of thousands of rows in the 14-day slice on every ISR refresh. If the precomputed table is more than 12 hours old or empty, the endpoint falls through to a paginated inline route over meta_stats that returns the same answer at a higher cost. Pagination is required because PostgREST silently truncates non-paginated queries to 1,000 rows, which once caused most brawlers to return null due to fake undersampling.',
          'The logic lives duplicated by design: a TypeScript version in src/lib/brawler-detail/trend.ts (detail route) and a SQL version in supabase/migrations/022_*.sql (bulk route). Both use the same threshold, the same window and the same source=global filter. If they ever diverge, the per-brawler detail page and the aggregate page would show different numbers for the same brawler, so any change is applied in both.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Update cadence',
        paragraphs: [
          'How often a piece of data refreshes affects how you should interpret it, so we document it explicitly. Static pages (this one included) use ISR (Incremental Static Regeneration) with a 24-hour revalidation. Pages with dynamic data cache the API response until the relevant job invalidates it.',
          'Brawlers, gadgets and star powers sync from the Supercell API with a 24-hour server cache. The meta-poll (PRO data) runs every 6 hours and produces fresh meta_stats rows. The 7-day trend precomputation runs in pg_cron at "17 */6 * * *" (minute 17 of every sixth hour) to avoid colliding with the meta-poll. The in-game event rotation refreshes every 30 minutes.',
          'Individual battles from premium users who enabled sync are downloaded right after each match in a moving window via the sync cron. Once in our database they feed meta_stats with source=user and are the basis for private analytics in the profile section; they never appear in public aggregates and never mix with source=global.',
        ],
      },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      {
        q: 'Why isn\'t a brawler\'s WR 0 % or 100 % on small samples?',
        a: 'Because we apply Bayesian smoothing with a 50 %-centered prior. With very few matches the displayed number sits close to 50 %; as the sample grows, it converges to the real WR. This is deliberate: 100 % on 3 matches is not information, it is noise.',
      },
      {
        q: 'Do public pages use data from real users?',
        a: 'No. Every public aggregate filters by source=global, which only holds battles taken from automated PRO-leaderboard sampling. Private battles from premium users are stored with source=user and never cross into public pages.',
      },
      {
        q: 'What happens when Supercell ships a new brawler?',
        a: 'The brawler list comes from the official API, so the full roster appears on the site the same day as the launch. Rarity and images come from Brawlify, which can lag by one to three days; we keep a local rarity map (BRAWLER_RARITY_MAP) as fallback for those first days.',
      },
      {
        q: 'Why do some trends show a dash instead of a percentage?',
        a: 'We only show the trend if each half of the 14-day window has at least 3 battles in source=global. When a brawler is rarely seen, we prefer to show nothing rather than a low-signal number.',
      },
      {
        q: 'Does the site use AI to generate descriptions?',
        a: 'Descriptions are generated dynamically from our own data (best map, best mode, Bayesian WR per brawler). We do not copy text from Brawlify or the wiki, and we do not use language models to inflate content.',
      },
    ],
    contactTitle: 'Questions or corrections?',
    contactBody: 'If you spot a methodological error or want to suggest an improvement, get in touch. We keep this page in sync with every relevant change to how we compute the data.',
    aboutLink: 'About BrawlVision',
    privacyLink: 'Privacy policy',
  },

  fr: {
    metaTitle: 'Méthodologie BrawlVision — comment chaque stat est calculée',
    metaDescription: 'Les formules, les sources et les cadences derrière chaque chiffre sur BrawlVision : Win Rate bayésien, Comfort Score, sampling PRO, fenêtres temporelles et filtres source=global.',
    breadcrumbLabel: 'Méthodologie',
    homeAriaLabel: 'Aller à la page d\'accueil',
    eyebrow: 'Méthodologie',
    heroTitle: 'Comment nous construisons chaque statistique',
    heroLead: 'BrawlVision combine l\'API officielle de Supercell, notre propre couche d\'échantillonnage de joueurs PRO et plusieurs étapes de lissage statistique pour te fournir des chiffres stables, comparables, et honnêtes sur leur propre incertitude. Cette page décrit chacune de ces étapes, avec les formules exactes et les fréquences de mise à jour.',
    lastUpdated: 'Dernière mise à jour : {date}',
    tocTitle: 'Sur cette page',
    sections: [
      {
        id: 'data-sources',
        title: 'Sources de données',
        paragraphs: [
          'Tout ce que nous affichons vient de trois sources que nous gardons auditables : l\'API publique de Supercell (developer.brawlstars.com), le CDN Brawlify (cdn.brawlify.com), et notre propre base Supabase, qui persiste les combats et agrégats que l\'API officielle ne révèle pas au-delà des 25 derniers matchs par joueur.',
          'L\'API Supercell est la source canonique pour les données structurelles — brawlers, gadgets, star powers, hypercharges, gears et rotation des événements — mais elle laisse de côté des champs critiques comme les images, la rareté et les descriptions longues. Nous croisons ces champs avec le CDN Brawlify, qui fonctionne indépendamment et accuse parfois un retard d\'un à trois jours sur Supercell. Quand un brawler nouveau apparaît sur l\'API officielle sans encore exister chez Brawlify, nous gardons une carte locale de rareté (BRAWLER_RARITY_MAP) pour que sa page s\'affiche correctement le jour du lancement.',
          'Notre base stocke deux classes de lignes dans la table meta_stats : source=user (combats réels d\'utilisateurs premium ayant activé la sync) et source=global (échantillonnage automatique des classements PRO). Toute statistique publique sur le site est calculée en filtrant par source=global, pour qu\'aucune donnée personnelle d\'un utilisateur ne fuite vers les pages publiques.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'Comment nous construisons les données PRO',
        paragraphs: [
          'La couche « PRO » de BrawlVision est un ensemble d\'agrégats calculés sur les combats récents des meilleurs joueurs du monde. Toutes les six heures, un cron (meta-poll) interroge les classements officiels de Supercell pour onze pays — ceux qui concentrent l\'activité compétitive — et construit une pool dédoublonnée d\'environ 2 100 joueurs uniques tirés de chaque top 200.',
          'Sur cette pool nous appliquons un sampler probabiliste pour empêcher que les combinaisons (carte, mode) populaires écrasent le dataset et masquent les plus rares. La probabilité d\'accepter un combat individuel est p = min(1, (minLive + 1) / (current + 1)), où minLive est le nombre de la combinaison la moins représentée et current celui de la combinaison du combat candidat. Les combinaisons sous-échantillonnées reçoivent plus de poids, les saturées arrêtent de croître.',
          'Le cron itère jusqu\'à META_POLL_MAX_DEPTH = 1 000 joueurs par exécution avec un budget souple de 270 secondes pour rester sous le maxDuration de 300 s de la fonction serverless. Chaque réponse inclut un bloc « adaptive » avec compteurs d\'itérations, joueurs interrogés et nombres par mode, pour que tout comportement anormal du sampler reste observable en production.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Win Rate bayésien',
        paragraphs: [
          'Le Win Rate naïf (victoires / matchs) trompe sur les petits échantillons : un brawler à 3-0 sur une nouvelle carte affiche « 100 % WR » sans que cela signifie rien. BrawlVision utilise un lissage bayésien pour corriger cela et renvoyer un nombre comparable entre brawlers ayant des tailles d\'échantillon très différentes.',
          'La formule est WR_bayésien = (wins + α) / (battles + α + β), où α et β sont des hyperparamètres encodant une croyance préalable centrée sur 50 % de WR. En pratique α = β = 25, équivalent à « supposer 50 combats préalables 50/50 avant de voir les vraies données ». Un brawler à 3 wins et 0 losses passe de 100 % naïf à (3 + 25) / (3 + 50) = 52,8 %, beaucoup plus représentatif de l\'état réel de l\'échantillon.',
          'À mesure que l\'échantillon grandit, le poids du prior décroît : avec 1 000 combats et 530 wins, le WR bayésien est à (530 + 25) / (1 000 + 50) = 52,9 %, quasi identique au naïf 53,0 %. Le lissage ne « pénalise » que lorsque l\'échantillon est réellement petit. C\'est exactement la propriété voulue : pénaliser le bruit, pas le signal.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Le Comfort Score est la métrique maison de BrawlVision pour répondre à la question « avec quel brawler joues-tu vraiment mieux que la moyenne ? ». Ce n\'est pas un Win Rate brut : il combine trois composantes avec des poids 60/30/10 pour couvrir différentes dimensions de la performance personnelle.',
          'La composante principale (60 %) est le WR du joueur avec ce brawler, lissé bayésiennement comme le meta global, pour qu\'un brawler joué peu de fois ne fausse pas le classement. La composante intermédiaire (30 %) est l\'écart entre ce WR personnel et le WR meta du brawler en général : un joueur à 55 % sur SHELLY quand le meta global est à 48 % gagne plus de comfort qu\'un joueur à 55 % sur un brawler dont le meta est 53 %, parce que la progression relative est plus grande.',
          'La composante finale (10 %) est la fréquence d\'usage normalisée : à conditions égales, jouer un brawler 100 fois compte plus que 10, parce que la régularité est récompensée. Les formules exactes et les poids vivent dans src/lib/analytics/compute.ts et s\'appliquent identiquement à chaque appel d\'endpoint, pour que le classement reste reproductible.',
        ],
      },
      {
        id: 'weekly-trends',
        title: 'Tendances 7 jours',
        paragraphs: [
          'Chaque brawler public porte un indicateur de tendance « +X,Y% » ou « −X,Y% » qui mesure comment son WR meta a changé sur les 7 derniers jours par rapport aux 7 précédents (fenêtre totale de 14 jours). Le calcul tourne sur source=global avec un minimum de MIN_BATTLES_PER_TREND_WINDOW = 3 combats dans chaque moitié de la fenêtre — si l\'une des deux moitiés n\'atteint pas le seuil, nous renvoyons null et l\'UI cache la flèche au lieu d\'inventer un nombre à faible signal.',
          'La tendance est précalculée toutes les six heures dans une petite table (public.brawler_trends, une ligne par brawler) via un job pg_cron. Le faire dans la base — plutôt que dans la réponse de l\'endpoint — évite de scanner des dizaines de milliers de lignes de la fenêtre de 14 jours à chaque rafraîchissement ISR. Si la table précalculée a plus de 12 heures ou est vide, l\'endpoint bascule vers une route inline paginée sur meta_stats qui renvoie la même réponse à un coût plus élevé. La pagination est requise parce que PostgREST tronque silencieusement les requêtes non paginées à 1 000 lignes, ce qui avait fait retourner null à la majorité des brawlers pour fausse insuffisance d\'échantillon.',
          'La logique vit dupliquée par design : une version TypeScript dans src/lib/brawler-detail/trend.ts (route détail) et une version SQL dans supabase/migrations/022_*.sql (route bulk). Les deux utilisent le même seuil, la même fenêtre et le même filtre source=global. Si elles divergent un jour, la page individuelle d\'un brawler et la page agrégée afficheraient des nombres différents pour le même brawler, donc tout changement est appliqué aux deux.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Cadence de mise à jour',
        paragraphs: [
          'La fréquence à laquelle une donnée est rafraîchie influence comment la lire, alors nous la documentons explicitement. Les pages statiques (celle-ci comprise) utilisent ISR (Incremental Static Regeneration) avec une revalidation de 24 heures. Les pages avec données dynamiques mettent en cache la réponse de l\'API jusqu\'à ce que le job pertinent l\'invalide.',
          'Brawlers, gadgets et star powers se synchronisent depuis l\'API Supercell avec un cache serveur de 24 heures. Le meta-poll (données PRO) tourne toutes les 6 heures et produit des lignes meta_stats fraîches. La précalcul des tendances 7 jours tourne en pg_cron à « 17 */6 * * * » (minute 17 de toutes les six heures) pour ne pas entrer en conflit avec le meta-poll. La rotation in-game des événements se rafraîchit toutes les 30 minutes.',
          'Les combats individuels d\'utilisateurs premium ayant activé la sync sont téléchargés juste après chaque match dans une fenêtre glissante via le cron de sync. Une fois en base, ils alimentent meta_stats avec source=user et servent aux analyses privées de la section profil ; ils n\'apparaissent jamais dans des agrégats publics et ne se mélangent jamais à source=global.',
        ],
      },
    ],
    faqTitle: 'Questions fréquentes',
    faq: [
      {
        q: 'Pourquoi le WR d\'un brawler peu joué n\'est pas 0 % ou 100 % ?',
        a: 'Parce que nous appliquons un lissage bayésien avec un prior centré sur 50 %. Avec très peu de matchs, le nombre affiché est proche de 50 % ; à mesure que l\'échantillon grandit, il converge vers le vrai WR. C\'est délibéré : 100 % sur 3 matchs n\'est pas une information, c\'est du bruit.',
      },
      {
        q: 'Les pages publiques utilisent-elles des données d\'utilisateurs réels ?',
        a: 'Non. Chaque agrégat public filtre par source=global, qui ne contient que des combats issus de l\'échantillonnage automatique des classements PRO. Les combats privés d\'utilisateurs premium sont stockés avec source=user et ne traversent jamais vers les pages publiques.',
      },
      {
        q: 'Que se passe-t-il quand Supercell sort un nouveau brawler ?',
        a: 'La liste des brawlers vient de l\'API officielle, donc le roster complet apparaît sur le site le jour même du lancement. La rareté et les images viennent de Brawlify, qui peut accuser un à trois jours de retard ; nous gardons une carte locale de rareté (BRAWLER_RARITY_MAP) en fallback pour ces premiers jours.',
      },
      {
        q: 'Pourquoi certaines tendances montrent un tiret au lieu d\'un pourcentage ?',
        a: 'Nous n\'affichons la tendance que si chaque moitié de la fenêtre 14 jours a au moins 3 combats en source=global. Quand un brawler est peu vu, nous préférons ne rien montrer plutôt qu\'un chiffre à faible signal.',
      },
      {
        q: 'Le site utilise-t-il l\'IA pour générer les descriptions ?',
        a: 'Les descriptions sont générées dynamiquement à partir de nos propres données (meilleure carte, meilleur mode, WR bayésien par brawler). Nous ne copions pas de texte de Brawlify ni du wiki, et nous n\'utilisons pas de modèles de langage pour gonfler le contenu.',
      },
    ],
    contactTitle: 'Questions ou corrections ?',
    contactBody: 'Si tu repères une erreur méthodologique ou veux suggérer une amélioration, écris-nous. Nous gardons cette page synchronisée avec chaque changement pertinent dans la façon de calculer les données.',
    aboutLink: 'À propos de BrawlVision',
    privacyLink: 'Politique de confidentialité',
  },

  pt: {
    metaTitle: 'Metodologia BrawlVision — como cada estatística é calculada',
    metaDescription: 'As fórmulas, fontes e cadências por trás de cada número no BrawlVision: Win Rate bayesiano, Comfort Score, amostragem PRO, janelas temporais e filtros source=global.',
    breadcrumbLabel: 'Metodologia',
    homeAriaLabel: 'Ir para a página inicial',
    eyebrow: 'Metodologia',
    heroTitle: 'Como construímos cada estatística',
    heroLead: 'O BrawlVision combina a API oficial da Supercell, nossa própria camada de amostragem de jogadores PRO e várias etapas de smoothing estatístico para entregar números estáveis, comparáveis e honestos sobre a própria incerteza. Esta página descreve cada uma dessas etapas, com as fórmulas exatas e as cadências de atualização.',
    lastUpdated: 'Última atualização: {date}',
    tocTitle: 'Nesta página',
    sections: [
      {
        id: 'data-sources',
        title: 'Fontes de dados',
        paragraphs: [
          'Tudo que mostramos vem de três fontes que mantemos auditáveis: a API pública da Supercell (developer.brawlstars.com), a CDN do Brawlify (cdn.brawlify.com) e nosso próprio banco no Supabase, que persiste batalhas e agregados que a API oficial não expõe além das últimas 25 partidas por jogador.',
          'A API da Supercell é a fonte canônica para dados estruturais — brawlers, gadgets, star powers, hypercharges, gears e rotação de eventos — mas deixa de fora campos críticos como imagens, raridade e descrições longas. Cruzamos esses campos com a CDN do Brawlify, que opera independentemente e às vezes atrasa de um a três dias em relação à Supercell. Quando detectamos um brawler novo na API oficial que ainda não existe no Brawlify, mantemos um mapa local de raridade (BRAWLER_RARITY_MAP) para que a página do brawler renderize certo no dia do lançamento.',
          'Nosso banco guarda duas classes de linhas em meta_stats: source=user (batalhas reais de usuários premium que ativaram sync) e source=global (amostragem automática dos rankings PRO). Toda estatística pública do site é calculada filtrando por source=global, para que dados pessoais de qualquer usuário não vazem para páginas públicas.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'Como construímos os dados PRO',
        paragraphs: [
          'A camada "PRO" do BrawlVision é um conjunto de agregados calculados sobre batalhas recentes dos melhores jogadores do mundo. A cada seis horas, um cron job (meta-poll) consulta os rankings oficiais da Supercell para onze países — os que concentram atividade competitiva — e constrói uma pool deduplicada de aproximadamente 2.100 jogadores únicos do top 200 de cada um.',
          'Sobre essa pool aplicamos um sampler probabilístico para impedir que combinações (mapa, modo) populares dominem o dataset e mascarem as raras. A probabilidade de aceitar uma batalha individual é p = min(1, (minLive + 1) / (current + 1)), onde minLive é a contagem da combinação menos representada e current a da combinação da batalha candidata. Combinações sub-amostradas recebem mais peso; as saturadas param de crescer.',
          'O cron itera até META_POLL_MAX_DEPTH = 1.000 jogadores por execução com orçamento flexível de 270 segundos para ficar dentro do maxDuration de 300 s da função serverless. Cada resposta inclui um bloco "adaptive" com contagens de iterações, jogadores consultados e contagens por modo, para que qualquer comportamento anormal do sampler fique observável em produção.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Win Rate bayesiano',
        paragraphs: [
          'Win Rate ingênuo (vitórias / partidas) engana em amostras pequenas: um brawler 3-0 num mapa novo mostra "100 % WR" sem que isso signifique nada. O BrawlVision usa smoothing bayesiano para corrigir e devolver um número comparável entre brawlers com tamanhos de amostra muito diferentes.',
          'A fórmula é WR_bayesiano = (wins + α) / (battles + α + β), onde α e β são hiperparâmetros que codificam uma crença prévia centrada em 50 % de WR. Na prática α = β = 25, equivalente a "assumir 50 batalhas prévias 50/50 antes de ver os dados reais". Um brawler com 3 wins e 0 losses sai de 100 % ingênuo para (3 + 25) / (3 + 50) = 52,8 %, muito mais representativo do estado real da amostragem.',
          'À medida que a amostra cresce, o peso do prior decai: com 1.000 batalhas e 530 wins, o WR bayesiano fica em (530 + 25) / (1.000 + 50) = 52,9 %, quase idêntico ao ingênuo 53,0 %. O smoothing só "dói" quando a amostra é genuinamente pequena. É exatamente a propriedade desejada: penalizar ruído, não sinal.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'O Comfort Score é a métrica própria do BrawlVision para responder "com qual brawler você joga melhor que a média?". Não é um Win Rate puro: combina três componentes com pesos 60/30/10 cobrindo dimensões diferentes do desempenho pessoal.',
          'O componente principal (60 %) é o WR do jogador com aquele brawler, com smoothing bayesiano como o meta global, para que um brawler pouco jogado não dominhe o ranking. O componente intermediário (30 %) é a diferença entre esse WR pessoal e o WR meta do brawler no geral: um jogador com 55 % em SHELLY quando o meta global está em 48 % ganha mais comfort que outro com 55 % num brawler com meta 53 %, porque o ganho relativo é maior.',
          'O componente final (10 %) é a frequência de uso normalizada: tudo igual, jogar um brawler 100 vezes vale mais que 10, porque consistência é recompensada. As fórmulas exatas e os pesos vivem em src/lib/analytics/compute.ts e se aplicam idênticos em cada chamada de endpoint, para que o ranking seja reproduzível.',
        ],
      },
      {
        id: 'weekly-trends',
        title: 'Tendências de 7 dias',
        paragraphs: [
          'Cada brawler público tem um indicador de tendência "+X,Y%" ou "−X,Y%" que mede como o WR meta mudou nos últimos 7 dias em comparação aos 7 anteriores (janela total de 14 dias). O cálculo roda em source=global com mínimo de MIN_BATTLES_PER_TREND_WINDOW = 3 batalhas em cada metade da janela — se uma das metades não atingir o limite, retornamos null e a UI esconde a seta em vez de inventar um número de baixo sinal.',
          'A tendência é pré-calculada a cada seis horas numa tabela pequena (public.brawler_trends, uma linha por brawler) por um job pg_cron. Fazer isso no banco — em vez da resposta do endpoint — evita escanear dezenas de milhares de linhas da janela de 14 dias a cada refresh ISR. Se a tabela pré-calculada tiver mais de 12 horas ou estiver vazia, o endpoint cai numa rota inline paginada sobre meta_stats que retorna a mesma resposta com custo maior. A paginação é necessária porque o PostgREST trunca silenciosamente queries não paginadas a 1.000 linhas, o que uma vez fez a maioria dos brawlers retornar null por subamostragem falsa.',
          'A lógica vive duplicada por design: uma versão TypeScript em src/lib/brawler-detail/trend.ts (rota detalhe) e uma SQL em supabase/migrations/022_*.sql (rota bulk). Ambas usam o mesmo limiar, a mesma janela e o mesmo filtro source=global. Se divergirem, a página individual e a agregada mostrariam números diferentes para o mesmo brawler, então qualquer mudança vai nas duas.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Cadência de atualização',
        paragraphs: [
          'A frequência com que um dado é atualizado afeta como interpretá-lo, então documentamos explicitamente. Páginas estáticas (incluindo esta) usam ISR (Incremental Static Regeneration) com revalidação de 24 horas. Páginas com dados dinâmicos cacheiam a resposta da API até que o job relevante invalide.',
          'Brawlers, gadgets e star powers sincronizam da API Supercell com cache de servidor de 24 horas. O meta-poll (dados PRO) roda a cada 6 horas e gera linhas meta_stats frescas. A pré-computação de tendências 7d roda em pg_cron a "17 */6 * * *" (minuto 17 de cada sexta hora) para não colidir com o meta-poll. A rotação de eventos do jogo atualiza a cada 30 minutos.',
          'Batalhas individuais de usuários premium que ativaram sync são baixadas logo após cada partida numa janela móvel via cron de sync. Uma vez no nosso banco, alimentam meta_stats com source=user e são a base das análises privadas da seção de perfil; nunca aparecem em agregados públicos e nunca se misturam com source=global.',
        ],
      },
    ],
    faqTitle: 'Perguntas frequentes',
    faq: [
      {
        q: 'Por que o WR de um brawler com pouca amostra não é 0 % ou 100 %?',
        a: 'Porque aplicamos smoothing bayesiano com um prior centrado em 50 %. Com muito poucas partidas o número exibido fica perto de 50 %; conforme a amostra cresce, converge para o WR real. É deliberado: 100 % com 3 partidas não é informação, é ruído.',
      },
      {
        q: 'As páginas públicas usam dados de usuários reais?',
        a: 'Não. Cada agregado público filtra por source=global, que só contém batalhas da amostragem automática dos rankings PRO. Batalhas privadas de usuários premium são guardadas com source=user e nunca atravessam para páginas públicas.',
      },
      {
        q: 'O que acontece quando a Supercell lança um brawler novo?',
        a: 'A lista de brawlers vem da API oficial, então o roster completo aparece no site no mesmo dia do lançamento. Raridade e imagem vêm do Brawlify, que pode atrasar de um a três dias; mantemos um mapa local de raridade (BRAWLER_RARITY_MAP) como fallback nesses primeiros dias.',
      },
      {
        q: 'Por que algumas tendências mostram um traço em vez de porcentagem?',
        a: 'Só mostramos a tendência se cada metade da janela 14d tiver pelo menos 3 batalhas em source=global. Quando um brawler é pouco visto, preferimos não mostrar nada a um número de baixo sinal.',
      },
      {
        q: 'O site usa IA para gerar as descrições?',
        a: 'As descrições são geradas dinamicamente a partir dos nossos próprios dados (melhor mapa, melhor modo, WR bayesiano por brawler). Não copiamos texto do Brawlify nem do wiki, e não usamos modelos de linguagem para inflar conteúdo.',
      },
    ],
    contactTitle: 'Perguntas ou correções?',
    contactBody: 'Se você achou um erro metodológico ou quer sugerir uma melhoria, fala com a gente. Mantemos esta página atualizada a cada mudança relevante na forma de calcular os dados.',
    aboutLink: 'Sobre o BrawlVision',
    privacyLink: 'Política de privacidade',
  },

  de: {
    metaTitle: 'BrawlVision Methodik — wie jede Statistik berechnet wird',
    metaDescription: 'Die Formeln, Quellen und Aktualisierungs-Kadenzen hinter jeder Zahl auf BrawlVision: Bayesian Win Rate, Comfort Score, PRO-Sampling, Zeitfenster und source=global Filter.',
    breadcrumbLabel: 'Methodik',
    homeAriaLabel: 'Zur Startseite',
    eyebrow: 'Methodik',
    heroTitle: 'Wie wir jede Statistik aufbauen',
    heroLead: 'BrawlVision kombiniert die offizielle Supercell-API, eine eigene PRO-Spieler-Sampling-Schicht und mehrere statistische Smoothing-Schritte, um dir Zahlen zu liefern, die stabil, vergleichbar und ehrlich über ihre eigene Unsicherheit sind. Diese Seite dokumentiert jeden dieser Schritte mit den exakten Formeln und Aktualisierungs-Kadenzen.',
    lastUpdated: 'Zuletzt aktualisiert: {date}',
    tocTitle: 'Auf dieser Seite',
    sections: [
      {
        id: 'data-sources',
        title: 'Datenquellen',
        paragraphs: [
          'Alles, was wir anzeigen, kommt aus drei Quellen, die wir prüfbar halten: die öffentliche Supercell-API (developer.brawlstars.com), das Brawlify-CDN (cdn.brawlify.com) und unsere eigene Supabase-Datenbank, die Kämpfe und Aggregate persistiert, die die offizielle API jenseits der letzten 25 Matches pro Spieler nicht offenlegt.',
          'Die Supercell-API ist die kanonische Quelle für strukturelle Daten — Brawler, Gadgets, Star Powers, Hypercharges, Gears und Event-Rotation — lässt aber kritische Felder wie Brawler-Bilder, Seltenheit und lange Beschreibungen aus. Diese Felder kreuzen wir mit dem Brawlify-CDN, das unabhängig läuft und manchmal ein bis drei Tage hinter Supercell hinterherhinkt. Wenn ein neuer Brawler in der offiziellen API auftaucht, der bei Brawlify noch nicht existiert, halten wir eine lokale Seltenheits-Map (BRAWLER_RARITY_MAP), damit die Brawler-Seite am Launch-Tag korrekt rendert.',
          'Unsere Datenbank speichert zwei Klassen von Zeilen in meta_stats: source=user (echte Kämpfe von Premium-Nutzern, die Sync aktiviert haben) und source=global (automatisches Sampling der Top-PRO-Ranglisten). Jede öffentliche Statistik wird mit Filter source=global berechnet, damit persönliche Daten einzelner Nutzer niemals in öffentliche Seiten lecken.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'Wie wir die PRO-Daten aufbauen',
        paragraphs: [
          'Die "PRO"-Schicht von BrawlVision sind Aggregate über aktuelle Kämpfe der besten Spieler weltweit. Alle sechs Stunden befragt ein Cron-Job (meta-poll) die offiziellen Supercell-Ranglisten für elf Länder — die mit der konzentriertesten Wettkampfaktivität — und baut eine deduplizierte Pool von etwa 2.100 einzigartigen Spielern aus jedem Top 200.',
          'Auf dieser Pool wenden wir einen probabilistischen Sampler an, damit beliebte (Map, Modus)-Kombinationen den Datensatz nicht dominieren und seltene maskieren. Die Akzeptanzwahrscheinlichkeit eines einzelnen Kampfs ist p = min(1, (minLive + 1) / (current + 1)), wobei minLive die Anzahl der unterrepräsentiertsten Kombination und current die der Kandidaten-Kombination ist. Untersample-Kombinationen bekommen mehr Gewicht, gesättigte hören auf zu wachsen.',
          'Der Cron iteriert bis zu META_POLL_MAX_DEPTH = 1.000 Spieler pro Lauf mit einem weichen 270-Sekunden-Budget, um innerhalb der 300-s maxDuration der Serverless-Funktion zu bleiben. Jede Antwort enthält einen "adaptive"-Diagnoseblock mit Iterationszählern, befragten Spielern und Modi-Counts, damit jedes anomale Sampler-Verhalten in Produktion beobachtbar bleibt.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Bayesian Win Rate',
        paragraphs: [
          'Die naive Win Rate (Siege / Matches) ist bei kleinen Stichproben irreführend: ein Brawler mit 3-0 auf einer neuen Map zeigt "100 % WR", ohne dass das etwas bedeutet. BrawlVision verwendet Bayesian-Smoothing zur Korrektur und gibt eine Zahl zurück, die zwischen Brawlern mit sehr unterschiedlichen Stichprobengrößen vergleichbar ist.',
          'Die Formel ist WR_bayesian = (wins + α) / (battles + α + β), wobei α und β Hyperparameter sind, die einen 50 %-WR-Prior kodieren. In der Praxis α = β = 25, äquivalent zu "50 vorherige Kämpfe 50/50 annehmen, bevor reale Daten gesehen werden". Ein Brawler mit 3 Siegen und 0 Niederlagen geht von naiv 100 % auf (3 + 25) / (3 + 50) = 52,8 %, viel repräsentativer für den realen Sampling-Stand.',
          'Wenn die Stichprobe wächst, sinkt das Gewicht des Priors: bei 1.000 Kämpfen und 530 Siegen liegt der Bayesian WR bei (530 + 25) / (1.000 + 50) = 52,9 %, nahezu identisch zum naiven 53,0 %. Smoothing "schmerzt" nur, wenn die Stichprobe wirklich klein ist. Genau die gewünschte Eigenschaft: Rauschen bestrafen, nicht Signal.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score ist die hauseigene Metrik von BrawlVision für die Frage "mit welchem Brawler spielst du tatsächlich besser als der Durchschnitt?". Es ist keine reine Win Rate: er kombiniert drei Komponenten mit Gewichten 60/30/10 für verschiedene Dimensionen persönlicher Leistung.',
          'Die Hauptkomponente (60 %) ist die Spieler-WR mit diesem Brawler, Bayesian-geglättet wie das Global-Meta, damit ein selten gespielter Brawler das Ranking nicht verzerrt. Die mittlere Komponente (30 %) ist die Differenz zwischen dieser persönlichen WR und der gesamten Meta-WR des Brawlers: ein Spieler bei 55 % auf SHELLY, wenn das Global-Meta bei 48 % liegt, gewinnt mehr Comfort als jemand bei 55 % auf einem Brawler mit Meta 53 %, weil der relative Lift größer ist.',
          'Die letzte Komponente (10 %) ist die normalisierte Nutzungsfrequenz: bei sonst gleichen Bedingungen zählt es mehr, einen Brawler 100 Mal zu spielen als 10 Mal, weil Konstanz belohnt wird. Die genauen Formeln und Gewichte leben in src/lib/analytics/compute.ts und gelten identisch bei jedem Endpoint-Aufruf, damit das Ranking reproduzierbar ist.',
        ],
      },
      {
        id: 'weekly-trends',
        title: '7-Tage-Trends',
        paragraphs: [
          'Jeder öffentliche Brawler hat einen Trend-Indikator "+X,Y%" oder "−X,Y%", der zeigt, wie sich seine Meta-WR in den letzten 7 Tagen gegenüber den vorherigen 7 verändert hat (insgesamt 14-Tage-Fenster). Die Berechnung läuft auf source=global mit minimal MIN_BATTLES_PER_TREND_WINDOW = 3 Kämpfen pro Fensterhälfte — wenn eine der Hälften unter der Schwelle liegt, geben wir null zurück und die UI versteckt den Pfeil, statt eine schwache Zahl zu erfinden.',
          'Der Trend wird alle sechs Stunden in einer kleinen Tabelle (public.brawler_trends, eine Zeile pro Brawler) per pg_cron-Job vorberechnet. Das in der DB statt in der Endpoint-Antwort zu tun vermeidet, bei jedem ISR-Refresh zehntausende Zeilen des 14-Tage-Slices zu scannen. Wenn die vorberechnete Tabelle älter als 12 Stunden oder leer ist, fällt der Endpoint auf eine paginierte Inline-Route über meta_stats zurück, die dieselbe Antwort zu höheren Kosten liefert. Pagination ist nötig, weil PostgREST nicht-paginierte Queries lautlos auf 1.000 Zeilen kürzt — was einmal die Mehrheit der Brawler null zurückgeben ließ wegen falscher Untersample.',
          'Die Logik existiert dupliziert by design: TypeScript-Version in src/lib/brawler-detail/trend.ts (Detail-Route) und SQL-Version in supabase/migrations/022_*.sql (Bulk-Route). Beide nutzen denselben Schwellenwert, dasselbe Fenster und denselben source=global-Filter. Wenn sie auseinanderlaufen, würden Detail- und Aggregat-Seite verschiedene Zahlen für denselben Brawler zeigen, also wird jede Änderung in beiden angewandt.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Aktualisierungs-Kadenz',
        paragraphs: [
          'Wie oft eine Datenkomponente aktualisiert wird, beeinflusst, wie du sie interpretieren solltest, also dokumentieren wir das explizit. Statische Seiten (diese eingeschlossen) nutzen ISR (Incremental Static Regeneration) mit 24-Stunden-Revalidation. Seiten mit dynamischen Daten cachen die API-Antwort, bis der entsprechende Job sie invalidiert.',
          'Brawler, Gadgets und Star Powers synchronisieren von der Supercell-API mit 24-Stunden-Server-Cache. Der meta-poll (PRO-Daten) läuft alle 6 Stunden und produziert frische meta_stats-Zeilen. Die 7-Tage-Trend-Vorberechnung läuft in pg_cron auf "17 */6 * * *" (Minute 17 jeder sechsten Stunde), um nicht mit dem meta-poll zu kollidieren. Die In-Game-Event-Rotation wird alle 30 Minuten erneuert.',
          'Einzelne Kämpfe von Premium-Nutzern mit aktivierter Sync werden direkt nach jedem Match in einem gleitenden Fenster über den sync-cron heruntergeladen. In unserer DB speisen sie meta_stats mit source=user und sind die Basis privater Analysen im Profilbereich; sie tauchen nie in öffentlichen Aggregaten auf und mischen sich nie mit source=global.',
        ],
      },
    ],
    faqTitle: 'Häufig gestellte Fragen',
    faq: [
      {
        q: 'Warum ist die WR eines selten gespielten Brawlers nicht 0 % oder 100 %?',
        a: 'Weil wir Bayesian-Smoothing mit einem 50 %-zentrierten Prior anwenden. Bei sehr wenigen Matches liegt die angezeigte Zahl nahe 50 %; mit wachsender Stichprobe konvergiert sie zur realen WR. Das ist beabsichtigt: 100 % bei 3 Matches ist keine Information, sondern Rauschen.',
      },
      {
        q: 'Verwenden öffentliche Seiten Daten echter Nutzer?',
        a: 'Nein. Jedes öffentliche Aggregat filtert auf source=global, das nur Kämpfe aus dem automatischen PRO-Ranglisten-Sampling enthält. Private Kämpfe von Premium-Nutzern sind mit source=user gespeichert und kreuzen nie zu öffentlichen Seiten.',
      },
      {
        q: 'Was passiert, wenn Supercell einen neuen Brawler veröffentlicht?',
        a: 'Die Brawler-Liste kommt aus der offiziellen API, also erscheint das volle Roster am Launch-Tag. Seltenheit und Bilder kommen aus Brawlify, das ein bis drei Tage hinterherhinken kann; wir halten eine lokale Seltenheits-Map (BRAWLER_RARITY_MAP) als Fallback für diese ersten Tage.',
      },
      {
        q: 'Warum zeigen manche Trends einen Strich statt einer Prozentzahl?',
        a: 'Wir zeigen den Trend nur, wenn jede Hälfte des 14-Tage-Fensters mindestens 3 Kämpfe in source=global hat. Wenn ein Brawler selten gesehen wird, zeigen wir lieber nichts als eine schwache Zahl.',
      },
      {
        q: 'Verwendet die Seite KI zur Beschreibungs-Generierung?',
        a: 'Beschreibungen werden dynamisch aus unseren eigenen Daten generiert (beste Map, bester Modus, Bayesian WR pro Brawler). Wir kopieren weder Text aus Brawlify noch aus dem Wiki, und wir nutzen keine Sprachmodelle, um Inhalt aufzublähen.',
      },
    ],
    contactTitle: 'Fragen oder Korrekturen?',
    contactBody: 'Wenn du einen methodischen Fehler entdeckst oder eine Verbesserung vorschlagen willst, melde dich. Wir halten diese Seite mit jeder relevanten Änderung in der Berechnungsweise synchron.',
    aboutLink: 'Über BrawlVision',
    privacyLink: 'Datenschutzerklärung',
  },

  it: {
    metaTitle: 'Metodologia BrawlVision — come viene calcolata ogni statistica',
    metaDescription: 'Le formule, le fonti e le cadenze di aggiornamento dietro ogni numero su BrawlVision: Win Rate bayesiano, Comfort Score, sampling PRO, finestre temporali e filtri source=global.',
    breadcrumbLabel: 'Metodologia',
    homeAriaLabel: 'Vai alla pagina principale',
    eyebrow: 'Metodologia',
    heroTitle: 'Come costruiamo ogni statistica',
    heroLead: 'BrawlVision combina l\'API ufficiale di Supercell, un nostro layer di campionamento di giocatori PRO e diversi passaggi di smoothing statistico per fornirti numeri stabili, comparabili e onesti sulla propria incertezza. Questa pagina documenta ognuno di questi passaggi, con le formule esatte e le cadenze di aggiornamento.',
    lastUpdated: 'Ultimo aggiornamento: {date}',
    tocTitle: 'In questa pagina',
    sections: [
      {
        id: 'data-sources',
        title: 'Fonti di dati',
        paragraphs: [
          'Tutto ciò che mostriamo proviene da tre fonti che manteniamo verificabili: l\'API pubblica di Supercell (developer.brawlstars.com), il CDN di Brawlify (cdn.brawlify.com) e il nostro database Supabase, che persiste battaglie e aggregati che l\'API ufficiale non espone oltre le ultime 25 partite per giocatore.',
          'L\'API di Supercell è la fonte canonica per i dati strutturali — brawler, gadget, star power, hypercharge, gear e rotazione eventi — ma omette campi critici come immagini dei brawler, rarità e descrizioni lunghe. Incrociamo questi campi con il CDN di Brawlify, che opera in modo indipendente e a volte ritarda da uno a tre giorni rispetto a Supercell. Quando rileviamo un brawler nuovo nell\'API ufficiale che ancora non esiste su Brawlify, manteniamo una mappa locale di rarità (BRAWLER_RARITY_MAP) perché la pagina del brawler renderizzi correttamente al lancio.',
          'Il nostro database memorizza due classi di righe in meta_stats: source=user (battaglie reali di utenti premium che hanno attivato la sync) e source=global (campionamento automatico delle classifiche PRO). Ogni statistica pubblica è calcolata filtrando su source=global, per evitare che dati personali di un singolo utente trapelino nelle pagine pubbliche.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'Come costruiamo i dati PRO',
        paragraphs: [
          'Il livello "PRO" di BrawlVision è un insieme di aggregati calcolati sulle battaglie recenti dei migliori giocatori al mondo. Ogni sei ore un cron job (meta-poll) interroga le classifiche ufficiali di Supercell per undici paesi — quelli che concentrano l\'attività competitiva — e costruisce una pool dedduplicata di circa 2.100 giocatori unici dal top 200 di ciascuno.',
          'Su questa pool applichiamo un sampler probabilistico per impedire che le combinazioni (mappa, modalità) popolari dominino il dataset e mascherino quelle rare. La probabilità di accettare una battaglia individuale è p = min(1, (minLive + 1) / (current + 1)), dove minLive è il conteggio della combinazione meno rappresentata e current quello della combinazione candidata. Le combinazioni sotto-campionate ricevono più peso; quelle sature smettono di crescere.',
          'Il cron itera fino a META_POLL_MAX_DEPTH = 1.000 giocatori per esecuzione con budget flessibile di 270 secondi per restare entro il maxDuration di 300 s della funzione serverless. Ogni risposta include un blocco "adaptive" con conteggi di iterazioni, giocatori interrogati e conteggi per modalità, perché qualsiasi comportamento anomalo del sampler resti osservabile in produzione.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Win Rate bayesiano',
        paragraphs: [
          'Il Win Rate ingenuo (vittorie / partite) inganna su campioni piccoli: un brawler 3-0 su una mappa nuova mostra "100 % WR" senza che significhi nulla. BrawlVision usa lo smoothing bayesiano per correggere e restituire un numero comparabile tra brawler con dimensioni di campione molto diverse.',
          'La formula è WR_bayesiano = (wins + α) / (battles + α + β), dove α e β sono iperparametri che codificano una credenza precedente centrata su 50 % di WR. In pratica α = β = 25, equivalente a "assumere 50 battaglie precedenti 50/50 prima di vedere i dati reali". Un brawler con 3 wins e 0 losses passa da 100 % ingenuo a (3 + 25) / (3 + 50) = 52,8 %, molto più rappresentativo dello stato reale del campionamento.',
          'Man mano che il campione cresce, il peso del prior decade: con 1.000 battaglie e 530 wins, il WR bayesiano è a (530 + 25) / (1.000 + 50) = 52,9 %, quasi identico all\'ingenuo 53,0 %. Lo smoothing "fa male" solo quando il campione è genuinamente piccolo. È esattamente la proprietà desiderata: penalizzare il rumore, non il segnale.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Il Comfort Score è la metrica interna di BrawlVision per rispondere "con quale brawler giochi davvero meglio della media?". Non è un Win Rate puro: combina tre componenti con pesi 60/30/10 per coprire dimensioni diverse della performance personale.',
          'La componente principale (60 %) è il WR del giocatore con quel brawler, smoothed bayesianamente come il meta globale, perché un brawler giocato di rado non distorca il ranking. La componente intermedia (30 %) è la differenza tra questo WR personale e il WR meta del brawler in generale: un giocatore al 55 % su SHELLY quando il meta globale è al 48 % guadagna più comfort di uno al 55 % su un brawler con meta 53 %, perché il guadagno relativo è maggiore.',
          'La componente finale (10 %) è la frequenza d\'uso normalizzata: a parità di tutto il resto, giocare un brawler 100 volte conta più che 10, perché la coerenza viene premiata. Le formule esatte e i pesi vivono in src/lib/analytics/compute.ts e si applicano identicamente a ogni chiamata di endpoint, perché il ranking sia riproducibile.',
        ],
      },
      {
        id: 'weekly-trends',
        title: 'Tendenze 7 giorni',
        paragraphs: [
          'Ogni brawler pubblico ha un indicatore di tendenza "+X,Y%" o "−X,Y%" che misura come il suo WR meta è cambiato negli ultimi 7 giorni rispetto ai 7 precedenti (finestra totale di 14 giorni). Il calcolo gira su source=global con un minimo di MIN_BATTLES_PER_TREND_WINDOW = 3 battaglie in ciascuna metà della finestra — se una delle due metà non raggiunge la soglia, restituiamo null e l\'UI nasconde la freccia invece di inventare un numero a basso segnale.',
          'La tendenza è precalcolata ogni sei ore in una piccola tabella (public.brawler_trends, una riga per brawler) tramite un job pg_cron. Farlo nel database — invece che nella risposta dell\'endpoint — evita di scansionare decine di migliaia di righe della finestra 14 giorni a ogni refresh ISR. Se la tabella precalcolata è vecchia più di 12 ore o vuota, l\'endpoint cade su una rotta inline paginata su meta_stats che restituisce la stessa risposta a costo maggiore. La paginazione è necessaria perché PostgREST tronca silenziosamente le query non paginate a 1.000 righe, cosa che una volta ha fatto ritornare null alla maggior parte dei brawler per falsa sotto-campionatura.',
          'La logica vive duplicata by design: una versione TypeScript in src/lib/brawler-detail/trend.ts (rotta dettaglio) e una SQL in supabase/migrations/022_*.sql (rotta bulk). Entrambe usano la stessa soglia, la stessa finestra e lo stesso filtro source=global. Se divergessero, la pagina individuale e quella aggregata mostrerebbero numeri diversi per lo stesso brawler, quindi ogni cambio si applica a entrambe.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Cadenza di aggiornamento',
        paragraphs: [
          'Quanto spesso un dato si aggiorna influenza come interpretarlo, quindi lo documentiamo esplicitamente. Le pagine statiche (questa inclusa) usano ISR (Incremental Static Regeneration) con revalidazione di 24 ore. Le pagine con dati dinamici cachano la risposta dell\'API finché il job rilevante non la invalida.',
          'Brawler, gadget e star power si sincronizzano dall\'API Supercell con cache server di 24 ore. Il meta-poll (dati PRO) gira ogni 6 ore e produce righe meta_stats fresche. La precomputazione delle tendenze 7d gira in pg_cron a "17 */6 * * *" (minuto 17 di ogni sesta ora) per non scontrarsi con il meta-poll. La rotazione eventi in-game si rinfresca ogni 30 minuti.',
          'Le battaglie individuali di utenti premium con sync attiva sono scaricate subito dopo ogni partita in una finestra mobile via cron di sync. Una volta nel nostro database, alimentano meta_stats con source=user e sono la base delle analisi private nella sezione profilo; non appaiono mai in aggregati pubblici e non si mescolano mai a source=global.',
        ],
      },
    ],
    faqTitle: 'Domande frequenti',
    faq: [
      {
        q: 'Perché il WR di un brawler con poco campione non è 0 % o 100 %?',
        a: 'Perché applichiamo lo smoothing bayesiano con un prior centrato sul 50 %. Con pochissime partite il numero mostrato è vicino al 50 %; con il crescere del campione converge al WR reale. È deliberato: 100 % con 3 partite non è informazione, è rumore.',
      },
      {
        q: 'Le pagine pubbliche usano dati di utenti reali?',
        a: 'No. Ogni aggregato pubblico filtra su source=global, che contiene solo battaglie dal campionamento automatico delle classifiche PRO. Le battaglie private di utenti premium sono salvate con source=user e non passano mai alle pagine pubbliche.',
      },
      {
        q: 'Cosa succede quando Supercell pubblica un nuovo brawler?',
        a: 'L\'elenco dei brawler arriva dall\'API ufficiale, quindi il roster completo appare nel sito lo stesso giorno del lancio. Rarità e immagini vengono da Brawlify, che può ritardare di uno a tre giorni; manteniamo una mappa locale di rarità (BRAWLER_RARITY_MAP) come fallback per quei primi giorni.',
      },
      {
        q: 'Perché alcune tendenze mostrano un trattino invece di una percentuale?',
        a: 'Mostriamo la tendenza solo se ciascuna metà della finestra 14d ha almeno 3 battaglie in source=global. Quando un brawler è poco visto, preferiamo non mostrare nulla piuttosto che un numero a basso segnale.',
      },
      {
        q: 'Il sito usa l\'IA per generare le descrizioni?',
        a: 'Le descrizioni sono generate dinamicamente dai nostri dati (miglior mappa, miglior modalità, WR bayesiano per brawler). Non copiamo testo da Brawlify né dalla wiki, e non usiamo modelli linguistici per gonfiare il contenuto.',
      },
    ],
    contactTitle: 'Domande o correzioni?',
    contactBody: 'Se trovi un errore metodologico o vuoi suggerire un miglioramento, contattaci. Manteniamo questa pagina sincronizzata con ogni cambio rilevante nel modo di calcolare i dati.',
    aboutLink: 'Su BrawlVision',
    privacyLink: 'Politica sulla privacy',
  },

  ru: {
    metaTitle: 'Методология BrawlVision — как рассчитывается каждая статистика',
    metaDescription: 'Формулы, источники и частоты обновления за каждым числом на BrawlVision: Bayesian Win Rate, Comfort Score, PRO-сэмплинг, временные окна и фильтры source=global.',
    breadcrumbLabel: 'Методология',
    homeAriaLabel: 'На главную',
    eyebrow: 'Методология',
    heroTitle: 'Как мы строим каждую статистику',
    heroLead: 'BrawlVision сочетает официальное API Supercell, нашу собственную систему семплинга PRO-игроков и несколько шагов статистического сглаживания, чтобы давать вам стабильные, сопоставимые числа, честные по поводу собственной неопределённости. Эта страница описывает каждый из шагов с точными формулами и частотами обновления.',
    lastUpdated: 'Последнее обновление: {date}',
    tocTitle: 'На этой странице',
    sections: [
      {
        id: 'data-sources',
        title: 'Источники данных',
        paragraphs: [
          'Всё, что мы показываем, происходит из трёх источников, которые мы держим аудируемыми: публичный API Supercell (developer.brawlstars.com), CDN Brawlify (cdn.brawlify.com) и наша собственная база Supabase, в которой персистируются бои и агрегаты, не раскрываемые официальным API дальше последних 25 матчей на игрока.',
          'API Supercell — каноничный источник структурных данных: бойцов, гаджетов, star powers, гиперзарядов, шестерёнок и ротации событий. Однако оно не возвращает картинки бойцов, редкость и длинные описания. Эти поля мы сверяем с CDN Brawlify, который работает независимо и иногда отстаёт от Supercell на один-три дня. Когда в API появляется новый боец, которого ещё нет в Brawlify, мы держим локальную карту редкости (BRAWLER_RARITY_MAP), чтобы страница бойца корректно отрисовывалась в день релиза.',
          'Наша база хранит два класса записей в meta_stats: source=user (реальные бои премиум-пользователей с включённой синхронизацией) и source=global (автоматический сэмплинг из топ-рейтингов PRO). Любая публичная статистика на сайте считается с фильтром source=global, чтобы личные данные никогда не утекали на публичные страницы.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'Как мы строим PRO-данные',
        paragraphs: [
          'Слой "PRO" в BrawlVision — это агрегаты, посчитанные на свежих боях лучших игроков мира. Каждые шесть часов cron-задача (meta-poll) опрашивает официальные рейтинги Supercell по одиннадцати странам — там, где сосредоточена соревновательная активность — и строит дедуплицированный пул примерно из 2 100 уникальных игроков из топ-200 каждой страны.',
          'Над этим пулом применяется вероятностный сэмплер, чтобы популярные комбинации (карта, режим) не доминировали в датасете и не маскировали редкие. Вероятность принять отдельный бой — p = min(1, (minLive + 1) / (current + 1)), где minLive — счётчик наименее представленной комбинации, а current — счётчик комбинации кандидата. Недосэмплированные комбинации получают больший вес, насыщенные перестают расти.',
          'Cron итерирует до META_POLL_MAX_DEPTH = 1 000 игроков за запуск с мягким бюджетом 270 секунд, чтобы оставаться в пределах maxDuration 300 с serverless-функции. Каждый ответ содержит блок "adaptive" с диагностикой: число итераций, опрошенных игроков, счётчики по режимам — чтобы аномалии сэмплера были видны в продакшене.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Bayesian Win Rate',
        paragraphs: [
          'Наивный Win Rate (победы / матчи) обманчив на малых выборках: боец 3-0 на новой карте показывает "100 % WR", и это ничего не значит. BrawlVision применяет байесовское сглаживание для коррекции и возвращает число, сравнимое между бойцами с очень разными размерами выборки.',
          'Формула: WR_bayesian = (wins + α) / (battles + α + β), где α и β — гиперпараметры, кодирующие предварительное убеждение, центрированное на 50 % WR. На практике α = β = 25, что эквивалентно "предположить 50 предыдущих боёв 50/50 до того, как видны реальные данные". Боец с 3 победами и 0 поражениями из наивных 100 % переходит к (3 + 25) / (3 + 50) = 52,8 %, гораздо ближе к реальному состоянию выборки.',
          'По мере роста выборки вес priora падает: при 1 000 боях и 530 победах байесовский WR становится (530 + 25) / (1 000 + 50) = 52,9 %, практически идентично наивным 53,0 %. Сглаживание "бьёт" только тогда, когда выборка действительно мала. Это и есть нужное свойство: штрафовать шум, а не сигнал.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score — собственная метрика BrawlVision, отвечающая на вопрос "с каким бойцом ты на самом деле играешь лучше среднего?". Это не чистый Win Rate: он сочетает три компонента с весами 60/30/10, покрывая разные стороны личной формы.',
          'Главный компонент (60 %) — WR игрока с этим бойцом, сглаженный байесовски как и глобальный мета, чтобы редко играемый боец не искажал ранг. Средний компонент (30 %) — разница между этим личным WR и общим мета-WR бойца: игрок с 55 % на SHELLY при глобальном мета 48 % набирает больше comfort, чем игрок с 55 % на бойце с мета 53 %, потому что относительный лифт выше.',
          'Финальный компонент (10 %) — нормализованная частота использования: при прочих равных играть бойца 100 раз весит больше, чем 10, потому что постоянство вознаграждается. Точные формулы и веса живут в src/lib/analytics/compute.ts и применяются одинаково на каждом вызове эндпоинта, чтобы ранг был воспроизводим.',
        ],
      },
      {
        id: 'weekly-trends',
        title: '7-дневные тренды',
        paragraphs: [
          'У каждого публичного бойца есть индикатор тренда "+X,Y%" или "−X,Y%", показывающий, как изменился его мета-WR за последние 7 дней по сравнению с предыдущими 7 (всего окно 14 дней). Расчёт идёт на source=global с минимумом MIN_BATTLES_PER_TREND_WINDOW = 3 боя в каждой половине окна — если одна из половин ниже порога, мы возвращаем null, и UI скрывает стрелку, не выдумывая слабый сигнал.',
          'Тренд предрасчитывается каждые шесть часов в маленькой таблице (public.brawler_trends, одна строка на бойца) задачей pg_cron. Делать это в БД, а не в ответе эндпоинта, позволяет не сканировать десятки тысяч строк 14-дневного среза при каждом ISR-обновлении. Если предрасчитанная таблица старше 12 часов или пуста, эндпоинт переходит на пагинированный inline-маршрут поверх meta_stats, возвращающий тот же ответ ценой большей задержки. Пагинация нужна, потому что PostgREST молча обрезает непагинированные запросы до 1 000 строк — что однажды заставило большинство бойцов отдавать null по ложной недосемплированности.',
          'Логика дублирована by design: TypeScript-версия в src/lib/brawler-detail/trend.ts (маршрут детали) и SQL-версия в supabase/migrations/022_*.sql (массовый маршрут). Обе используют один и тот же порог, окно и фильтр source=global. Если они разойдутся, страница бойца и агрегатная страница покажут разные числа для одного и того же бойца, поэтому любое изменение применяется к обеим.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Частота обновления',
        paragraphs: [
          'Как часто данные обновляются — влияет на интерпретацию, поэтому мы документируем явно. Статичные страницы (включая эту) используют ISR (Incremental Static Regeneration) с ревалидацией раз в 24 часа. Страницы с динамическими данными кэшируют ответ API, пока соответствующая задача не инвалидирует его.',
          'Бойцы, гаджеты и star powers синхронизируются с API Supercell с серверным кэшем 24 часа. Meta-poll (PRO-данные) запускается каждые 6 часов и пишет свежие строки в meta_stats. Предрасчёт 7-дневных трендов запускается в pg_cron на "17 */6 * * *" (минута 17 каждых шести часов), чтобы не сталкиваться с meta-poll. Внутриигровая ротация событий обновляется каждые 30 минут.',
          'Отдельные бои премиум-пользователей с включённой синхронизацией скачиваются сразу после каждой партии в скользящем окне через cron sync. Попадая в нашу базу, они подпитывают meta_stats с source=user и являются основой приватной аналитики в разделе профиля; они никогда не появляются в публичных агрегатах и никогда не смешиваются с source=global.',
        ],
      },
    ],
    faqTitle: 'Часто задаваемые вопросы',
    faq: [
      {
        q: 'Почему WR редко играющего бойца не 0 % или 100 %?',
        a: 'Потому что мы применяем байесовское сглаживание с приором, центрированным на 50 %. При очень малом числе матчей показанное число близко к 50 %; с ростом выборки оно сходится к реальному WR. Это сделано намеренно: 100 % при 3 матчах — это шум, не информация.',
      },
      {
        q: 'Используют ли публичные страницы данные реальных пользователей?',
        a: 'Нет. Каждый публичный агрегат фильтрует по source=global, который содержит только бои из автоматического сэмплинга PRO-рейтингов. Приватные бои премиум-пользователей хранятся с source=user и никогда не попадают на публичные страницы.',
      },
      {
        q: 'Что происходит, когда Supercell выпускает нового бойца?',
        a: 'Список бойцов берётся из официального API, поэтому полный ростер появляется на сайте в день релиза. Редкость и картинки приходят из Brawlify, который может отставать на один-три дня; мы держим локальную карту редкости (BRAWLER_RARITY_MAP) как fallback на эти первые дни.',
      },
      {
        q: 'Почему некоторые тренды показывают прочерк вместо процента?',
        a: 'Тренд показывается, только если в каждой половине 14-дневного окна есть хотя бы 3 боя в source=global. Когда боец редко встречается, мы предпочитаем ничего не показывать, чем число со слабым сигналом.',
      },
      {
        q: 'Использует ли сайт ИИ для генерации описаний?',
        a: 'Описания генерируются динамически из наших данных (лучшая карта, лучший режим, байесовский WR на бойца). Мы не копируем тексты из Brawlify или вики и не используем языковые модели для раздувания контента.',
      },
    ],
    contactTitle: 'Вопросы или поправки?',
    contactBody: 'Если вы заметили методологическую ошибку или хотите предложить улучшение, напишите нам. Мы держим эту страницу синхронизированной с каждым релевантным изменением расчётов.',
    aboutLink: 'О BrawlVision',
    privacyLink: 'Политика конфиденциальности',
  },

  tr: {
    metaTitle: 'BrawlVision Metodolojisi — Her İstatistik Nasıl Hesaplanır',
    metaDescription: 'BrawlVision\'daki her sayının arkasındaki formüller, kaynaklar ve güncelleme sıklıkları: Bayesian Win Rate, Comfort Score, PRO örnekleme, zaman pencereleri ve source=global filtreleri.',
    breadcrumbLabel: 'Metodoloji',
    homeAriaLabel: 'Ana sayfaya git',
    eyebrow: 'Metodoloji',
    heroTitle: 'Her istatistiği nasıl inşa ediyoruz',
    heroLead: 'BrawlVision, Supercell\'in resmi API\'sini, kendi PRO oyuncu örnekleme katmanımızı ve birkaç istatistiksel yumuşatma adımını birleştirerek sana kararlı, karşılaştırılabilir ve kendi belirsizliği konusunda dürüst sayılar sunuyor. Bu sayfa her bir adımı tam formülleri ve güncelleme sıklıklarıyla belgeler.',
    lastUpdated: 'Son güncelleme: {date}',
    tocTitle: 'Bu sayfada',
    sections: [
      {
        id: 'data-sources',
        title: 'Veri kaynakları',
        paragraphs: [
          'Gösterdiğimiz her şey, denetlenebilir tuttuğumuz üç kaynaktan gelir: Supercell\'in genel API\'si (developer.brawlstars.com), Brawlify CDN\'i (cdn.brawlify.com) ve resmi API\'nin oyuncu başına son 25 maçın ötesinde sunmadığı savaşları ve toplamları kalıcılaştıran kendi Supabase veritabanımız.',
          'Supercell API\'si yapısal veriler için kanonik kaynaktır — brawlerlar, gadgetlar, star powerlar, hyperchargelar, gearlar ve etkinlik rotasyonu — ancak brawler görselleri, nadirlik ve uzun açıklamalar gibi kritik alanları dışarıda bırakır. Bu alanları, bağımsız çalışan ve bazen Supercell\'den bir-üç gün geriden gelen Brawlify CDN\'i ile çapraz kontrol ederiz. Resmi API\'de Brawlify\'da henüz var olmayan yeni bir brawler tespit ettiğimizde, brawler sayfasının lansman gününde doğru render edilmesi için yerel bir nadirlik haritası (BRAWLER_RARITY_MAP) tutarız.',
          'Veritabanımız meta_stats tablosunda iki sınıf satır saklar: source=user (senkronizasyonu açan premium kullanıcıların gerçek savaşları) ve source=global (en iyi PRO sıralamalarından otomatik örnekleme). Sitede gösterilen her kamuya açık istatistik source=global filtresiyle hesaplanır, böylece tek bir kullanıcının kişisel verisi kamuya açık sayfalara sızmaz.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'PRO verilerini nasıl inşa ederiz',
        paragraphs: [
          'BrawlVision\'ın "PRO" katmanı, dünyanın en iyi oyuncularının son savaşları üzerinden hesaplanan toplamlardır. Her altı saatte bir cron işi (meta-poll), rekabetçi aktivitenin yoğunlaştığı on bir ülkenin Supercell resmi sıralamalarını sorgular ve her ülkenin top 200\'ünden yaklaşık 2.100 benzersiz oyunculuk dedupe edilmiş bir havuz oluşturur.',
          'Bu havuza, popüler (harita, mod) kombinasyonlarının veri kümesine hâkim olup nadir olanları maskelemesini engellemek için olasılıklı bir örnekleyici uygularız. Bireysel bir savaşı kabul olasılığı p = min(1, (minLive + 1) / (current + 1)) olup minLive en az temsil edilen kombinasyonun sayısı, current ise aday savaşın kombinasyonunun sayısıdır. Yetersiz örneklenen kombinasyonlar daha fazla ağırlık alır; doymuş olanlar büyümeyi bırakır.',
          'Cron, serverless fonksiyonun 300 sn maxDuration\'ı içinde kalmak için yumuşak 270 saniyelik bir bütçeyle çalıştırma başına META_POLL_MAX_DEPTH = 1.000 oyuncuya kadar yineler. Her yanıt; iterasyon sayıları, sorgulanan oyuncular ve mod başına sayımları içeren "adaptive" tanılama bloğu içerir, böylece anormal örnekleyici davranışı üretimde gözlemlenebilir kalır.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Bayesian Win Rate',
        paragraphs: [
          'Naif Win Rate (galibiyet / maç) küçük örneklerde yanıltıcıdır: yeni bir haritada 3-0 olan bir brawler "100 % WR" gösterir ama bunun bir anlamı yoktur. BrawlVision bunu düzeltmek için Bayesian yumuşatma kullanır ve çok farklı örneklem boyutlarına sahip brawlerlar arasında karşılaştırılabilir bir sayı döndürür.',
          'Formül WR_bayesian = (wins + α) / (battles + α + β) olup α ve β, %50 WR civarında merkezlenmiş bir önsel inancı kodlayan hiperparametrelerdir. Pratikte α = β = 25, yani "gerçek veriyi görmeden önce 50 önceki savaşı 50/50 varsay" demek. 3 win ve 0 loss\'lu bir brawler, naif 100 %\'den (3 + 25) / (3 + 50) = %52,8\'e geçer; bu da örneklemin gerçek durumunu çok daha iyi temsil eder.',
          'Örneklem büyüdükçe önselin ağırlığı azalır: 1.000 savaş ve 530 win\'de Bayesian WR (530 + 25) / (1.000 + 50) = %52,9 olur, naif %53,0 ile neredeyse aynı. Yumuşatma yalnızca örneklem gerçekten küçük olduğunda "acıtır". İstenen özellik tam olarak budur: gürültüyü cezalandır, sinyali değil.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score, "ortalamadan gerçekten hangi brawlerla daha iyi oynuyorsun?" sorusunu yanıtlayan BrawlVision\'a özgü bir metriktir. Saf Win Rate değildir: kişisel performansın farklı boyutlarını kapsamak için 60/30/10 ağırlıklarıyla üç bileşeni birleştirir.',
          'Ana bileşen (% 60), oyuncunun o brawlerla WR\'ı; küresel meta gibi Bayesian yumuşatılmıştır, böylece nadir oynanan brawler sıralamayı bozmaz. Orta bileşen (% 30), kişisel WR ile brawlerın genel meta WR\'ı arasındaki farktır: küresel meta %48\'deyken SHELLY üzerinde %55 olan oyuncu, metası %53 olan bir brawlerda %55 olan oyuncudan daha fazla comfort kazanır çünkü göreceli artış daha büyüktür.',
          'Son bileşen (% 10), normalize edilmiş kullanım sıklığıdır: diğer her şey eşit olduğunda bir brawleri 100 kez oynamak 10 kez oynamaktan daha çok sayar çünkü tutarlılık ödüllendirilir. Tam formüller ve ağırlıklar src/lib/analytics/compute.ts içinde yaşar ve her endpoint çağrısında aynı şekilde uygulanır, böylece sıralama tekrarlanabilir.',
        ],
      },
      {
        id: 'weekly-trends',
        title: '7 günlük trendler',
        paragraphs: [
          'Her kamuya açık brawlerin "+X,Y%" veya "−X,Y%" trend göstergesi, meta WR\'ının son 7 günde bir önceki 7\'ye göre nasıl değiştiğini gösterir (toplam 14 günlük pencere). Hesap source=global üzerinde, pencerenin her yarısında en az MIN_BATTLES_PER_TREND_WINDOW = 3 savaş asgarisiyle çalışır — yarımlardan biri eşiği geçmezse null döneriz ve UI, zayıf sinyalli bir sayı uydurmak yerine oku gizler.',
          'Trend, her altı saatte bir küçük bir tabloda (public.brawler_trends, brawler başına bir satır) pg_cron işiyle önceden hesaplanır. Bunu endpoint yanıtı yerine veritabanında yapmak, her ISR yenilemesinde 14 günlük dilimin on binlerce satırını taramaktan kaçınır. Önceden hesaplanan tablo 12 saatten eskiyse veya boşsa endpoint, aynı yanıtı daha yüksek maliyetle döndüren meta_stats üzerinde sayfalandırılmış inline rotaya düşer. Sayfalandırma gereklidir çünkü PostgREST sayfalandırılmamış sorguları sessizce 1.000 satıra keser; bu bir keresinde brawlerların çoğunun yanlış yetersiz örneklem nedeniyle null dönmesine yol açtı.',
          'Mantık tasarım gereği iki yerde yaşar: src/lib/brawler-detail/trend.ts içindeki TypeScript versiyonu (detay rotası) ve supabase/migrations/022_*.sql içindeki SQL versiyonu (toplu rota). İkisi de aynı eşiği, aynı pencereyi ve aynı source=global filtresini kullanır. Eğer ayrılırlarsa brawler başına detay sayfası ile toplu sayfa aynı brawler için farklı sayılar gösterir, bu yüzden her değişiklik ikisine de uygulanır.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Güncelleme sıklığı',
        paragraphs: [
          'Bir verinin ne sıklıkta yenilendiği nasıl yorumlanması gerektiğini etkiler, bu yüzden açıkça belgeleriz. Statik sayfalar (bu dahil) 24 saatlik revalidasyonla ISR (Incremental Static Regeneration) kullanır. Dinamik veriye sahip sayfalar, ilgili iş geçersiz kılana kadar API yanıtını önbelleğe alır.',
          'Brawlerlar, gadgetlar ve star powerlar Supercell API\'sinden 24 saatlik sunucu önbelleğiyle senkronize olur. Meta-poll (PRO verisi) her 6 saatte bir çalışır ve taze meta_stats satırları üretir. 7 günlük trend ön hesaplaması meta-poll ile çakışmamak için pg_cron\'da "17 */6 * * *" üzerinde (her altıncı saatin 17. dakikasında) çalışır. Oyun içi etkinlik rotasyonu her 30 dakikada bir yenilenir.',
          'Senkronizasyonu açan premium kullanıcıların bireysel savaşları, sync cron\'u ile her maçtan hemen sonra kayan bir pencerede indirilir. Veritabanına girdikten sonra source=user ile meta_stats\'i besler ve profil bölümündeki özel analizlerin temelidir; kamuya açık toplamlarda asla görünmez ve source=global ile asla karışmaz.',
        ],
      },
    ],
    faqTitle: 'Sık sorulan sorular',
    faq: [
      {
        q: 'Az örneklemli bir brawlerin WR\'ı neden %0 veya %100 değil?',
        a: 'Çünkü %50 merkezli önselle Bayesian yumuşatma uyguluyoruz. Çok az maçta gösterilen sayı %50\'ye yakın; örneklem büyüdükçe gerçek WR\'a yakınsar. Bu kasıtlı: 3 maçta %100 bilgi değil, gürültüdür.',
      },
      {
        q: 'Kamuya açık sayfalar gerçek kullanıcı verisi kullanıyor mu?',
        a: 'Hayır. Her kamuya açık toplam source=global filtreler; bu yalnızca PRO sıralamalarından otomatik örneklenen savaşları içerir. Premium kullanıcıların özel savaşları source=user ile saklanır ve asla kamuya açık sayfalara geçmez.',
      },
      {
        q: 'Supercell yeni bir brawler çıkardığında ne olur?',
        a: 'Brawler listesi resmi API\'den gelir, dolayısıyla tam roster lansman gününde sitede görünür. Nadirlik ve görseller Brawlify\'dan gelir ve bir-üç gün gecikebilir; o ilk günler için fallback olarak yerel bir nadirlik haritası (BRAWLER_RARITY_MAP) tutarız.',
      },
      {
        q: 'Bazı trendler neden yüzde yerine tire gösteriyor?',
        a: 'Trendi yalnızca 14 günlük pencerenin her yarısında source=global\'de en az 3 savaş varsa gösteririz. Bir brawler nadir görüldüğünde zayıf sinyalli sayı yerine hiçbir şey göstermeyi tercih ederiz.',
      },
      {
        q: 'Site açıklamaları üretmek için yapay zeka kullanıyor mu?',
        a: 'Açıklamalar kendi verilerimizden dinamik üretilir (en iyi harita, en iyi mod, brawler başına Bayesian WR). Brawlify\'dan veya wiki\'den metin kopyalamayız ve içerik şişirmek için dil modeli kullanmayız.',
      },
    ],
    contactTitle: 'Sorular veya düzeltmeler?',
    contactBody: 'Metodolojik bir hata fark edersen veya bir iyileştirme önermek istersen bize yaz. Bu sayfayı verilerin hesaplanma şeklindeki her ilgili değişiklikle senkron tutuyoruz.',
    aboutLink: 'BrawlVision Hakkında',
    privacyLink: 'Gizlilik politikası',
  },

  pl: {
    metaTitle: 'Metodologia BrawlVision — jak liczona jest każda statystyka',
    metaDescription: 'Wzory, źródła i częstotliwości za każdą liczbą na BrawlVision: Bayesian Win Rate, Comfort Score, sampling PRO, okna czasowe i filtry source=global.',
    breadcrumbLabel: 'Metodologia',
    homeAriaLabel: 'Przejdź do strony głównej',
    eyebrow: 'Metodologia',
    heroTitle: 'Jak budujemy każdą statystykę',
    heroLead: 'BrawlVision łączy oficjalne API Supercella, naszą warstwę próbkowania graczy PRO i kilka kroków statystycznego smoothing​a, by dostarczać liczby stabilne, porównywalne i uczciwe wobec własnej niepewności. Ta strona dokumentuje każdy z tych kroków z dokładnymi wzorami i częstotliwościami aktualizacji.',
    lastUpdated: 'Ostatnia aktualizacja: {date}',
    tocTitle: 'Na tej stronie',
    sections: [
      {
        id: 'data-sources',
        title: 'Źródła danych',
        paragraphs: [
          'Wszystko, co wyświetlamy, pochodzi z trzech źródeł, które trzymamy audytowalne: publiczne API Supercella (developer.brawlstars.com), CDN Brawlify (cdn.brawlify.com) i nasza własna baza Supabase, która utrwala walki i agregaty, których oficjalne API nie udostępnia poza ostatnimi 25 meczami na gracza.',
          'API Supercella to kanoniczne źródło danych strukturalnych — brawlery, gadżety, star powery, hypercharge, gearsy i rotacja eventów — ale pomija krytyczne pola jak obrazy brawlerów, rzadkość i długie opisy. Te pola krzyżujemy z CDN Brawlify, który działa niezależnie i czasem opóźnia się o jeden do trzech dni względem Supercella. Gdy wykrywamy nowego brawlera w API, którego jeszcze nie ma w Brawlify, trzymamy lokalną mapę rzadkości (BRAWLER_RARITY_MAP), żeby strona brawlera renderowała się poprawnie w dniu premiery.',
          'Nasza baza przechowuje dwie klasy wierszy w meta_stats: source=user (prawdziwe walki użytkowników premium z włączoną sync) i source=global (automatyczne próbkowanie z rankingów PRO). Każda publiczna statystyka jest liczona z filtrem source=global, by dane osobowe pojedynczego użytkownika nigdy nie wyciekły na strony publiczne.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'Jak budujemy dane PRO',
        paragraphs: [
          'Warstwa "PRO" BrawlVision to agregaty liczone na ostatnich walkach najlepszych graczy świata. Co sześć godzin cron job (meta-poll) odpytuje oficjalne rankingi Supercella dla jedenastu krajów — tych z największą aktywnością competitive — i buduje deduplikowaną pulę około 2 100 unikalnych graczy z top 200 każdego.',
          'Na tej puli stosujemy probabilistyczny sampler, by popularne kombinacje (mapa, tryb) nie zdominowały datasetu i nie maskowały rzadkich. Prawdopodobieństwo akceptacji pojedynczej walki to p = min(1, (minLive + 1) / (current + 1)), gdzie minLive to liczba najmniej reprezentowanej kombinacji, a current liczba kombinacji walki kandydata. Niedopróbkowane kombinacje dostają większą wagę, nasycone przestają rosnąć.',
          'Cron iteruje do META_POLL_MAX_DEPTH = 1 000 graczy na uruchomienie z miękkim budżetem 270 sekund, by mieścić się w maxDuration 300 s funkcji serverless. Każda odpowiedź zawiera blok diagnostyczny "adaptive" z liczbą iteracji, sprawdzonymi graczami i licznikami per tryb, by anomalie samplera były obserwowalne w produkcji.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'Bayesian Win Rate',
        paragraphs: [
          'Naiwny Win Rate (zwycięstwa / mecze) wprowadza w błąd przy małych próbach: brawler 3-0 na nowej mapie pokazuje "100 % WR" bez znaczenia. BrawlVision używa Bayesian smoothing, by to skorygować i zwracać liczbę porównywalną między brawlerami o bardzo różnych rozmiarach próby.',
          'Wzór: WR_bayesian = (wins + α) / (battles + α + β), gdzie α i β to hiperparametry kodujące wcześniejsze przekonanie wyśrodkowane na 50 % WR. W praktyce α = β = 25, równoważne "załóż 50 wcześniejszych walk 50/50 zanim zobaczysz prawdziwe dane". Brawler z 3 wins i 0 losses przechodzi z naiwnego 100 % na (3 + 25) / (3 + 50) = 52,8 %, znacznie bardziej reprezentatywne dla rzeczywistego stanu próbkowania.',
          'Wraz ze wzrostem próby waga prior​a spada: przy 1 000 walk i 530 wins WR bayesowski wynosi (530 + 25) / (1 000 + 50) = 52,9 %, niemal identycznie jak naiwne 53,0 %. Smoothing "boli" tylko wtedy, gdy próba jest naprawdę mała. To dokładnie pożądana właściwość: karać szum, nie sygnał.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score to wewnętrzna metryka BrawlVision odpowiadająca na pytanie "z którym brawlerem grasz naprawdę lepiej niż średnia?". To nie jest czysty Win Rate: łączy trzy komponenty z wagami 60/30/10, pokrywając różne wymiary osobistej formy.',
          'Główny komponent (60 %) to WR gracza z tym brawlerem, wygładzony bayesowsko jak meta globalna, by rzadko grany brawler nie zawyżał rankingu. Komponent średni (30 %) to różnica między tym osobistym WR a metą WR brawlera ogółem: gracz z 55 % na SHELLY przy globalnej mecie 48 % zyskuje więcej comfort niż gracz z 55 % na brawlerze z metą 53 %, bo względny lift jest większy.',
          'Komponent końcowy (10 %) to znormalizowana częstość użycia: przy reszcie równej granie brawlerem 100 razy waży więcej niż 10, bo konsystencja jest nagradzana. Dokładne wzory i wagi żyją w src/lib/analytics/compute.ts i są stosowane identycznie przy każdym wywołaniu endpointa, by ranking był powtarzalny.',
        ],
      },
      {
        id: 'weekly-trends',
        title: 'Trendy 7-dniowe',
        paragraphs: [
          'Każdy publiczny brawler ma wskaźnik trendu "+X,Y%" lub "−X,Y%", który mierzy, jak jego meta WR zmienił się w ciągu ostatnich 7 dni względem poprzednich 7 (łącznie okno 14 dni). Obliczenie działa na source=global z minimum MIN_BATTLES_PER_TREND_WINDOW = 3 walk w każdej połowie okna — jeśli któraś z połówek jest poniżej progu, zwracamy null i UI ukrywa strzałkę zamiast wymyślać liczbę o słabym sygnale.',
          'Trend jest preliczany co sześć godzin w małej tabeli (public.brawler_trends, jeden wiersz na brawlera) przez job pg_cron. Robienie tego w bazie zamiast w odpowiedzi endpointa unika skanowania dziesiątek tysięcy wierszy 14-dniowego wycinka przy każdym odświeżeniu ISR. Jeśli prelliczona tabela jest starsza niż 12 godzin lub pusta, endpoint przechodzi na paginowaną trasę inline po meta_stats, która zwraca tę samą odpowiedź wyższym kosztem. Paginacja jest konieczna, bo PostgREST cicho ucina niepaginowane zapytania do 1 000 wierszy, co kiedyś sprawiło, że większość brawlerów zwracała null z fałszywego niedopróbkowania.',
          'Logika żyje zduplikowana z premedytacją: wersja TypeScript w src/lib/brawler-detail/trend.ts (trasa szczegółów) i wersja SQL w supabase/migrations/022_*.sql (trasa zbiorcza). Obie używają tego samego progu, tego samego okna i tego samego filtru source=global. Jeśli się rozjadą, strona pojedynczego brawlera i strona zbiorcza pokażą różne liczby dla tego samego brawlera, więc każda zmiana idzie w obie.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'Częstotliwość aktualizacji',
        paragraphs: [
          'Jak często dane się odświeżają wpływa na ich interpretację, więc dokumentujemy to wprost. Strony statyczne (w tym ta) używają ISR (Incremental Static Regeneration) z rewalidacją co 24 godziny. Strony z danymi dynamicznymi cache​ują odpowiedź API, dopóki odpowiedni job jej nie unieważni.',
          'Brawlerzy, gadżety i star powery synchronizują się z API Supercella z 24-godzinnym cache serwera. Meta-poll (dane PRO) działa co 6 godzin i produkuje świeże wiersze meta_stats. Preliczanie trendów 7d działa w pg_cron na "17 */6 * * *" (minuta 17 co szóstej godziny), by nie kolidować z meta-poll. Rotacja eventów w grze odświeża się co 30 minut.',
          'Pojedyncze walki użytkowników premium z włączoną sync są pobierane zaraz po każdym meczu w przesuwanym oknie przez cron sync. Po dotarciu do naszej bazy zasilają meta_stats z source=user i są podstawą prywatnych analiz w sekcji profilu; nigdy nie pojawiają się w agregatach publicznych i nigdy nie mieszają z source=global.',
        ],
      },
    ],
    faqTitle: 'Najczęstsze pytania',
    faq: [
      {
        q: 'Czemu WR brawlera z małą próbą nie wynosi 0 % lub 100 %?',
        a: 'Bo stosujemy Bayesian smoothing z priorem wyśrodkowanym na 50 %. Przy bardzo małej liczbie meczów wyświetlana liczba jest blisko 50 %; gdy próba rośnie, zbliża się do prawdziwego WR. To celowe: 100 % na 3 meczach to nie informacja, to szum.',
      },
      {
        q: 'Czy strony publiczne używają danych prawdziwych użytkowników?',
        a: 'Nie. Każdy publiczny agregat filtruje po source=global, który zawiera tylko walki z automatycznego próbkowania rankingów PRO. Prywatne walki użytkowników premium są zapisywane z source=user i nigdy nie przechodzą na strony publiczne.',
      },
      {
        q: 'Co się dzieje, gdy Supercell wypuszcza nowego brawlera?',
        a: 'Lista brawlerów pochodzi z oficjalnego API, więc pełny roster pojawia się na stronie w dniu premiery. Rzadkość i obrazy pochodzą z Brawlify, który może opóźnić się o jeden do trzech dni; trzymamy lokalną mapę rzadkości (BRAWLER_RARITY_MAP) jako fallback na te pierwsze dni.',
      },
      {
        q: 'Czemu niektóre trendy pokazują kreskę zamiast procentu?',
        a: 'Pokazujemy trend tylko, jeśli każda połowa okna 14d ma co najmniej 3 walki w source=global. Gdy brawler jest rzadko widziany, wolimy nic nie pokazać niż liczbę o słabym sygnale.',
      },
      {
        q: 'Czy strona używa AI do generowania opisów?',
        a: 'Opisy są generowane dynamicznie z naszych danych (najlepsza mapa, najlepszy tryb, Bayesian WR per brawler). Nie kopiujemy tekstu z Brawlify ani z wiki i nie używamy modeli językowych do nadymania treści.',
      },
    ],
    contactTitle: 'Pytania lub poprawki?',
    contactBody: 'Jeśli zauważyłeś błąd metodologiczny lub chcesz zasugerować ulepszenie, napisz do nas. Trzymamy tę stronę zsynchronizowaną z każdą istotną zmianą sposobu liczenia danych.',
    aboutLink: 'O BrawlVision',
    privacyLink: 'Polityka prywatności',
  },

  ar: {
    metaTitle: 'منهجية BrawlVision — كيف تُحسب كل إحصائية',
    metaDescription: 'الصيغ والمصادر وتواترات التحديث وراء كل رقم في BrawlVision: نسبة الفوز البايزية، Comfort Score، أخذ عينات PRO، النوافذ الزمنية ومرشحات source=global.',
    breadcrumbLabel: 'المنهجية',
    homeAriaLabel: 'العودة إلى الصفحة الرئيسية',
    eyebrow: 'المنهجية',
    heroTitle: 'كيف نبني كل إحصائية تراها',
    heroLead: 'يجمع BrawlVision بين واجهة Supercell الرسمية وطبقة أخذ عينات لاعبين PRO خاصة بنا وعدة خطوات تنعيم إحصائية لتقديم أرقام مستقرة وقابلة للمقارنة وصادقة بشأن عدم اليقين الخاص بها. توثق هذه الصفحة كل خطوة بالصيغ الدقيقة وتواترات التحديث.',
    lastUpdated: 'آخر تحديث: {date}',
    tocTitle: 'في هذه الصفحة',
    sections: [
      {
        id: 'data-sources',
        title: 'مصادر البيانات',
        paragraphs: [
          'كل ما نعرضه يأتي من ثلاثة مصادر نحافظ عليها قابلة للتدقيق: واجهة Supercell العامة (developer.brawlstars.com)، شبكة Brawlify CDN (cdn.brawlify.com)، وقاعدة بياناتنا الخاصة في Supabase التي تحفظ المعارك والمجاميع التي لا تكشفها الواجهة الرسمية بعد آخر 25 مباراة لكل لاعب.',
          'واجهة Supercell هي المصدر الأساسي للبيانات البنيوية — الأبطال، الجادجت، الستار باور، الهايبرتشارج، الجير ودوران الأحداث — لكنها تترك حقولاً حرجة مثل صور الأبطال والندرة والوصف الطويل. نقاطع هذه الحقول مع Brawlify CDN الذي يعمل مستقلاً ويتأخر أحياناً يوماً إلى ثلاثة عن Supercell. عند اكتشاف بطل جديد في الواجهة الرسمية لا يوجد بعد في Brawlify، نحتفظ بخريطة ندرة محلية (BRAWLER_RARITY_MAP) لتعرض صفحة البطل بشكل صحيح يوم الإطلاق.',
          'تخزن قاعدتنا فئتين من الصفوف في meta_stats: source=user (معارك حقيقية لمستخدمي Premium الذين فعّلوا المزامنة) و source=global (أخذ عينات تلقائي من أفضل تصنيفات PRO). كل إحصائية عامة في الموقع محسوبة بفلتر source=global حتى لا تتسرب بيانات شخصية لأي مستخدم إلى الصفحات العامة.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'كيف نبني بيانات PRO',
        paragraphs: [
          'طبقة "PRO" في BrawlVision هي مجاميع محسوبة على معارك حديثة لأفضل لاعبي العالم. كل ست ساعات تستعلم مهمة cron (meta-poll) عن تصنيفات Supercell الرسمية لإحدى عشرة دولة — التي تتركز فيها النشاط التنافسي — وتبني تجمعاً غير مكرر يضم نحو 2,100 لاعب فريد من أعلى 200 لكل دولة.',
          'فوق هذا التجمع نطبق مأخوذ عينات احتمالي لمنع تركيبات (الخريطة، الوضع) الشائعة من الهيمنة على البيانات وإخفاء النادرة. احتمال قبول معركة فردية هو p = min(1, (minLive + 1) / (current + 1))، حيث minLive هو عدد التركيبة الأقل تمثيلاً و current عدد تركيبة المعركة المرشحة. التركيبات قليلة العينات تأخذ وزناً أكبر، والمشبعة تتوقف عن النمو.',
          'يتكرر cron حتى META_POLL_MAX_DEPTH = 1,000 لاعب لكل تشغيل بميزانية مرنة 270 ثانية ليبقى ضمن maxDuration 300 ثانية لوظيفة serverless. تتضمن كل استجابة كتلة تشخيص "adaptive" مع عدد التكرارات واللاعبين المستعلَمين والعدّ لكل وضع، ليبقى أي سلوك غير طبيعي للسامبلر قابلاً للملاحظة في الإنتاج.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'نسبة الفوز البايزية',
        paragraphs: [
          'نسبة الفوز الساذجة (الانتصارات / المباريات) مضللة في العينات الصغيرة: بطل 3-0 في خريطة جديدة يعرض "100% WR" دون أن يعني ذلك شيئاً. يستخدم BrawlVision التنعيم البايزي للتصحيح وإرجاع رقم قابل للمقارنة بين أبطال بأحجام عينات مختلفة جداً.',
          'الصيغة هي WR_bayesian = (wins + α) / (battles + α + β)، حيث α و β معاملان فائقان يشفران اعتقاداً سابقاً متمركزاً عند 50% WR. عملياً α = β = 25، أي "افترض 50 معركة سابقة 50/50 قبل رؤية البيانات الفعلية". بطل ب3 انتصارات و0 خسائر ينتقل من 100% ساذج إلى (3 + 25) / (3 + 50) = 52.8%، أكثر تمثيلاً للحالة الفعلية لأخذ العينات.',
          'مع نمو العينة يهبط وزن السابق: عند 1,000 معركة و530 انتصار يصبح WR البايزي (530 + 25) / (1,000 + 50) = 52.9%، يكاد يطابق الساذج 53.0%. التنعيم "يؤلم" فقط عندما تكون العينة صغيرة فعلاً. هذه هي الخاصية المرغوبة بالضبط: عاقب الضوضاء، لا الإشارة.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score هو مقياس BrawlVision الداخلي للإجابة على سؤال "مع أي بطل تلعب فعلاً أفضل من المتوسط؟". ليس نسبة فوز خام: يجمع ثلاثة مكونات بأوزان 60/30/10 لتغطية أبعاد مختلفة من الأداء الشخصي.',
          'المكون الرئيسي (60%) هو WR اللاعب مع ذلك البطل، منعّماً بايزياً مثل الميتا العالمية، لئلا يهيمن بطل قليل اللعب على التصنيف. المكون الأوسط (30%) هو الفرق بين هذا WR الشخصي و WR ميتا البطل عموماً: لاعب بنسبة 55% على SHELLY بينما الميتا العالمية 48% يحصل على comfort أكبر من لاعب بنسبة 55% على بطل ميتاه 53% لأن الارتفاع النسبي أكبر.',
          'المكون الأخير (10%) هو تردد الاستخدام المعياري: مع تساوي الباقي، لعب بطل 100 مرة يحسب أكثر من 10 لأن الاتساق يكافأ. الصيغ الدقيقة والأوزان تعيش في src/lib/analytics/compute.ts وتُطبق بشكل متطابق عند كل استدعاء للنقطة الطرفية لتكون النتيجة قابلة للتكرار.',
        ],
      },
      {
        id: 'weekly-trends',
        title: 'الاتجاهات لـ7 أيام',
        paragraphs: [
          'لكل بطل عام مؤشر اتجاه "+X.Y%" أو "−X.Y%" يقيس تغيّر WR ميتاه في آخر 7 أيام مقارنة ب7 السابقة (نافذة كلية 14 يوماً). الحساب يجري على source=global بحد أدنى MIN_BATTLES_PER_TREND_WINDOW = 3 معارك في كل نصف من النافذة — إذا لم يبلغ أحد النصفين الحد، نُعيد null وتخفي الواجهة السهم بدلاً من اختلاق رقم بإشارة ضعيفة.',
          'يُحسب الاتجاه مسبقاً كل ست ساعات في جدول صغير (public.brawler_trends، صف لكل بطل) عبر مهمة pg_cron. القيام بذلك في قاعدة البيانات بدلاً من استجابة النقطة الطرفية يتجنب مسح عشرات الآلاف من صفوف شريحة 14 يوماً مع كل تحديث ISR. إذا كان الجدول المسبق التحضير أقدم من 12 ساعة أو فارغاً، تسقط النقطة الطرفية إلى مسار inline مرقّم على meta_stats يعيد نفس الاستجابة بكلفة أعلى. الترقيم ضروري لأن PostgREST يقطع بصمت الاستعلامات غير المرقّمة عند 1,000 صف، ما جعل غالبية الأبطال يُعيدون null لخطأ في تقدير العينة.',
          'المنطق مكرر بقصد: نسخة TypeScript في src/lib/brawler-detail/trend.ts (مسار التفصيل) ونسخة SQL في supabase/migrations/022_*.sql (مسار الكميّ). تستخدم كلتاهما نفس العتبة ونفس النافذة ونفس فلتر source=global. إن تباعدتا، ستعرض صفحة البطل الفردية وصفحة المجمّع أرقاماً مختلفة لنفس البطل، لذلك يُطبق أي تغيير في كليهما.',
        ],
      },
      {
        id: 'update-cadence',
        title: 'تواتر التحديث',
        paragraphs: [
          'وتيرة تحديث البيانات تؤثر في كيفية تفسيرها، لذا نوثقها بشكل صريح. الصفحات الثابتة (بما فيها هذه) تستخدم ISR (التجديد التدريجي الثابت) بإعادة تحقق كل 24 ساعة. الصفحات ذات البيانات الديناميكية تخزن استجابة الواجهة حتى تبطلها المهمة المعنية.',
          'الأبطال والجادجت والستار باور تتزامن من واجهة Supercell بمخبأ خادم 24 ساعة. يعمل meta-poll (بيانات PRO) كل 6 ساعات وينتج صفوف meta_stats جديدة. الحساب المسبق لاتجاهات 7 أيام يعمل في pg_cron على "17 */6 * * *" (الدقيقة 17 من كل ست ساعات) لتفادي الاصطدام مع meta-poll. دوران أحداث اللعبة يتجدد كل 30 دقيقة.',
          'تنزل المعارك الفردية لمستخدمي Premium الذين فعّلوا المزامنة فور كل مباراة في نافذة متحركة عبر cron المزامنة. بمجرد دخولها قاعدتنا، تغذي meta_stats بـ source=user وتشكل أساس التحليلات الخاصة في قسم الملف الشخصي؛ لا تظهر أبداً في المجاميع العامة ولا تختلط أبداً مع source=global.',
        ],
      },
    ],
    faqTitle: 'الأسئلة الشائعة',
    faq: [
      {
        q: 'لماذا نسبة فوز بطل بعينة صغيرة ليست 0% أو 100%؟',
        a: 'لأننا نطبق التنعيم البايزي بسابق متمركز عند 50%. مع قليل من المباريات يظل الرقم المعروض قرب 50%؛ مع نمو العينة يقترب من نسبة الفوز الفعلية. هذا متعمد: 100% على 3 مباريات ليست معلومة، بل ضوضاء.',
      },
      {
        q: 'هل تستخدم الصفحات العامة بيانات مستخدمين حقيقيين؟',
        a: 'لا. كل مجمع عام يفلتر بـ source=global الذي لا يضم سوى معارك من أخذ عينات تلقائي لتصنيفات PRO. المعارك الخاصة لمستخدمي Premium تُحفظ بـ source=user ولا تنتقل أبداً إلى الصفحات العامة.',
      },
      {
        q: 'ماذا يحدث عند إصدار Supercell بطلاً جديداً؟',
        a: 'قائمة الأبطال تأتي من الواجهة الرسمية، لذا يظهر الروستر الكامل في الموقع نفس يوم الإطلاق. الندرة والصور تأتي من Brawlify الذي قد يتأخر يوماً إلى ثلاثة؛ نحتفظ بخريطة ندرة محلية (BRAWLER_RARITY_MAP) كـ fallback لتلك الأيام الأولى.',
      },
      {
        q: 'لماذا تُظهر بعض الاتجاهات شرطة بدلاً من نسبة مئوية؟',
        a: 'نعرض الاتجاه فقط إذا كان كل نصف من نافذة 14 يوماً يحتوي على 3 معارك على الأقل في source=global. عندما يكون البطل قليل الظهور، نفضّل عدم إظهار شيء بدلاً من رقم بإشارة ضعيفة.',
      },
      {
        q: 'هل يستخدم الموقع الذكاء الاصطناعي لتوليد الأوصاف؟',
        a: 'تُولّد الأوصاف ديناميكياً من بياناتنا (أفضل خريطة، أفضل وضع، WR بايزي لكل بطل). لا ننسخ نصوصاً من Brawlify أو الويكي، ولا نستخدم نماذج لغوية لتضخيم المحتوى.',
      },
    ],
    contactTitle: 'أسئلة أو تصحيحات؟',
    contactBody: 'إن لاحظت خطأ منهجياً أو تريد اقتراح تحسين، تواصل معنا. نُحدّث هذه الصفحة مع كل تغيير ذي صلة في طريقة احتساب البيانات.',
    aboutLink: 'حول BrawlVision',
    privacyLink: 'سياسة الخصوصية',
  },

  ko: {
    metaTitle: 'BrawlVision 방법론 — 모든 통계를 어떻게 계산하는가',
    metaDescription: 'BrawlVision의 모든 숫자 뒤에 있는 공식, 출처, 갱신 주기: 베이지안 승률, Comfort Score, PRO 샘플링, 시간 창 및 source=global 필터.',
    breadcrumbLabel: '방법론',
    homeAriaLabel: '홈 페이지로 이동',
    eyebrow: '방법론',
    heroTitle: '모든 통계를 어떻게 만드는가',
    heroLead: 'BrawlVision은 Supercell 공식 API, 자체 PRO 플레이어 샘플링 레이어, 그리고 여러 통계 스무딩 단계를 결합하여 안정적이고 비교 가능하며 자체 불확실성에 솔직한 숫자를 제공합니다. 이 페이지는 정확한 공식과 갱신 주기와 함께 각 단계를 문서화합니다.',
    lastUpdated: '마지막 업데이트: {date}',
    tocTitle: '이 페이지에서',
    sections: [
      {
        id: 'data-sources',
        title: '데이터 출처',
        paragraphs: [
          '우리가 표시하는 모든 것은 감사 가능하게 유지하는 세 가지 출처에서 옵니다: Supercell 공개 API (developer.brawlstars.com), Brawlify CDN (cdn.brawlify.com), 그리고 공식 API가 플레이어당 최근 25경기 이후로는 노출하지 않는 전투와 집계를 보존하는 자체 Supabase 데이터베이스.',
          'Supercell API는 구조 데이터(브롤러, 가젯, 스타파워, 하이퍼차지, 기어, 이벤트 로테이션)의 정식 출처이지만 브롤러 이미지, 등급, 긴 설명 같은 핵심 필드는 빠져 있습니다. 이 필드들은 독립적으로 운영되며 때때로 Supercell보다 1~3일 늦는 Brawlify CDN과 교차 참조합니다. 공식 API에 새 브롤러가 등장했지만 Brawlify에 아직 없을 때, 출시일에도 브롤러 페이지가 정확히 렌더되도록 로컬 등급 매핑(BRAWLER_RARITY_MAP)을 유지합니다.',
          '데이터베이스는 meta_stats에 두 종류의 행을 저장합니다: source=user (동기화를 활성화한 프리미엄 사용자의 실제 전투)와 source=global (상위 PRO 랭킹의 자동 샘플링). 사이트의 모든 공개 통계는 source=global 필터로 계산되어 단일 사용자의 개인 데이터가 절대 공개 페이지로 새지 않습니다.',
        ],
      },
      {
        id: 'meta-poll',
        title: 'PRO 데이터 구성 방식',
        paragraphs: [
          'BrawlVision의 "PRO" 레이어는 세계 최고 플레이어들의 최근 전투에서 계산된 집계입니다. 6시간마다 cron 작업(meta-poll)이 경쟁 활동이 집중된 11개국의 Supercell 공식 랭킹을 조회하여 각 상위 200위에서 약 2,100명의 고유 플레이어로 구성된 중복 제거 풀을 만듭니다.',
          '이 풀에 확률적 샘플러를 적용하여 인기 있는 (맵, 모드) 조합이 데이터셋을 지배하고 희귀 조합을 가리지 않도록 합니다. 개별 전투를 받아들일 확률은 p = min(1, (minLive + 1) / (current + 1))이며, minLive는 가장 적게 표현된 조합의 카운트, current는 후보 전투의 조합 카운트입니다. 과소 샘플링된 조합은 더 많은 가중치를 받고, 포화된 조합은 성장이 멈춥니다.',
          'cron은 서버리스 함수의 300초 maxDuration 안에 머물기 위해 270초 소프트 예산으로 실행당 META_POLL_MAX_DEPTH = 1,000명의 플레이어까지 반복합니다. 각 응답은 반복 횟수, 조회된 플레이어 수, 모드별 카운트가 담긴 "adaptive" 진단 블록을 포함하여 비정상 샘플러 동작이 프로덕션에서 관찰 가능하도록 합니다.',
        ],
      },
      {
        id: 'bayesian-wr',
        title: '베이지안 승률',
        paragraphs: [
          '소박한 승률(승리/매치)은 작은 표본에서 오해를 줍니다: 새 맵에서 3-0인 브롤러는 "100% 승률"을 보여주지만 의미가 없습니다. BrawlVision은 베이지안 스무딩으로 이를 보정하고 표본 크기가 매우 다른 브롤러 사이에서도 비교 가능한 숫자를 반환합니다.',
          '공식은 WR_bayesian = (wins + α) / (battles + α + β)이며, α와 β는 50% 승률을 중심으로 하는 사전 신념을 인코딩하는 하이퍼파라미터입니다. 실제로 α = β = 25, "실제 데이터를 보기 전에 50/50의 50번 이전 전투를 가정"하는 것과 같습니다. 3승 0패의 브롤러는 소박한 100%에서 (3 + 25) / (3 + 50) = 52.8%로 이동하여 실제 샘플링 상태를 훨씬 잘 대표합니다.',
          '표본이 커질수록 사전의 가중치는 감소합니다: 1,000 전투와 530승에서 베이지안 WR은 (530 + 25) / (1,000 + 50) = 52.9%로 소박한 53.0%와 거의 동일합니다. 스무딩은 표본이 진짜로 작을 때만 "아픕니다". 이것이 정확히 원하는 속성입니다: 신호가 아닌 노이즈를 처벌합니다.',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score는 "어떤 브롤러로 평균보다 정말 잘하는가?"라는 질문에 답하는 BrawlVision 자체 메트릭입니다. 순수한 승률이 아닙니다: 개인 성과의 다양한 차원을 포괄하기 위해 60/30/10 가중치로 세 가지 구성 요소를 결합합니다.',
          '주요 구성 요소(60%)는 그 브롤러로의 플레이어 승률이며, 글로벌 메타와 동일하게 베이지안 스무딩을 적용해 거의 사용하지 않은 브롤러가 랭킹을 왜곡하지 않게 합니다. 중간 구성 요소(30%)는 이 개인 승률과 브롤러의 전체 메타 승률 간의 차이입니다: 글로벌 메타가 48%일 때 SHELLY로 55%인 플레이어는 메타가 53%인 브롤러로 55%인 플레이어보다 더 많은 comfort를 얻는데, 상대적 향상이 더 크기 때문입니다.',
          '마지막 구성 요소(10%)는 정규화된 사용 빈도입니다: 다른 모든 것이 같다면 브롤러를 100번 플레이하는 것이 10번보다 더 가치가 있습니다. 일관성이 보상받기 때문입니다. 정확한 공식과 가중치는 src/lib/analytics/compute.ts에 있으며 모든 엔드포인트 호출에서 동일하게 적용되어 랭킹이 재현 가능합니다.',
        ],
      },
      {
        id: 'weekly-trends',
        title: '7일 트렌드',
        paragraphs: [
          '모든 공개 브롤러에는 메타 승률이 지난 7일 동안 이전 7일에 비해 어떻게 변했는지(총 14일 창) 보여주는 "+X.Y%" 또는 "−X.Y%" 트렌드 표시기가 있습니다. 계산은 source=global에서 창의 각 절반에 최소 MIN_BATTLES_PER_TREND_WINDOW = 3 전투로 실행됩니다 — 절반 중 하나라도 임계값에 미치지 못하면 null을 반환하고 UI는 약한 신호의 숫자를 만들어내는 대신 화살표를 숨깁니다.',
          '트렌드는 pg_cron 작업으로 6시간마다 작은 테이블(public.brawler_trends, 브롤러당 한 행)에 미리 계산됩니다. 엔드포인트 응답이 아닌 데이터베이스에서 이렇게 하는 것은 모든 ISR 새로고침에서 14일 슬라이스의 수만 행을 스캔하는 것을 피합니다. 미리 계산된 테이블이 12시간 이상 오래되었거나 비어 있으면 엔드포인트는 더 높은 비용으로 동일한 응답을 반환하는 meta_stats의 페이지화된 인라인 경로로 떨어집니다. 페이징은 PostgREST가 페이지화되지 않은 쿼리를 1,000행으로 조용히 자르기 때문에 필요하며, 이는 한때 대부분의 브롤러가 가짜 언더샘플링으로 null을 반환하게 했습니다.',
          '논리는 의도적으로 중복 존재합니다: src/lib/brawler-detail/trend.ts의 TypeScript 버전(상세 경로)과 supabase/migrations/022_*.sql의 SQL 버전(대량 경로). 둘 다 동일한 임계값, 동일한 창, 동일한 source=global 필터를 사용합니다. 발산하면 브롤러별 상세 페이지와 집계 페이지가 같은 브롤러에 대해 다른 숫자를 보여주게 되므로 모든 변경은 둘 다에 적용됩니다.',
        ],
      },
      {
        id: 'update-cadence',
        title: '갱신 주기',
        paragraphs: [
          '데이터가 얼마나 자주 새로 고쳐지는지는 해석 방식에 영향을 미치므로 명시적으로 문서화합니다. 정적 페이지(이 페이지 포함)는 24시간 재검증의 ISR(Incremental Static Regeneration)을 사용합니다. 동적 데이터가 있는 페이지는 관련 작업이 무효화할 때까지 API 응답을 캐시합니다.',
          '브롤러, 가젯, 스타파워는 24시간 서버 캐시로 Supercell API에서 동기화됩니다. meta-poll(PRO 데이터)은 6시간마다 실행되어 새로운 meta_stats 행을 생성합니다. 7일 트렌드 사전 계산은 meta-poll과 충돌을 피하기 위해 pg_cron의 "17 */6 * * *"(매 6시간마다 17분)에서 실행됩니다. 게임 내 이벤트 로테이션은 30분마다 새로 고쳐집니다.',
          '동기화를 활성화한 프리미엄 사용자의 개별 전투는 sync cron을 통해 슬라이딩 윈도우에서 각 매치 직후에 다운로드됩니다. 데이터베이스에 들어가면 source=user로 meta_stats를 채우고 프로필 섹션의 비공개 분석의 기반이 됩니다; 공개 집계에 절대 나타나지 않으며 source=global과 절대 섞이지 않습니다.',
        ],
      },
    ],
    faqTitle: '자주 묻는 질문',
    faq: [
      {
        q: '표본이 적은 브롤러의 승률이 0% 또는 100%가 아닌 이유는?',
        a: '50% 중심의 사전을 가진 베이지안 스무딩을 적용하기 때문입니다. 매치가 매우 적으면 표시되는 숫자는 50%에 가깝고; 표본이 커지면 실제 승률에 수렴합니다. 의도적입니다: 3매치에서 100%는 정보가 아니라 노이즈입니다.',
      },
      {
        q: '공개 페이지가 실제 사용자 데이터를 사용하나요?',
        a: '아니요. 모든 공개 집계는 PRO 랭킹 자동 샘플링에서 가져온 전투만 포함하는 source=global로 필터링합니다. 프리미엄 사용자의 비공개 전투는 source=user로 저장되며 공개 페이지로 절대 넘어가지 않습니다.',
      },
      {
        q: 'Supercell이 새 브롤러를 출시하면 어떻게 되나요?',
        a: '브롤러 목록은 공식 API에서 가져오므로 출시 당일 사이트에 전체 로스터가 나타납니다. 등급과 이미지는 1~3일 지연될 수 있는 Brawlify에서 가져옵니다; 첫 며칠을 위한 폴백으로 로컬 등급 매핑(BRAWLER_RARITY_MAP)을 유지합니다.',
      },
      {
        q: '일부 트렌드가 백분율 대신 대시를 보여주는 이유는?',
        a: '14일 창의 각 절반에 source=global에 최소 3개의 전투가 있을 때만 트렌드를 표시합니다. 브롤러를 거의 보지 못할 때는 약한 신호의 숫자보다 아무것도 표시하지 않는 것을 선호합니다.',
      },
      {
        q: '사이트가 설명을 생성하는 데 AI를 사용하나요?',
        a: '설명은 자체 데이터(최고 맵, 최고 모드, 브롤러별 베이지안 승률)에서 동적으로 생성됩니다. Brawlify나 위키에서 텍스트를 복사하지 않으며 콘텐츠를 부풀리기 위해 언어 모델을 사용하지 않습니다.',
      },
    ],
    contactTitle: '질문이나 수정 사항?',
    contactBody: '방법론적 오류를 발견했거나 개선을 제안하고 싶으면 연락해 주세요. 데이터 계산 방식의 모든 관련 변경 사항으로 이 페이지를 동기화 상태로 유지합니다.',
    aboutLink: 'BrawlVision 소개',
    privacyLink: '개인정보 처리방침',
  },

  ja: {
    metaTitle: 'BrawlVisionの方法論 — 各統計の算出方法',
    metaDescription: 'BrawlVisionに表示される各数値の背後にある式、出典、更新頻度: ベイジアン勝率、Comfort Score、PROサンプリング、時間ウィンドウ、source=globalフィルター。',
    breadcrumbLabel: '方法論',
    homeAriaLabel: 'ホームページへ戻る',
    eyebrow: '方法論',
    heroTitle: '各統計をどう構築しているか',
    heroLead: 'BrawlVisionはSupercellの公式API、独自のPROプレイヤーサンプリング層、複数の統計平滑化ステップを組み合わせて、安定し、比較可能で、自身の不確実性に正直な数値を提供します。本ページではそれぞれのステップを正確な式と更新頻度とともに記載します。',
    lastUpdated: '最終更新: {date}',
    tocTitle: 'このページの内容',
    sections: [
      {
        id: 'data-sources',
        title: 'データソース',
        paragraphs: [
          '表示するすべては監査可能に保つ3つのソースから来ています: Supercell公開API（developer.brawlstars.com）、Brawlify CDN（cdn.brawlify.com）、そしてプレイヤーごとの直近25試合を超えて公式APIが公開しないバトルや集計を永続化する弊社のSupabaseデータベース。',
          'Supercell APIは構造データ（ブロウラー、ガジェット、スターパワー、ハイパーチャージ、ギア、イベントローテーション）の正典源ですが、ブロウラー画像、レアリティ、長文説明などの重要なフィールドは含まれていません。これらのフィールドは独立して運営され、時にSupercellより1〜3日遅れるBrawlify CDNとクロスチェックします。公式APIに新ブロウラーが現れBrawlifyにまだ存在しない場合、ローンチ日にもブロウラーページが正しくレンダリングされるよう、ローカルレアリティマップ（BRAWLER_RARITY_MAP）を保持します。',
          'データベースはmeta_stats内に2クラスの行を保存します: source=user（同期を有効にしたプレミアムユーザーの実バトル）とsource=global（上位PROランキングからの自動サンプリング）。サイトの公開統計はすべてsource=globalでフィルターして計算され、個別ユーザーの個人データが公開ページに漏れることはありません。',
        ],
      },
      {
        id: 'meta-poll',
        title: 'PROデータの構築方法',
        paragraphs: [
          'BrawlVisionの「PRO」層は、世界トップ選手の最新バトルに対して計算された集計です。6時間ごとにcronジョブ（meta-poll）が、競技活動が集中する11カ国のSupercell公式ランキングをクエリし、各トップ200から約2,100人のユニークプレイヤーで構成される重複排除済みプールを構築します。',
          'このプールに確率的サンプラーを適用し、人気のある（マップ、モード）の組み合わせがデータセットを支配して稀なものをマスクするのを防ぎます。個々のバトルを受け入れる確率はp = min(1, (minLive + 1) / (current + 1))で、minLiveは最も代表されない組み合わせのカウント、currentは候補バトルの組み合わせのカウントです。サンプル不足の組み合わせはより多くの重みを受け取り、飽和したものは成長を止めます。',
          'cronはサーバーレス関数の300秒maxDurationに収まるよう270秒のソフト予算で実行ごとにMETA_POLL_MAX_DEPTH = 1,000人まで反復します。各応答にはイテレーションカウント、サンプル対象プレイヤー、モード別カウントを含む「adaptive」診断ブロックがあり、サンプラーの異常動作が本番で観察可能です。',
        ],
      },
      {
        id: 'bayesian-wr',
        title: 'ベイジアン勝率',
        paragraphs: [
          'ナイーブな勝率（勝利/試合）は小サンプルでは誤解を招きます: 新マップで3-0のブロウラーは「100%勝率」と表示されますが何の意味もありません。BrawlVisionはこれを補正するためベイジアン平滑化を使用し、サンプルサイズが大きく異なるブロウラー間でも比較可能な数値を返します。',
          '式はWR_bayesian = (wins + α) / (battles + α + β)で、αとβは50%勝率を中心とする事前信念をエンコードするハイパーパラメータです。実用上α = β = 25、つまり「実データを見る前に50/50の50バトルを仮定する」に相当します。3勝0敗のブロウラーはナイーブな100%から(3 + 25) / (3 + 50) = 52.8%に移行し、サンプリングの実態をはるかによく表します。',
          'サンプルが大きくなるにつれ事前分布の重みは減少します: 1,000バトル530勝でベイジアン勝率は(530 + 25) / (1,000 + 50) = 52.9%、ナイーブな53.0%とほぼ同じです。平滑化はサンプルが本当に小さい時にのみ「痛み」ます。これがまさに望ましい性質です: ノイズを罰し、シグナルを罰しない。',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort ScoreはBrawlVision独自のメトリクスで「平均より実際にどのブロウラーで上手いか」に答えます。生の勝率ではありません: 個人パフォーマンスの異なる側面をカバーするため、60/30/10の重みで3コンポーネントを組み合わせます。',
          '主要コンポーネント（60%）はそのブロウラーでのプレイヤー勝率で、グローバルメタと同じくベイジアン平滑化が適用され、ほぼ使われないブロウラーがランキングを歪めないようにします。中間コンポーネント（30%）はこの個人勝率とブロウラー全体のメタ勝率との差です: グローバルメタが48%の時にSHELLYで55%のプレイヤーは、メタが53%のブロウラーで55%のプレイヤーより多くのcomfortを得ます。相対的な伸びが大きいからです。',
          '最終コンポーネント（10%）は正規化された使用頻度です: 他が同じ条件なら、ブロウラーを100回プレイすることは10回プレイすることよりも価値があります。一貫性が報われるからです。正確な式と重みはsrc/lib/analytics/compute.tsにあり、各エンドポイント呼び出しで同一に適用され、ランキングは再現可能です。',
        ],
      },
      {
        id: 'weekly-trends',
        title: '7日間のトレンド',
        paragraphs: [
          'すべての公開ブロウラーには「+X.Y%」または「−X.Y%」のトレンドインジケータがあり、メタ勝率が直近7日と前7日（合計14日ウィンドウ）でどう変化したかを示します。計算はsource=globalで、ウィンドウの各半分に最低MIN_BATTLES_PER_TREND_WINDOW = 3バトルで実行されます — 半分の一方でも閾値に達しなければnullを返し、UIは弱い信号の数を捏造する代わりに矢印を隠します。',
          'トレンドはpg_cronジョブにより6時間ごとに小テーブル（public.brawler_trends、ブロウラーごとに1行）で事前計算されます。エンドポイント応答ではなくDBで行うことで、ISRリフレッシュごとに14日スライスの数万行をスキャンすることを避けます。事前計算テーブルが12時間以上古いか空の場合、エンドポイントはmeta_statsへのページネーションされたインラインルートにフォールバックし、より高いコストで同じ応答を返します。PostgRESTがページネーションされていないクエリを1,000行に静かに切り詰めるため、ページネーションが必要で、これにより一度多くのブロウラーが偽のアンダーサンプリングでnullを返したことがあります。',
          'ロジックは設計上重複して存在します: src/lib/brawler-detail/trend.tsのTypeScriptバージョン（詳細ルート）とsupabase/migrations/022_*.sqlのSQLバージョン（バルクルート）。両者は同じ閾値、同じウィンドウ、同じsource=globalフィルタを使用します。乖離するとブロウラー個別ページと集計ページが同じブロウラーに対して異なる数を表示するため、変更は両方に適用されます。',
        ],
      },
      {
        id: 'update-cadence',
        title: '更新頻度',
        paragraphs: [
          'データがどれくらいの頻度で更新されるかは解釈に影響するため、明示的に文書化します。静的ページ（このページを含む）は24時間再検証のISR（Incremental Static Regeneration）を使用します。動的データを持つページは、関連ジョブが無効化するまでAPI応答をキャッシュします。',
          'ブロウラー、ガジェット、スターパワーは24時間サーバーキャッシュでSupercell APIから同期します。meta-poll（PROデータ）は6時間ごとに実行され新しいmeta_stats行を生成します。7日トレンドの事前計算はmeta-pollとの衝突を避けるためpg_cronで「17 */6 * * *」（6時間ごとの17分）に実行されます。ゲーム内イベントローテーションは30分ごとに更新されます。',
          '同期を有効にしたプレミアムユーザーの個別バトルは、sync cron経由でスライディングウィンドウで各試合直後にダウンロードされます。データベースに入るとsource=userでmeta_statsに供給され、プロフィールセクションのプライベート分析の基礎となります; 公開集計には決して現れず、source=globalと混ざることもありません。',
        ],
      },
    ],
    faqTitle: 'よくある質問',
    faq: [
      {
        q: 'サンプルが少ないブロウラーの勝率が0%や100%にならないのはなぜ?',
        a: '50%中心の事前を持つベイジアン平滑化を適用しているからです。試合がごくわずかな時、表示される数値は50%付近にあり、サンプルが大きくなるにつれ実際の勝率に収束します。これは意図的です: 3試合で100%は情報ではなくノイズです。',
      },
      {
        q: '公開ページは実ユーザーのデータを使用していますか?',
        a: 'いいえ。すべての公開集計はsource=globalでフィルターされ、PROランキングの自動サンプリングからのバトルのみを含みます。プレミアムユーザーのプライベートバトルはsource=userで保存され、公開ページには決して交差しません。',
      },
      {
        q: 'Supercellが新ブロウラーをリリースするとどうなりますか?',
        a: 'ブロウラーリストは公式APIから来るため、ローンチ当日に完全なロースターがサイトに表示されます。レアリティと画像は1〜3日遅れる可能性があるBrawlifyから来ます; 最初の数日のフォールバックとしてローカルレアリティマップ（BRAWLER_RARITY_MAP）を保持しています。',
      },
      {
        q: '一部のトレンドがパーセンテージの代わりにダッシュを表示するのはなぜ?',
        a: '14日ウィンドウの各半分にsource=globalで少なくとも3バトルがある場合のみトレンドを表示します。ブロウラーがほとんど見られない時は、弱い信号の数字より何も表示しない方を選びます。',
      },
      {
        q: 'サイトは説明生成にAIを使用していますか?',
        a: '説明は自前のデータ（ベストマップ、ベストモード、ブロウラーごとのベイジアン勝率）から動的に生成されます。Brawlifyやwikiからテキストをコピーすることはなく、コンテンツを膨らませるために言語モデルを使用することもありません。',
      },
    ],
    contactTitle: '質問や訂正?',
    contactBody: '方法論上のエラーを見つけた、または改善を提案したい場合はご連絡ください。データ計算方法の関連する変更ごとにこのページを同期させています。',
    aboutLink: 'BrawlVisionについて',
    privacyLink: 'プライバシーポリシー',
  },

  zh: {
    metaTitle: 'BrawlVision 方法论 — 每项统计如何计算',
    metaDescription: 'BrawlVision 上每个数字背后的公式、来源和更新频率: 贝叶斯胜率、Comfort Score、PRO 采样、时间窗口和 source=global 过滤器。',
    breadcrumbLabel: '方法论',
    homeAriaLabel: '返回首页',
    eyebrow: '方法论',
    heroTitle: '我们如何构建每项统计',
    heroLead: 'BrawlVision 结合 Supercell 官方 API、自有的 PRO 玩家采样层和多个统计平滑步骤，为你提供稳定、可比、对自身不确定性诚实的数字。本页用准确的公式和更新频率记录每个步骤。',
    lastUpdated: '最后更新: {date}',
    tocTitle: '在本页',
    sections: [
      {
        id: 'data-sources',
        title: '数据来源',
        paragraphs: [
          '我们展示的所有内容来自三个保持可审计的来源: Supercell 公开 API（developer.brawlstars.com）、Brawlify CDN（cdn.brawlify.com），以及我们自己的 Supabase 数据库，它持久保存官方 API 在每个玩家最近 25 场比赛之外不公开的战斗和聚合。',
          'Supercell API 是结构数据的标准来源——英雄、小工具、星能、超级充能、装备和事件轮换——但它遗漏了关键字段，如英雄图像、稀有度和长描述。我们将这些字段与独立运行、有时落后 Supercell 一到三天的 Brawlify CDN 进行交叉引用。当我们在官方 API 中检测到 Brawlify 上还不存在的新英雄时，我们保留本地稀有度映射（BRAWLER_RARITY_MAP），以便英雄页面在发布日正确渲染。',
          '我们的数据库在 meta_stats 表中存储两类行: source=user（启用同步的高级用户的真实战斗）和 source=global（来自顶级 PRO 排行榜的自动采样）。网站上的每项公开统计都使用 source=global 过滤器计算，以确保任何单一用户的个人数据永远不会泄漏到公开页面。',
        ],
      },
      {
        id: 'meta-poll',
        title: '我们如何构建 PRO 数据',
        paragraphs: [
          'BrawlVision 的"PRO"层是基于世界顶级玩家的最近战斗计算的聚合。每六小时一次 cron 任务（meta-poll）查询竞争活动集中的十一个国家的 Supercell 官方排名，并构建一个去重的池，约有 2,100 名独特玩家来自每个国家的前 200 名。',
          '我们对这个池应用概率采样器，以防止流行的（地图、模式）组合主导数据集并掩盖罕见组合。接受单个战斗的概率为 p = min(1, (minLive + 1) / (current + 1))，其中 minLive 是最少代表组合的计数，current 是候选战斗组合的计数。采样不足的组合获得更多权重，饱和的组合停止增长。',
          'cron 每次运行迭代最多 META_POLL_MAX_DEPTH = 1,000 名玩家，软预算 270 秒，以保持在无服务器函数的 300 秒 maxDuration 内。每个响应包含一个"adaptive"诊断块，包含迭代计数、查询的玩家和按模式的计数，以便任何异常的采样器行为在生产中可观察。',
        ],
      },
      {
        id: 'bayesian-wr',
        title: '贝叶斯胜率',
        paragraphs: [
          '朴素胜率（胜利 / 比赛）在小样本上具有误导性: 在新地图上 3-0 的英雄显示"100% 胜率"，但这没有任何意义。BrawlVision 使用贝叶斯平滑来纠正此问题，并返回一个在样本量差异很大的英雄之间可比较的数字。',
          '公式为 WR_bayesian = (wins + α) / (battles + α + β)，其中 α 和 β 是对以 50% 胜率为中心的先验信念进行编码的超参数。实际上 α = β = 25，相当于"在看到真实数据之前假设 50 场之前的 50/50 战斗"。3 胜 0 负的英雄从朴素的 100% 转为 (3 + 25) / (3 + 50) = 52.8%，更能代表实际采样状态。',
          '随着样本增长，先验的权重减小: 1,000 场战斗和 530 胜时，贝叶斯胜率为 (530 + 25) / (1,000 + 50) = 52.9%，几乎与朴素的 53.0% 相同。平滑只在样本真的很小的时候"伤害"。这正是所需的属性: 惩罚噪声而非信号。',
        ],
      },
      {
        id: 'comfort-score',
        title: 'Comfort Score',
        paragraphs: [
          'Comfort Score 是 BrawlVision 自有的指标，回答"你用哪个英雄真的比平均水平打得更好？"这不是原始胜率: 它以 60/30/10 的权重组合三个组件，覆盖个人表现的不同维度。',
          '主要组件（60%）是玩家用该英雄的胜率，与全球元数据一样进行贝叶斯平滑，以防一个很少使用的英雄扭曲排名。中间组件（30%）是这个个人胜率与英雄整体元数据胜率之间的差异: 当全球元数据为 48% 时，SHELLY 上 55% 的玩家比元数据为 53% 的英雄上 55% 的玩家获得更多 comfort，因为相对提升更大。',
          '最后一个组件（10%）是归一化使用频率: 在其他条件相等的情况下，玩一个英雄 100 次比 10 次更有价值，因为一致性会得到奖励。确切的公式和权重位于 src/lib/analytics/compute.ts，并在每次端点调用时相同地应用，使排名可重现。',
        ],
      },
      {
        id: 'weekly-trends',
        title: '7 天趋势',
        paragraphs: [
          '每个公开英雄都有一个"+X.Y%"或"−X.Y%"的趋势指示器，显示其元数据胜率在过去 7 天与前 7 天（共 14 天窗口）相比有何变化。计算在 source=global 上运行，窗口每半部分至少 MIN_BATTLES_PER_TREND_WINDOW = 3 场战斗 — 如果任何一半低于阈值，我们返回 null，UI 隐藏箭头而不是编造一个低信号数。',
          '趋势由 pg_cron 任务每六小时在小表（public.brawler_trends，每个英雄一行）中预计算。在数据库中而非端点响应中执行此操作可避免在每次 ISR 刷新时扫描 14 天切片的数万行。如果预计算表超过 12 小时或为空，端点会回退到 meta_stats 上的分页内联路由，以更高的成本返回相同的响应。分页是必需的，因为 PostgREST 静默将未分页的查询截断为 1,000 行，这曾经导致大多数英雄因虚假欠采样而返回 null。',
          '逻辑按设计重复存在: src/lib/brawler-detail/trend.ts 中的 TypeScript 版本（详细路由）和 supabase/migrations/022_*.sql 中的 SQL 版本（批量路由）。两者都使用相同的阈值、相同的窗口和相同的 source=global 过滤器。如果它们分歧，每个英雄的详细页面和聚合页面将为同一英雄显示不同的数字，所以任何更改都应用于两者。',
        ],
      },
      {
        id: 'update-cadence',
        title: '更新频率',
        paragraphs: [
          '数据更新的频率影响你应该如何解释，所以我们明确记录。静态页面（包括此页面）使用 24 小时重新验证的 ISR（增量静态再生）。动态数据的页面缓存 API 响应，直到相关任务使其无效。',
          '英雄、小工具和星能从 Supercell API 同步，服务器缓存 24 小时。meta-poll（PRO 数据）每 6 小时运行一次，生成新的 meta_stats 行。7 天趋势预计算在 pg_cron 中以"17 */6 * * *"（每 6 小时的 17 分钟）运行，以避免与 meta-poll 冲突。游戏内事件轮换每 30 分钟刷新一次。',
          '启用同步的高级用户的个别战斗在每场比赛后立即通过 sync cron 在滑动窗口中下载。一旦进入我们的数据库，它们以 source=user 输入 meta_stats，并是个人资料部分私有分析的基础; 它们从不出现在公开聚合中，也从不与 source=global 混合。',
        ],
      },
    ],
    faqTitle: '常见问题',
    faq: [
      {
        q: '为什么样本少的英雄的胜率不是 0% 或 100%？',
        a: '因为我们应用以 50% 为中心的先验的贝叶斯平滑。在比赛非常少的情况下，显示的数字接近 50%; 随着样本增长，它收敛到真实胜率。这是有意的: 3 场比赛中的 100% 不是信息，而是噪声。',
      },
      {
        q: '公开页面使用真实用户数据吗？',
        a: '不。每个公开聚合都用 source=global 过滤，它只包含来自 PRO 排行榜自动采样的战斗。高级用户的私人战斗以 source=user 存储，永远不会越界到公开页面。',
      },
      {
        q: 'Supercell 发布新英雄时会发生什么？',
        a: '英雄列表来自官方 API，因此完整阵容会在发布当天出现在网站上。稀有度和图像来自 Brawlify，可能延迟一到三天; 我们在这些初始日子保留本地稀有度映射（BRAWLER_RARITY_MAP）作为后备。',
      },
      {
        q: '为什么有些趋势显示破折号而不是百分比？',
        a: '只有当 14 天窗口的每半部分在 source=global 中至少有 3 场战斗时，我们才显示趋势。当英雄很少见时，我们宁可什么都不显示也不显示低信号数。',
      },
      {
        q: '网站使用 AI 生成描述吗？',
        a: '描述是从我们自己的数据（最佳地图、最佳模式、每个英雄的贝叶斯胜率）动态生成的。我们不从 Brawlify 或 wiki 复制文本，也不使用语言模型来膨胀内容。',
      },
    ],
    contactTitle: '问题或更正？',
    contactBody: '如果你发现方法论错误或想建议改进，请联系我们。我们使此页面与数据计算方式的每一个相关更改保持同步。',
    aboutLink: '关于 BrawlVision',
    privacyLink: '隐私政策',
  },
}

// Footer link key — sits in the `landing` namespace next to other
// footer entries (privacyLink, battleHistoryLink, etc).
const LANDING_FOOTER_LINK = {
  es: 'Metodología',
  en: 'Methodology',
  fr: 'Méthodologie',
  pt: 'Metodologia',
  de: 'Methodik',
  it: 'Metodologia',
  ru: 'Методология',
  tr: 'Metodoloji',
  pl: 'Metodologia',
  ar: 'المنهجية',
  ko: '방법론',
  ja: '方法論',
  zh: '方法论',
}

let totalAdditions = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  const namespace = TRANSLATIONS[locale]
  if (!namespace) {
    console.warn(`  ${locale.padEnd(3)}  SKIP — no translation defined`)
    continue
  }
  data.methodology = namespace

  if (!data.landing) data.landing = {}
  data.landing.methodologyLink = LANDING_FOOTER_LINK[locale]

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  const keyCount = Object.keys(namespace).length + 1
  totalAdditions += keyCount
  console.log(`  ${locale.padEnd(3)}  methodology namespace (${Object.keys(namespace).length} keys) + landing.methodologyLink`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
