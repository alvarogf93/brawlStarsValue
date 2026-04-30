#!/usr/bin/env node
// /[locale]/leaderboard — adds editorial context (~300 words).
// Targets AdSense AD-05 ("navigation page"). Idempotent.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    editorialEyebrow: 'Cómo se forma este ranking',
    editorialIntro: 'El ranking de trofeos globales que ves abajo lo publica la API oficial de Supercell, no es nuestro: lista a los 200 mejores jugadores de Brawl Stars por país y por temporada según el conteo total de trofeos. BrawlVision lo lee y lo muestra junto con su nombre, club, y enlaces a la ficha de cada jugador.',
    editorialMethodology: 'Trofeos en Brawl Stars no son ELO ni MMR. Son una métrica de actividad ponderada: ganar partidas y participar en eventos suma trofeos, y la cifra acumulada nunca decrece de un día para otro (decae sólo entre temporadas, según cuán arriba estés). Eso significa que un jugador con 75 000 trofeos no es necesariamente "el doble de bueno" que uno con 38 000; está jugando mucho más, posiblemente con más brawlers, durante más temporadas. La cifra premia consistencia y volumen, no skill bruta.',
    editorialNote: 'Para una visión más cercana al skill, abre el perfil de cualquier jugador del top — la página individual incluye win rate de los últimos 14 días, brawlers más jugados con su comfort score, y el historial de batallas si han activado tracking. La comparación 1-a-1 contra ti mismo (botón "Compare") es lo más cercano a un ranking competitivo real.',
    editorialClosing: 'El selector de país arriba filtra el ranking por la región declarada en la cuenta de cada jugador (no por servidor de juego, que es global). Si ves un nombre que no reconoces en el top global, casi siempre viene de uno de los rankings nacionales que muestreamos para el cron de PRO data — cómo se construye ese muestreo está en la página de metodología.',
  },

  en: {
    editorialEyebrow: 'How this ranking is built',
    editorialIntro: 'The global trophy ranking you see below is published by Supercell\'s official API, not by us: it lists the top 200 Brawl Stars players per country per season by total trophy count. BrawlVision reads it and displays it alongside name, club, and links to each player\'s profile.',
    editorialMethodology: 'Trophies in Brawl Stars are not ELO or MMR. They\'re a weighted activity metric: winning matches and participating in events adds trophies, and the cumulative total never decreases day to day (it only decays between seasons, by how high you sit). That means a player at 75,000 trophies is not necessarily "twice as good" as one at 38,000; they\'re playing more, possibly with more brawlers, across more seasons. The number rewards consistency and volume, not raw skill.',
    editorialNote: 'For a view closer to skill, open the profile of any top player — the individual page includes win rate over the last 14 days, most-played brawlers with their comfort score, and battle history if they\'ve enabled tracking. The 1-on-1 comparison against yourself (the "Compare" button) is the closest thing to a real competitive ranking.',
    editorialClosing: 'The country selector above filters the ranking by the region declared in each player\'s account (not by game server, which is global). If you see an unfamiliar name in the global top, it almost always comes from one of the national rankings we sample for the PRO-data cron — how that sampling is built lives on the methodology page.',
  },

  fr: {
    editorialEyebrow: 'Comment ce classement est construit',
    editorialIntro: 'Le classement global des trophées que tu vois en dessous est publié par l\'API officielle de Supercell, pas par nous : il liste les 200 meilleurs joueurs de Brawl Stars par pays et par saison selon le total de trophées. BrawlVision le lit et l\'affiche avec leur nom, club, et des liens vers la fiche de chaque joueur.',
    editorialMethodology: 'Les trophées dans Brawl Stars ne sont pas de l\'ELO ni du MMR. C\'est une métrique d\'activité pondérée : gagner des matchs et participer à des événements ajoute des trophées, et le total cumulé ne diminue jamais d\'un jour à l\'autre (il décroît seulement entre saisons, selon ta position). Donc un joueur à 75 000 trophées n\'est pas forcément « deux fois meilleur » qu\'un à 38 000 ; il joue beaucoup plus, sans doute avec plus de brawlers, sur plus de saisons. Le nombre récompense consistance et volume, pas le skill brut.',
    editorialNote: 'Pour une vue plus proche du skill, ouvre la fiche de n\'importe quel joueur du top — la page individuelle inclut le taux de victoire sur 14 jours, les brawlers les plus joués avec leur comfort score, et l\'historique de combats s\'ils ont activé le tracking. La comparaison 1-contre-1 contre toi-même (bouton « Compare ») est ce qui se rapproche le plus d\'un vrai classement compétitif.',
    editorialClosing: 'Le sélecteur de pays au-dessus filtre le classement par la région déclarée dans le compte de chaque joueur (pas par serveur de jeu, qui est global). Si tu vois un nom inconnu dans le top global, il vient presque toujours d\'un des classements nationaux que nous échantillonnons pour le cron de PRO data — comment cet échantillonnage est construit vit sur la page méthodologie.',
  },

  pt: {
    editorialEyebrow: 'Como esse ranking se forma',
    editorialIntro: 'O ranking global de troféus que você vê abaixo é publicado pela API oficial da Supercell, não por nós: lista os 200 melhores jogadores do Brawl Stars por país e por temporada pelo total de troféus. O BrawlVision lê e mostra junto com o nome, clube e links pro perfil de cada jogador.',
    editorialMethodology: 'Troféus no Brawl Stars não são ELO nem MMR. São uma métrica de atividade ponderada: ganhar partidas e participar de eventos soma troféus, e o total acumulado nunca diminui de um dia pro outro (decai só entre temporadas, conforme sua posição). Um jogador com 75.000 troféus não é necessariamente "duas vezes melhor" que um de 38.000; ele tá jogando muito mais, possivelmente com mais brawlers, em mais temporadas. O número premia consistência e volume, não skill bruta.',
    editorialNote: 'Pra uma visão mais próxima de skill, abre o perfil de qualquer jogador do top — a página individual inclui win rate dos últimos 14 dias, brawlers mais jogados com comfort score, e histórico de batalhas se ativaram tracking. A comparação 1 contra 1 contra você mesmo (botão "Compare") é o que mais se parece com um ranking competitivo real.',
    editorialClosing: 'O seletor de país no topo filtra o ranking pela região declarada na conta de cada jogador (não por servidor de jogo, que é global). Se você vê um nome desconhecido no top global, quase sempre vem de um dos rankings nacionais que amostramos pro cron de PRO data — como essa amostragem é construída tá na página de metodologia.',
  },

  de: {
    editorialEyebrow: 'Wie dieses Ranking aufgebaut wird',
    editorialIntro: 'Das globale Trophäen-Ranking unten wird von Supercells offizieller API veröffentlicht, nicht von uns: es listet die Top 200 Brawl-Stars-Spieler pro Land und Saison nach Gesamt-Trophäenzahl. BrawlVision liest es und zeigt es zusammen mit Name, Club und Links zum Profil jedes Spielers.',
    editorialMethodology: 'Trophäen in Brawl Stars sind weder ELO noch MMR. Sie sind eine gewichtete Aktivitätsmetrik: Matches gewinnen und an Events teilnehmen addiert Trophäen, und die kumulierte Gesamtsumme sinkt nie von Tag zu Tag (sie verfällt nur zwischen Saisons, je nach Position). Das heißt, ein Spieler mit 75.000 Trophäen ist nicht zwingend „doppelt so gut" wie einer mit 38.000; er spielt deutlich mehr, möglicherweise mit mehr Brawlern, über mehr Saisons. Die Zahl belohnt Konstanz und Volumen, nicht reines Skill.',
    editorialNote: 'Für eine Ansicht näher an Skill öffne das Profil eines beliebigen Top-Spielers — die Einzelseite enthält Siegrate der letzten 14 Tage, am meisten gespielte Brawler mit Comfort Score und Kampfverlauf, falls Tracking aktiv ist. Der 1-zu-1-Vergleich gegen dich selbst (Button „Compare") kommt einem echten kompetitiven Ranking am nächsten.',
    editorialClosing: 'Der Länder-Selector oben filtert das Ranking nach der im Spieler-Account deklarierten Region (nicht nach Game-Server, der global ist). Wenn du im globalen Top einen unbekannten Namen siehst, kommt er fast immer aus einer der nationalen Ranglisten, die wir für den PRO-Data-Cron sampeln — wie dieses Sampling aufgebaut ist, lebt auf der Methodik-Seite.',
  },

  it: {
    editorialEyebrow: 'Come si forma questo ranking',
    editorialIntro: 'Il ranking globale di trofei che vedi sotto è pubblicato dall\'API ufficiale di Supercell, non da noi: elenca i 200 migliori giocatori di Brawl Stars per paese e per stagione in base al totale di trofei. BrawlVision lo legge e lo mostra con nome, clan e link al profilo di ogni giocatore.',
    editorialMethodology: 'I trofei in Brawl Stars non sono ELO o MMR. Sono una metrica di attività pesata: vincere partite e partecipare a eventi aggiunge trofei, e il totale cumulato non diminuisce mai da un giorno all\'altro (decade solo tra stagioni, in base alla posizione). Un giocatore a 75.000 trofei non è necessariamente "il doppio bravo" di uno a 38.000; sta giocando molto di più, magari con più brawler, su più stagioni. Il numero premia coerenza e volume, non skill puro.',
    editorialNote: 'Per una vista più vicina al skill, apri il profilo di un giocatore qualsiasi del top — la pagina individuale include win rate degli ultimi 14 giorni, brawler più giocati con comfort score, e cronologia battaglie se hanno attivato il tracking. Il confronto 1 contro 1 contro te stesso (pulsante "Compare") è la cosa più vicina a un ranking competitivo reale.',
    editorialClosing: 'Il selettore di paese in alto filtra il ranking per la regione dichiarata nell\'account di ogni giocatore (non per server di gioco, che è globale). Se vedi un nome sconosciuto nel top globale, quasi sempre viene da uno dei ranking nazionali che campioniamo per il cron di PRO data — come si costruisce quel campionamento è nella pagina metodologia.',
  },

  ru: {
    editorialEyebrow: 'Как формируется этот рейтинг',
    editorialIntro: 'Глобальный рейтинг трофеев ниже публикуется официальным API Supercell, не нами: он перечисляет 200 лучших игроков Brawl Stars по стране и сезону по общему числу трофеев. BrawlVision читает его и показывает вместе с именем, клубом и ссылками на профиль каждого игрока.',
    editorialMethodology: 'Трофеи в Brawl Stars — это не ELO и не MMR. Это взвешенная метрика активности: победы в матчах и участие в событиях добавляют трофеи, и накопленная сумма никогда не уменьшается со дня на день (распадается только между сезонами по тому, как высоко вы стоите). Это значит, что игрок с 75 000 трофеев не обязательно «вдвое лучше» игрока с 38 000; он играет гораздо больше, возможно, с большим количеством бойцов, за большее количество сезонов. Число вознаграждает постоянство и объём, а не чистый скилл.',
    editorialNote: 'Для более близкого к скиллу взгляда откройте профиль любого игрока из топа — индивидуальная страница включает винрейт за последние 14 дней, наиболее играемых бойцов с их comfort score, и историю боёв, если они включили трекинг. Сравнение 1-на-1 с собой (кнопка «Compare») — самое близкое к настоящему соревновательному рейтингу.',
    editorialClosing: 'Селектор страны вверху фильтрует рейтинг по региону, заявленному в аккаунте каждого игрока (не по игровому серверу, который глобальный). Если вы видите незнакомое имя в глобальном топе, оно почти всегда приходит из одного из национальных рейтингов, которые мы семплируем для PRO-data крона — как строится этот семплинг, описано на странице методологии.',
  },

  tr: {
    editorialEyebrow: 'Bu sıralama nasıl oluşur',
    editorialIntro: 'Aşağıda gördüğün küresel kupa sıralaması Supercell\'in resmi API\'si tarafından yayımlanır, biz değil: ülke ve sezon başına toplam kupa sayısına göre Brawl Stars\'ın en iyi 200 oyuncusunu listeler. BrawlVision bunu okur ve her oyuncunun adı, kulübü ve profiline link ile birlikte gösterir.',
    editorialMethodology: 'Brawl Stars\'taki kupalar ELO veya MMR değildir. Ağırlıklı bir aktivite metriğidir: maç kazanmak ve etkinliklere katılmak kupa ekler ve birikmiş toplam günden güne asla azalmaz (yalnızca sezonlar arasında, ne kadar yukarıda olduğuna göre düşer). Bu, 75.000 kupa olan bir oyuncunun 38.000 olan bir oyuncudan zorunlu olarak "iki kat iyi" olmadığı anlamına gelir; çok daha fazla oynuyor, muhtemelen daha fazla brawler ile, daha fazla sezonda. Sayı tutarlılığı ve hacmi ödüllendirir, ham yeteneği değil.',
    editorialNote: 'Yeteneğe daha yakın bir görüş için, en üstteki herhangi bir oyuncunun profilini aç — bireysel sayfa son 14 günün galibiyet oranını, en çok oynanan brawler\'ları comfort skoru ile ve takip aktifse savaş geçmişini içerir. Kendine karşı 1-e-1 karşılaştırma ("Compare" düğmesi) gerçek bir rekabetçi sıralamaya en yakın şeydir.',
    editorialClosing: 'Üstteki ülke seçici sıralamayı her oyuncunun hesabında bildirilen bölgeye göre filtreler (oyun sunucusuna göre değil, o globaldir). Küresel topta tanımadığın bir isim görürsen, neredeyse her zaman PRO veri cron\'u için örneklediğimiz ulusal sıralamalardan birinden gelir — bu örneklemenin nasıl oluşturulduğu metodoloji sayfasında.',
  },

  pl: {
    editorialEyebrow: 'Jak powstaje ten ranking',
    editorialIntro: 'Globalny ranking trofeów poniżej jest publikowany przez oficjalne API Supercella, nie przez nas: wymienia 200 najlepszych graczy Brawl Stars na kraj i sezon według łącznej liczby trofeów. BrawlVision czyta go i pokazuje razem z imieniem, klubem i linkami do profilu każdego gracza.',
    editorialMethodology: 'Trofea w Brawl Stars nie są ELO ani MMR. To ważona metryka aktywności: wygrywanie meczów i udział w wydarzeniach dodaje trofea, a skumulowana suma nigdy nie maleje z dnia na dzień (spada tylko między sezonami, w zależności od pozycji). Oznacza to, że gracz z 75 000 trofeów niekoniecznie jest "dwa razy lepszy" niż ten z 38 000; gra znacznie więcej, prawdopodobnie z większą liczbą brawlerów, w więcej sezonów. Liczba nagradza konsystencję i wolumen, nie surowy skill.',
    editorialNote: 'Dla widoku bliższego skill, otwórz profil dowolnego gracza z topu — strona indywidualna zawiera win rate z ostatnich 14 dni, najczęściej grane brawlery z ich comfort score i historię walk jeśli włączyli tracking. Porównanie 1 na 1 z samym sobą (przycisk "Compare") to najbliższe rzeczywistego rankingu competitive.',
    editorialClosing: 'Selektor kraju powyżej filtruje ranking po regionie zadeklarowanym na koncie każdego gracza (nie po serwerze gry, który jest globalny). Jeśli widzisz nieznane imię w globalnym topie, prawie zawsze pochodzi z jednego z krajowych rankingów, które samplujemy do crona PRO data — jak ten sampling powstaje, znajdziesz na stronie metodologii.',
  },

  ar: {
    editorialEyebrow: 'كيف يُبنى هذا التصنيف',
    editorialIntro: 'تصنيف الكؤوس العالمي الذي تراه أدناه تنشره واجهة Supercell الرسمية لا نحن: يسرد أفضل 200 لاعب في Brawl Stars لكل دولة وكل موسم بحسب إجمالي الكؤوس. يقرأه BrawlVision ويعرضه إلى جانب الاسم والنادي وروابط إلى ملف كل لاعب.',
    editorialMethodology: 'الكؤوس في Brawl Stars ليست ELO أو MMR. إنها مقياس نشاط مرجَّح: الفوز في المباريات والمشاركة في الأحداث يضيفان كؤوساً، ولا ينخفض الإجمالي التراكمي يوماً بيوم (يتراجع فقط بين المواسم بحسب موقعك). يعني هذا أن لاعباً عند 75,000 كأس ليس بالضرورة "ضعف" لاعب عند 38,000؛ بل يلعب أكثر بكثير، ربما بأبطال أكثر، عبر مواسم أكثر. يكافئ الرقم الاتساق والحجم لا المهارة الخام.',
    editorialNote: 'لرؤية أقرب إلى المهارة، افتح ملف أي لاعب من القمة — تتضمن الصفحة الفردية معدل الفوز خلال آخر 14 يوماً، الأبطال الأكثر لعباً مع درجة الراحة (Comfort Score)، وسجل المعارك إن فعَّلوا التتبع. المقارنة واحد مقابل واحد ضد نفسك (زر "Compare") هي الأقرب لتصنيف تنافسي فعلي.',
    editorialClosing: 'يصفّي محدد الدولة في الأعلى التصنيف بحسب المنطقة المعلنة في حساب كل لاعب (لا بحسب خادم اللعبة الذي عالمي). إن رأيت اسماً غير مألوف في القمة العالمية فهو غالباً يأتي من أحد التصنيفات الوطنية التي نأخذ عينات منها لـ cron بيانات PRO — كيفية بناء تلك العيّنات في صفحة المنهجية.',
  },

  ko: {
    editorialEyebrow: '이 랭킹은 어떻게 만들어지는가',
    editorialIntro: '아래에 보이는 글로벌 트로피 랭킹은 Supercell의 공식 API에서 게시한 것이지 우리가 만든 것이 아닙니다: 시즌 및 국가별 총 트로피 수에 따라 브롤스타즈 상위 200명의 플레이어를 나열합니다. BrawlVision은 이를 읽어 이름, 클럽, 각 플레이어의 프로필 링크와 함께 표시합니다.',
    editorialMethodology: '브롤스타즈의 트로피는 ELO나 MMR이 아닙니다. 가중 활동 지표입니다: 경기 승리와 이벤트 참여로 트로피가 추가되며, 누적 총합은 날마다 감소하지 않습니다(시즌 사이에만, 자신의 위치에 따라 감소). 이는 75,000 트로피의 플레이어가 반드시 38,000의 플레이어보다 "두 배 좋다"는 의미는 아닙니다; 훨씬 많이 플레이하고, 더 많은 브롤러로, 더 많은 시즌에 걸쳐서일 수 있습니다. 이 숫자는 일관성과 양을 보상하지, 순수한 실력을 보상하지 않습니다.',
    editorialNote: '실력에 더 가까운 시각을 위해 상위 플레이어의 프로필을 열어보세요 — 개별 페이지에는 최근 14일 승률, 컴포트 스코어가 있는 가장 많이 플레이된 브롤러, 트래킹을 활성화한 경우 전투 기록이 포함되어 있습니다. 자신과의 1 대 1 비교("Compare" 버튼)가 실제 경쟁 랭킹에 가장 가까운 것입니다.',
    editorialClosing: '상단의 국가 선택기는 각 플레이어 계정에 선언된 지역(글로벌인 게임 서버가 아님)으로 랭킹을 필터링합니다. 글로벌 상위에서 익숙하지 않은 이름이 보이면 거의 항상 PRO 데이터 cron을 위해 샘플링하는 국가별 랭킹 중 하나에서 옵니다 — 그 샘플링이 어떻게 구축되는지는 방법론 페이지에 있습니다.',
  },

  ja: {
    editorialEyebrow: 'このランキングはどう作られるか',
    editorialIntro: '下に見えるグローバルトロフィーランキングはSupercellの公式APIによって公開されており、私たちのものではありません: 国とシーズンごとの総トロフィー数によりブロスタの上位200プレイヤーをリストします。BrawlVisionはこれを読み、各プレイヤーの名前、クラブ、プロフィールへのリンクとともに表示します。',
    editorialMethodology: 'ブロスタのトロフィーはELOやMMRではありません。重み付けされたアクティビティ指標です: 試合に勝つこととイベントに参加することがトロフィーを加算し、累積合計は日ごとに決して減少しません（シーズン間でのみ、自分の位置に応じて減衰）。つまり、75,000トロフィーのプレイヤーは必ずしも38,000のプレイヤーより「2倍上手い」とは限りません; はるかに多くプレイし、おそらくより多くのブロウラーで、より多くのシーズンにわたって。この数字は一貫性と量を報いるものであり、純粋なスキルではありません。',
    editorialNote: 'スキルに近い視点には、トッププレイヤーのプロフィールを開いてください — 個別ページには直近14日の勝率、コンフォートスコア付きの最もプレイされたブロウラー、トラッキングを有効にしている場合はバトル履歴が含まれます。自分自身との1対1の比較（「Compare」ボタン）が実際の競技ランキングに最も近いものです。',
    editorialClosing: '上の国セレクターは、各プレイヤーのアカウントで宣言された地域（グローバルなゲームサーバーではない）でランキングをフィルタリングします。グローバルトップで馴染みのない名前を見たら、ほとんどの場合PROデータcron用にサンプリングする国別ランキングのいずれかから来ています — そのサンプリングがどう構築されるかは方法論ページにあります。',
  },

  zh: {
    editorialEyebrow: '该排名如何构建',
    editorialIntro: '你下面看到的全球奖杯排名由 Supercell 官方 API 发布，不是我们：按总奖杯数列出每个国家每个赛季前 200 名荒野乱斗玩家。BrawlVision 读取它并与每个玩家的姓名、俱乐部和指向其个人资料的链接一起显示。',
    editorialMethodology: '荒野乱斗中的奖杯不是 ELO 或 MMR。它是加权活动指标：赢得比赛和参与活动会增加奖杯，累积总数从未一天一天减少（仅在赛季之间衰减，按你的位置）。这意味着 75,000 奖杯的玩家不一定比 38,000 的玩家"好两倍"; 他们玩得更多，可能用更多英雄，跨越更多赛季。该数字奖励一致性和数量，而不是纯粹的技能。',
    editorialNote: '为了更接近技能的视图，打开任何顶级玩家的个人资料 — 个人页面包括过去 14 天的胜率、最常玩英雄及其 comfort 分数，以及如果他们启用了跟踪的战斗历史。与你自己的 1 对 1 比较（"Compare"按钮）最接近真实的竞争排名。',
    editorialClosing: '上面的国家选择器按每个玩家账户中声明的地区（不是按游戏服务器，那是全球的）过滤排名。如果你在全球榜首看到不熟悉的名字，几乎总是来自我们为 PRO 数据 cron 采样的国家排名之一 — 该采样如何构建在方法论页面上。',
  },
}

let totalAdditions = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.leaderboard) data.leaderboard = {}
  const ns = TRANSLATIONS[locale]
  if (!ns) continue
  Object.assign(data.leaderboard, ns)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  totalAdditions += Object.keys(ns).length
  console.log(`  ${locale.padEnd(3)}  leaderboard editorial keys (${Object.keys(ns).length})`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
