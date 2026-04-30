#!/usr/bin/env node
// SEO + AdSense compliance — /about page i18n batch.
//
// Adds the `about` namespace × 13 locales. The page complements
// /methodology by providing the "who is behind this site" signal
// (Authoritativeness + Trustworthiness in the E-E-A-T framework
// AdSense reviewers use). Footer site-wide already links it; this
// script provides the actual copy.
//
// Idempotent: re-running overwrites existing keys with the latest
// values. This file is the single source of truth for /about copy.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    metaTitle: 'Sobre BrawlVision — quiénes hacemos esta plataforma',
    metaDescription: 'Quiénes somos, cómo funciona BrawlVision, y por qué construimos analítica independiente para Brawl Stars: misión, equipo, contacto y compromisos editoriales.',
    breadcrumbLabel: 'Sobre nosotros',
    homeAriaLabel: 'Ir a la página principal',
    eyebrow: 'Sobre nosotros',
    heroTitle: 'Analítica independiente para Brawl Stars',
    heroLead: 'BrawlVision es un proyecto independiente que cruza la API oficial de Supercell con un sistema propio de muestreo PRO para que cualquier jugador, gratis o premium, pueda ver el meta del juego con números honestos. No somos parte de Supercell ni estamos afiliados con Brawlify; somos lectores de sus datos públicos y los presentamos con metodología abierta.',
    sections: [
      {
        id: 'mission',
        title: 'Por qué existimos',
        paragraphs: [
          'La API pública de Brawl Stars solo conserva las últimas 25 batallas por jugador y no expone agregados del meta. Eso significa que cualquier insight más profundo que "¿gané o perdí mi última partida?" requiere una capa de cálculo que el juego oficial no provee. BrawlVision construye esa capa: persistimos batallas, agregamos resultados de los rankings PRO mundiales y publicamos win rates, comfort scores y tendencias semanales que no encontrarás en la app del juego.',
          'Lo hacemos público y multilingüe (13 idiomas) porque la comunidad competitiva no debería depender de hojas de cálculo privadas o canales cerrados. Lo hacemos con metodología documentada porque los números sin fórmula son opinión disfrazada de dato.',
        ],
      },
      {
        id: 'team',
        title: 'Quién está detrás',
        paragraphs: [
          'BrawlVision lo mantiene un equipo pequeño de desarrolladores con experiencia en backend de datos y UI de aplicaciones móviles. Diseñamos, construimos, operamos y respondemos los emails. No tenemos inversores externos ni acuerdos comerciales con creadores de contenido; el sitio se sostiene con suscripciones premium y publicidad compliant en algunas páginas públicas.',
          'Si encuentras un error en un cálculo, en una traducción o en un dato, escríbenos: la página `/methodology` describe cada fórmula y cuándo se actualiza. Corregimos los errores en cuanto los confirmamos y dejamos un registro en el changelog interno.',
        ],
      },
      {
        id: 'editorial',
        title: 'Nuestros compromisos editoriales',
        paragraphs: [
          'Separamos los datos personales de los datos públicos: cualquier estadística que aparece en una página pública (`/brawler`, `/picks`, etc.) se calcula filtrando por `source=global`, que solo contiene batallas tomadas del muestreo PRO automático. Las batallas privadas de usuarios premium nunca se mezclan con las públicas.',
          'No publicamos contenido escrito por modelos de lenguaje ni copiamos descripciones de Brawlify o de la wiki. Los textos de las páginas individuales de brawlers se generan dinámicamente a partir de nuestras propias agregaciones (mejor mapa, mejor modo, win rate bayesiano), y los artículos editoriales están escritos por personas. Aceptamos que eso es más lento; preferimos lentitud a contenido de bajo valor.',
          'Si Supercell, Brawlify o cualquier titular de copyright nos solicita retirar un contenido, lo hacemos. El correo de contacto está en este mismo bloque y respondemos en 72 horas hábiles.',
        ],
      },
    ],
    contactTitle: 'Contacto',
    contactBody: 'Para correcciones metodológicas, peticiones de retirada, sugerencias de feature o reporte de bugs, escríbenos al correo siguiente. Respondemos en 72 horas hábiles.',
    methodologyLink: 'Metodología',
    privacyLink: 'Privacidad',
    disclaimer: 'BrawlVision no está afiliado con Supercell ni con Brawl Stars. Brawl Stars es marca registrada de Supercell Oy. Las imágenes y datos del juego son propiedad de Supercell.',
  },

  en: {
    metaTitle: 'About BrawlVision — who builds this platform',
    metaDescription: 'Who we are, how BrawlVision works, and why we built independent analytics for Brawl Stars: mission, team, contact, and editorial commitments.',
    breadcrumbLabel: 'About',
    homeAriaLabel: 'Go to the home page',
    eyebrow: 'About',
    heroTitle: 'Independent analytics for Brawl Stars',
    heroLead: 'BrawlVision is an independent project that combines Supercell\'s official API with our own PRO-sampling system so any player — free or premium — can see the game\'s meta with honest numbers. We are not part of Supercell, and we\'re not affiliated with Brawlify; we are readers of their public data and we present it with open methodology.',
    sections: [
      {
        id: 'mission',
        title: 'Why we exist',
        paragraphs: [
          'The public Brawl Stars API only keeps the last 25 battles per player and exposes no meta aggregates. Any insight deeper than "did I win or lose my last match?" requires a computation layer the official game does not provide. BrawlVision builds that layer: we persist battles, aggregate results from world PRO rankings, and publish win rates, comfort scores, and weekly trends you won\'t find in the game app.',
          'We do it publicly and multilingually (13 languages) because the competitive community shouldn\'t depend on private spreadsheets or closed channels. We do it with documented methodology because numbers without a formula are opinion dressed up as data.',
        ],
      },
      {
        id: 'team',
        title: 'Who is behind it',
        paragraphs: [
          'BrawlVision is maintained by a small team of developers with backgrounds in data backends and mobile-app UI. We design, build, operate, and answer the emails. We have no external investors and no commercial agreements with content creators; the site is funded through premium subscriptions and compliant advertising on some public pages.',
          'If you spot an error in a calculation, a translation, or a data point, write to us: the `/methodology` page describes every formula and when it is updated. We fix errors as soon as we confirm them and keep a record in the internal changelog.',
        ],
      },
      {
        id: 'editorial',
        title: 'Our editorial commitments',
        paragraphs: [
          'We separate personal data from public data: every statistic shown on a public page (`/brawler`, `/picks`, etc.) is computed by filtering on `source=global`, which only contains battles taken from automated PRO sampling. Premium users\' private battles never mix into the public ones.',
          'We do not publish content written by language models, and we do not copy descriptions from Brawlify or the wiki. The text on individual brawler pages is generated dynamically from our own aggregates (best map, best mode, Bayesian win rate), and editorial articles are written by people. We accept that this is slower; we prefer slow over low-value content.',
          'If Supercell, Brawlify, or any copyright holder asks us to remove content, we do so. The contact email is in this block and we respond within 72 business hours.',
        ],
      },
    ],
    contactTitle: 'Contact',
    contactBody: 'For methodological corrections, takedown requests, feature suggestions, or bug reports, write to the email below. We respond within 72 business hours.',
    methodologyLink: 'Methodology',
    privacyLink: 'Privacy',
    disclaimer: 'BrawlVision is not affiliated with Supercell or Brawl Stars. Brawl Stars is a registered trademark of Supercell Oy. Game images and data are the property of Supercell.',
  },

  fr: {
    metaTitle: 'À propos de BrawlVision — qui construit cette plateforme',
    metaDescription: 'Qui nous sommes, comment fonctionne BrawlVision, et pourquoi nous construisons une analytique indépendante pour Brawl Stars : mission, équipe, contact et engagements éditoriaux.',
    breadcrumbLabel: 'À propos',
    homeAriaLabel: 'Aller à la page d\'accueil',
    eyebrow: 'À propos',
    heroTitle: 'Analytique indépendante pour Brawl Stars',
    heroLead: 'BrawlVision est un projet indépendant qui croise l\'API officielle de Supercell avec notre propre système d\'échantillonnage PRO pour que n\'importe quel joueur — gratuit ou premium — puisse voir le meta du jeu avec des chiffres honnêtes. Nous ne faisons pas partie de Supercell et nous ne sommes pas affiliés à Brawlify ; nous lisons leurs données publiques et nous les présentons avec une méthodologie ouverte.',
    sections: [
      {
        id: 'mission',
        title: 'Pourquoi nous existons',
        paragraphs: [
          'L\'API publique de Brawl Stars ne conserve que les 25 derniers combats par joueur et n\'expose aucun agrégat du meta. N\'importe quelle observation plus profonde que « ai-je gagné ou perdu mon dernier match ? » exige une couche de calcul que le jeu officiel ne fournit pas. BrawlVision construit cette couche : nous persistons les combats, agrégeons les résultats des classements PRO mondiaux, et publions taux de victoire, comfort scores et tendances hebdomadaires que tu ne trouveras pas dans l\'app du jeu.',
          'Nous le faisons publiquement et en plusieurs langues (13) parce que la communauté compétitive ne devrait pas dépendre de feuilles de calcul privées ou de canaux fermés. Nous le faisons avec une méthodologie documentée parce que les chiffres sans formule sont une opinion déguisée en donnée.',
        ],
      },
      {
        id: 'team',
        title: 'Qui est derrière',
        paragraphs: [
          'BrawlVision est maintenu par une petite équipe de développeurs avec une expérience en backends de données et UI d\'applications mobiles. Nous concevons, construisons, opérons et répondons aux emails. Nous n\'avons pas d\'investisseurs externes ni d\'accords commerciaux avec des créateurs de contenu ; le site est financé par les abonnements premium et la publicité compliant sur certaines pages publiques.',
          'Si tu trouves une erreur dans un calcul, une traduction ou une donnée, écris-nous : la page `/methodology` décrit chaque formule et quand elle est mise à jour. Nous corrigeons les erreurs dès que nous les confirmons et conservons une trace dans le changelog interne.',
        ],
      },
      {
        id: 'editorial',
        title: 'Nos engagements éditoriaux',
        paragraphs: [
          'Nous séparons les données personnelles des données publiques : chaque statistique affichée sur une page publique (`/brawler`, `/picks`, etc.) est calculée en filtrant sur `source=global`, qui ne contient que des combats issus de l\'échantillonnage PRO automatique. Les combats privés des utilisateurs premium ne se mélangent jamais aux publics.',
          'Nous ne publions pas de contenu écrit par modèles de langage et nous ne copions pas de descriptions de Brawlify ou de la wiki. Les textes des pages individuelles de brawlers sont générés dynamiquement à partir de nos propres agrégats (meilleure carte, meilleur mode, taux de victoire bayésien), et les articles éditoriaux sont écrits par des personnes. Nous acceptons que ce soit plus lent ; nous préférons la lenteur au contenu de faible valeur.',
          'Si Supercell, Brawlify ou n\'importe quel détenteur de droits nous demande de retirer un contenu, nous le faisons. L\'email de contact est dans ce bloc et nous répondons sous 72 heures ouvrées.',
        ],
      },
    ],
    contactTitle: 'Contact',
    contactBody: 'Pour les corrections méthodologiques, demandes de retrait, suggestions de fonctionnalités ou rapports de bug, écris à l\'email ci-dessous. Nous répondons sous 72 heures ouvrées.',
    methodologyLink: 'Méthodologie',
    privacyLink: 'Confidentialité',
    disclaimer: 'BrawlVision n\'est pas affilié à Supercell ni à Brawl Stars. Brawl Stars est une marque déposée de Supercell Oy. Les images et données du jeu sont la propriété de Supercell.',
  },

  pt: {
    metaTitle: 'Sobre o BrawlVision — quem constrói esta plataforma',
    metaDescription: 'Quem somos, como o BrawlVision funciona, e por que construímos análises independentes para Brawl Stars: missão, equipe, contato e compromissos editoriais.',
    breadcrumbLabel: 'Sobre',
    homeAriaLabel: 'Ir para a página inicial',
    eyebrow: 'Sobre nós',
    heroTitle: 'Análise independente para Brawl Stars',
    heroLead: 'O BrawlVision é um projeto independente que cruza a API oficial da Supercell com um sistema próprio de amostragem PRO para que qualquer jogador — grátis ou premium — possa ver o meta do jogo com números honestos. Não fazemos parte da Supercell e não temos vínculo com o Brawlify; somos leitores dos dados públicos deles e os apresentamos com metodologia aberta.',
    sections: [
      {
        id: 'mission',
        title: 'Por que existimos',
        paragraphs: [
          'A API pública do Brawl Stars só guarda as últimas 25 batalhas por jogador e não expõe agregados do meta. Qualquer insight mais profundo que "ganhei ou perdi minha última partida?" exige uma camada de cálculo que o jogo oficial não fornece. O BrawlVision constrói essa camada: persistimos batalhas, agregamos resultados dos rankings PRO mundiais, e publicamos win rates, comfort scores e tendências semanais que você não encontra no app do jogo.',
          'Fazemos isso de forma pública e em vários idiomas (13) porque a comunidade competitiva não deveria depender de planilhas privadas ou canais fechados. Fazemos com metodologia documentada porque números sem fórmula são opinião disfarçada de dado.',
        ],
      },
      {
        id: 'team',
        title: 'Quem está por trás',
        paragraphs: [
          'O BrawlVision é mantido por uma equipe pequena de desenvolvedores com experiência em backends de dados e UI de apps mobile. Projetamos, construímos, operamos e respondemos os emails. Não temos investidores externos nem acordos comerciais com criadores de conteúdo; o site é financiado por assinaturas premium e publicidade compliant em algumas páginas públicas.',
          'Se você encontrar um erro num cálculo, numa tradução ou num dado, escreva pra gente: a página `/methodology` descreve cada fórmula e quando é atualizada. Corrigimos os erros assim que confirmamos e mantemos registro no changelog interno.',
        ],
      },
      {
        id: 'editorial',
        title: 'Nossos compromissos editoriais',
        paragraphs: [
          'Separamos dados pessoais de dados públicos: toda estatística exibida em página pública (`/brawler`, `/picks`, etc.) é calculada filtrando por `source=global`, que só contém batalhas da amostragem PRO automática. Batalhas privadas de usuários premium nunca se misturam às públicas.',
          'Não publicamos conteúdo escrito por modelos de linguagem e não copiamos descrições do Brawlify nem da wiki. Os textos das páginas individuais de brawlers são gerados dinamicamente dos nossos agregados (melhor mapa, melhor modo, win rate bayesiano), e artigos editoriais são escritos por pessoas. Aceitamos que isso é mais lento; preferimos lento a conteúdo de baixo valor.',
          'Se a Supercell, o Brawlify ou qualquer detentor de copyright pedir remoção de conteúdo, removemos. O email de contato está neste bloco e respondemos em 72 horas úteis.',
        ],
      },
    ],
    contactTitle: 'Contato',
    contactBody: 'Para correções metodológicas, pedidos de remoção, sugestões de funcionalidade ou relatos de bug, escreva pro email abaixo. Respondemos em 72 horas úteis.',
    methodologyLink: 'Metodologia',
    privacyLink: 'Privacidade',
    disclaimer: 'O BrawlVision não é afiliado à Supercell nem ao Brawl Stars. Brawl Stars é marca registrada da Supercell Oy. Imagens e dados do jogo são propriedade da Supercell.',
  },

  de: {
    metaTitle: 'Über BrawlVision — wer diese Plattform baut',
    metaDescription: 'Wer wir sind, wie BrawlVision funktioniert und warum wir unabhängige Analysen für Brawl Stars bauen: Mission, Team, Kontakt und redaktionelle Verpflichtungen.',
    breadcrumbLabel: 'Über uns',
    homeAriaLabel: 'Zur Startseite',
    eyebrow: 'Über uns',
    heroTitle: 'Unabhängige Analytik für Brawl Stars',
    heroLead: 'BrawlVision ist ein unabhängiges Projekt, das Supercells offizielle API mit einem eigenen PRO-Sampling-System kreuzt, damit jeder Spieler — gratis oder premium — das Meta des Spiels mit ehrlichen Zahlen sehen kann. Wir gehören nicht zu Supercell und sind nicht mit Brawlify verbunden; wir sind Leser ihrer öffentlichen Daten und präsentieren sie mit offener Methodik.',
    sections: [
      {
        id: 'mission',
        title: 'Warum wir existieren',
        paragraphs: [
          'Die öffentliche Brawl-Stars-API speichert nur die letzten 25 Kämpfe pro Spieler und legt keine Meta-Aggregate offen. Jede Erkenntnis tiefer als „habe ich mein letztes Match gewonnen oder verloren?" erfordert eine Berechnungsschicht, die das offizielle Spiel nicht bietet. BrawlVision baut diese Schicht: Wir persistieren Kämpfe, aggregieren Ergebnisse der PRO-Weltranglisten und veröffentlichen Siegraten, Comfort Scores und wöchentliche Trends, die du in der Spiele-App nicht findest.',
          'Wir tun das öffentlich und mehrsprachig (13 Sprachen), weil die kompetitive Community nicht von privaten Tabellen oder geschlossenen Kanälen abhängen sollte. Wir tun es mit dokumentierter Methodik, weil Zahlen ohne Formel Meinung in Daten-Verkleidung sind.',
        ],
      },
      {
        id: 'team',
        title: 'Wer dahintersteht',
        paragraphs: [
          'BrawlVision wird von einem kleinen Team von Entwicklern mit Hintergrund in Daten-Backends und Mobile-App-UI gepflegt. Wir entwerfen, bauen, betreiben und beantworten die Mails. Wir haben keine externen Investoren und keine kommerziellen Vereinbarungen mit Content-Creators; die Seite finanziert sich durch Premium-Abos und compliant Werbung auf manchen öffentlichen Seiten.',
          'Wenn du einen Fehler in einer Berechnung, Übersetzung oder Datenpunkt findest, schreib uns: Die Seite `/methodology` beschreibt jede Formel und wann sie aktualisiert wird. Wir korrigieren Fehler, sobald wir sie bestätigen, und führen einen Eintrag im internen Changelog.',
        ],
      },
      {
        id: 'editorial',
        title: 'Unsere redaktionellen Verpflichtungen',
        paragraphs: [
          'Wir trennen persönliche von öffentlichen Daten: Jede Statistik auf einer öffentlichen Seite (`/brawler`, `/picks` usw.) wird mit Filter `source=global` berechnet, der nur Kämpfe aus dem automatischen PRO-Sampling enthält. Private Kämpfe von Premium-Nutzern mischen sich nie mit öffentlichen.',
          'Wir veröffentlichen keine von Sprachmodellen geschriebenen Inhalte und kopieren keine Beschreibungen von Brawlify oder dem Wiki. Texte auf einzelnen Brawler-Seiten werden dynamisch aus unseren eigenen Aggregaten (beste Map, bester Modus, Bayesian Win Rate) erzeugt, redaktionelle Artikel sind von Menschen geschrieben. Wir akzeptieren, dass das langsamer ist; wir bevorzugen Langsamkeit gegenüber Inhalt mit niedrigem Wert.',
          'Wenn Supercell, Brawlify oder ein anderer Rechteinhaber uns bittet, Inhalt zu entfernen, tun wir das. Die Kontakt-Mail steht in diesem Block, und wir antworten innerhalb von 72 Werkstagen-Stunden.',
        ],
      },
    ],
    contactTitle: 'Kontakt',
    contactBody: 'Für methodische Korrekturen, Take-Down-Anfragen, Feature-Vorschläge oder Bug-Reports schreib an die Mail unten. Wir antworten innerhalb von 72 Werkstagen-Stunden.',
    methodologyLink: 'Methodik',
    privacyLink: 'Datenschutz',
    disclaimer: 'BrawlVision ist nicht mit Supercell oder Brawl Stars verbunden. Brawl Stars ist eine eingetragene Marke der Supercell Oy. Spielbilder und -daten sind Eigentum von Supercell.',
  },

  it: {
    metaTitle: 'Su BrawlVision — chi costruisce questa piattaforma',
    metaDescription: 'Chi siamo, come funziona BrawlVision e perché costruiamo analisi indipendenti per Brawl Stars: missione, team, contatti e impegni editoriali.',
    breadcrumbLabel: 'Chi siamo',
    homeAriaLabel: 'Vai alla pagina principale',
    eyebrow: 'Chi siamo',
    heroTitle: 'Analisi indipendenti per Brawl Stars',
    heroLead: 'BrawlVision è un progetto indipendente che incrocia l\'API ufficiale di Supercell con un sistema proprio di campionamento PRO perché qualsiasi giocatore — free o premium — possa vedere il meta del gioco con numeri onesti. Non facciamo parte di Supercell e non siamo affiliati a Brawlify; siamo lettori dei loro dati pubblici e li presentiamo con metodologia aperta.',
    sections: [
      {
        id: 'mission',
        title: 'Perché esistiamo',
        paragraphs: [
          'L\'API pubblica di Brawl Stars conserva solo le ultime 25 battaglie per giocatore e non espone aggregati del meta. Qualsiasi insight più profondo di "ho vinto o perso l\'ultima partita?" richiede un livello di calcolo che il gioco ufficiale non fornisce. BrawlVision costruisce quel livello: persistiamo le battaglie, aggreghiamo risultati dalle classifiche PRO mondiali e pubblichiamo win rate, comfort score e tendenze settimanali che non trovi nell\'app del gioco.',
          'Lo facciamo pubblicamente e in più lingue (13) perché la community competitiva non dovrebbe dipendere da fogli privati o canali chiusi. Lo facciamo con metodologia documentata perché numeri senza formula sono opinione travestita da dato.',
        ],
      },
      {
        id: 'team',
        title: 'Chi c\'è dietro',
        paragraphs: [
          'BrawlVision è mantenuto da un piccolo team di sviluppatori con background in backend dati e UI di app mobili. Progettiamo, costruiamo, operiamo e rispondiamo alle email. Non abbiamo investitori esterni né accordi commerciali con creator di contenuti; il sito si finanzia con abbonamenti premium e pubblicità compliant su alcune pagine pubbliche.',
          'Se trovi un errore in un calcolo, una traduzione o un dato, scrivici: la pagina `/methodology` descrive ogni formula e quando viene aggiornata. Correggiamo gli errori non appena li confermiamo e teniamo traccia in un changelog interno.',
        ],
      },
      {
        id: 'editorial',
        title: 'I nostri impegni editoriali',
        paragraphs: [
          'Separiamo dati personali da dati pubblici: ogni statistica mostrata su una pagina pubblica (`/brawler`, `/picks`, ecc.) è calcolata filtrando per `source=global`, che contiene solo battaglie dal campionamento PRO automatico. Le battaglie private degli utenti premium non si mescolano mai con quelle pubbliche.',
          'Non pubblichiamo contenuti scritti da modelli linguistici e non copiamo descrizioni da Brawlify o dalla wiki. I testi delle pagine individuali dei brawler sono generati dinamicamente dai nostri aggregati (miglior mappa, miglior modalità, win rate bayesiano), e gli articoli editoriali sono scritti da persone. Accettiamo che sia più lento; preferiamo la lentezza a contenuti di basso valore.',
          'Se Supercell, Brawlify o qualsiasi titolare di copyright ci chiede di rimuovere un contenuto, lo facciamo. L\'email di contatto è in questo blocco e rispondiamo entro 72 ore lavorative.',
        ],
      },
    ],
    contactTitle: 'Contatti',
    contactBody: 'Per correzioni metodologiche, richieste di rimozione, suggerimenti di funzionalità o segnalazioni di bug, scrivi all\'email qui sotto. Rispondiamo entro 72 ore lavorative.',
    methodologyLink: 'Metodologia',
    privacyLink: 'Privacy',
    disclaimer: 'BrawlVision non è affiliato a Supercell né a Brawl Stars. Brawl Stars è un marchio registrato di Supercell Oy. Immagini e dati di gioco sono di proprietà di Supercell.',
  },

  ru: {
    metaTitle: 'О BrawlVision — кто создаёт эту платформу',
    metaDescription: 'Кто мы, как работает BrawlVision и почему мы создаём независимую аналитику для Brawl Stars: миссия, команда, контакты и редакционные обязательства.',
    breadcrumbLabel: 'О нас',
    homeAriaLabel: 'На главную',
    eyebrow: 'О нас',
    heroTitle: 'Независимая аналитика для Brawl Stars',
    heroLead: 'BrawlVision — независимый проект, который сочетает официальное API Supercell с собственной системой PRO-семплинга, чтобы любой игрок — бесплатный или премиум — мог видеть мета игры с честными числами. Мы не часть Supercell и не аффилированы с Brawlify; мы читатели их публичных данных и представляем их с открытой методологией.',
    sections: [
      {
        id: 'mission',
        title: 'Зачем мы существуем',
        paragraphs: [
          'Публичное API Brawl Stars хранит только последние 25 боёв на игрока и не отдаёт агрегаты меты. Любое более глубокое наблюдение, чем "я выиграл или проиграл последний матч?", требует слоя вычислений, которого официальная игра не предоставляет. BrawlVision строит этот слой: мы сохраняем бои, агрегируем результаты мировых PRO-рейтингов и публикуем win rate, comfort scores и недельные тренды, которых нет в приложении игры.',
          'Мы делаем это публично и на 13 языках, потому что соревновательное сообщество не должно зависеть от приватных таблиц или закрытых каналов. Мы делаем это с задокументированной методологией, потому что числа без формулы — это мнение в маске данных.',
        ],
      },
      {
        id: 'team',
        title: 'Кто стоит за проектом',
        paragraphs: [
          'BrawlVision поддерживает небольшая команда разработчиков с опытом в data-бекендах и UI мобильных приложений. Мы проектируем, создаём, поддерживаем и отвечаем на письма. У нас нет внешних инвесторов и коммерческих соглашений с создателями контента; сайт финансируется премиум-подписками и совместимой рекламой на некоторых публичных страницах.',
          'Если вы заметили ошибку в расчёте, переводе или данных, напишите нам: страница `/methodology` описывает каждую формулу и когда она обновляется. Исправляем ошибки сразу после подтверждения и ведём запись в внутреннем changelog.',
        ],
      },
      {
        id: 'editorial',
        title: 'Наши редакционные обязательства',
        paragraphs: [
          'Мы отделяем личные данные от публичных: любая статистика на публичной странице (`/brawler`, `/picks` и др.) считается с фильтром `source=global`, который содержит только бои из автоматического PRO-семплинга. Приватные бои премиум-пользователей никогда не смешиваются с публичными.',
          'Мы не публикуем контент, написанный языковыми моделями, и не копируем описания из Brawlify или вики. Тексты на индивидуальных страницах бойцов генерируются динамически из наших собственных агрегатов (лучшая карта, лучший режим, байесовский win rate), а редакционные статьи пишут люди. Мы принимаем, что это медленнее; мы предпочитаем медленный темп низкокачественному контенту.',
          'Если Supercell, Brawlify или иной правообладатель просит удалить контент, мы это делаем. Контактный email указан в этом блоке, и мы отвечаем в течение 72 рабочих часов.',
        ],
      },
    ],
    contactTitle: 'Контакты',
    contactBody: 'Для методологических исправлений, запросов на удаление, предложений функций или сообщений о багах пишите на email ниже. Отвечаем в течение 72 рабочих часов.',
    methodologyLink: 'Методология',
    privacyLink: 'Конфиденциальность',
    disclaimer: 'BrawlVision не аффилирован с Supercell или Brawl Stars. Brawl Stars — зарегистрированная торговая марка Supercell Oy. Изображения и данные игры — собственность Supercell.',
  },

  tr: {
    metaTitle: 'BrawlVision Hakkında — bu platformu kim inşa ediyor',
    metaDescription: 'Biz kimiz, BrawlVision nasıl çalışıyor ve Brawl Stars için neden bağımsız analitik kuruyoruz: misyon, ekip, iletişim ve editoryal taahhütler.',
    breadcrumbLabel: 'Hakkımızda',
    homeAriaLabel: 'Ana sayfaya git',
    eyebrow: 'Hakkımızda',
    heroTitle: 'Brawl Stars için bağımsız analitik',
    heroLead: 'BrawlVision, Supercell\'in resmi API\'sini kendi PRO örnekleme sistemimizle çapraz ileten bağımsız bir projedir; böylece herhangi bir oyuncu — ücretsiz ya da premium — oyunun metasını dürüst sayılarla görebilir. Supercell\'in parçası değiliz, Brawlify ile bağlantımız yok; onların kamuya açık verilerinin okuruyuz ve onları açık metodolojiyle sunuyoruz.',
    sections: [
      {
        id: 'mission',
        title: 'Neden varız',
        paragraphs: [
          'Brawl Stars\'ın genel API\'si oyuncu başına yalnızca son 25 savaşı saklar ve meta toplamlarını ortaya çıkarmaz. "Son maçımı kazandım mı kaybettim mi?"den daha derin herhangi bir içgörü, resmi oyunun sağlamadığı bir hesaplama katmanı gerektirir. BrawlVision bu katmanı kurar: savaşları kalıcılaştırırız, dünya PRO sıralamalarından sonuçları toplarız ve oyun uygulamasında bulamayacağınız galibiyet oranları, comfort skorları ve haftalık trendler yayınlarız.',
          'Bunu kamuya açık ve çok dilli (13 dil) yaparız çünkü rekabetçi topluluk özel elektronik tablolara veya kapalı kanallara bağımlı olmamalıdır. Belgelenmiş metodolojiyle yaparız çünkü formülsüz sayılar, veri kılığına girmiş görüştür.',
        ],
      },
      {
        id: 'team',
        title: 'Arkasında kim var',
        paragraphs: [
          'BrawlVision, veri arka uçları ve mobil uygulama UI geçmişine sahip küçük bir geliştirici ekip tarafından sürdürülür. Tasarlarız, kurarız, işletiriz ve e-postaları yanıtlarız. Dış yatırımcımız yok ve içerik üreticileriyle ticari anlaşmalarımız yok; site bazı kamuya açık sayfalardaki premium abonelikler ve uyumlu reklamlarla finanse edilir.',
          'Bir hesaplamada, çeviride veya veri noktasında bir hata bulursanız bize yazın: `/methodology` sayfası her formülü ve güncellenme zamanını tanımlar. Doğruladığımız anda hataları düzeltir ve dahili changelog\'da kayıt tutarız.',
        ],
      },
      {
        id: 'editorial',
        title: 'Editoryal taahhütlerimiz',
        paragraphs: [
          'Kişisel verileri kamuya açık verilerden ayırırız: kamuya açık bir sayfada gösterilen her istatistik (`/brawler`, `/picks` vb.) yalnızca otomatik PRO örneklemesinden alınan savaşları içeren `source=global` filtresiyle hesaplanır. Premium kullanıcıların özel savaşları kamuya açık olanlarla asla karışmaz.',
          'Dil modelleri tarafından yazılmış içerik yayınlamayız ve Brawlify\'dan veya wiki\'den açıklamalar kopyalamayız. Tek brawler sayfalarındaki metinler kendi toplamlarımızdan dinamik olarak üretilir (en iyi harita, en iyi mod, Bayesian galibiyet oranı), editoryal makaleler ise insanlar tarafından yazılır. Bunun daha yavaş olduğunu kabul ederiz; düşük değerli içerik yerine yavaşlığı tercih ederiz.',
          'Supercell, Brawlify veya herhangi bir telif hakkı sahibi içeriği kaldırmamızı isterse, kaldırırız. İletişim e-postası bu bloktadır ve 72 iş saati içinde yanıt veririz.',
        ],
      },
    ],
    contactTitle: 'İletişim',
    contactBody: 'Metodolojik düzeltmeler, kaldırma talepleri, özellik önerileri veya hata raporları için aşağıdaki e-postaya yazın. 72 iş saati içinde yanıt veririz.',
    methodologyLink: 'Metodoloji',
    privacyLink: 'Gizlilik',
    disclaimer: 'BrawlVision, Supercell veya Brawl Stars ile bağlantılı değildir. Brawl Stars, Supercell Oy\'un tescilli markasıdır. Oyun görselleri ve verileri Supercell\'e aittir.',
  },

  pl: {
    metaTitle: 'O BrawlVision — kto buduje tę platformę',
    metaDescription: 'Kim jesteśmy, jak działa BrawlVision i dlaczego budujemy niezależną analitykę dla Brawl Stars: misja, zespół, kontakt i zobowiązania redakcyjne.',
    breadcrumbLabel: 'O nas',
    homeAriaLabel: 'Przejdź do strony głównej',
    eyebrow: 'O nas',
    heroTitle: 'Niezależna analityka dla Brawl Stars',
    heroLead: 'BrawlVision to niezależny projekt, który łączy oficjalne API Supercella z naszym własnym systemem próbkowania PRO, by dowolny gracz — darmowy lub premium — mógł zobaczyć metę gry z uczciwymi liczbami. Nie jesteśmy częścią Supercella i nie jesteśmy powiązani z Brawlify; jesteśmy czytelnikami ich publicznych danych i prezentujemy je z otwartą metodologią.',
    sections: [
      {
        id: 'mission',
        title: 'Dlaczego istniejemy',
        paragraphs: [
          'Publiczne API Brawl Stars trzyma tylko ostatnie 25 walk na gracza i nie udostępnia agregatów mety. Każdy głębszy wgląd niż "wygrałem czy przegrałem ostatni mecz?" wymaga warstwy obliczeniowej, której oficjalna gra nie zapewnia. BrawlVision buduje tę warstwę: utrwalamy walki, agregujemy wyniki światowych rankingów PRO i publikujemy win rate, comfort score i tygodniowe trendy, których nie znajdziesz w aplikacji gry.',
          'Robimy to publicznie i wielojęzycznie (13 języków), bo społeczność competitive nie powinna zależeć od prywatnych arkuszy ani zamkniętych kanałów. Robimy to z udokumentowaną metodologią, bo liczby bez formuły to opinia przebrana za dane.',
        ],
      },
      {
        id: 'team',
        title: 'Kto za tym stoi',
        paragraphs: [
          'BrawlVision jest utrzymywany przez mały zespół deweloperów z doświadczeniem w backendach danych i UI aplikacji mobilnych. Projektujemy, budujemy, prowadzimy i odpisujemy na maile. Nie mamy zewnętrznych inwestorów ani umów handlowych z twórcami treści; serwis finansują abonamenty premium i reklamy zgodne z polityką na niektórych stronach publicznych.',
          'Jeśli znajdziesz błąd w obliczeniu, tłumaczeniu lub danych, napisz: strona `/methodology` opisuje każdą formułę i kiedy jest aktualizowana. Naprawiamy błędy zaraz po potwierdzeniu i prowadzimy zapis w wewnętrznym changelogu.',
        ],
      },
      {
        id: 'editorial',
        title: 'Nasze zobowiązania redakcyjne',
        paragraphs: [
          'Oddzielamy dane osobowe od publicznych: każda statystyka na stronie publicznej (`/brawler`, `/picks` itd.) jest liczona z filtrem `source=global`, który zawiera tylko walki z automatycznego próbkowania PRO. Prywatne walki użytkowników premium nigdy nie mieszają się z publicznymi.',
          'Nie publikujemy treści pisanych przez modele językowe i nie kopiujemy opisów z Brawlify ani z wiki. Teksty na indywidualnych stronach brawlerów są generowane dynamicznie z naszych agregatów (najlepsza mapa, najlepszy tryb, Bayesian win rate), a artykuły redakcyjne piszą ludzie. Akceptujemy, że to wolniejsze; wolimy wolne tempo niż treści o niskiej wartości.',
          'Jeśli Supercell, Brawlify lub jakikolwiek właściciel praw autorskich poprosi o usunięcie treści, robimy to. Email kontaktowy jest w tym bloku, odpowiadamy w ciągu 72 godzin roboczych.',
        ],
      },
    ],
    contactTitle: 'Kontakt',
    contactBody: 'W sprawie poprawek metodologicznych, wniosków o usunięcie, sugestii funkcji lub zgłoszeń błędów napisz na poniższy email. Odpowiadamy w ciągu 72 godzin roboczych.',
    methodologyLink: 'Metodologia',
    privacyLink: 'Prywatność',
    disclaimer: 'BrawlVision nie jest powiązany z Supercell ani Brawl Stars. Brawl Stars to zarejestrowany znak towarowy Supercell Oy. Obrazy i dane gry są własnością Supercell.',
  },

  ar: {
    metaTitle: 'حول BrawlVision — من يبني هذه المنصة',
    metaDescription: 'من نحن، وكيف يعمل BrawlVision، ولماذا نبني تحليلات مستقلة لـ Brawl Stars: الرسالة والفريق والتواصل والالتزامات التحريرية.',
    breadcrumbLabel: 'من نحن',
    homeAriaLabel: 'العودة إلى الصفحة الرئيسية',
    eyebrow: 'من نحن',
    heroTitle: 'تحليلات مستقلة لـ Brawl Stars',
    heroLead: 'BrawlVision مشروع مستقل يجمع بين واجهة Supercell الرسمية ونظامنا الخاص لأخذ عينات PRO ليتمكن أي لاعب — مجاني أو premium — من رؤية ميتا اللعبة بأرقام صادقة. لسنا جزءاً من Supercell ولسنا منتسبين إلى Brawlify؛ نحن قراء لبياناتهم العامة ونعرضها بمنهجية مفتوحة.',
    sections: [
      {
        id: 'mission',
        title: 'لماذا نوجد',
        paragraphs: [
          'واجهة Brawl Stars العامة تحفظ فقط آخر 25 معركة لكل لاعب ولا تكشف عن مجاميع الميتا. أي رؤية أعمق من "هل ربحت أم خسرت آخر مباراة؟" تتطلب طبقة حساب لا توفرها اللعبة الرسمية. يبني BrawlVision تلك الطبقة: نحفظ المعارك، ونجمع نتائج تصنيفات PRO العالمية، وننشر معدلات الفوز ودرجات الراحة (Comfort Score) والاتجاهات الأسبوعية التي لن تجدها في تطبيق اللعبة.',
          'نفعل ذلك علنياً وبلغات متعددة (13 لغة) لأن مجتمع التنافس يجب ألا يعتمد على جداول بيانات خاصة أو قنوات مغلقة. نفعله بمنهجية موثقة لأن الأرقام دون صيغة هي رأي متنكر بزي بيانات.',
        ],
      },
      {
        id: 'team',
        title: 'من خلف المشروع',
        paragraphs: [
          'يحافظ على BrawlVision فريق صغير من المطورين ذوي خلفية في خوادم البيانات وواجهات تطبيقات الجوال. نصمم ونبني ونشغّل ونرد على البريد. ليس لدينا مستثمرون خارجيون ولا اتفاقيات تجارية مع صانعي المحتوى؛ تموَّل المنصة من اشتراكات premium وإعلانات متوافقة في بعض الصفحات العامة.',
          'إذا وجدت خطأ في حساب أو ترجمة أو نقطة بيانات، اكتب لنا: تصف صفحة `/methodology` كل صيغة ومتى تُحدَّث. نصحح الأخطاء فور تأكيدها ونحتفظ بسجل في changelog داخلي.',
        ],
      },
      {
        id: 'editorial',
        title: 'التزاماتنا التحريرية',
        paragraphs: [
          'نفصل البيانات الشخصية عن العامة: كل إحصائية تظهر في صفحة عامة (`/brawler` و`/picks` ...) تُحسب بفلتر `source=global` الذي يحتوي فقط على معارك من أخذ عينات PRO الآلي. لا تختلط معارك مستخدمي premium الخاصة أبداً بالعامة.',
          'لا ننشر محتوى مكتوباً بنماذج لغوية ولا ننسخ أوصافاً من Brawlify أو الويكي. تُنشأ نصوص صفحات الأبطال الفردية ديناميكياً من مجاميعنا الخاصة (أفضل خريطة، أفضل وضع، WR بايزي)، والمقالات التحريرية يكتبها أشخاص. نقبل أن ذلك أبطأ؛ نفضّل البطء على المحتوى منخفض القيمة.',
          'إذا طلبت Supercell أو Brawlify أو أي مالك حقوق إزالة محتوى، نفعل. بريد التواصل في هذه الكتلة، ونرد خلال 72 ساعة عمل.',
        ],
      },
    ],
    contactTitle: 'التواصل',
    contactBody: 'للتصحيحات المنهجية وطلبات الإزالة واقتراحات الميزات وتقارير الأخطاء، اكتب إلى البريد أدناه. نرد خلال 72 ساعة عمل.',
    methodologyLink: 'المنهجية',
    privacyLink: 'الخصوصية',
    disclaimer: 'BrawlVision غير منتسب إلى Supercell أو Brawl Stars. Brawl Stars علامة تجارية مسجلة لشركة Supercell Oy. صور وبيانات اللعبة ملك لـ Supercell.',
  },

  ko: {
    metaTitle: 'BrawlVision 소개 — 이 플랫폼을 만드는 사람들',
    metaDescription: '우리는 누구인지, BrawlVision이 어떻게 작동하는지, 그리고 우리가 왜 Brawl Stars를 위한 독립적인 분석을 구축하는지: 미션, 팀, 연락처 및 편집 약속.',
    breadcrumbLabel: '소개',
    homeAriaLabel: '홈 페이지로 이동',
    eyebrow: '소개',
    heroTitle: 'Brawl Stars를 위한 독립 분석',
    heroLead: 'BrawlVision은 Supercell의 공식 API를 자체 PRO 샘플링 시스템과 결합하여 무료든 프리미엄이든 모든 플레이어가 정직한 수치로 게임의 메타를 볼 수 있도록 하는 독립 프로젝트입니다. 우리는 Supercell의 일부가 아니며 Brawlify와도 무관합니다; 우리는 공개 데이터의 독자이며 열린 방법론으로 이를 제시합니다.',
    sections: [
      {
        id: 'mission',
        title: '존재 이유',
        paragraphs: [
          '공개 Brawl Stars API는 플레이어당 최근 25개의 전투만 저장하고 메타 집계를 노출하지 않습니다. "내 마지막 매치에서 이겼는지 졌는지?"보다 더 깊은 인사이트는 공식 게임이 제공하지 않는 계산 레이어가 필요합니다. BrawlVision이 그 레이어를 구축합니다: 전투를 보존하고, 세계 PRO 랭킹의 결과를 집계하며, 게임 앱에서 찾을 수 없는 승률, 컴포트 스코어, 주간 트렌드를 게시합니다.',
          '우리는 경쟁 커뮤니티가 비공개 스프레드시트나 폐쇄형 채널에 의존해서는 안 되기 때문에 이를 공개적이고 다국어로(13개 언어) 수행합니다. 공식 없는 숫자는 데이터로 위장한 의견이기 때문에 문서화된 방법론으로 수행합니다.',
        ],
      },
      {
        id: 'team',
        title: '뒤에 누가 있나',
        paragraphs: [
          'BrawlVision은 데이터 백엔드와 모바일 앱 UI 배경을 가진 작은 개발자 팀이 유지합니다. 우리는 설계하고, 구축하고, 운영하고, 이메일에 답변합니다. 외부 투자자도 콘텐츠 크리에이터와의 상업 계약도 없습니다; 사이트는 프리미엄 구독과 일부 공개 페이지의 컴플라이언트 광고로 자금을 조달합니다.',
          '계산, 번역 또는 데이터 포인트에서 오류를 발견하면 저희에게 적어주세요: `/methodology` 페이지는 모든 공식과 업데이트 시점을 설명합니다. 확인 즉시 오류를 수정하고 내부 변경 로그에 기록을 보관합니다.',
        ],
      },
      {
        id: 'editorial',
        title: '편집 약속',
        paragraphs: [
          '개인 데이터를 공개 데이터와 분리합니다: 공개 페이지(`/brawler`, `/picks` 등)에 표시되는 모든 통계는 자동 PRO 샘플링에서 가져온 전투만 포함하는 `source=global` 필터를 적용하여 계산됩니다. 프리미엄 사용자의 비공개 전투는 공개와 절대 섞이지 않습니다.',
          '언어 모델이 작성한 콘텐츠를 게시하지 않으며 Brawlify나 위키에서 설명을 복사하지 않습니다. 개별 브롤러 페이지의 텍스트는 자체 집계(최고 맵, 최고 모드, 베이지안 승률)에서 동적으로 생성되며, 편집 기사는 사람이 작성합니다. 더 느리다는 것을 받아들입니다; 저희는 가치가 낮은 콘텐츠보다 느림을 선호합니다.',
          'Supercell, Brawlify 또는 모든 저작권 보유자가 콘텐츠 제거를 요청하면, 그렇게 합니다. 연락처 이메일은 이 블록에 있으며, 72 영업 시간 이내에 응답합니다.',
        ],
      },
    ],
    contactTitle: '연락처',
    contactBody: '방법론적 수정, 제거 요청, 기능 제안 또는 버그 신고는 아래 이메일로 적어주세요. 72 영업 시간 이내에 응답합니다.',
    methodologyLink: '방법론',
    privacyLink: '개인정보',
    disclaimer: 'BrawlVision은 Supercell이나 Brawl Stars와 제휴 관계가 아닙니다. Brawl Stars는 Supercell Oy의 등록 상표입니다. 게임 이미지와 데이터는 Supercell의 자산입니다.',
  },

  ja: {
    metaTitle: 'BrawlVisionについて — このプラットフォームを作っているのは',
    metaDescription: '私たちが誰か、BrawlVisionがどう動くか、そしてBrawl Starsのために独立した分析を構築する理由: ミッション、チーム、連絡先、編集方針。',
    breadcrumbLabel: 'About',
    homeAriaLabel: 'ホームページへ戻る',
    eyebrow: 'About',
    heroTitle: 'Brawl Starsのための独立分析',
    heroLead: 'BrawlVisionは、Supercellの公式APIを自前のPROサンプリングシステムと組み合わせて、無料でもプレミアムでも、どのプレイヤーもゲームの環境を正直な数字で見られるようにする独立したプロジェクトです。私たちはSupercellの一部ではなく、Brawlifyとも無関係です。私たちは彼らの公開データの読者であり、それをオープンな方法論で提示します。',
    sections: [
      {
        id: 'mission',
        title: '存在理由',
        paragraphs: [
          'Brawl Starsの公開APIはプレイヤーごとに直近25バトルしか保持せず、環境集計を公開していません。「直近の試合に勝ったか負けたか」より深い洞察には、公式ゲームが提供しない計算層が必要です。BrawlVisionはその層を構築します。バトルを永続化し、世界のPROランキングから結果を集約し、ゲームアプリでは見つからない勝率、コンフォートスコア、週次トレンドを公開します。',
          '競技コミュニティは私的なスプレッドシートや閉じたチャンネルに依存すべきではないため、私たちはこれを公開かつ多言語（13言語）で行います。公式のない数字はデータに偽装された意見にすぎないため、文書化された方法論で行います。',
        ],
      },
      {
        id: 'team',
        title: 'バックにいるのは',
        paragraphs: [
          'BrawlVisionは、データバックエンドとモバイルアプリUIのバックグラウンドを持つ小さな開発者チームが維持しています。私たちは設計し、構築し、運用し、メールに返信します。外部投資家も、コンテンツクリエイターとの商業契約もありません。サイトはプレミアム購読と一部の公開ページのコンプライアンス広告で資金調達されています。',
          '計算、翻訳、データポイントに誤りを見つけたら、ご連絡ください。`/methodology` ページは各公式と更新タイミングを説明します。確認次第、誤りを修正し、内部の変更ログに記録します。',
        ],
      },
      {
        id: 'editorial',
        title: '編集上の約束',
        paragraphs: [
          '個人データと公開データを分離します。公開ページ(`/brawler`、`/picks` など)に表示されるすべての統計は、自動PROサンプリングからのバトルのみを含む `source=global` フィルタで計算されます。プレミアムユーザーの非公開バトルが公開と混ざることはありません。',
          '言語モデルが書いたコンテンツは公開せず、Brawlifyやwikiから説明をコピーすることもありません。個別ブロウラーページのテキストは自前の集計（ベストマップ、ベストモード、ベイジアン勝率）から動的に生成され、編集記事は人が書きます。それは遅くなることを受け入れます。低品質コンテンツより遅さを好みます。',
          'Supercell、Brawlify、または著作権者がコンテンツの削除を求めたら、削除します。連絡用メールアドレスはこのブロックにあり、72営業時間以内に返信します。',
        ],
      },
    ],
    contactTitle: 'お問い合わせ',
    contactBody: '方法論的な修正、削除依頼、機能提案、バグレポートは下記のメールアドレスへどうぞ。72営業時間以内に返信します。',
    methodologyLink: '方法論',
    privacyLink: 'プライバシー',
    disclaimer: 'BrawlVisionはSupercellおよびBrawl Starsと提携していません。Brawl StarsはSupercell Oyの登録商標です。ゲーム画像およびデータはSupercellの所有物です。',
  },

  zh: {
    metaTitle: '关于 BrawlVision — 谁在构建这个平台',
    metaDescription: '我们是谁、BrawlVision 如何运作，以及我们为什么为荒野乱斗构建独立分析：使命、团队、联系方式与编辑承诺。',
    breadcrumbLabel: '关于我们',
    homeAriaLabel: '返回首页',
    eyebrow: '关于我们',
    heroTitle: '为荒野乱斗打造的独立分析',
    heroLead: 'BrawlVision 是一个独立项目，将 Supercell 官方 API 与我们自己的 PRO 采样系统交叉，让任何玩家——免费或高级——都能用诚实的数字看到游戏的元数据。我们不是 Supercell 的一部分，也与 Brawlify 无关；我们是其公开数据的读者，并以开放方法论呈现这些数据。',
    sections: [
      {
        id: 'mission',
        title: '我们为何存在',
        paragraphs: [
          '荒野乱斗的公开 API 仅保留每位玩家最近 25 场战斗，并不公开元数据聚合。任何比"我上一场比赛是赢还是输？"更深入的洞察都需要官方游戏不提供的计算层。BrawlVision 构建了这一层：我们持久化战斗、聚合来自世界 PRO 排行榜的结果，并发布在游戏应用中找不到的胜率、Comfort Score 和每周趋势。',
          '我们以公开和多语言（13 种语言）方式做这件事，因为竞争社区不应依赖私有电子表格或封闭渠道。我们以记录的方法论做这件事，因为没有公式的数字是伪装成数据的观点。',
        ],
      },
      {
        id: 'team',
        title: '幕后是谁',
        paragraphs: [
          'BrawlVision 由一个具有数据后端和移动应用 UI 背景的小团队维护。我们设计、构建、运营并回复邮件。我们没有外部投资者，也没有与内容创作者的商业协议；该站通过高级订阅和部分公开页面上的合规广告获得资金。',
          '如果你发现计算、翻译或数据点中的错误，请写信给我们：`/methodology` 页面描述每个公式及其更新时间。确认后我们立即修复错误并在内部变更日志中保留记录。',
        ],
      },
      {
        id: 'editorial',
        title: '我们的编辑承诺',
        paragraphs: [
          '我们将个人数据与公共数据分开：公开页面（`/brawler`、`/picks` 等）显示的每一项统计都通过 `source=global` 过滤计算，该过滤器只包含来自自动 PRO 采样的战斗。高级用户的私人战斗永远不会与公开战斗混合。',
          '我们不发布由语言模型撰写的内容，也不复制 Brawlify 或 wiki 的描述。各个英雄页面的文本由我们自己的聚合（最佳地图、最佳模式、贝叶斯胜率）动态生成，编辑文章由人撰写。我们接受这样会更慢；我们宁愿慢一些也不要低价值内容。',
          '如果 Supercell、Brawlify 或任何版权持有者要求我们删除内容，我们会删除。联系电子邮件就在此块中，我们在 72 个工作小时内回复。',
        ],
      },
    ],
    contactTitle: '联系',
    contactBody: '关于方法论更正、删除请求、功能建议或错误报告，请写信至下方邮箱。我们在 72 个工作小时内回复。',
    methodologyLink: '方法论',
    privacyLink: '隐私',
    disclaimer: 'BrawlVision 不隶属于 Supercell 或荒野乱斗。荒野乱斗是 Supercell Oy 的注册商标。游戏图像和数据归 Supercell 所有。',
  },
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
  data.about = namespace

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  const keyCount = Object.keys(namespace).length
  totalAdditions += keyCount
  console.log(`  ${locale.padEnd(3)}  about namespace (${keyCount} keys)`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
