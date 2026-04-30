#!/usr/bin/env node
// /[locale]/brawler — roster page editorial copy.
//
// Adds the `brawlerRoster` namespace × 13 locales: hero lead +
// rarity distribution copy + meta notes block. The page used to
// be a thin grid of 104 portraits (AdSense AD-04, navigation page),
// so we add ~700 words of editorial above the grid before the slot.
//
// Idempotent.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    metaTitle: 'Roster completo de Brawl Stars 2026 — todos los brawlers, rareza y meta',
    metaDescription: 'Lista completa de los {count} brawlers de Brawl Stars con su rareza, clase y posición en el meta competitivo actual. Datos cruzados con la API oficial de Supercell y muestreo PRO propio.',
    breadcrumbLabel: 'Brawlers',
    eyebrow: 'Roster competitivo',
    heroTitle: 'Roster completo Brawl Stars 2026',
    heroLead: 'Esta página lista los {count} brawlers de Brawl Stars de la rotación actual con la rareza con la que se desbloquean y un acceso directo a su análisis individual de meta. La lista se sincroniza diariamente con la API oficial de Supercell, así que cualquier brawler nuevo aparece el mismo día del lanzamiento; la rareza la cruzamos con Brawlify y, mientras esa CDN se pone al día (suele tardar de uno a tres días), un mapa local de rareza nuestro evita huecos visuales en la primera ventana.',
    heroLeadSecond: 'Para cada brawler ofrecemos una ficha individual con win rate global de los últimos 14 días, mejor mapa, counters más probables y la tendencia 7 días del WR. Todos los porcentajes provienen de batallas reales de top jugadores PRO de once países, con smoothing bayesiano para que un brawler con poca muestra no aparezca con un porcentaje engañoso. Los detalles completos del cálculo están en la página de metodología.',
    distributionTitle: 'Distribución por rareza',
    distributionLead: 'La rareza determina cómo se desbloquea cada brawler en el juego (recompensas de Trophy Road, Brawl Boxes pasadas o packs específicos del nuevo sistema de progresión). En el meta competitivo, la rareza no es un proxy directo de potencia: muchos Trophy Road siguen teniendo win rates por encima del 52% catorce días después de una rotación, y bastantes Legendary se quedan estables alrededor del 50%. Esta tabla muestra cuántos brawlers hay por categoría con el roster actual.',
    distributionFootnote: 'Los porcentajes se redondean al entero más cercano y suman 100 con un margen de error de ±1 punto.',
    metaNotesTitle: 'Notas del meta',
    metaNotesParagraph1: 'El meta de Brawl Stars cambia con cada rotación de mapas y modos. Algunos brawlers son consistentes (su win rate fluctúa menos de un punto porcentual semana a semana), otros tienen picos cíclicos cuando entra en juego un mapa que premia su kit. La página individual de cada brawler muestra la tendencia 7 días en porcentaje exacto cuando hay muestra suficiente; cuando no la hay, mostramos un placeholder antes que un número de baja confianza.',
    metaNotesParagraph2: 'No publicamos rankings agregados de "tier list" porque consideran cosas que cambian deprisa (rotación, last-pick advantage, sinergia de equipo) como si fueran estáticas. En su lugar, te invitamos a abrir la ficha del brawler que te interesa: ahí ves el WR, el mejor mapa, los counters principales y la tendencia, todo calculado a partir de los mismos datos PRO con la misma metodología bayesiana.',
    methodologyLink: 'Cómo calculamos cada estadística',
    countLabel: 'brawlers',
    rarityCountFormat: '{count} ({percent}%)',
  },

  en: {
    metaTitle: 'Brawl Stars 2026 Full Roster — every brawler, rarity, and meta',
    metaDescription: 'Complete list of all {count} Brawl Stars brawlers with their rarity, class, and current competitive standing. Cross-referenced with Supercell\'s official API and our own PRO sampling.',
    breadcrumbLabel: 'Brawlers',
    eyebrow: 'Competitive roster',
    heroTitle: 'Full Brawl Stars 2026 roster',
    heroLead: 'This page lists the {count} brawlers in Brawl Stars\' current rotation, with the rarity each one unlocks at and a direct link to their individual meta breakdown. The roster syncs daily with Supercell\'s official API, so any new brawler shows up on launch day; rarity comes from Brawlify, and while that CDN catches up (usually one to three days) our local rarity map plugs the visual gap.',
    heroLeadSecond: 'Each brawler has its own page with global win rate over the last 14 days, best map, top likely counters, and the 7-day WR trend. All percentages come from real top-PRO battles across eleven countries, Bayesian-smoothed so a brawler with a small sample doesn\'t show a misleading percentage. Full computation details live on the methodology page.',
    distributionTitle: 'Rarity distribution',
    distributionLead: 'Rarity determines how each brawler unlocks in-game (Trophy Road rewards, past Brawl Boxes, or specific packs in the new progression system). In the competitive meta, rarity is not a direct proxy for power: many Trophy Roads keep win rates above 52% fourteen days after a rotation, and several Legendaries hover steadily around 50%. This table shows how many brawlers fall in each category with the current roster.',
    distributionFootnote: 'Percentages are rounded to the nearest integer and sum to 100 within ±1 point.',
    metaNotesTitle: 'Meta notes',
    metaNotesParagraph1: 'The Brawl Stars meta shifts with every map / mode rotation. Some brawlers are consistent (their win rate fluctuates by less than a percentage point week to week), others have cyclical peaks when a map that rewards their kit comes into rotation. Each individual brawler page shows the 7-day trend in exact percentage when the sample is large enough; when it isn\'t, we show a placeholder rather than a low-confidence number.',
    metaNotesParagraph2: 'We don\'t publish aggregated tier lists because they treat fast-moving things (rotation, last-pick advantage, team synergy) as if they were static. Instead, we invite you to open the page of the brawler you care about: there you see WR, best map, primary counters, and the trend, all computed from the same PRO data with the same Bayesian methodology.',
    methodologyLink: 'How we compute each stat',
    countLabel: 'brawlers',
    rarityCountFormat: '{count} ({percent}%)',
  },

  fr: {
    metaTitle: 'Roster complet Brawl Stars 2026 — tous les brawlers, rareté et meta',
    metaDescription: 'Liste complète des {count} brawlers de Brawl Stars avec rareté, classe et position dans le meta compétitif actuel. Croisée avec l\'API Supercell officielle et notre sampling PRO.',
    breadcrumbLabel: 'Brawlers',
    eyebrow: 'Roster compétitif',
    heroTitle: 'Roster complet Brawl Stars 2026',
    heroLead: 'Cette page liste les {count} brawlers de la rotation actuelle de Brawl Stars, avec leur rareté de déblocage et un accès direct à leur analyse individuelle dans le meta. Le roster est synchronisé chaque jour avec l\'API officielle Supercell, donc tout nouveau brawler apparaît le jour du lancement ; la rareté provient de Brawlify et, le temps que ce CDN se mette à jour (un à trois jours), notre carte locale de rareté évite les trous visuels.',
    heroLeadSecond: 'Chaque brawler a sa fiche avec taux de victoire global sur 14 jours, meilleure carte, counters probables et tendance 7 jours du WR. Tous les pourcentages viennent de combats réels de top joueurs PRO de onze pays, avec lissage bayésien pour qu\'un brawler avec petite sample ne montre pas un pourcentage trompeur. Détails complets sur la page méthodologie.',
    distributionTitle: 'Distribution par rareté',
    distributionLead: 'La rareté détermine comment chaque brawler se débloque en jeu (récompenses Trophy Road, anciennes Brawl Boxes, packs spécifiques du nouveau système). Dans le meta compétitif, la rareté n\'est pas un proxy direct de puissance : beaucoup de Trophy Road maintiennent des WR au-dessus de 52% quatorze jours après une rotation, et plusieurs Legendaries restent stables autour de 50%. Ce tableau montre combien de brawlers tombent dans chaque catégorie avec le roster actuel.',
    distributionFootnote: 'Les pourcentages sont arrondis à l\'entier le plus proche et somment 100 à ±1 point près.',
    metaNotesTitle: 'Notes sur le meta',
    metaNotesParagraph1: 'Le meta de Brawl Stars bouge à chaque rotation de cartes/modes. Certains brawlers sont constants (leur WR fluctue de moins d\'un point d\'une semaine à l\'autre), d\'autres ont des pics cycliques quand une carte qui valorise leur kit entre en rotation. Chaque fiche individuelle montre la tendance 7 jours en pourcentage exact quand la sample est assez grande ; sinon, on affiche un placeholder plutôt qu\'un nombre à faible confiance.',
    metaNotesParagraph2: 'On ne publie pas de tier list agrégée parce qu\'elles traitent des choses qui bougent vite (rotation, avantage du last-pick, synergie d\'équipe) comme si elles étaient statiques. À la place, on t\'invite à ouvrir la page du brawler qui t\'intéresse : tu y vois WR, meilleure carte, counters principaux et tendance, tout calculé à partir des mêmes données PRO avec la même méthodologie bayésienne.',
    methodologyLink: 'Comment nous calculons chaque stat',
    countLabel: 'brawlers',
    rarityCountFormat: '{count} ({percent}%)',
  },

  pt: {
    metaTitle: 'Roster completo Brawl Stars 2026 — todos os brawlers, raridade e meta',
    metaDescription: 'Lista completa dos {count} brawlers do Brawl Stars com raridade, classe e posição no meta competitivo atual. Cruzada com a API oficial da Supercell e nosso sampling PRO.',
    breadcrumbLabel: 'Brawlers',
    eyebrow: 'Roster competitivo',
    heroTitle: 'Roster completo Brawl Stars 2026',
    heroLead: 'Esta página lista os {count} brawlers da rotação atual do Brawl Stars com a raridade em que cada um desbloqueia e atalho pra análise individual no meta. O roster sincroniza todo dia com a API oficial da Supercell, então qualquer brawler novo aparece no dia do lançamento; a raridade vem do Brawlify e, enquanto a CDN se atualiza (um a três dias), nosso mapa local de raridade evita buracos visuais.',
    heroLeadSecond: 'Cada brawler tem sua página com win rate global de 14 dias, melhor mapa, counters mais prováveis e tendência 7 dias do WR. Todas as porcentagens vêm de batalhas reais de top jogadores PRO de onze países, com smoothing bayesiano pra que um brawler com pouca amostra não apareça com porcentagem enganosa. Detalhes completos do cálculo na página de metodologia.',
    distributionTitle: 'Distribuição por raridade',
    distributionLead: 'A raridade determina como cada brawler se desbloqueia no jogo (recompensas do Trophy Road, antigas Brawl Boxes ou packs específicos do novo sistema). No meta competitivo, a raridade não é proxy direto de poder: muitos Trophy Road mantêm win rates acima de 52% catorze dias depois de uma rotação, e vários Legendary ficam estáveis em torno de 50%. Esta tabela mostra quantos brawlers caem em cada categoria no roster atual.',
    distributionFootnote: 'Porcentagens arredondadas pro inteiro mais próximo e somam 100 com margem de ±1 ponto.',
    metaNotesTitle: 'Notas sobre o meta',
    metaNotesParagraph1: 'O meta do Brawl Stars muda a cada rotação de mapas/modos. Alguns brawlers são consistentes (WR varia menos de um ponto semana a semana), outros têm picos cíclicos quando entra em jogo um mapa que premia o kit deles. A página individual de cada brawler mostra a tendência 7 dias em porcentagem exata quando há amostra suficiente; quando não há, mostramos placeholder em vez de um número de baixa confiança.',
    metaNotesParagraph2: 'Não publicamos tier lists agregadas porque tratam coisas que mudam rápido (rotação, vantagem do last-pick, sinergia de time) como se fossem estáticas. Em vez disso, te convidamos a abrir a página do brawler que te interessa: lá você vê WR, melhor mapa, counters principais e tendência, tudo calculado dos mesmos dados PRO com a mesma metodologia bayesiana.',
    methodologyLink: 'Como calculamos cada estatística',
    countLabel: 'brawlers',
    rarityCountFormat: '{count} ({percent}%)',
  },

  de: {
    metaTitle: 'Brawl Stars 2026 Vollständiges Roster — alle Brawler, Seltenheit, Meta',
    metaDescription: 'Vollständige Liste aller {count} Brawl-Stars-Brawler mit Seltenheit, Klasse und aktueller Position im kompetitiven Meta. Abgeglichen mit Supercells offizieller API und unserem PRO-Sampling.',
    breadcrumbLabel: 'Brawler',
    eyebrow: 'Kompetitives Roster',
    heroTitle: 'Vollständiges Brawl-Stars-2026-Roster',
    heroLead: 'Diese Seite listet die {count} Brawler der aktuellen Brawl-Stars-Rotation mit ihrer Freischalt-Seltenheit und einem Direktlink zu ihrer individuellen Meta-Analyse. Das Roster synchronisiert täglich mit Supercells offizieller API, daher erscheint jeder neue Brawler am Launch-Tag; die Seltenheit kommt von Brawlify, und während dieses CDN aufholt (meist ein bis drei Tage), füllt unsere lokale Seltenheits-Map die visuelle Lücke.',
    heroLeadSecond: 'Jeder Brawler hat eine eigene Seite mit globaler Siegrate der letzten 14 Tage, bester Map, wahrscheinlichsten Countern und 7-Tage-Trend der WR. Alle Prozentsätze kommen aus echten Top-PRO-Kämpfen aus elf Ländern, Bayesian-geglättet, damit ein Brawler mit kleiner Stichprobe keinen irreführenden Prozentsatz zeigt. Komplette Berechnungsdetails auf der Methodik-Seite.',
    distributionTitle: 'Verteilung nach Seltenheit',
    distributionLead: 'Die Seltenheit bestimmt, wie jeder Brawler im Spiel freigeschaltet wird (Trophy-Road-Belohnungen, alte Brawl Boxes oder spezielle Packs des neuen Systems). Im kompetitiven Meta ist Seltenheit kein direkter Proxy für Stärke: viele Trophy Roads halten Siegraten über 52% vierzehn Tage nach einer Rotation, und etliche Legendaries bleiben stabil um 50%. Diese Tabelle zeigt, wie viele Brawler je Kategorie im aktuellen Roster sind.',
    distributionFootnote: 'Prozentsätze werden auf die nächste Ganzzahl gerundet und summieren sich auf 100 mit einem Spielraum von ±1 Punkt.',
    metaNotesTitle: 'Meta-Hinweise',
    metaNotesParagraph1: 'Das Brawl-Stars-Meta verschiebt sich mit jeder Map/Mode-Rotation. Manche Brawler sind beständig (ihre WR schwankt um weniger als einen Prozentpunkt pro Woche), andere haben zyklische Spitzen, wenn eine Map kommt, die ihr Kit belohnt. Die Einzelseite jedes Brawlers zeigt den 7-Tage-Trend in exaktem Prozent, wenn die Stichprobe ausreicht; wenn nicht, zeigen wir einen Platzhalter statt einer Zahl mit niedriger Konfidenz.',
    metaNotesParagraph2: 'Wir veröffentlichen keine aggregierten Tier-Listen, weil sie schnell bewegliche Dinge (Rotation, Last-Pick-Vorteil, Team-Synergie) so behandeln, als wären sie statisch. Stattdessen laden wir dich ein, die Seite des Brawlers zu öffnen, der dich interessiert: dort siehst du WR, beste Map, primäre Counter und den Trend, alles aus denselben PRO-Daten mit derselben Bayesian-Methodik berechnet.',
    methodologyLink: 'Wie wir jede Statistik berechnen',
    countLabel: 'Brawler',
    rarityCountFormat: '{count} ({percent}%)',
  },

  it: {
    metaTitle: 'Roster completo Brawl Stars 2026 — tutti i brawler, rarità e meta',
    metaDescription: 'Lista completa dei {count} brawler di Brawl Stars con rarità, classe e posizione nel meta competitivo attuale. Incrociata con l\'API ufficiale Supercell e il nostro sampling PRO.',
    breadcrumbLabel: 'Brawler',
    eyebrow: 'Roster competitivo',
    heroTitle: 'Roster completo Brawl Stars 2026',
    heroLead: 'Questa pagina elenca i {count} brawler della rotazione attuale di Brawl Stars con la rarità a cui ciascuno si sblocca e un accesso diretto alla sua analisi individuale nel meta. Il roster si sincronizza ogni giorno con l\'API ufficiale Supercell, quindi qualsiasi brawler nuovo appare il giorno del lancio; la rarità viene da Brawlify e, mentre quel CDN si aggiorna (uno-tre giorni), la nostra mappa locale di rarità evita buchi visivi.',
    heroLeadSecond: 'Ogni brawler ha la sua pagina con win rate globale degli ultimi 14 giorni, miglior mappa, counter più probabili e tendenza 7 giorni del WR. Tutte le percentuali vengono da battaglie reali di top giocatori PRO di undici paesi, con smoothing bayesiano perché un brawler con campione piccolo non mostri una percentuale ingannevole. Dettagli completi del calcolo nella pagina metodologia.',
    distributionTitle: 'Distribuzione per rarità',
    distributionLead: 'La rarità determina come ogni brawler si sblocca nel gioco (ricompense Trophy Road, vecchie Brawl Box o pack specifici del nuovo sistema). Nel meta competitivo la rarità non è proxy diretto di potenza: molti Trophy Road mantengono WR sopra 52% quattordici giorni dopo una rotazione, e diversi Legendary stanno stabili intorno al 50%. Questa tabella mostra quanti brawler cadono in ogni categoria nel roster attuale.',
    distributionFootnote: 'Le percentuali sono arrotondate al numero intero più vicino e sommano 100 con margine di ±1 punto.',
    metaNotesTitle: 'Note sul meta',
    metaNotesParagraph1: 'Il meta di Brawl Stars cambia con ogni rotazione di mappe/modalità. Alcuni brawler sono costanti (WR oscilla meno di un punto settimana per settimana), altri hanno picchi ciclici quando entra una mappa che premia il loro kit. La pagina individuale di ogni brawler mostra la tendenza 7 giorni in percentuale esatta quando il campione è sufficiente; quando non lo è, mostriamo placeholder invece di un numero a bassa confidenza.',
    metaNotesParagraph2: 'Non pubblichiamo tier list aggregate perché trattano cose che cambiano in fretta (rotazione, vantaggio last-pick, sinergia di squadra) come se fossero statiche. Invece ti invitiamo ad aprire la pagina del brawler che ti interessa: lì vedi WR, miglior mappa, counter principali e tendenza, tutto calcolato dagli stessi dati PRO con la stessa metodologia bayesiana.',
    methodologyLink: 'Come calcoliamo ogni statistica',
    countLabel: 'brawler',
    rarityCountFormat: '{count} ({percent}%)',
  },

  ru: {
    metaTitle: 'Полный ростер Brawl Stars 2026 — все бойцы, редкость и мета',
    metaDescription: 'Полный список из {count} бойцов Brawl Stars с редкостью, классом и положением в текущей соревновательной мете. Сверено с официальным API Supercell и нашим PRO-семплингом.',
    breadcrumbLabel: 'Бойцы',
    eyebrow: 'Соревновательный ростер',
    heroTitle: 'Полный ростер Brawl Stars 2026',
    heroLead: 'Эта страница содержит {count} бойцов текущей ротации Brawl Stars с редкостью разблокировки и прямой ссылкой на их индивидуальный анализ меты. Ростер синхронизируется ежедневно с официальным API Supercell, так что любой новый боец появляется в день релиза; редкость берётся из Brawlify, и пока этот CDN догоняет (обычно один-три дня), наш локальный мап редкости закрывает визуальный пробел.',
    heroLeadSecond: 'У каждого бойца своя страница с глобальным винрейтом за последние 14 дней, лучшей картой, вероятными контрами и 7-дневным трендом WR. Все проценты берутся из реальных боёв топ-PRO из одиннадцати стран, с байесовским сглаживанием, чтобы боец с маленькой выборкой не показывал обманчивый процент. Полные детали расчёта — на странице методологии.',
    distributionTitle: 'Распределение по редкости',
    distributionLead: 'Редкость определяет, как каждый боец разблокируется в игре (награды Trophy Road, старые Brawl Box или особые паки новой системы). В соревновательной мете редкость не является прямым прокси силы: многие Trophy Road держат винрейт выше 52% через четырнадцать дней после ротации, а несколько Legendary стабильно держатся около 50%. Эта таблица показывает, сколько бойцов в каждой категории текущего ростера.',
    distributionFootnote: 'Проценты округлены до ближайшего целого и суммируются до 100 с погрешностью ±1 пункт.',
    metaNotesTitle: 'Заметки по мете',
    metaNotesParagraph1: 'Мета Brawl Stars смещается с каждой ротацией карт/режимов. Некоторые бойцы стабильны (их WR колеблется менее чем на пункт в неделю), у других цикличные пики, когда входит карта, поощряющая их кит. Индивидуальная страница каждого бойца показывает 7-дневный тренд в точных процентах при достаточной выборке; иначе показываем плейсхолдер вместо числа с низкой уверенностью.',
    metaNotesParagraph2: 'Мы не публикуем агрегированные тир-листы, потому что они трактуют быстро меняющееся (ротация, преимущество последнего пика, синергия команды) как статическое. Вместо этого приглашаем открыть страницу интересующего бойца: там увидишь WR, лучшую карту, основные контры и тренд, всё считается из тех же PRO-данных с той же байесовской методологией.',
    methodologyLink: 'Как мы считаем каждую статистику',
    countLabel: 'бойцов',
    rarityCountFormat: '{count} ({percent}%)',
  },

  tr: {
    metaTitle: 'Brawl Stars 2026 Tam Roster — tüm brawlerlar, nadirlik ve meta',
    metaDescription: '{count} Brawl Stars brawler\'ının tam listesi: nadirlik, sınıf ve mevcut rekabetçi metadaki konum. Supercell\'in resmi API\'si ve kendi PRO örneklememizle çapraz kontrol edildi.',
    breadcrumbLabel: 'Brawlerlar',
    eyebrow: 'Rekabetçi roster',
    heroTitle: 'Brawl Stars 2026 tam roster',
    heroLead: 'Bu sayfa Brawl Stars\'ın mevcut rotasyonundaki {count} brawler\'ı listeler; her birinin açıldığı nadirlik ve bireysel meta analizine doğrudan link ile birlikte. Roster Supercell\'in resmi API\'siyle her gün senkronize olur, dolayısıyla yeni brawler lansman gününde görünür; nadirlik Brawlify\'dan gelir ve bu CDN yakalanırken (genelde bir-üç gün) yerel nadirlik haritamız görsel boşluğu kapatır.',
    heroLeadSecond: 'Her brawler\'ın son 14 günün küresel galibiyet oranı, en iyi haritası, olası counter\'ları ve 7 günlük WR trendi olan kendi sayfası vardır. Tüm yüzdeler, küçük örneklemli bir brawler\'ın yanıltıcı yüzde göstermemesi için Bayesian yumuşatması uygulanan on bir ülkenin gerçek top PRO savaşlarından gelir. Hesaplama detayları metodoloji sayfasındadır.',
    distributionTitle: 'Nadirlik dağılımı',
    distributionLead: 'Nadirlik, her brawler\'ın oyunda nasıl açıldığını belirler (Trophy Road ödülleri, eski Brawl Box\'lar veya yeni sistemin özel paketleri). Rekabetçi metada nadirlik gücün doğrudan vekili değildir: birçok Trophy Road bir rotasyondan on dört gün sonra %52 üzerinde galibiyet oranını korurken birkaç Legendary stabil olarak %50 civarında durur. Bu tablo mevcut roster\'da her kategoride kaç brawler olduğunu gösterir.',
    distributionFootnote: 'Yüzdeler en yakın tam sayıya yuvarlanır ve ±1 puan paylı 100\'e ulaşır.',
    metaNotesTitle: 'Meta notları',
    metaNotesParagraph1: 'Brawl Stars metası her harita/mod rotasyonunda değişir. Bazı brawlerlar tutarlıdır (WR\'leri hafta hafta bir puandan az dalgalanır), diğerlerinin kit\'lerini ödüllendiren bir harita rotasyona girdiğinde döngüsel zirveleri olur. Her brawler\'ın bireysel sayfası örneklem yeterli olduğunda 7 günlük trendi tam yüzde olarak gösterir; yetersizse düşük güvenli bir sayı yerine placeholder gösterir.',
    metaNotesParagraph2: 'Hızlı değişen şeyleri (rotasyon, last-pick avantajı, takım sinerjisi) statikmiş gibi ele aldıkları için toplu tier listeleri yayınlamıyoruz. Onun yerine ilgilendiğin brawler\'ın sayfasını açmaya davet ediyoruz: orada aynı PRO verileriyle aynı Bayesian metodolojisiyle hesaplanmış WR\'yi, en iyi haritayı, ana counter\'ları ve trendi görürsün.',
    methodologyLink: 'Her istatistiği nasıl hesaplıyoruz',
    countLabel: 'brawler',
    rarityCountFormat: '{count} (%{percent})',
  },

  pl: {
    metaTitle: 'Pełny roster Brawl Stars 2026 — wszyscy brawlerzy, rzadkość i meta',
    metaDescription: 'Pełna lista {count} brawlerów Brawl Stars z rzadkością, klasą i pozycją w aktualnej mecie competitive. Skorelowane z oficjalnym API Supercella i naszym samplingiem PRO.',
    breadcrumbLabel: 'Brawlerzy',
    eyebrow: 'Roster competitive',
    heroTitle: 'Pełny roster Brawl Stars 2026',
    heroLead: 'Ta strona wymienia {count} brawlerów aktualnej rotacji Brawl Stars wraz z rzadkością odblokowania i bezpośrednim linkiem do ich indywidualnej analizy mety. Roster synchronizuje się codziennie z oficjalnym API Supercella, więc każdy nowy brawler pojawia się w dniu premiery; rzadkość pochodzi z Brawlify, a póki ten CDN nadrabia (zwykle jeden do trzech dni), nasza lokalna mapa rzadkości zapełnia lukę wizualną.',
    heroLeadSecond: 'Każdy brawler ma własną stronę z globalnym win rate z ostatnich 14 dni, najlepszą mapą, najprawdopodobniejszymi counterami i 7-dniową tendencją WR. Wszystkie procenty pochodzą z prawdziwych walk top graczy PRO z jedenastu krajów, wygładzonych bayesowsko, by brawler z małą próbą nie pokazywał mylącego procentu. Pełne szczegóły obliczeń na stronie metodologii.',
    distributionTitle: 'Rozkład rzadkości',
    distributionLead: 'Rzadkość określa, jak każdy brawler odblokowuje się w grze (nagrody Trophy Road, dawne Brawl Boxy lub specjalne packi nowego systemu). W mecie competitive rzadkość nie jest bezpośrednim proxy mocy: wielu Trophy Road utrzymuje win rate powyżej 52% czternaście dni po rotacji, a kilku Legendary stabilnie krąży wokół 50%. Ta tabela pokazuje, ilu brawlerów wpada do każdej kategorii w aktualnym rosterze.',
    distributionFootnote: 'Procenty zaokrąglane do najbliższej liczby całkowitej, sumują się do 100 z marginesem ±1 punkt.',
    metaNotesTitle: 'Notatki o mecie',
    metaNotesParagraph1: 'Meta Brawl Stars zmienia się z każdą rotacją map/trybów. Niektórzy brawlerzy są stabilni (ich WR waha się o mniej niż punkt tydzień do tygodnia), inni mają cykliczne szczyty, gdy wchodzi mapa nagradzająca ich kit. Indywidualna strona każdego brawlera pokazuje tendencję 7-dniową w dokładnym procencie gdy próba jest wystarczająca; gdy nie jest, pokazujemy placeholder zamiast liczby o niskim zaufaniu.',
    metaNotesParagraph2: 'Nie publikujemy zagregowanych tier listów, bo traktują rzeczy zmieniające się szybko (rotacja, przewaga last-pick, synergia drużyny) jakby były statyczne. Zamiast tego zapraszamy do otwarcia strony brawlera, który Cię interesuje: tam zobaczysz WR, najlepszą mapę, główne countery i tendencję, wszystko liczone z tych samych danych PRO z tą samą metodologią bayesowską.',
    methodologyLink: 'Jak liczymy każdą statystykę',
    countLabel: 'brawlerów',
    rarityCountFormat: '{count} ({percent}%)',
  },

  ar: {
    metaTitle: 'قائمة Brawl Stars 2026 الكاملة — كل الأبطال والندرة والميتا',
    metaDescription: 'قائمة كاملة بـ {count} أبطال Brawl Stars مع الندرة والفئة والموقع في الميتا التنافسي الحالي. مقاطعة مع واجهة Supercell الرسمية وعيّنات PRO الخاصة بنا.',
    breadcrumbLabel: 'الأبطال',
    eyebrow: 'القائمة التنافسية',
    heroTitle: 'قائمة Brawl Stars 2026 الكاملة',
    heroLead: 'تسرد هذه الصفحة الـ {count} بطلاً في دوران Brawl Stars الحالي، مع الندرة التي يُفتح بها كلٌّ ورابطاً مباشراً لتحليله الفردي في الميتا. تتزامن القائمة يوماً بيوم مع واجهة Supercell الرسمية، فيظهر أي بطل جديد يوم الإطلاق؛ تأتي الندرة من Brawlify، وبينما يلحق ذلك CDN (عادةً من يوم إلى ثلاثة) تسد خريطة الندرة المحلية الفجوة البصرية.',
    heroLeadSecond: 'لكل بطل صفحة خاصة بمعدل فوز عالمي خلال آخر 14 يوماً، أفضل خريطة، أرجح الكاونترز واتجاه 7 أيام لـ WR. تأتي كل النسب من معارك حقيقية لأفضل لاعبي PRO من إحدى عشرة دولة، مع تنعيم بايزي لئلا يعرض بطل بعينة صغيرة نسبة مضللة. التفاصيل الكاملة للحساب في صفحة المنهجية.',
    distributionTitle: 'توزيع الندرة',
    distributionLead: 'تحدد الندرة كيف يُفتح كل بطل داخل اللعبة (مكافآت Trophy Road، صناديق Brawl السابقة أو حزم محددة من النظام الجديد). في الميتا التنافسي، ليست الندرة وكيلاً مباشراً للقوة: يحافظ كثير من Trophy Road على نسب فوز فوق 52% بعد أربعة عشر يوماً من الدوران، ويبقى عدد من Legendary مستقراً حول 50%. يظهر هذا الجدول كم بطلاً يقع في كل فئة بالقائمة الحالية.',
    distributionFootnote: 'تُقرَّب النسب لأقرب عدد صحيح وتجمع إلى 100 ضمن هامش ±1 نقطة.',
    metaNotesTitle: 'ملاحظات على الميتا',
    metaNotesParagraph1: 'يتحرك ميتا Brawl Stars مع كل دوران للخرائط/الأوضاع. بعض الأبطال ثابتون (يتذبذب WR لديهم بأقل من نقطة أسبوعياً)، وآخرون يمرون بقمم دورية حين تدخل خريطة تكافئ عُدّتهم. تظهر صفحة كل بطل اتجاه 7 أيام بنسبة دقيقة عندما تكون العينة كافية؛ وإلا نعرض placeholder بدلاً من رقم منخفض الثقة.',
    metaNotesParagraph2: 'لا ننشر tier lists مجمَّعة لأنها تعامل أموراً سريعة الحركة (الدوران، أفضلية last-pick، تآزر الفريق) كما لو كانت ساكنة. بدلاً من ذلك ندعوك لفتح صفحة البطل الذي يهمك: ترى هناك WR، أفضل خريطة، الكاونترز الرئيسية والاتجاه — كله محسوب من نفس بيانات PRO بنفس المنهجية البايزية.',
    methodologyLink: 'كيف نحسب كل إحصائية',
    countLabel: 'أبطال',
    rarityCountFormat: '{count} ({percent}%)',
  },

  ko: {
    metaTitle: '브롤스타즈 2026 전체 로스터 — 모든 브롤러, 등급, 메타',
    metaDescription: '브롤스타즈의 모든 {count}명 브롤러 목록과 등급, 클래스, 현재 경쟁 메타 위치. 슈퍼셀 공식 API 및 자체 PRO 샘플링과 교차 참조.',
    breadcrumbLabel: '브롤러',
    eyebrow: '경쟁 로스터',
    heroTitle: '브롤스타즈 2026 전체 로스터',
    heroLead: '이 페이지는 브롤스타즈 현재 로테이션의 {count}명 브롤러를 잠금 해제 등급 및 개별 메타 분석으로 가는 직접 링크와 함께 나열합니다. 로스터는 매일 슈퍼셀 공식 API와 동기화되므로 새 브롤러가 출시 당일 표시됩니다; 등급은 Brawlify에서 가져오며, 해당 CDN이 따라잡을 동안(보통 1-3일) 우리 로컬 등급 매핑이 시각적 공백을 메웁니다.',
    heroLeadSecond: '각 브롤러는 최근 14일 글로벌 승률, 최고 맵, 가장 가능성 있는 카운터, 7일 승률 트렌드가 있는 자체 페이지를 가집니다. 모든 백분율은 표본이 작은 브롤러가 오해의 소지가 있는 백분율을 보이지 않도록 베이지안 스무딩을 적용한 11개국의 실제 톱 PRO 전투에서 나옵니다. 전체 계산 세부 사항은 방법론 페이지에 있습니다.',
    distributionTitle: '등급 분포',
    distributionLead: '등급은 각 브롤러가 게임 내에서 어떻게 잠금 해제되는지를 결정합니다(트로피 로드 보상, 과거 브롤 박스 또는 새 시스템의 특정 팩). 경쟁 메타에서 등급은 힘의 직접적인 프록시가 아닙니다: 많은 트로피 로드가 로테이션 후 14일 동안 52% 이상의 승률을 유지하고, 여러 레전더리는 약 50% 안팎에서 안정적입니다. 이 표는 현재 로스터에서 각 카테고리에 몇 명의 브롤러가 속하는지 보여줍니다.',
    distributionFootnote: '백분율은 가장 가까운 정수로 반올림되며 ±1 포인트 범위 내에서 합계 100이 됩니다.',
    metaNotesTitle: '메타 노트',
    metaNotesParagraph1: '브롤스타즈 메타는 각 맵/모드 로테이션과 함께 변합니다. 일부 브롤러는 일관됩니다(WR이 주마다 1 포인트 미만으로 변동), 다른 브롤러는 키트를 보상하는 맵이 로테이션에 들어올 때 주기적인 정점을 가집니다. 각 브롤러의 개별 페이지는 표본이 충분할 때 7일 트렌드를 정확한 백분율로 표시합니다; 그렇지 않을 때 신뢰도가 낮은 숫자 대신 플레이스홀더를 표시합니다.',
    metaNotesParagraph2: '우리는 빠르게 움직이는 것들(로테이션, 라스트픽 이점, 팀 시너지)을 정적인 것처럼 다루기 때문에 집계된 티어 리스트를 게시하지 않습니다. 대신, 관심 있는 브롤러의 페이지를 열어보길 권합니다: 거기서 동일한 PRO 데이터를 동일한 베이지안 방법론으로 계산한 WR, 최고 맵, 주요 카운터, 트렌드를 볼 수 있습니다.',
    methodologyLink: '각 통계를 어떻게 계산하는지',
    countLabel: '브롤러',
    rarityCountFormat: '{count}명 ({percent}%)',
  },

  ja: {
    metaTitle: 'ブロスタ2026 完全ロスター — 全ブロウラー、レア度、メタ',
    metaDescription: 'ブロスタの全 {count} ブロウラーのリストとレア度、クラス、現在の競技メタの位置。Supercell公式APIと自前のPROサンプリングと相互参照。',
    breadcrumbLabel: 'ブロウラー',
    eyebrow: '競技ロスター',
    heroTitle: 'ブロスタ2026完全ロスター',
    heroLead: 'このページはブロスタの現在のローテーションにある {count} ブロウラーをそれぞれの解放レア度と個別メタ分析への直接リンクとともにリストします。ロスターは毎日 Supercell の公式 API と同期するので、新ブロウラーは発売日に表示されます。レア度は Brawlify から来ており、その CDN が追いつく間（通常1〜3日）、自前のローカルレア度マップが視覚的な隙間を埋めます。',
    heroLeadSecond: '各ブロウラーには直近14日間のグローバル勝率、ベストマップ、最も可能性の高いカウンター、7日間の勝率トレンドがある独自のページがあります。すべてのパーセンテージは、サンプルの小さなブロウラーが誤解を招くパーセンテージを表示しないようにベイジアン平滑化された11カ国の実際のトップPROバトルから来ています。完全な計算詳細は方法論ページにあります。',
    distributionTitle: 'レア度分布',
    distributionLead: 'レア度は各ブロウラーがゲーム内でどう解放されるかを決定します（トロフィーロードの報酬、過去のブロウルボックス、または新システムの特定パック）。競技メタではレア度は強さの直接的な代理ではありません: 多くのトロフィーロードはローテーション後14日経っても勝率52%超を維持し、複数のレジェンダリーは約50%で安定しています。この表は現在のロスターで各カテゴリーにブロウラーが何人いるかを示します。',
    distributionFootnote: 'パーセンテージは最も近い整数に丸められ、±1ポイントの範囲内で合計100になります。',
    metaNotesTitle: 'メタノート',
    metaNotesParagraph1: 'ブロスタのメタはマップ/モードのローテーションごとにシフトします。一部のブロウラーは一貫しています（勝率は週毎に1ポイント未満で変動）、他のブロウラーはキットを報いるマップがローテーションに入るときに周期的なピークを持ちます。各ブロウラーの個別ページは、サンプルが十分なときに7日トレンドを正確なパーセンテージで表示します。そうでないとき、低信頼の数字ではなくプレースホルダーを表示します。',
    metaNotesParagraph2: '速く動くもの（ローテーション、ラストピックの優位性、チームシナジー）を静的かのように扱うため、集計されたティアリストは公開しません。代わりに、気になるブロウラーのページを開くことをお勧めします: そこで同じPROデータを同じベイジアン方法論で計算した勝率、ベストマップ、主要カウンター、トレンドを見ることができます。',
    methodologyLink: '各スタッツをどう計算しているか',
    countLabel: 'ブロウラー',
    rarityCountFormat: '{count}体 ({percent}%)',
  },

  zh: {
    metaTitle: '荒野乱斗 2026 完整阵容 — 所有英雄、稀有度和元',
    metaDescription: '荒野乱斗全部 {count} 个英雄的完整列表，包括稀有度、类型和当前竞争元位置。与 Supercell 官方 API 和我们自己的 PRO 采样交叉参考。',
    breadcrumbLabel: '英雄',
    eyebrow: '竞争阵容',
    heroTitle: '荒野乱斗 2026 完整阵容',
    heroLead: '本页列出荒野乱斗当前轮换中的 {count} 个英雄，包括每个英雄解锁的稀有度和指向其个人元分析的直接链接。阵容每天与 Supercell 官方 API 同步，因此任何新英雄都会在发布日显示；稀有度来自 Brawlify，在该 CDN 追赶时（通常一到三天），我们的本地稀有度映射填补视觉空白。',
    heroLeadSecond: '每个英雄都有自己的页面，包含过去 14 天的全球胜率、最佳地图、最可能的克制和 7 天胜率趋势。所有百分比都来自十一个国家的真实顶级 PRO 战斗，应用贝叶斯平滑以防样本小的英雄显示误导性百分比。完整计算细节在方法论页面。',
    distributionTitle: '稀有度分布',
    distributionLead: '稀有度决定每个英雄在游戏内如何解锁（奖杯之路奖励、过去的英雄宝箱或新系统的特定包）。在竞争元中，稀有度不是力量的直接代理：许多奖杯之路在轮换后十四天保持 52% 以上的胜率，几个传奇稳定在约 50%。该表显示当前阵容中每类别有多少英雄。',
    distributionFootnote: '百分比四舍五入到最近的整数，并在 ±1 点的范围内总和为 100。',
    metaNotesTitle: '元注释',
    metaNotesParagraph1: '荒野乱斗的元随每次地图/模式轮换而变化。一些英雄是一致的（其胜率每周变动小于一个百分点），其他英雄在奖励其套件的地图进入轮换时具有周期性高峰。每个英雄的个人页面在样本足够时以精确百分比显示 7 天趋势；不足时，显示占位符而非低置信度数字。',
    metaNotesParagraph2: '我们不发布聚合的 tier list，因为它们将快速移动的事物（轮换、末选优势、团队协同）视为静态。相反，我们邀请你打开你关心的英雄页面：在那里你可以看到从相同 PRO 数据用相同贝叶斯方法计算的胜率、最佳地图、主要克制和趋势。',
    methodologyLink: '我们如何计算每项统计',
    countLabel: '英雄',
    rarityCountFormat: '{count}个 ({percent}%)',
  },
}

let totalAdditions = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const ns = TRANSLATIONS[locale]
  if (!ns) {
    console.warn(`  ${locale.padEnd(3)}  SKIP — no translation defined`)
    continue
  }
  data.brawlerRoster = ns
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  totalAdditions += Object.keys(ns).length
  console.log(`  ${locale.padEnd(3)}  brawlerRoster (${Object.keys(ns).length} keys)`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
