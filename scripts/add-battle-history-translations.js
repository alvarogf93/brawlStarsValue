#!/usr/bin/env node
// SEO marketing page /battle-history — i18n batch
//
// Adds a new top-level `battleHistory` namespace × 13 locales with
// hero / benefits / how-it-works / FAQ / CTA copy. Designed so that
// this page can rank for long-tail queries like "save brawl stars
// battle history" / "brawl stars unlimited battle log" / "cómo
// guardar historial brawl stars" that the API-only 25-battle limit
// creates real search demand for.
//
// Idempotent: re-running overwrites existing keys with the latest
// values, so this file is the source of truth for the page copy.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    metaTitle: 'Historial completo de Brawl Stars | BrawlVision',
    metaDescription: 'La API de Supercell solo guarda 25 batallas. BrawlVision las sincroniza cada 10 minutos y construye tu historial ilimitado para siempre. Análisis por brawler, mapa y modo.',
    breadcrumbLabel: 'Historial de batallas',
    homeAriaLabel: 'Ir a la página principal',
    heroTitle: 'Guarda tu historial completo de batallas de Brawl Stars',
    heroLead: 'La API oficial de Supercell solo conserva tus últimas 25 partidas. BrawlVision las sincroniza cada 10 minutos y construye un historial ilimitado que es tuyo para siempre.',
    ctaPrimary: 'Empezar a guardar mi historial',
    benefitsTitle: 'Lo que BrawlVision hace por ti',
    benefits: [
      {
        title: 'Historial ilimitado',
        body: 'Cada batalla queda guardada. Revisa hace 3 meses, hace 6, hace un año. Sin borrados automáticos.',
      },
      {
        title: 'Estadísticas por brawler, mapa y modo',
        body: 'Win rate exacto de cada combinación. Descubre tus mejores y peores matchups con datos reales, no intuición.',
      },
      {
        title: 'Tendencias en el tiempo',
        body: 'Gráficos de trofeos y win rate por día. Mide si estás mejorando o estancado, en vez de adivinarlo.',
      },
      {
        title: 'Sincronización automática',
        body: 'Tu dashboard se actualiza cada 10 minutos. Sin tocar nada. Sin perder batallas por olvidarte de entrar.',
      },
    ],
    howTitle: 'Cómo empezar',
    steps: [
      'Introduce tu Player Tag de Brawl Stars en la página principal',
      'Activa tu prueba gratuita PRO (3 días, sin tarjeta)',
      'BrawlVision empieza a sincronizar y guarda cada batalla automáticamente',
    ],
    faqTitle: 'Preguntas frecuentes',
    faq: [
      {
        q: '¿Por qué Brawl Stars solo muestra 25 batallas?',
        a: 'La API pública de Supercell solo devuelve el battlelog de las últimas 25 partidas por jugador. El juego almacena más internamente, pero no lo expone. BrawlVision sincroniza tu log antes de que Supercell lo borre y lo persiste en nuestra base de datos.',
      },
      {
        q: '¿Puede BrawlVision recuperar batallas antiguas?',
        a: 'Solo podemos guardar batallas a partir del momento en que empiezas a usar el servicio — Supercell no ofrece acceso retrospectivo. Cuanto antes actives el tracking, más historial vas a acumular.',
      },
      {
        q: '¿Necesito instalar algo?',
        a: 'No. BrawlVision funciona en el navegador. Inicias sesión con Google, enlazas tu Player Tag y sincroniza en segundo plano. Nunca te pedimos tu contraseña de Supercell.',
      },
    ],
    finalCtaTitle: '¿Listo para no perder ninguna batalla más?',
    finalCtaBody: 'Activa el tracking en menos de un minuto y empieza a guardar tu historial completo desde hoy.',
  },

  en: {
    metaTitle: 'Complete Brawl Stars Battle History | BrawlVision',
    metaDescription: 'Supercell\'s API only keeps 25 battles. BrawlVision syncs them every 10 minutes and builds your unlimited battle history forever. Per-brawler, per-map, per-mode analytics.',
    breadcrumbLabel: 'Battle history',
    homeAriaLabel: 'Go to the home page',
    heroTitle: 'Save your complete Brawl Stars battle history',
    heroLead: 'Supercell\'s official API only keeps your last 25 matches. BrawlVision syncs them every 10 minutes and builds an unlimited history that\'s yours forever.',
    ctaPrimary: 'Start tracking my battles',
    benefitsTitle: 'What BrawlVision does for you',
    benefits: [
      {
        title: 'Unlimited history',
        body: 'Every battle is saved. Look back 3 months, 6 months, a year — no automatic deletions.',
      },
      {
        title: 'Per-brawler, per-map, per-mode stats',
        body: 'Exact win rate for every combination. Discover your best and worst matchups with real data, not gut feeling.',
      },
      {
        title: 'Trends over time',
        body: 'Trophy and win-rate curves by day. Measure whether you\'re actually improving or just treading water.',
      },
      {
        title: 'Automatic sync',
        body: 'Your dashboard refreshes every 10 minutes. No manual clicks. No battles lost because you forgot to log in.',
      },
    ],
    howTitle: 'How it works',
    steps: [
      'Enter your Brawl Stars Player Tag on the home page',
      'Activate your free PRO trial (3 days, no credit card)',
      'BrawlVision starts syncing and saves every battle automatically',
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      {
        q: 'Why does Brawl Stars only show 25 battles?',
        a: 'Supercell\'s public API only returns the last 25 matches per player through the battlelog endpoint. The game stores more internally but doesn\'t expose it. BrawlVision syncs your log before Supercell discards it and persists it to our database.',
      },
      {
        q: 'Can BrawlVision recover old battles?',
        a: 'We can only save battles from the moment you start using the service — Supercell does not provide retroactive access. The sooner you activate tracking, the more history you\'ll collect.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. BrawlVision runs in the browser. Sign in with Google, link your Player Tag, and it syncs in the background. We never ask for your Supercell password.',
      },
    ],
    finalCtaTitle: 'Ready to stop losing battles to the 25-match cap?',
    finalCtaBody: 'Activate tracking in under a minute and start building your complete history from today.',
  },

  fr: {
    metaTitle: 'Historique complet de Brawl Stars | BrawlVision',
    metaDescription: 'L\'API de Supercell ne garde que 25 combats. BrawlVision les synchronise toutes les 10 minutes et construit ton historique illimité. Analyses par brawler, carte et mode.',
    breadcrumbLabel: 'Historique de combats',
    homeAriaLabel: 'Aller à la page d\'accueil',
    heroTitle: 'Sauvegarde ton historique complet de combats Brawl Stars',
    heroLead: 'L\'API officielle de Supercell ne conserve que tes 25 derniers matchs. BrawlVision les synchronise toutes les 10 minutes et construit un historique illimité qui t\'appartient pour toujours.',
    ctaPrimary: 'Commencer à sauvegarder mes combats',
    benefitsTitle: 'Ce que BrawlVision fait pour toi',
    benefits: [
      {
        title: 'Historique illimité',
        body: 'Chaque combat est sauvegardé. Reviens 3 mois, 6 mois, un an en arrière. Pas de suppressions automatiques.',
      },
      {
        title: 'Stats par brawler, carte et mode',
        body: 'Taux de victoire exact de chaque combinaison. Découvre tes meilleurs et pires matchs avec des données réelles.',
      },
      {
        title: 'Tendances dans le temps',
        body: 'Courbes de trophées et de taux de victoire par jour. Mesure si tu progresses vraiment ou si tu stagnes.',
      },
      {
        title: 'Synchronisation automatique',
        body: 'Ton tableau de bord se rafraîchit toutes les 10 minutes. Sans rien faire. Sans perdre de combats.',
      },
    ],
    howTitle: 'Comment commencer',
    steps: [
      'Entre ton Player Tag Brawl Stars sur la page d\'accueil',
      'Active ton essai gratuit PRO (3 jours, sans carte)',
      'BrawlVision commence à synchroniser et sauvegarde chaque combat automatiquement',
    ],
    faqTitle: 'Questions fréquentes',
    faq: [
      {
        q: 'Pourquoi Brawl Stars n\'affiche que 25 combats ?',
        a: 'L\'API publique de Supercell ne renvoie que les 25 derniers matchs par joueur via le battlelog. Le jeu en stocke plus en interne mais ne les expose pas. BrawlVision synchronise ton log avant que Supercell ne l\'efface et le persiste dans notre base.',
      },
      {
        q: 'BrawlVision peut-il récupérer les anciens combats ?',
        a: 'On ne peut sauvegarder les combats qu\'à partir du moment où tu commences à utiliser le service — Supercell n\'offre pas d\'accès rétroactif. Plus tôt tu actives le suivi, plus d\'historique tu accumules.',
      },
      {
        q: 'Dois-je installer quelque chose ?',
        a: 'Non. BrawlVision fonctionne dans le navigateur. Connecte-toi avec Google, lie ton Player Tag et la synchro se fait en arrière-plan. On ne demande jamais ton mot de passe Supercell.',
      },
    ],
    finalCtaTitle: 'Prêt à ne plus perdre de combats ?',
    finalCtaBody: 'Active le suivi en moins d\'une minute et commence à bâtir ton historique complet dès aujourd\'hui.',
  },

  pt: {
    metaTitle: 'Histórico completo de Brawl Stars | BrawlVision',
    metaDescription: 'A API da Supercell só guarda 25 batalhas. BrawlVision sincroniza a cada 10 minutos e constrói seu histórico ilimitado para sempre. Análises por brawler, mapa e modo.',
    breadcrumbLabel: 'Histórico de batalhas',
    homeAriaLabel: 'Ir para a página inicial',
    heroTitle: 'Salve seu histórico completo de batalhas do Brawl Stars',
    heroLead: 'A API oficial da Supercell só guarda suas últimas 25 partidas. BrawlVision sincroniza a cada 10 minutos e constrói um histórico ilimitado que é seu para sempre.',
    ctaPrimary: 'Começar a salvar meu histórico',
    benefitsTitle: 'O que o BrawlVision faz por você',
    benefits: [
      {
        title: 'Histórico ilimitado',
        body: 'Cada batalha é salva. Veja há 3 meses, 6 meses, um ano. Sem remoções automáticas.',
      },
      {
        title: 'Stats por brawler, mapa e modo',
        body: 'Win rate exato de cada combinação. Descubra seus melhores e piores matchups com dados reais.',
      },
      {
        title: 'Tendências ao longo do tempo',
        body: 'Gráficos de troféus e win rate por dia. Meça se você está melhorando ou estagnado.',
      },
      {
        title: 'Sincronização automática',
        body: 'Seu dashboard atualiza a cada 10 minutos. Sem tocar em nada. Sem perder batalhas.',
      },
    ],
    howTitle: 'Como começar',
    steps: [
      'Digite seu Player Tag do Brawl Stars na página inicial',
      'Ative seu teste gratuito PRO (3 dias, sem cartão)',
      'BrawlVision começa a sincronizar e salva cada batalha automaticamente',
    ],
    faqTitle: 'Perguntas frequentes',
    faq: [
      {
        q: 'Por que o Brawl Stars só mostra 25 batalhas?',
        a: 'A API pública da Supercell só retorna as últimas 25 partidas por jogador pelo battlelog. O jogo guarda mais internamente, mas não expõe. BrawlVision sincroniza seu log antes da Supercell apagar e persiste no nosso banco.',
      },
      {
        q: 'BrawlVision pode recuperar batalhas antigas?',
        a: 'Só podemos salvar batalhas a partir do momento em que você começa a usar o serviço — a Supercell não dá acesso retroativo. Quanto antes ativar o tracking, mais histórico acumula.',
      },
      {
        q: 'Preciso instalar algo?',
        a: 'Não. BrawlVision roda no navegador. Entra com Google, vincula o Player Tag e sincroniza em segundo plano. Nunca pedimos sua senha da Supercell.',
      },
    ],
    finalCtaTitle: 'Pronto para não perder mais nenhuma batalha?',
    finalCtaBody: 'Ative o tracking em menos de um minuto e comece a construir seu histórico completo desde hoje.',
  },

  de: {
    metaTitle: 'Vollständiger Brawl Stars Kampfverlauf | BrawlVision',
    metaDescription: 'Supercells API speichert nur 25 Kämpfe. BrawlVision synchronisiert alle 10 Minuten und baut deinen unbegrenzten Verlauf für immer. Analysen pro Brawler, Karte und Modus.',
    breadcrumbLabel: 'Kampfverlauf',
    homeAriaLabel: 'Zur Startseite',
    heroTitle: 'Speichere deinen kompletten Brawl Stars Kampfverlauf',
    heroLead: 'Die offizielle Supercell-API speichert nur deine letzten 25 Matches. BrawlVision synchronisiert alle 10 Minuten und baut einen unbegrenzten Verlauf, der für immer dir gehört.',
    ctaPrimary: 'Meine Kämpfe speichern',
    benefitsTitle: 'Was BrawlVision für dich macht',
    benefits: [
      {
        title: 'Unbegrenzter Verlauf',
        body: 'Jeder Kampf wird gespeichert. Schau 3 Monate, 6 Monate, ein Jahr zurück. Keine automatischen Löschungen.',
      },
      {
        title: 'Stats pro Brawler, Karte und Modus',
        body: 'Exakte Siegrate für jede Kombination. Entdecke deine besten und schlechtesten Matchups mit echten Daten.',
      },
      {
        title: 'Zeitliche Trends',
        body: 'Trophäen- und Siegraten-Kurven pro Tag. Miss, ob du dich wirklich verbesserst oder stagnierst.',
      },
      {
        title: 'Automatische Synchronisation',
        body: 'Dein Dashboard aktualisiert sich alle 10 Minuten. Ohne Klicks. Ohne verlorene Kämpfe.',
      },
    ],
    howTitle: 'So fängst du an',
    steps: [
      'Gib deinen Brawl Stars Player Tag auf der Startseite ein',
      'Aktiviere deine kostenlose PRO-Testphase (3 Tage, keine Karte)',
      'BrawlVision synchronisiert und speichert automatisch jeden Kampf',
    ],
    faqTitle: 'Häufig gestellte Fragen',
    faq: [
      {
        q: 'Warum zeigt Brawl Stars nur 25 Kämpfe?',
        a: 'Supercells öffentliche API liefert nur die letzten 25 Matches pro Spieler über den Battlelog-Endpunkt. Das Spiel speichert intern mehr, legt sie aber nicht offen. BrawlVision synchronisiert dein Log bevor Supercell es verwirft und persistiert es in unserer Datenbank.',
      },
      {
        q: 'Kann BrawlVision alte Kämpfe wiederherstellen?',
        a: 'Wir können nur Kämpfe ab dem Moment speichern, an dem du den Dienst nutzt — Supercell bietet keinen rückwirkenden Zugriff. Je früher du aktivierst, desto mehr Verlauf sammelst du.',
      },
      {
        q: 'Muss ich etwas installieren?',
        a: 'Nein. BrawlVision läuft im Browser. Mit Google anmelden, Player Tag verknüpfen, und es synchronisiert im Hintergrund. Wir fragen nie nach deinem Supercell-Passwort.',
      },
    ],
    finalCtaTitle: 'Bereit, keinen Kampf mehr zu verlieren?',
    finalCtaBody: 'Aktiviere das Tracking in unter einer Minute und bau ab heute deinen kompletten Verlauf auf.',
  },

  it: {
    metaTitle: 'Storico completo di Brawl Stars | BrawlVision',
    metaDescription: 'L\'API di Supercell salva solo 25 battaglie. BrawlVision sincronizza ogni 10 minuti e costruisce il tuo storico illimitato per sempre. Analisi per brawler, mappa e modalità.',
    breadcrumbLabel: 'Storico battaglie',
    homeAriaLabel: 'Vai alla pagina principale',
    heroTitle: 'Salva lo storico completo delle tue battaglie di Brawl Stars',
    heroLead: 'L\'API ufficiale di Supercell conserva solo le tue ultime 25 partite. BrawlVision le sincronizza ogni 10 minuti e costruisce uno storico illimitato che è tuo per sempre.',
    ctaPrimary: 'Inizia a salvare le mie battaglie',
    benefitsTitle: 'Cosa fa BrawlVision per te',
    benefits: [
      {
        title: 'Storico illimitato',
        body: 'Ogni battaglia è salvata. Guarda 3 mesi fa, 6 mesi, un anno. Nessuna cancellazione automatica.',
      },
      {
        title: 'Stats per brawler, mappa e modalità',
        body: 'Win rate esatto di ogni combinazione. Scopri i tuoi matchup migliori e peggiori con dati reali.',
      },
      {
        title: 'Tendenze nel tempo',
        body: 'Grafici di trofei e win rate per giorno. Misura se stai davvero migliorando o sei fermo.',
      },
      {
        title: 'Sincronizzazione automatica',
        body: 'La tua dashboard si aggiorna ogni 10 minuti. Senza toccare niente. Senza perdere battaglie.',
      },
    ],
    howTitle: 'Come iniziare',
    steps: [
      'Inserisci il tuo Player Tag di Brawl Stars nella pagina principale',
      'Attiva la prova gratuita PRO (3 giorni, senza carta)',
      'BrawlVision inizia a sincronizzare e salva ogni battaglia automaticamente',
    ],
    faqTitle: 'Domande frequenti',
    faq: [
      {
        q: 'Perché Brawl Stars mostra solo 25 battaglie?',
        a: 'L\'API pubblica di Supercell restituisce solo le ultime 25 partite per giocatore tramite il battlelog. Il gioco ne salva di più internamente ma non le espone. BrawlVision sincronizza il log prima che Supercell lo cancelli e lo persiste nel nostro database.',
      },
      {
        q: 'BrawlVision può recuperare battaglie vecchie?',
        a: 'Possiamo salvare battaglie solo dal momento in cui inizi a usare il servizio — Supercell non offre accesso retroattivo. Prima attivi il tracking, più storico accumuli.',
      },
      {
        q: 'Devo installare qualcosa?',
        a: 'No. BrawlVision funziona nel browser. Accedi con Google, collega il Player Tag e sincronizza in background. Non chiediamo mai la password di Supercell.',
      },
    ],
    finalCtaTitle: 'Pronto a non perdere più battaglie?',
    finalCtaBody: 'Attiva il tracking in meno di un minuto e inizia a costruire il tuo storico completo da oggi.',
  },

  ru: {
    metaTitle: 'Полная история боёв Brawl Stars | BrawlVision',
    metaDescription: 'API Supercell хранит только 25 боёв. BrawlVision синхронизирует каждые 10 минут и строит неограниченную историю навсегда. Аналитика по брелку, карте и режиму.',
    breadcrumbLabel: 'История боёв',
    homeAriaLabel: 'На главную',
    heroTitle: 'Сохрани полную историю боёв в Brawl Stars',
    heroLead: 'Официальный API Supercell хранит только последние 25 матчей. BrawlVision синхронизирует их каждые 10 минут и строит неограниченную историю, которая твоя навсегда.',
    ctaPrimary: 'Начать сохранять историю',
    benefitsTitle: 'Что BrawlVision делает для тебя',
    benefits: [
      {
        title: 'Неограниченная история',
        body: 'Каждый бой сохраняется. Смотри назад на 3 месяца, 6 месяцев, год. Без автоматического удаления.',
      },
      {
        title: 'Статистика по бойцу, карте и режиму',
        body: 'Точный винрейт по каждой комбинации. Найди свои лучшие и худшие матчапы по реальным данным.',
      },
      {
        title: 'Тренды во времени',
        body: 'Графики трофеев и винрейта по дням. Измерь, прогрессируешь ли ты на самом деле.',
      },
      {
        title: 'Автоматическая синхронизация',
        body: 'Дашборд обновляется каждые 10 минут. Без кликов. Без потерянных боёв.',
      },
    ],
    howTitle: 'Как начать',
    steps: [
      'Введи свой Player Tag Brawl Stars на главной странице',
      'Активируй бесплатный PRO-пробник (3 дня, без карты)',
      'BrawlVision начинает синхронизацию и сохраняет каждый бой автоматически',
    ],
    faqTitle: 'Частые вопросы',
    faq: [
      {
        q: 'Почему Brawl Stars показывает только 25 боёв?',
        a: 'Публичный API Supercell возвращает только последние 25 матчей на игрока через battlelog. Игра хранит больше внутри, но не раскрывает. BrawlVision синхронизирует твой лог до того, как Supercell его удалит.',
      },
      {
        q: 'Может ли BrawlVision восстановить старые бои?',
        a: 'Мы сохраняем бои только с момента начала использования сервиса — Supercell не даёт ретроактивный доступ. Чем раньше активируешь трекинг, тем больше истории накопишь.',
      },
      {
        q: 'Нужно ли что-то устанавливать?',
        a: 'Нет. BrawlVision работает в браузере. Входишь через Google, привязываешь Player Tag, и оно синхронизируется в фоне. Мы никогда не просим пароль Supercell.',
      },
    ],
    finalCtaTitle: 'Готов не терять больше ни одного боя?',
    finalCtaBody: 'Активируй трекинг меньше чем за минуту и начни строить полную историю с сегодняшнего дня.',
  },

  tr: {
    metaTitle: 'Tam Brawl Stars Savaş Geçmişi | BrawlVision',
    metaDescription: 'Supercell API\'si sadece 25 savaş tutar. BrawlVision 10 dakikada bir senkronize eder ve sınırsız geçmişini sonsuza kadar saklar. Brawler, harita ve mod analizleri.',
    breadcrumbLabel: 'Savaş geçmişi',
    homeAriaLabel: 'Ana sayfaya git',
    heroTitle: 'Brawl Stars savaş geçmişini tam olarak kaydet',
    heroLead: 'Supercell\'in resmi API\'si sadece son 25 maçını tutar. BrawlVision her 10 dakikada bir senkronize eder ve sonsuza kadar senin olan sınırsız bir geçmiş oluşturur.',
    ctaPrimary: 'Savaşlarımı kaydetmeye başla',
    benefitsTitle: 'BrawlVision senin için ne yapar',
    benefits: [
      {
        title: 'Sınırsız geçmiş',
        body: 'Her savaş kaydedilir. 3 ay, 6 ay, bir yıl öncesine bak. Otomatik silme yok.',
      },
      {
        title: 'Brawler, harita ve mod istatistikleri',
        body: 'Her kombinasyon için tam kazanma oranı. En iyi ve en kötü eşleşmelerini gerçek verilerle keşfet.',
      },
      {
        title: 'Zaman içindeki trendler',
        body: 'Günlük kupa ve kazanma oranı grafikleri. Gerçekten gelişip gelişmediğini ölç.',
      },
      {
        title: 'Otomatik senkronizasyon',
        body: 'Dashboardun her 10 dakikada bir yenilenir. Elle dokunmadan. Kayıp savaş olmadan.',
      },
    ],
    howTitle: 'Nasıl başlarsın',
    steps: [
      'Ana sayfaya Brawl Stars Player Tag\'ini gir',
      'Ücretsiz PRO denemeni aktive et (3 gün, kart yok)',
      'BrawlVision senkronize etmeye ve her savaşı otomatik kaydetmeye başlar',
    ],
    faqTitle: 'Sık sorulan sorular',
    faq: [
      {
        q: 'Brawl Stars neden sadece 25 savaş gösterir?',
        a: 'Supercell\'in genel API\'si battlelog üzerinden oyuncu başına sadece son 25 maçı döner. Oyun dahilde daha fazlasını saklar ama açmaz. BrawlVision logunu Supercell silmeden önce senkronize eder ve veritabanımıza kaydeder.',
      },
      {
        q: 'BrawlVision eski savaşları kurtarabilir mi?',
        a: 'Sadece servisi kullanmaya başladığın andan itibaren savaşları kaydedebiliriz — Supercell geriye dönük erişim sunmuyor. Takibi ne kadar erken aktive edersen, o kadar çok geçmiş biriktirirsin.',
      },
      {
        q: 'Bir şey kurmam gerekiyor mu?',
        a: 'Hayır. BrawlVision tarayıcıda çalışır. Google ile giriş yap, Player Tag\'ini bağla, arka planda senkronize olur. Supercell parolanı asla istemeyiz.',
      },
    ],
    finalCtaTitle: 'Artık savaş kaybetmemeye hazır mısın?',
    finalCtaBody: 'Bir dakikadan kısa sürede takibi aktive et ve bugünden itibaren tam geçmişini oluşturmaya başla.',
  },

  pl: {
    metaTitle: 'Pełna historia walk Brawl Stars | BrawlVision',
    metaDescription: 'API Supercell trzyma tylko 25 walk. BrawlVision synchronizuje co 10 minut i buduje Twoją nieograniczoną historię na zawsze. Analiza po brawlerze, mapie i trybie.',
    breadcrumbLabel: 'Historia walk',
    homeAriaLabel: 'Przejdź do strony głównej',
    heroTitle: 'Zapisz pełną historię walk w Brawl Stars',
    heroLead: 'Oficjalne API Supercell trzyma tylko Twoje ostatnie 25 meczów. BrawlVision synchronizuje co 10 minut i buduje nieograniczoną historię, która jest Twoja na zawsze.',
    ctaPrimary: 'Zacznij zapisywać walki',
    benefitsTitle: 'Co BrawlVision robi dla Ciebie',
    benefits: [
      {
        title: 'Nieograniczona historia',
        body: 'Każda walka zapisana. Patrz 3 miesiące wstecz, 6 miesięcy, rok. Bez automatycznego usuwania.',
      },
      {
        title: 'Statystyki po brawlerze, mapie i trybie',
        body: 'Dokładny winrate każdej kombinacji. Odkryj swoje najlepsze i najgorsze matchupy na prawdziwych danych.',
      },
      {
        title: 'Trendy w czasie',
        body: 'Wykresy trofeów i winrate dzień po dniu. Zmierz, czy naprawdę się poprawiasz.',
      },
      {
        title: 'Automatyczna synchronizacja',
        body: 'Twój panel odświeża się co 10 minut. Bez klikania. Bez utraconych walk.',
      },
    ],
    howTitle: 'Jak zacząć',
    steps: [
      'Wpisz swój Player Tag Brawl Stars na stronie głównej',
      'Aktywuj darmowy okres próbny PRO (3 dni, bez karty)',
      'BrawlVision zaczyna synchronizację i zapisuje każdą walkę automatycznie',
    ],
    faqTitle: 'Najczęstsze pytania',
    faq: [
      {
        q: 'Dlaczego Brawl Stars pokazuje tylko 25 walk?',
        a: 'Publiczne API Supercell zwraca tylko ostatnie 25 meczów na gracza przez endpoint battlelog. Gra trzyma więcej wewnętrznie, ale nie udostępnia. BrawlVision synchronizuje log zanim Supercell go skasuje i zapisuje w naszej bazie.',
      },
      {
        q: 'Czy BrawlVision może odzyskać stare walki?',
        a: 'Możemy zapisywać walki tylko od momentu rozpoczęcia korzystania z serwisu — Supercell nie daje wstecznego dostępu. Im wcześniej aktywujesz tracking, tym więcej historii zbierzesz.',
      },
      {
        q: 'Czy muszę coś instalować?',
        a: 'Nie. BrawlVision działa w przeglądarce. Zaloguj się przez Google, połącz Player Tag, synchronizuje się w tle. Nigdy nie prosimy o hasło Supercell.',
      },
    ],
    finalCtaTitle: 'Gotowy, żeby nie tracić już walk?',
    finalCtaBody: 'Aktywuj tracking w mniej niż minutę i zacznij budować pełną historię od dziś.',
  },

  ar: {
    metaTitle: 'سجل معارك Brawl Stars الكامل | BrawlVision',
    metaDescription: 'واجهة Supercell تحفظ 25 معركة فقط. BrawlVision يزامنها كل 10 دقائق ويبني سجلك غير المحدود إلى الأبد. تحليلات لكل بطل وخريطة ووضع.',
    breadcrumbLabel: 'سجل المعارك',
    homeAriaLabel: 'العودة إلى الصفحة الرئيسية',
    heroTitle: 'احفظ سجل معارك Brawl Stars كاملاً',
    heroLead: 'واجهة Supercell الرسمية تحفظ آخر 25 مباراة فقط. BrawlVision يزامنها كل 10 دقائق ويبني سجلاً غير محدود يبقى ملكك إلى الأبد.',
    ctaPrimary: 'ابدأ بحفظ معاركي',
    benefitsTitle: 'ماذا يفعل BrawlVision لك',
    benefits: [
      {
        title: 'سجل غير محدود',
        body: 'كل معركة محفوظة. ارجع إلى 3 أشهر أو 6 أشهر أو سنة. بدون حذف تلقائي.',
      },
      {
        title: 'إحصائيات لكل بطل وخريطة ووضع',
        body: 'نسبة فوز دقيقة لكل تركيبة. اكتشف أفضل وأسوأ مواجهاتك ببيانات حقيقية.',
      },
      {
        title: 'اتجاهات عبر الزمن',
        body: 'منحنيات الكؤوس ونسبة الفوز يومياً. قِس ما إذا كنت تتحسن فعلاً أم لا.',
      },
      {
        title: 'مزامنة تلقائية',
        body: 'لوحتك تتحدث كل 10 دقائق. بدون نقرات. بدون فقدان معارك.',
      },
    ],
    howTitle: 'كيف تبدأ',
    steps: [
      'أدخل Player Tag الخاص بك في الصفحة الرئيسية',
      'فعّل تجربتك المجانية PRO (3 أيام، بدون بطاقة)',
      'BrawlVision يبدأ المزامنة ويحفظ كل معركة تلقائياً',
    ],
    faqTitle: 'أسئلة شائعة',
    faq: [
      {
        q: 'لماذا يعرض Brawl Stars 25 معركة فقط؟',
        a: 'واجهة Supercell العامة تعيد آخر 25 مباراة فقط لكل لاعب عبر battlelog. اللعبة تخزن أكثر داخلياً لكنها لا تكشفه. BrawlVision يزامن سجلك قبل أن يحذفه Supercell ويحفظه في قاعدة بياناتنا.',
      },
      {
        q: 'هل يمكن لـ BrawlVision استرجاع المعارك القديمة؟',
        a: 'يمكننا حفظ المعارك فقط من لحظة بدء استخدام الخدمة — Supercell لا يوفر وصولاً بأثر رجعي. كلما فعّلت التتبع أبكر، كلما جمعت سجلاً أكثر.',
      },
      {
        q: 'هل أحتاج إلى تثبيت شيء؟',
        a: 'لا. BrawlVision يعمل في المتصفح. سجّل الدخول عبر Google، اربط Player Tag، ويزامن في الخلفية. لا نطلب أبداً كلمة مرور Supercell.',
      },
    ],
    finalCtaTitle: 'هل أنت مستعد لئلا تفقد معركة أخرى؟',
    finalCtaBody: 'فعّل التتبع في أقل من دقيقة وابدأ ببناء سجلك الكامل من اليوم.',
  },

  ko: {
    metaTitle: '브롤스타즈 전체 전투 기록 | BrawlVision',
    metaDescription: '슈퍼셀 API는 25개 전투만 저장합니다. BrawlVision은 10분마다 동기화하고 무제한 기록을 영구 보관합니다. 브롤러, 맵, 모드별 분석.',
    breadcrumbLabel: '전투 기록',
    homeAriaLabel: '홈 페이지로 이동',
    heroTitle: '브롤스타즈 전투 기록을 완전하게 저장하세요',
    heroLead: '슈퍼셀 공식 API는 마지막 25경기만 저장합니다. BrawlVision은 10분마다 동기화하며 영원히 당신의 것인 무제한 기록을 구축합니다.',
    ctaPrimary: '전투 기록 저장 시작',
    benefitsTitle: 'BrawlVision이 해드리는 일',
    benefits: [
      {
        title: '무제한 기록',
        body: '모든 전투가 저장됩니다. 3개월, 6개월, 1년 전을 확인하세요. 자동 삭제 없음.',
      },
      {
        title: '브롤러·맵·모드별 통계',
        body: '모든 조합의 정확한 승률. 실제 데이터로 최고와 최악의 매치업을 발견하세요.',
      },
      {
        title: '시간에 따른 추이',
        body: '일별 트로피와 승률 그래프. 실제로 실력이 늘고 있는지 측정하세요.',
      },
      {
        title: '자동 동기화',
        body: '대시보드가 10분마다 갱신됩니다. 클릭 없이. 잃어버린 전투 없이.',
      },
    ],
    howTitle: '시작 방법',
    steps: [
      '메인 페이지에 브롤스타즈 Player Tag 입력',
      '무료 PRO 체험 활성화 (3일, 카드 불필요)',
      'BrawlVision이 동기화하고 모든 전투를 자동 저장',
    ],
    faqTitle: '자주 묻는 질문',
    faq: [
      {
        q: '브롤스타즈가 왜 25전투만 보여주나요?',
        a: '슈퍼셀 공개 API는 battlelog를 통해 플레이어당 최근 25경기만 반환합니다. 게임은 내부적으로 더 저장하지만 노출하지 않습니다. BrawlVision은 슈퍼셀이 삭제하기 전에 로그를 동기화하여 데이터베이스에 보관합니다.',
      },
      {
        q: 'BrawlVision이 오래된 전투를 복구할 수 있나요?',
        a: '서비스 사용을 시작한 시점부터의 전투만 저장할 수 있습니다 — 슈퍼셀은 소급 접근을 제공하지 않습니다. 트래킹을 빨리 활성화할수록 더 많은 기록이 쌓입니다.',
      },
      {
        q: '설치해야 할 것이 있나요?',
        a: '아니요. BrawlVision은 브라우저에서 작동합니다. Google로 로그인하고 Player Tag를 연결하면 백그라운드에서 동기화됩니다. 슈퍼셀 비밀번호는 절대 묻지 않습니다.',
      },
    ],
    finalCtaTitle: '더 이상 전투를 잃고 싶지 않으신가요?',
    finalCtaBody: '1분 이내에 트래킹을 활성화하고 오늘부터 완전한 기록을 구축하세요.',
  },

  ja: {
    metaTitle: 'ブロスタ完全バトル履歴 | BrawlVision',
    metaDescription: 'Supercell APIは25戦しか保存しません。BrawlVisionは10分ごとに同期し、無制限の履歴を永久に保存します。ブロウラー・マップ・モードごとの分析。',
    breadcrumbLabel: 'バトル履歴',
    homeAriaLabel: 'ホームページへ戻る',
    heroTitle: 'ブロスタのバトル履歴を完全に保存',
    heroLead: 'Supercell公式APIは直近25試合しか保存しません。BrawlVisionは10分ごとに同期し、永久にあなたのものとなる無制限の履歴を構築します。',
    ctaPrimary: 'バトル履歴を保存開始',
    benefitsTitle: 'BrawlVisionができること',
    benefits: [
      {
        title: '無制限の履歴',
        body: 'すべてのバトルが保存されます。3ヶ月前、6ヶ月前、1年前も確認可能。自動削除なし。',
      },
      {
        title: 'ブロウラー・マップ・モードごとの統計',
        body: 'すべての組み合わせの正確な勝率。実データで最高と最悪のマッチアップを発見。',
      },
      {
        title: '時系列トレンド',
        body: '日別のトロフィーと勝率のグラフ。本当に上達しているかを測定。',
      },
      {
        title: '自動同期',
        body: 'ダッシュボードは10分ごとに更新。クリック不要。バトルを失わない。',
      },
    ],
    howTitle: '始め方',
    steps: [
      'ホームページでブロスタのPlayer Tagを入力',
      '無料PROトライアルを有効化（3日間、カード不要）',
      'BrawlVisionが同期を開始し、すべてのバトルを自動保存',
    ],
    faqTitle: 'よくある質問',
    faq: [
      {
        q: 'なぜブロスタは25戦しか表示しないの?',
        a: 'Supercellの公開APIはbattlelog経由でプレイヤーごとの直近25試合のみを返します。ゲーム内部ではより多く保存されていますが公開されません。BrawlVisionはSupercellが破棄する前にログを同期し、データベースに永続化します。',
      },
      {
        q: 'BrawlVisionは古いバトルを復元できますか?',
        a: 'サービスの利用を開始した時点からのバトルしか保存できません — Supercellは遡及的アクセスを提供していません。早くトラッキングを有効化するほど、より多くの履歴が蓄積されます。',
      },
      {
        q: '何かインストールする必要はありますか?',
        a: 'いいえ。BrawlVisionはブラウザで動作します。Googleでサインインし、Player Tagを連携するとバックグラウンドで同期します。Supercellのパスワードは決して求めません。',
      },
    ],
    finalCtaTitle: 'もうバトルを失いたくないですか?',
    finalCtaBody: '1分以内でトラッキングを有効化し、今日から完全な履歴の構築を開始しましょう。',
  },

  zh: {
    metaTitle: '荒野乱斗完整战斗历史 | BrawlVision',
    metaDescription: 'Supercell API只保留25场战斗。BrawlVision每10分钟同步一次，永久构建你的无限历史。按英雄、地图、模式分析。',
    breadcrumbLabel: '战斗历史',
    homeAriaLabel: '返回首页',
    heroTitle: '保存你完整的荒野乱斗战斗历史',
    heroLead: 'Supercell官方API只保留你最近25场比赛。BrawlVision每10分钟同步一次，为你构建永远属于你的无限历史。',
    ctaPrimary: '开始保存我的战斗',
    benefitsTitle: 'BrawlVision为你做什么',
    benefits: [
      {
        title: '无限历史',
        body: '每场战斗都被保存。回看3个月、6个月、一年前。没有自动删除。',
      },
      {
        title: '按英雄、地图、模式统计',
        body: '每种组合的精确胜率。用真实数据发现你最好和最差的对战组合。',
      },
      {
        title: '时间趋势',
        body: '按天的奖杯和胜率曲线。测量你是否真的在进步。',
      },
      {
        title: '自动同步',
        body: '你的仪表盘每10分钟刷新。无需点击。不会丢失战斗。',
      },
    ],
    howTitle: '如何开始',
    steps: [
      '在主页输入你的荒野乱斗Player Tag',
      '激活免费PRO试用（3天，无需银行卡）',
      'BrawlVision开始同步并自动保存每场战斗',
    ],
    faqTitle: '常见问题',
    faq: [
      {
        q: '为什么荒野乱斗只显示25场战斗?',
        a: 'Supercell公开API通过battlelog只返回每个玩家的最近25场比赛。游戏内部保存更多，但不对外公开。BrawlVision在Supercell删除前同步你的日志，持久化到我们的数据库。',
      },
      {
        q: 'BrawlVision能恢复旧战斗吗?',
        a: '我们只能从你开始使用服务的时刻保存战斗 — Supercell不提供追溯访问。你越早激活追踪，积累的历史就越多。',
      },
      {
        q: '我需要安装什么吗?',
        a: '不需要。BrawlVision在浏览器中运行。用Google登录，连接Player Tag，就会在后台同步。我们从不询问你的Supercell密码。',
      },
    ],
    finalCtaTitle: '准备好不再丢失战斗了吗?',
    finalCtaBody: '一分钟内激活追踪，从今天开始构建完整历史。',
  },
}

// Landing footer link key lives in the `landing` namespace so it
// sits next to `privacyLink` and `contact`.
const LANDING_FOOTER_LINK = {
  es: 'Historial ilimitado',
  en: 'Unlimited history',
  fr: 'Historique illimité',
  pt: 'Histórico ilimitado',
  de: 'Unbegrenzter Verlauf',
  it: 'Storico illimitato',
  ru: 'Безлимитная история',
  tr: 'Sınırsız geçmiş',
  pl: 'Pełna historia',
  ar: 'سجل غير محدود',
  ko: '무제한 기록',
  ja: '無制限の履歴',
  zh: '无限历史',
}

let totalAdditions = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

  const namespace = TRANSLATIONS[locale]
  data.battleHistory = namespace

  if (!data.landing) data.landing = {}
  data.landing.battleHistoryLink = LANDING_FOOTER_LINK[locale]

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  const keyCount = Object.keys(namespace).length + 1
  totalAdditions += keyCount
  console.log(`  ${locale.padEnd(3)}  battleHistory namespace (${Object.keys(namespace).length} keys) + landing.battleHistoryLink`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
