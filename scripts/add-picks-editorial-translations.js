#!/usr/bin/env node
// /[locale]/picks — editorial block above the fold, ≥200 words.
//
// Extends the existing `picks` namespace × 13 locales with the
// new editorial keys: intro + methodology + meta-notes + closing.
// AdSense AD-07 flagged the page as "aggregated data without
// commentary"; this block fixes that by adding original analysis
// of the rotation BEFORE the data grid.
//
// Idempotent.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    editorialEyebrow: 'Recomendaciones de la rotación actual',
    editorialIntro: 'La rotación de mapas y modos de Brawl Stars cambia varias veces al día y, con cada cambio, las recomendaciones de mejor brawler también cambian. Esta página recoge la rotación que está viva ahora mismo (incluyendo los modos draft) y muestra para cada mapa los brawlers con mejor win rate calculado sobre las batallas recientes de top jugadores PRO de once países distintos.',
    editorialMethodology: 'Los porcentajes que ves debajo se calculan con smoothing bayesiano sobre la ventana de 14 días de la tabla meta_stats con filtro source=global, así que un brawler con muestra pequeña no aparece artificialmente alto. Cuando un mapa concreto tiene poca muestra, caemos a un fallback por modo —el badge de cada card indica si los datos vienen del mapa exacto o del fallback— para que nunca veas un slot vacío en una rotación recién entrada.',
    editorialNotesTitle: 'Cómo leer estas recomendaciones',
    editorialNote1: 'Pickea el brawler con el WR más alto del mapa solo si tu equipo cubre las otras dos posiciones; un solo pick fuera de meta puede contrarrestar la ventaja estadística. Si tu equipo ya tiene tank y damage, conviene mirar el segundo o tercero del listado, no el primero.',
    editorialNote2: 'El sample size por mapa-modo importa: una recomendación con 200+ batallas es muy fiable, una con 30-50 todavía no se ha estabilizado. La página usa el mínimo bayesiano para no mostrar nada sin contexto, pero la confianza no es uniforme.',
    editorialNote3: 'La rotación se refresca cada 30 minutos en el caché del servidor; si una rotación acaba de entrar y aún no aparece, recarga en unos minutos. Las rotaciones que terminan en la próxima hora se muestran con countdown para que decidas si vale la pena invertir.',
    editorialClosing: 'Si quieres entender cómo se construye cada porcentaje (sampling PRO, smoothing bayesiano, ventana temporal, filtros source=global), la página de metodología tiene la fórmula completa. Las recomendaciones de aquí abajo son agregados de batallas reales, no opiniones de tier list.',
    methodologyLink: 'Ver metodología completa',
  },

  en: {
    editorialEyebrow: 'Recommendations for the current rotation',
    editorialIntro: 'Brawl Stars\' map and mode rotation changes several times a day, and with every change the best-brawler recommendations change too. This page captures the rotation that is live right now (including draft modes) and shows, for each map, the brawlers with the highest win rate computed over recent top-PRO battles from eleven different countries.',
    editorialMethodology: 'The percentages below are computed with Bayesian smoothing over the 14-day window of the meta_stats table with filter source=global, so a brawler with a small sample does not show up artificially high. When a specific map has thin sample, we fall back to a per-mode aggregate — each card\'s badge indicates whether the data comes from the exact map or from the fallback — so you never see an empty slot on a brand-new rotation.',
    editorialNotesTitle: 'How to read these recommendations',
    editorialNote1: 'Pick the brawler with the highest WR for the map only if your team covers the other two positions; a single off-meta pick can cancel the statistical edge. If your team already has tank and damage, prefer the second or third entry on the list rather than the first.',
    editorialNote2: 'Per map-mode sample size matters: a recommendation with 200+ battles is very reliable, one with 30-50 hasn\'t fully stabilized. The page uses the Bayesian minimum to avoid showing anything without context, but confidence is not uniform.',
    editorialNote3: 'Rotation refreshes every 30 minutes in the server cache; if a rotation just kicked in and isn\'t showing, refresh in a few minutes. Rotations ending in the next hour show a countdown so you can decide whether the investment is worth it.',
    editorialClosing: 'If you want to understand how each percentage is built (PRO sampling, Bayesian smoothing, time window, source=global filtering), the methodology page has the full formula. The recommendations below are aggregates of real battles, not tier-list opinions.',
    methodologyLink: 'View full methodology',
  },

  fr: {
    editorialEyebrow: 'Recommandations de la rotation actuelle',
    editorialIntro: 'La rotation des cartes et modes de Brawl Stars change plusieurs fois par jour et, avec chaque changement, les recommandations de meilleur brawler changent aussi. Cette page capture la rotation en cours (y compris les modes draft) et affiche, pour chaque carte, les brawlers au taux de victoire le plus élevé calculé sur des combats récents de top joueurs PRO de onze pays différents.',
    editorialMethodology: 'Les pourcentages ci-dessous sont calculés avec un lissage bayésien sur la fenêtre de 14 jours de la table meta_stats avec filtre source=global, donc un brawler à petite sample n\'apparaît pas artificiellement haut. Quand une carte précise a peu de sample, on retombe sur un agrégat par mode — le badge de chaque carte indique si les données viennent de la carte exacte ou du fallback — pour que tu ne voies jamais un slot vide sur une rotation toute neuve.',
    editorialNotesTitle: 'Comment lire ces recommandations',
    editorialNote1: 'Pickeer le brawler au WR le plus élevé pour la carte seulement si ton équipe couvre les deux autres positions ; un seul pick hors meta peut annuler l\'avantage statistique. Si ton équipe a déjà tank et damage, prends le deuxième ou troisième de la liste plutôt que le premier.',
    editorialNote2: 'La sample size par carte-mode compte : une reco avec 200+ combats est très fiable, une avec 30-50 ne s\'est pas encore stabilisée. La page utilise le minimum bayésien pour ne rien montrer sans contexte, mais la confiance n\'est pas uniforme.',
    editorialNote3: 'La rotation se rafraîchit toutes les 30 minutes dans le cache serveur ; si une rotation vient d\'entrer et n\'apparaît pas, rafraîchis dans quelques minutes. Les rotations qui se terminent dans l\'heure affichent un countdown pour que tu décides si l\'investissement vaut le coup.',
    editorialClosing: 'Si tu veux comprendre comment chaque pourcentage est construit (sampling PRO, lissage bayésien, fenêtre temporelle, filtre source=global), la page méthodologie a la formule complète. Les recommandations ci-dessous sont des agrégats de combats réels, pas des opinions de tier list.',
    methodologyLink: 'Voir la méthodologie complète',
  },

  pt: {
    editorialEyebrow: 'Recomendações da rotação atual',
    editorialIntro: 'A rotação de mapas e modos do Brawl Stars muda várias vezes por dia e, a cada mudança, as recomendações de melhor brawler mudam também. Esta página captura a rotação que está ao vivo agora (incluindo modos draft) e mostra, pra cada mapa, os brawlers com maior win rate calculado sobre batalhas recentes de top jogadores PRO de onze países diferentes.',
    editorialMethodology: 'Os percentuais abaixo são calculados com smoothing bayesiano sobre a janela de 14 dias da tabela meta_stats com filtro source=global, então um brawler com amostra pequena não aparece artificialmente alto. Quando um mapa específico tem amostra fina, caímos num agregado por modo — o badge de cada card indica se os dados vêm do mapa exato ou do fallback — pra você nunca ver um slot vazio numa rotação recém-entrada.',
    editorialNotesTitle: 'Como ler estas recomendações',
    editorialNote1: 'Picke o brawler com WR mais alto pro mapa só se seu time cobre as outras duas posições; um único pick fora do meta pode anular a vantagem estatística. Se seu time já tem tank e damage, prefira o segundo ou terceiro da lista em vez do primeiro.',
    editorialNote2: 'Sample size por mapa-modo importa: uma recomendação com 200+ batalhas é muito confiável, uma com 30-50 ainda não se estabilizou. A página usa o mínimo bayesiano pra não mostrar nada sem contexto, mas a confiança não é uniforme.',
    editorialNote3: 'A rotação atualiza a cada 30 minutos no cache do servidor; se uma rotação acabou de entrar e não aparece, recarregue em alguns minutos. Rotações que terminam na próxima hora mostram countdown pra você decidir se vale o investimento.',
    editorialClosing: 'Se quiser entender como cada percentual é construído (sampling PRO, smoothing bayesiano, janela temporal, filtro source=global), a página de metodologia tem a fórmula completa. As recomendações abaixo são agregados de batalhas reais, não opiniões de tier list.',
    methodologyLink: 'Ver metodologia completa',
  },

  de: {
    editorialEyebrow: 'Empfehlungen für die aktuelle Rotation',
    editorialIntro: 'Brawl Stars\' Map- und Modus-Rotation wechselt mehrmals täglich, und mit jedem Wechsel ändern sich auch die Best-Brawler-Empfehlungen. Diese Seite erfasst die Rotation, die gerade läuft (einschließlich Draft-Modi), und zeigt für jede Map die Brawler mit der höchsten Siegrate, berechnet über aktuelle Top-PRO-Kämpfe aus elf verschiedenen Ländern.',
    editorialMethodology: 'Die Prozentsätze unten werden mit Bayesian-Glättung über das 14-Tage-Fenster der meta_stats-Tabelle mit Filter source=global berechnet, sodass ein Brawler mit kleiner Stichprobe nicht künstlich hoch erscheint. Wenn eine bestimmte Map dünne Stichprobe hat, fallen wir auf einen Per-Modus-Aggregat zurück — das Badge jeder Karte zeigt, ob die Daten von der exakten Map oder vom Fallback kommen — damit du auf einer brandneuen Rotation nie einen leeren Slot siehst.',
    editorialNotesTitle: 'Wie diese Empfehlungen zu lesen sind',
    editorialNote1: 'Pick den Brawler mit der höchsten WR für die Map nur, wenn dein Team die anderen beiden Positionen abdeckt; ein einziger Off-Meta-Pick kann den statistischen Vorteil aufheben. Hat dein Team bereits Tank und Damage, nimm den zweiten oder dritten der Liste statt den ersten.',
    editorialNote2: 'Stichprobengröße pro Map-Modus zählt: eine Empfehlung mit 200+ Kämpfen ist sehr zuverlässig, eine mit 30-50 hat sich noch nicht stabilisiert. Die Seite nutzt das Bayesian-Minimum, um nichts ohne Kontext zu zeigen, aber Konfidenz ist nicht uniform.',
    editorialNote3: 'Die Rotation aktualisiert sich alle 30 Minuten im Server-Cache; wenn eine Rotation gerade eingetreten und nicht zu sehen ist, lade in wenigen Minuten neu. Rotationen, die in der nächsten Stunde enden, zeigen einen Countdown, damit du entscheiden kannst, ob die Investition lohnt.',
    editorialClosing: 'Willst du verstehen, wie jede Prozentzahl zusammengesetzt ist (PRO-Sampling, Bayesian-Glättung, Zeitfenster, Filter source=global), enthält die Methodik-Seite die vollständige Formel. Die Empfehlungen unten sind Aggregate echter Kämpfe, keine Tier-List-Meinungen.',
    methodologyLink: 'Vollständige Methodik ansehen',
  },

  it: {
    editorialEyebrow: 'Raccomandazioni della rotazione attuale',
    editorialIntro: 'La rotazione di mappe e modalità di Brawl Stars cambia più volte al giorno e con ogni cambio cambiano anche le raccomandazioni del miglior brawler. Questa pagina cattura la rotazione che è viva adesso (incluse le modalità draft) e mostra, per ogni mappa, i brawler con il win rate più alto calcolato su battaglie recenti di top giocatori PRO di undici paesi diversi.',
    editorialMethodology: 'Le percentuali qui sotto sono calcolate con smoothing bayesiano sulla finestra di 14 giorni della tabella meta_stats con filtro source=global, così un brawler con campione piccolo non appare artificialmente alto. Quando una mappa specifica ha campione sottile, cadiamo su un aggregato per modalità — il badge di ogni card indica se i dati vengono dalla mappa esatta o dal fallback — perché tu non veda mai uno slot vuoto su una rotazione appena entrata.',
    editorialNotesTitle: 'Come leggere queste raccomandazioni',
    editorialNote1: 'Picka il brawler col WR più alto per la mappa solo se il tuo team copre le altre due posizioni; un solo pick fuori meta può cancellare il vantaggio statistico. Se il tuo team ha già tank e damage, preferisci il secondo o terzo della lista al primo.',
    editorialNote2: 'Sample size per mappa-modalità conta: una raccomandazione con 200+ battaglie è molto affidabile, una con 30-50 non si è ancora stabilizzata. La pagina usa il minimo bayesiano per non mostrare nulla senza contesto, ma la confidenza non è uniforme.',
    editorialNote3: 'La rotazione si aggiorna ogni 30 minuti nella cache server; se una rotazione è appena entrata e non appare, ricarica in qualche minuto. Le rotazioni che finiscono entro un\'ora mostrano un countdown perché tu decida se l\'investimento vale.',
    editorialClosing: 'Se vuoi capire come è costruita ogni percentuale (sampling PRO, smoothing bayesiano, finestra temporale, filtro source=global), la pagina metodologia ha la formula completa. Le raccomandazioni qui sotto sono aggregati di battaglie reali, non opinioni di tier list.',
    methodologyLink: 'Vedi metodologia completa',
  },

  ru: {
    editorialEyebrow: 'Рекомендации текущей ротации',
    editorialIntro: 'Ротация карт и режимов Brawl Stars меняется несколько раз в день, и с каждым изменением меняются рекомендации лучшего бойца. Эта страница фиксирует ротацию, активную прямо сейчас (включая режимы драфта) и показывает для каждой карты бойцов с наивысшим винрейтом, вычисленным по недавним боям топ-PRO из одиннадцати разных стран.',
    editorialMethodology: 'Проценты ниже считаются с байесовским сглаживанием на окне 14 дней таблицы meta_stats с фильтром source=global, чтобы боец с маленькой выборкой не казался искусственно высоким. Когда у конкретной карты тонкая выборка, падаем на агрегат по режиму — бейдж каждой карточки показывает, идут ли данные с точной карты или из fallback — чтобы вы никогда не видели пустого слота в свежей ротации.',
    editorialNotesTitle: 'Как читать эти рекомендации',
    editorialNote1: 'Пикайте бойца с самым высоким WR для карты только если ваша команда покрывает две другие позиции; один внеметовый пик может перечеркнуть статистическое преимущество. Если в команде уже есть танк и дамаг, лучше брать второго или третьего из списка вместо первого.',
    editorialNote2: 'Размер выборки на карту-режим важен: рекомендация на 200+ боёв очень надёжная, на 30-50 ещё не стабилизировалась. Страница использует байесовский минимум, чтобы ничего не показывать без контекста, но уверенность неоднородна.',
    editorialNote3: 'Ротация обновляется каждые 30 минут в кеше сервера; если ротация только что зашла и не отображается, обновите через несколько минут. Ротации, заканчивающиеся в ближайший час, показывают countdown, чтобы вы решили, стоят ли вложения.',
    editorialClosing: 'Если хотите понять, как строится каждый процент (PRO-сэмплинг, байесовское сглаживание, временное окно, фильтр source=global), на странице методологии полная формула. Рекомендации ниже — агрегаты реальных боёв, а не мнения тир-листа.',
    methodologyLink: 'Смотреть полную методологию',
  },

  tr: {
    editorialEyebrow: 'Mevcut rotasyon için öneriler',
    editorialIntro: 'Brawl Stars\'ın harita ve mod rotasyonu günde birkaç kez değişir; her değişiklikle en iyi brawler önerileri de değişir. Bu sayfa şu anda canlı olan rotasyonu (draft modları dahil) yakalar ve her harita için on bir farklı ülkenin son top PRO savaşları üzerinden hesaplanmış en yüksek galibiyet oranına sahip brawler\'ları gösterir.',
    editorialMethodology: 'Aşağıdaki yüzdeler, source=global filtresiyle meta_stats tablosunun 14 günlük penceresi üzerinde Bayesian yumuşatmasıyla hesaplanır; küçük örneklemli bir brawler yapay olarak yüksek görünmez. Belirli bir haritanın örneklemi inceyse mod başına toplama düşeriz — her kartın rozeti verinin tam haritadan mı yoksa fallback\'ten mi geldiğini belirtir — böylece yeni bir rotasyonda asla boş bir slot görmezsin.',
    editorialNotesTitle: 'Bu önerileri nasıl okumalı',
    editorialNote1: 'Haritanın en yüksek WR\'sine sahip brawler\'ı yalnızca takımın diğer iki pozisyonu kapatıyorsa pickle; tek bir meta dışı pick istatistiksel avantajı silebilir. Takımında zaten tank ve damage varsa listeden birinciyi değil ikinciyi veya üçüncüyü tercih et.',
    editorialNote2: 'Harita-mod başına örneklem boyutu önemlidir: 200+ savaşlık öneri çok güvenilirdir, 30-50 olan henüz tam olarak oturmamıştır. Sayfa bağlamsız hiçbir şey göstermemek için Bayesian minimumunu kullanır ama güven düzeyi tek tip değildir.',
    editorialNote3: 'Rotasyon sunucu önbelleğinde 30 dakikada bir yenilenir; bir rotasyon yeni başladıysa ve görünmüyorsa birkaç dakika sonra yenile. Önümüzdeki saat içinde biten rotasyonlar yatırımın değip değmediğine karar vermen için countdown gösterir.',
    editorialClosing: 'Her yüzdenin nasıl oluştuğunu (PRO örnekleme, Bayesian yumuşatma, zaman penceresi, source=global filtresi) anlamak istersen metodoloji sayfasında tam formül var. Aşağıdaki öneriler gerçek savaşların toplamlarıdır, tier list görüşleri değil.',
    methodologyLink: 'Tam metodolojiyi gör',
  },

  pl: {
    editorialEyebrow: 'Rekomendacje aktualnej rotacji',
    editorialIntro: 'Rotacja map i trybów Brawl Stars zmienia się kilka razy dziennie, a z każdą zmianą zmieniają się też rekomendacje najlepszego brawlera. Ta strona uchwyca rotację aktywną teraz (włącznie z trybami draft) i pokazuje dla każdej mapy brawlerów z najwyższym win rate liczonym na ostatnich walkach top graczy PRO z jedenastu różnych krajów.',
    editorialMethodology: 'Procenty poniżej są liczone z wygładzaniem bayesowskim na oknie 14-dniowym tabeli meta_stats z filtrem source=global, więc brawler z małą próbą nie pojawia się sztucznie wysoko. Gdy konkretna mapa ma cienką próbę, spadamy na agregat per tryb — odznaka każdej karty wskazuje, czy dane pochodzą z dokładnej mapy czy z fallbacku — byś nigdy nie widział pustego slotu na świeżej rotacji.',
    editorialNotesTitle: 'Jak czytać te rekomendacje',
    editorialNote1: 'Pickuj brawlera z najwyższym WR dla mapy tylko jeśli Twoja drużyna pokrywa pozostałe dwie pozycje; pojedynczy pick poza metą może skasować przewagę statystyczną. Jeśli drużyna ma już tanka i damage, weź drugiego lub trzeciego z listy zamiast pierwszego.',
    editorialNote2: 'Próbka per mapa-tryb ma znaczenie: rekomendacja z 200+ walkami jest bardzo wiarygodna, ta z 30-50 jeszcze się nie ustabilizowała. Strona używa minimum bayesowskiego, by nie pokazywać niczego bez kontekstu, ale pewność nie jest jednolita.',
    editorialNote3: 'Rotacja odświeża się co 30 minut w cache serwera; jeśli rotacja właśnie wskoczyła i nie pojawia się, odśwież za kilka minut. Rotacje kończące się w ciągu godziny pokazują countdown, byś zdecydował czy inwestycja się opłaca.',
    editorialClosing: 'Jeśli chcesz zrozumieć, jak budowany jest każdy procent (sampling PRO, wygładzanie bayesowskie, okno czasowe, filtr source=global), strona metodologii ma pełną formułę. Rekomendacje poniżej to agregaty prawdziwych walk, nie opinie tier listy.',
    methodologyLink: 'Zobacz pełną metodologię',
  },

  ar: {
    editorialEyebrow: 'توصيات الدوران الحالي',
    editorialIntro: 'يتغير دوران الخرائط والأوضاع في Brawl Stars عدة مرات يومياً، ومع كل تغيير تتغير توصيات أفضل بطل أيضاً. تلتقط هذه الصفحة الدوران الحي الآن (بما في ذلك أوضاع draft) وتعرض لكل خريطة الأبطال ذوي أعلى نسبة فوز محسوبة على معارك حديثة لأفضل لاعبي PRO من إحدى عشرة دولة مختلفة.',
    editorialMethodology: 'تُحسب النسب أدناه بتنعيم بايزي على نافذة الـ14 يوماً من جدول meta_stats مع فلتر source=global، فلا يظهر بطل ذو عينة صغيرة مرتفعاً بشكل مصطنع. حين يكون لخريطة بعينها عينة رقيقة، نسقط إلى مجمَّع لكل وضع — تُشير شارة كل بطاقة إلى ما إذا كانت البيانات من الخريطة الفعلية أو من fallback — حتى لا ترى أبداً خانة فارغة في دوران جديد.',
    editorialNotesTitle: 'كيف تقرأ هذه التوصيات',
    editorialNote1: 'اختر البطل بأعلى WR للخريطة فقط إذا كان فريقك يغطي المركزين الآخرين؛ اختيار واحد خارج الميتا قد يلغي الميزة الإحصائية. إن كان لدى فريقك بالفعل تانك ودامج، فضّل الثاني أو الثالث من القائمة بدل الأول.',
    editorialNote2: 'حجم العينة لكل خريطة-وضع مهم: توصية بـ200+ معركة موثوقة جداً، أما 30-50 فلم تستقر بعد. تستخدم الصفحة الحد الأدنى البايزي لئلا تعرض شيئاً بلا سياق، لكن الثقة ليست موحدة.',
    editorialNote3: 'يُحدَّث الدوران كل 30 دقيقة في كاش الخادم؛ إن بدأ دوران للتو ولم يظهر، أعد التحميل بعد دقائق. تُظهر الدورات التي تنتهي في الساعة القادمة عدّاً تنازلياً لتقرر ما إذا كان الاستثمار يستحق.',
    editorialClosing: 'إن أردت فهم كيف يُبنى كل نسبة (عينة PRO، تنعيم بايزي، النافذة الزمنية، فلتر source=global)، تحوي صفحة المنهجية الصيغة الكاملة. التوصيات أدناه مجاميع لمعارك حقيقية، لا آراء tier list.',
    methodologyLink: 'عرض المنهجية الكاملة',
  },

  ko: {
    editorialEyebrow: '현재 로테이션 추천',
    editorialIntro: '브롤스타즈의 맵과 모드 로테이션은 하루에 여러 번 바뀌고, 변경마다 최고 브롤러 추천도 바뀝니다. 이 페이지는 지금 활성화된 로테이션(드래프트 모드 포함)을 캡처하고, 각 맵에 대해 11개국의 최근 톱 PRO 전투에서 계산된 가장 높은 승률을 가진 브롤러를 표시합니다.',
    editorialMethodology: '아래 백분율은 source=global 필터로 meta_stats 테이블의 14일 윈도우에서 베이지안 스무딩으로 계산되므로, 표본이 작은 브롤러가 인위적으로 높게 표시되지 않습니다. 특정 맵의 표본이 얇을 때는 모드별 집계로 폴백합니다 — 각 카드의 배지는 데이터가 정확한 맵에서 왔는지 폴백에서 왔는지 표시합니다 — 새로운 로테이션에서 빈 슬롯을 보지 않도록.',
    editorialNotesTitle: '이 추천을 읽는 법',
    editorialNote1: '맵에서 가장 높은 WR을 가진 브롤러는 팀이 다른 두 포지션을 커버할 때만 픽하세요; 한 명의 메타 외 픽이 통계적 우위를 무효화할 수 있습니다. 팀에 이미 탱커와 데미지가 있다면 첫 번째가 아닌 목록의 두 번째 또는 세 번째를 선호하세요.',
    editorialNote2: '맵-모드별 표본 크기가 중요합니다: 200+ 전투의 추천은 매우 신뢰할 수 있고, 30-50의 것은 아직 완전히 안정되지 않았습니다. 페이지는 컨텍스트 없이 아무것도 표시하지 않기 위해 베이지안 최소값을 사용하지만, 신뢰도는 균일하지 않습니다.',
    editorialNote3: '로테이션은 서버 캐시에서 30분마다 새로 고쳐집니다; 로테이션이 방금 시작되어 표시되지 않으면 몇 분 후에 새로 고치세요. 다음 한 시간 내에 종료되는 로테이션은 투자할 가치가 있는지 결정할 수 있도록 카운트다운을 표시합니다.',
    editorialClosing: '각 백분율이 어떻게 만들어지는지(PRO 샘플링, 베이지안 스무딩, 시간 윈도우, source=global 필터링) 이해하고 싶다면 방법론 페이지에 전체 공식이 있습니다. 아래 추천은 실제 전투의 집계이며, 티어 리스트 의견이 아닙니다.',
    methodologyLink: '전체 방법론 보기',
  },

  ja: {
    editorialEyebrow: '現在のローテーションへのおすすめ',
    editorialIntro: 'ブロスタのマップとモードのローテーションは1日に何度か変わり、変わるたびにベストブロウラーのおすすめも変わります。このページは現在ライブのローテーション（ドラフトモード含む）を捉え、各マップについて11カ国の最近のトップPRO戦闘から算出された最も高い勝率を持つブロウラーを表示します。',
    editorialMethodology: '以下のパーセンテージは meta_stats テーブルの14日ウィンドウに対してsource=globalフィルターでベイジアン平滑化されて算出されるため、サンプルの小さなブロウラーが人為的に高く表示されることはありません。特定のマップのサンプルが薄い場合、モードごとの集計にフォールバックします — 各カードのバッジはデータが正確なマップから来たかフォールバックから来たかを示します — 新しいローテーションで空のスロットを見ないようにします。',
    editorialNotesTitle: 'これらのおすすめの読み方',
    editorialNote1: 'マップで最も高い勝率のブロウラーを選ぶのは、チームが他の2つのポジションをカバーする場合のみにしてください。1つのメタ外ピックが統計的優位を打ち消すことがあります。チームにすでにタンクとダメージがあれば、リストの最初ではなく2番目または3番目を選んでください。',
    editorialNote2: 'マップ-モードごとのサンプルサイズが重要です: 200+戦闘の推奨は非常に信頼でき、30-50のものはまだ完全に安定していません。ページはコンテキストなしに何も表示しないようにベイジアン最小値を使用しますが、信頼度は均一ではありません。',
    editorialNote3: 'ローテーションはサーバーキャッシュで30分ごとに更新されます。ローテーションが始まったばかりで表示されない場合は、数分後に再読み込みしてください。次の1時間で終わるローテーションは投資する価値があるかを判断できるようにカウントダウンを表示します。',
    editorialClosing: '各パーセンテージがどう構築されるか（PROサンプリング、ベイジアン平滑化、時間ウィンドウ、source=globalフィルター）を理解したい場合、方法論ページに完全な公式があります。以下の推奨は実戦闘の集計であり、ティアリストの意見ではありません。',
    methodologyLink: '完全な方法論を見る',
  },

  zh: {
    editorialEyebrow: '当前轮换的推荐',
    editorialIntro: '荒野乱斗的地图和模式轮换每天变化多次，每次变化最佳英雄推荐也会变化。本页捕获当前激活的轮换（包括草案模式），并为每张地图显示从十一个不同国家的最近顶级 PRO 战斗中计算出的最高胜率英雄。',
    editorialMethodology: '下面的百分比通过对 meta_stats 表的 14 天窗口和 source=global 过滤器进行贝叶斯平滑计算，因此样本小的英雄不会人为地显示得很高。当特定地图样本稀薄时，我们退回到每模式聚合 — 每张卡片的徽章指示数据来自精确地图还是来自回退 — 这样你永远不会在全新轮换上看到空槽。',
    editorialNotesTitle: '如何阅读这些推荐',
    editorialNote1: '只有当你的队伍覆盖其他两个位置时才选择该地图胜率最高的英雄；单个非元选择可能取消统计优势。如果你的队伍已经有坦克和伤害，请选择列表中的第二或第三而不是第一。',
    editorialNote2: '每张地图-模式的样本量很重要：200+ 战斗的推荐非常可靠，30-50 的还没有完全稳定。该页面使用贝叶斯最小值以避免在没有上下文的情况下显示任何内容，但置信度并不一致。',
    editorialNote3: '轮换在服务器缓存中每 30 分钟刷新一次；如果轮换刚开始且未显示，请几分钟后刷新。在下一个小时内结束的轮换显示倒计时，以便你决定投资是否值得。',
    editorialClosing: '如果你想了解每个百分比是如何构建的（PRO 采样、贝叶斯平滑、时间窗口、source=global 过滤），方法论页面有完整公式。下面的推荐是真实战斗的聚合，不是 tier list 意见。',
    methodologyLink: '查看完整方法论',
  },
}

let totalAdditions = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.picks) data.picks = {}
  const ns = TRANSLATIONS[locale]
  if (!ns) {
    console.warn(`  ${locale.padEnd(3)}  SKIP — no translation defined`)
    continue
  }
  Object.assign(data.picks, ns)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  totalAdditions += Object.keys(ns).length
  console.log(`  ${locale.padEnd(3)}  picks editorial keys (${Object.keys(ns).length})`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
