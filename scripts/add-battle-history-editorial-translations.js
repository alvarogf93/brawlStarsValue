#!/usr/bin/env node
// /[locale]/battle-history — adds editorial depth.
//
// The page already has hero/benefits/steps/faq (~280 words ES).
// AdSense T2.1 requires it to read as an article, not a landing
// — this script extends the existing `battleHistory` namespace
// with two analytical sections (~400 extra words) so the page
// crosses the 600-word editorial threshold before the ad slot.
//
// Idempotent.

const fs = require('fs')
const path = require('path')

const LOCALES = ['ar', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'zh']

const TRANSLATIONS = {
  es: {
    analysisTitle: 'Por qué guardar tu histórico cambia cómo juegas',
    analysisParagraph1: 'Sin histórico, "estoy mejorando" es una intuición. Quizás llevas tres semanas con el mismo brawler y sientes que vas a más, pero la API de Brawl Stars solo te enseña las últimas 25 partidas. Si tuviste un mal día reciente, la app te dice que vas mal. Si tuviste uno bueno, te dice lo opuesto. Ninguna de las dos lecturas es la verdad. Con un mes de historial guardado, el ruido del último día deja de pesar y el patrón real (winrate por brawler, por mapa, por hora del día) emerge.',
    analysisParagraph2: 'El otro caso típico es el tilt. Después de cuatro derrotas seguidas, el cerebro tiende a seguir picando un brawler concreto buscando "remontar". El histórico mostrado por hora ayuda a detectar esa pauta: muchos jugadores tienen un winrate normal a las 21:00 y otro 7-8 puntos peor pasada la medianoche. Esa observación viene exclusivamente de comparar muestras temporales que no caben en 25 partidas. La página de stats individual de cada usuario premium muestra esos cortes para que decidas cuándo conviene parar.',
    analysisParagraph3: 'Un tercer uso, menos obvio, es la comparación con el meta. Si BrawlVision te dice que en tu mapa preferido el brawler que más juegas tiene un winrate global del 53%, pero el tuyo personal con ese brawler en ese mapa lleva semanas en el 45%, hay una pista clara: probablemente no eres "malo con ese brawler", sino que algo en tu draft o tu rotación de mapas te está fallando. Sin histórico no podrías ni formar la pregunta.',
    whyTitle: 'Cómo lo hacemos sin tocar tu cuenta',
    whyParagraph1: 'BrawlVision sincroniza tu battlelog leyendo la API pública de Supercell con tu Player Tag. Nunca te pedimos contraseña ni credenciales del juego, porque la API oficial no requiere autenticación para el endpoint de batallas — solo necesita el tag. Cada vez que el cron corre, descarga las nuevas batallas que la API expone (las últimas 25), las cruza con las que ya tenemos en nuestra base de datos, y sólo guarda las que aún no habíamos visto.',
    whyParagraph2: 'Ese cron mantiene tu histórico al día sin pasos manuales mientras la sincronización esté activa. Si pausas el servicio o cancelas el premium, tu histórico se queda como estaba — no borramos nada — y reactivar la sincronización retoma desde donde se detuvo. La metodología completa (frecuencia de poll, manejo de duplicados, política de retención) está documentada en la página de metodología.',
  },

  en: {
    analysisTitle: 'Why saving your history changes how you play',
    analysisParagraph1: 'Without a history, "I\'m improving" is intuition. You may have spent three weeks with the same brawler and feel you\'re getting better, but the Brawl Stars API only shows the last 25 matches. Bad recent day? The app says you\'re tilting. Good one? Says the opposite. Neither reading is the truth. With a month of saved history, the noise of the last day stops mattering and the real pattern (win rate per brawler, per map, per hour of day) emerges.',
    analysisParagraph2: 'The other common case is tilt. After four losses in a row, the brain tends to keep picking the same brawler hoping to "make it back". An hour-of-day history breakdown helps spot that pattern: many players have a normal win rate at 9pm and 7-8 points worse past midnight. That observation comes only from comparing temporal samples that don\'t fit in 25 matches. Each premium user\'s personal stats page shows those cuts so you can decide when it\'s smarter to stop.',
    analysisParagraph3: 'A third, less obvious use is comparison against the meta. If BrawlVision tells you that on your favorite map the brawler you play most has a global win rate of 53%, but your personal win rate with that brawler on that map has been at 45% for weeks, you have a clear lead: you\'re probably not "bad with that brawler" — something in your draft or your map rotation is failing you. Without history, you couldn\'t even formulate the question.',
    whyTitle: 'How we do it without touching your account',
    whyParagraph1: 'BrawlVision syncs your battle log by reading Supercell\'s public API against your Player Tag. We never ask for passwords or game credentials — the official API doesn\'t require authentication for the battles endpoint, just the tag. Every time the cron runs, it downloads the new battles the API exposes (the last 25), cross-references them with what\'s already in our database, and only saves the ones we hadn\'t seen.',
    whyParagraph2: 'That cron keeps your history current with no manual steps while sync is active. If you pause the service or cancel premium, your history stays as it was — we don\'t delete anything — and reactivating sync resumes where it stopped. The full methodology (poll frequency, dedup handling, retention policy) is documented on the methodology page.',
  },

  fr: {
    analysisTitle: 'Pourquoi sauvegarder ton historique change ta façon de jouer',
    analysisParagraph1: 'Sans historique, « je m\'améliore » est de l\'intuition. Tu as peut-être passé trois semaines avec le même brawler en sentant que tu progresses, mais l\'API de Brawl Stars ne montre que les 25 derniers matchs. Mauvaise journée récente ? L\'app dit que tu tiltes. Bonne ? L\'inverse. Aucune des deux lectures n\'est la vérité. Avec un mois d\'historique sauvegardé, le bruit du dernier jour cesse de peser et le vrai pattern (taux de victoire par brawler, par carte, par heure) émerge.',
    analysisParagraph2: 'L\'autre cas typique est le tilt. Après quatre défaites de suite, le cerveau a tendance à continuer à picker le même brawler en espérant remonter. L\'historique par heure de la journée aide à détecter ce pattern : beaucoup de joueurs ont un WR normal à 21h et 7-8 points pire passé minuit. Cette observation ne vient que de comparer des samples temporels qui ne tiennent pas dans 25 matchs. La page de stats personnelle de chaque utilisateur premium montre ces coupes pour que tu décides quand il est malin d\'arrêter.',
    analysisParagraph3: 'Un troisième usage, moins évident, est la comparaison avec le meta. Si BrawlVision te dit que sur ta carte favorite le brawler que tu joues le plus a un WR global de 53%, mais que ton WR personnel avec ce brawler sur cette carte est à 45% depuis des semaines, tu as une piste claire : tu n\'es probablement pas « mauvais avec ce brawler » — quelque chose dans ton draft ou ta rotation de cartes te plante. Sans historique tu ne pourrais même pas formuler la question.',
    whyTitle: 'Comment on fait sans toucher à ton compte',
    whyParagraph1: 'BrawlVision synchronise ton battle log en lisant l\'API publique de Supercell contre ton Player Tag. On ne te demande jamais de mot de passe ni d\'identifiants de jeu — l\'API officielle n\'exige pas d\'authentification pour le endpoint des combats, juste le tag. Chaque fois que le cron tourne, il télécharge les nouveaux combats que l\'API expose (les 25 derniers), les recoupe avec ce qu\'on a déjà en base, et ne sauvegarde que ceux qu\'on n\'avait pas vus.',
    whyParagraph2: 'Ce cron maintient ton historique à jour sans étape manuelle tant que la synchro est active. Si tu mets en pause le service ou annules le premium, ton historique reste tel quel — on ne supprime rien — et réactiver la synchro reprend où elle s\'est arrêtée. La méthodologie complète (fréquence du poll, gestion des doublons, rétention) est documentée sur la page méthodologie.',
  },

  pt: {
    analysisTitle: 'Por que salvar seu histórico muda como você joga',
    analysisParagraph1: 'Sem histórico, "estou melhorando" é intuição. Você pode ter passado três semanas com o mesmo brawler sentindo que progride, mas a API do Brawl Stars só mostra as últimas 25 partidas. Dia ruim recente? O app diz que você está tiltando. Bom dia? O contrário. Nenhuma das duas leituras é verdade. Com um mês de histórico salvo, o ruído do último dia para de pesar e o padrão real (win rate por brawler, por mapa, por hora do dia) emerge.',
    analysisParagraph2: 'O outro caso típico é o tilt. Depois de quatro derrotas seguidas, o cérebro tende a continuar pickando o mesmo brawler tentando "recuperar". O histórico por hora ajuda a detectar esse padrão: muitos jogadores têm um WR normal às 21h e 7-8 pontos pior depois da meia-noite. Essa observação só vem de comparar amostras temporais que não cabem em 25 partidas. A página de stats individual de cada usuário premium mostra esses recortes pra você decidir quando é mais esperto parar.',
    analysisParagraph3: 'Um terceiro uso, menos óbvio, é a comparação com o meta. Se o BrawlVision te diz que no seu mapa preferido o brawler que você mais joga tem WR global de 53%, mas o seu WR pessoal com esse brawler nesse mapa está em 45% há semanas, tem uma pista clara: você provavelmente não é "ruim com esse brawler" — algo na sua draft ou rotação de mapas está te falhando. Sem histórico nem formular a pergunta dá.',
    whyTitle: 'Como fazemos isso sem tocar na sua conta',
    whyParagraph1: 'O BrawlVision sincroniza seu battlelog lendo a API pública da Supercell com seu Player Tag. Nunca pedimos senha nem credenciais do jogo — a API oficial não exige autenticação pro endpoint de batalhas, só o tag. Toda vez que o cron roda, baixa as batalhas novas que a API expõe (as últimas 25), cruza com o que já temos no banco, e só salva as que não tínhamos visto.',
    whyParagraph2: 'Esse cron mantém seu histórico atualizado sem passos manuais enquanto a sync estiver ativa. Se pausar o serviço ou cancelar o premium, seu histórico fica como estava — não apagamos nada — e reativar a sync retoma de onde parou. A metodologia completa (frequência de poll, dedup, retenção) está documentada na página de metodologia.',
  },

  de: {
    analysisTitle: 'Warum das Speichern deines Verlaufs ändert, wie du spielst',
    analysisParagraph1: 'Ohne Verlauf ist „ich werde besser" Intuition. Du hast vielleicht drei Wochen mit demselben Brawler verbracht und das Gefühl, dass du Fortschritte machst, aber die Brawl-Stars-API zeigt nur die letzten 25 Matches. Schlechter Tag kürzlich? Die App sagt, du tiltest. Guter Tag? Das Gegenteil. Keine Lesart ist Wahrheit. Mit einem Monat gespeichertem Verlauf hört der Lärm des letzten Tages auf zu wiegen und das echte Muster (Siegrate pro Brawler, pro Map, pro Tageszeit) tritt hervor.',
    analysisParagraph2: 'Der andere typische Fall ist Tilt. Nach vier Niederlagen in Folge neigt das Gehirn dazu, denselben Brawler weiter zu picken, um „zurückzukommen". Eine Stunde-für-Stunde-Aufschlüsselung hilft, dieses Muster zu erkennen: viele Spieler haben um 21 Uhr eine normale WR und nach Mitternacht 7-8 Punkte schlechter. Diese Beobachtung kommt nur aus dem Vergleich zeitlicher Stichproben, die in 25 Matches nicht passen. Die persönliche Stats-Seite jedes Premium-Nutzers zeigt diese Schnitte, damit du entscheidest, wann es klüger ist aufzuhören.',
    analysisParagraph3: 'Eine dritte, weniger offensichtliche Nutzung ist der Vergleich mit dem Meta. Wenn BrawlVision dir sagt, dass auf deiner Lieblingskarte der von dir am meisten gespielte Brawler eine globale WR von 53% hat, deine persönliche WR mit diesem Brawler auf dieser Karte aber seit Wochen bei 45% liegt, hast du einen klaren Hinweis: du bist wahrscheinlich nicht „schlecht mit diesem Brawler" — etwas in deinem Draft oder deiner Map-Rotation versagt dich. Ohne Verlauf könntest du die Frage nicht einmal formulieren.',
    whyTitle: 'Wie wir es machen, ohne deinen Account zu berühren',
    whyParagraph1: 'BrawlVision synchronisiert dein Battle Log durch Lesen der öffentlichen Supercell-API gegen deinen Player Tag. Wir fragen nie nach Passwörtern oder Spiel-Credentials — die offizielle API benötigt keine Authentifizierung für den Kampf-Endpunkt, nur den Tag. Jedes Mal wenn der Cron läuft, lädt er die neuen Kämpfe herunter, die die API offenlegt (die letzten 25), gleicht sie mit dem ab, was wir schon in der DB haben, und speichert nur die, die wir noch nicht gesehen hatten.',
    whyParagraph2: 'Dieser Cron hält deinen Verlauf aktuell, ohne manuelle Schritte, solange Sync aktiv ist. Pausierst du den Dienst oder kündigst Premium, bleibt dein Verlauf wie er war — wir löschen nichts — und Sync-Reaktivierung nimmt dort wieder auf, wo sie stehen geblieben ist. Die vollständige Methodik (Poll-Frequenz, Duplikat-Handling, Aufbewahrungsrichtlinie) ist auf der Methodik-Seite dokumentiert.',
  },

  it: {
    analysisTitle: 'Perché salvare la tua storia cambia come giochi',
    analysisParagraph1: 'Senza storico, "sto migliorando" è intuizione. Magari hai passato tre settimane con lo stesso brawler sentendo che progredisci, ma l\'API di Brawl Stars mostra solo le ultime 25 partite. Brutta giornata recente? L\'app dice che stai tiltando. Buona? Il contrario. Nessuna delle due letture è la verità. Con un mese di storico salvato, il rumore dell\'ultimo giorno smette di pesare e il vero pattern (win rate per brawler, per mappa, per ora del giorno) emerge.',
    analysisParagraph2: 'L\'altro caso tipico è il tilt. Dopo quattro sconfitte di fila, il cervello tende a continuare a pickare lo stesso brawler sperando di "recuperare". Lo storico per ora aiuta a individuare quel pattern: molti giocatori hanno un WR normale alle 21 e 7-8 punti peggio dopo mezzanotte. Quell\'osservazione viene solo dal confronto di campioni temporali che non entrano in 25 partite. La pagina stats individuale di ogni utente premium mostra quei tagli perché tu decida quando è più furbo fermarsi.',
    analysisParagraph3: 'Un terzo uso, meno ovvio, è il confronto col meta. Se BrawlVision ti dice che sulla tua mappa preferita il brawler che giochi più ha un WR globale del 53%, ma il tuo WR personale con quel brawler su quella mappa è al 45% da settimane, hai una pista chiara: probabilmente non sei "scarso con quel brawler" — qualcosa nel tuo draft o nella rotazione di mappe ti sta fallendo. Senza storico non potresti nemmeno formulare la domanda.',
    whyTitle: 'Come lo facciamo senza toccare il tuo account',
    whyParagraph1: 'BrawlVision sincronizza il tuo battlelog leggendo l\'API pubblica di Supercell contro il tuo Player Tag. Non chiediamo mai password né credenziali di gioco — l\'API ufficiale non richiede autenticazione per l\'endpoint delle battaglie, solo il tag. Ogni volta che il cron gira, scarica le nuove battaglie che l\'API espone (le ultime 25), le incrocia con quello che abbiamo nel DB, e salva solo quelle che non avevamo visto.',
    whyParagraph2: 'Quel cron mantiene il tuo storico aggiornato senza passi manuali finché la sync è attiva. Se metti in pausa il servizio o cancelli il premium, il tuo storico resta com\'era — non cancelliamo nulla — e riattivare la sync riprende da dove si era fermata. La metodologia completa (frequenza poll, gestione duplicati, ritenzione) è documentata sulla pagina metodologia.',
  },

  ru: {
    analysisTitle: 'Почему сохранение истории меняет ваш стиль игры',
    analysisParagraph1: 'Без истории «я улучшаюсь» — это интуиция. Возможно, вы провели три недели с одним бойцом, ощущая прогресс, но API Brawl Stars показывает только последние 25 матчей. Плохой недавний день? Приложение говорит, что вы тильтуете. Хороший? Наоборот. Ни одно из двух прочтений не является истиной. С месяцем сохранённой истории шум последнего дня перестаёт давить, и реальный паттерн (винрейт по бойцу, по карте, по часу дня) проступает.',
    analysisParagraph2: 'Другой типичный случай — тильт. После четырёх поражений подряд мозг склонен продолжать пикать того же бойца в надежде «отыграться». Часовой разрез истории помогает увидеть этот паттерн: у многих игроков нормальный WR в 21:00 и на 7-8 пунктов хуже после полуночи. Это наблюдение возможно только при сравнении временных выборок, которые не помещаются в 25 матчей. Страница персональной статистики каждого премиум-пользователя показывает эти срезы, чтобы вы могли решить, когда умнее остановиться.',
    analysisParagraph3: 'Третий, менее очевидный случай — сравнение с метой. Если BrawlVision говорит, что на вашей любимой карте боец, которым вы играете больше всего, имеет глобальный WR 53%, а ваш личный WR с этим бойцом на этой карте уже несколько недель держится на 45%, у вас есть чёткий след: вы, вероятно, не «плохи с этим бойцом» — что-то в вашем драфте или ротации карт вас подводит. Без истории вы бы даже не сформулировали вопрос.',
    whyTitle: 'Как мы это делаем, не трогая ваш аккаунт',
    whyParagraph1: 'BrawlVision синхронизирует ваш battlelog, читая публичный API Supercell по вашему Player Tag. Мы никогда не просим пароли или игровые учётные данные — официальный API не требует аутентификации для эндпоинта боёв, только тег. Каждый раз, когда работает cron, он скачивает новые бои, которые экспонирует API (последние 25), сверяет с тем, что уже есть в БД, и сохраняет только те, что мы ещё не видели.',
    whyParagraph2: 'Этот cron поддерживает вашу историю актуальной без ручных шагов, пока синхронизация активна. Если приостановите сервис или отмените премиум, история останется как была — мы ничего не удаляем — и реактивация синхронизации продолжит с того места, где остановилась. Полная методология (частота опроса, обработка дубликатов, политика хранения) задокументирована на странице методологии.',
  },

  tr: {
    analysisTitle: 'Geçmişini kaydetmek nasıl oynadığını neden değiştirir',
    analysisParagraph1: 'Geçmiş olmadan "iyileşiyorum" sezgidir. Aynı brawler\'la üç hafta geçirmiş ve ilerlediğini hissediyor olabilirsin, ama Brawl Stars API\'si yalnızca son 25 maçı gösterir. Son zamanlarda kötü gün mü? Uygulama tilt olduğunu söyler. İyi gün mü? Tam tersi. Her iki okuma da gerçek değil. Bir aylık kayıtlı geçmişle son günün gürültüsü ağırlığını kaybeder ve gerçek desen (brawler başına, harita başına, günün saati başına galibiyet oranı) ortaya çıkar.',
    analysisParagraph2: 'Diğer tipik durum tilt\'tir. Üst üste dört yenilgiden sonra beyin "geri dönmek" için aynı brawler\'ı seçmeye devam etme eğilimindedir. Günün saati başına geçmiş bu deseni tespit etmeye yardımcı olur: birçok oyuncunun saat 21:00\'de normal WR\'si vardır ve gece yarısından sonra 7-8 puan daha kötüdür. Bu gözlem yalnızca 25 maça sığmayan zamansal örnekleri karşılaştırmaktan gelir. Her premium kullanıcının kişisel istatistik sayfası, durmanın ne zaman daha akıllıca olduğuna karar verebilmeniz için bu kesitleri gösterir.',
    analysisParagraph3: 'Daha az belirgin üçüncü kullanım metayla karşılaştırmadır. BrawlVision sana, en sevdiğin haritada en çok oynadığın brawler\'ın küresel WR\'sinin %53 olduğunu, ama o haritada o brawler ile kişisel WR\'nin haftalardır %45\'te olduğunu söylerse, net bir ipucun var: muhtemelen "o brawler\'la kötü" değilsin — draft\'ında ya da harita rotasyonunda bir şey seni başarısızlığa sürüklüyor. Geçmiş olmadan soruyu bile formüle edemezdin.',
    whyTitle: 'Hesabına dokunmadan nasıl yapıyoruz',
    whyParagraph1: 'BrawlVision, Supercell\'in genel API\'sini Player Tag\'inle okuyarak savaş kayıtlarını senkronize eder. Asla şifre ya da oyun kimlik bilgileri istemeyiz — resmi API savaş endpoint\'i için kimlik doğrulaması istemez, yalnızca tag\'ı. Cron her çalıştığında, API\'nin maruz bıraktığı yeni savaşları (son 25) indirir, veritabanımızdakiyle eşleştirir ve yalnızca daha önce görmediklerimizi kaydeder.',
    whyParagraph2: 'Bu cron, sync aktif olduğu sürece geçmişini manuel adım olmadan güncel tutar. Hizmeti duraklatır veya premium\'u iptal edersen, geçmişin olduğu gibi kalır — hiçbir şey silmeyiz — ve sync\'i yeniden etkinleştirmek durduğu yerden devam eder. Tam metodoloji (poll sıklığı, tekrar yönetimi, saklama politikası) metodoloji sayfasında belgelenmiştir.',
  },

  pl: {
    analysisTitle: 'Czemu zapisywanie historii zmienia jak grasz',
    analysisParagraph1: 'Bez historii "poprawiam się" to intuicja. Może spędziłeś trzy tygodnie z tym samym brawlerem czując, że robisz postępy, ale API Brawl Stars pokazuje tylko ostatnie 25 meczów. Zły niedawny dzień? Aplikacja mówi, że tiltujesz. Dobry? Odwrotnie. Żaden z dwóch odczytów nie jest prawdą. Z miesięczną zapisaną historią szum ostatniego dnia przestaje ważyć, a prawdziwy wzór (win rate na brawlera, na mapę, na godzinę dnia) wyłania się.',
    analysisParagraph2: 'Drugi typowy przypadek to tilt. Po czterech porażkach z rzędu mózg ma tendencję do dalszego pickowania tego samego brawlera w nadziei "odrobienia". Historia per godzina pomaga zauważyć ten wzór: wielu graczy ma normalny WR o 21:00 i 7-8 punktów gorzej po północy. Ta obserwacja pochodzi tylko z porównania próbek czasowych, które nie mieszczą się w 25 meczach. Strona stats indywidualnej każdego użytkownika premium pokazuje te przekroje, byś zdecydował, kiedy mądrzej jest przestać.',
    analysisParagraph3: 'Trzecie, mniej oczywiste zastosowanie to porównanie z metą. Jeśli BrawlVision mówi ci, że na twojej ulubionej mapie brawler, którym grasz najczęściej, ma globalny WR 53%, ale twój osobisty WR z tym brawlerem na tej mapie jest na 45% od tygodni, masz wyraźny ślad: prawdopodobnie nie jesteś "zły z tym brawlerem" — coś w twoim drafcie lub rotacji map cię zawodzi. Bez historii nie sformułowałbyś nawet pytania.',
    whyTitle: 'Jak to robimy nie dotykając twojego konta',
    whyParagraph1: 'BrawlVision synchronizuje twój battlelog czytając publiczne API Supercella przeciw twojemu Player Tag. Nigdy nie prosimy o hasło ani dane logowania do gry — oficjalne API nie wymaga uwierzytelnienia dla endpointu walk, tylko taga. Za każdym razem gdy cron się uruchamia, pobiera nowe walki, które API udostępnia (ostatnie 25), porównuje z tym, co już mamy w bazie, i zapisuje tylko te, których nie widzieliśmy.',
    whyParagraph2: 'Ten cron utrzymuje twoją historię aktualną bez ręcznych kroków dopóki sync jest aktywna. Jeśli zatrzymasz usługę lub anulujesz premium, twoja historia zostaje taka, jaka była — niczego nie usuwamy — a reaktywacja synca wznawia od miejsca, w którym się zatrzymał. Pełna metodologia (częstotliwość polla, obsługa duplikatów, polityka retencji) jest udokumentowana na stronie metodologii.',
  },

  ar: {
    analysisTitle: 'لماذا يغير حفظ سجلك طريقة لعبك',
    analysisParagraph1: 'بدون سجل، "أتحسن" حدس. ربما قضيت ثلاثة أسابيع مع نفس البطل وتشعر بالتقدم، لكن واجهة Brawl Stars تعرض فقط آخر 25 مباراة. يوم سيئ مؤخراً؟ التطبيق يقول إنك تيلت. يوم جيد؟ العكس. ليست أي من القراءتين الحقيقة. مع شهر من السجل المحفوظ يكفّ ضجيج اليوم الأخير عن الترجيح ويبرز النمط الحقيقي (معدل فوز لكل بطل، لكل خريطة، لكل ساعة من اليوم).',
    analysisParagraph2: 'الحالة النموذجية الأخرى هي التيلت. بعد أربع هزائم متتالية يميل الدماغ إلى مواصلة اختيار نفس البطل أملاً في "العودة". يساعد السجل لكل ساعة من اليوم على رصد ذلك النمط: لدى كثيرين WR طبيعي الساعة 9 مساءً وأسوأ بـ7-8 نقاط بعد منتصف الليل. تأتي تلك الملاحظة فقط من مقارنة عينات زمنية لا تتسع في 25 مباراة. تعرض صفحة الإحصاءات الشخصية لكل مستخدم premium هذه المقاطع لتقرر متى يكون التوقف أذكى.',
    analysisParagraph3: 'استخدام ثالث أقل وضوحاً هو المقارنة مع الميتا. إن قال لك BrawlVision إن على خريطتك المفضلة البطل الذي تلعبه أكثر له WR عالمي 53%، بينما WR الشخصي عندك مع هذا البطل على تلك الخريطة 45% منذ أسابيع، فلديك خيط واضح: غالباً لست "سيئاً مع ذلك البطل" — شيء ما في درافتك أو في دوران خرائطك يخذلك. بدون سجل لا يمكنك حتى صياغة السؤال.',
    whyTitle: 'كيف نفعل ذلك دون لمس حسابك',
    whyParagraph1: 'يزامن BrawlVision سجل معاركك بقراءة واجهة Supercell العامة بـ Player Tag الخاص بك. لا نطلب أبداً كلمات مرور أو بيانات تسجيل الدخول للعبة — لا تتطلب الواجهة الرسمية مصادقة لنقطة المعارك، فقط الـtag. في كل مرة يعمل cron، يحمّل المعارك الجديدة التي تكشفها الواجهة (آخر 25)، يقاطعها مع ما لدينا، ويحفظ فقط ما لم نره من قبل.',
    whyParagraph2: 'يبقي ذلك cron سجلك محدّثاً دون خطوات يدوية ما دامت المزامنة فعّالة. إن أوقفت الخدمة مؤقتاً أو ألغيت premium يبقى سجلك كما هو — لا نحذف شيئاً — وإعادة تفعيل المزامنة تستأنف من حيث توقفت. المنهجية الكاملة (تردد الاستعلام، معالجة التكرارات، سياسة الاحتفاظ) موثقة على صفحة المنهجية.',
  },

  ko: {
    analysisTitle: '기록 저장이 플레이 방식을 바꾸는 이유',
    analysisParagraph1: '기록이 없으면 "나는 나아지고 있다"는 직관입니다. 같은 브롤러로 3주를 보내며 진보하고 있다고 느꼈을 수 있지만, 브롤스타즈 API는 최근 25경기만 보여줍니다. 최근에 안 좋은 날? 앱은 틸트라고 말합니다. 좋은 날? 반대를 말합니다. 어느 쪽도 진실이 아닙니다. 한 달의 저장된 기록이 있으면 마지막 날의 노이즈가 무게를 잃고 실제 패턴(브롤러별, 맵별, 시간대별 승률)이 드러납니다.',
    analysisParagraph2: '다른 전형적인 사례는 틸트입니다. 4연패 후 뇌는 "만회"하기 위해 같은 브롤러를 계속 선택하는 경향이 있습니다. 시간대별 기록은 그 패턴을 감지하는 데 도움이 됩니다: 많은 플레이어가 오후 9시에 정상 승률을 가지지만 자정 이후 7-8 포인트 더 나빠집니다. 그 관찰은 25경기에 들어가지 않는 시간 표본을 비교해야만 나올 수 있습니다. 각 프리미엄 사용자의 개인 통계 페이지는 이러한 절단을 보여 주어 언제 멈추는 것이 더 현명한지 결정할 수 있게 합니다.',
    analysisParagraph3: '세 번째이자 덜 분명한 용도는 메타와의 비교입니다. BrawlVision이 가장 좋아하는 맵에서 가장 많이 플레이하는 브롤러의 글로벌 승률이 53%인데 그 브롤러로 그 맵에서의 개인 승률이 몇 주 동안 45%였다고 알려준다면, 명확한 단서가 있습니다: 아마도 "그 브롤러로 못한다"가 아니라 — 드래프트나 맵 로테이션의 무언가가 당신을 실패시키고 있는 것입니다. 기록 없이는 질문조차 형성할 수 없습니다.',
    whyTitle: '계정에 손대지 않고 어떻게 하는지',
    whyParagraph1: 'BrawlVision은 슈퍼셀의 공개 API를 Player Tag와 함께 읽어 전투 로그를 동기화합니다. 비밀번호나 게임 자격 증명을 요구하지 않습니다 — 공식 API는 전투 엔드포인트에 대해 인증이 필요하지 않으며 태그만 필요합니다. cron이 실행될 때마다 API가 노출하는 새 전투(최근 25)를 다운로드하고, 데이터베이스에 있는 것과 교차 참조한 후, 보지 못한 것만 저장합니다.',
    whyParagraph2: '그 cron은 동기화가 활성 상태인 한 수동 단계 없이 기록을 최신 상태로 유지합니다. 서비스를 일시 중지하거나 프리미엄을 취소하면 기록은 그대로 유지됩니다 — 우리는 아무것도 삭제하지 않습니다 — 동기화를 재활성화하면 중단된 곳에서 재개됩니다. 전체 방법론(폴링 빈도, 중복 처리, 보존 정책)은 방법론 페이지에 문서화되어 있습니다.',
  },

  ja: {
    analysisTitle: '履歴を保存することがプレイをどう変えるか',
    analysisParagraph1: '履歴なしでは、「上達している」は直感です。同じブロウラーで3週間を過ごし、進歩していると感じているかもしれませんが、ブロスタAPIは直近25試合しか表示しません。最近の悪い日？アプリはあなたがティルトしていると言います。良い日？逆を言います。どちらの読みも真実ではありません。1ヶ月分の保存された履歴があれば、最後の日のノイズは重みを失い、本当のパターン（ブロウラーごと、マップごと、時間帯ごとの勝率）が現れます。',
    analysisParagraph2: 'もう一つの典型的なケースはティルトです。4連敗の後、脳は「取り戻す」ために同じブロウラーをピックし続ける傾向があります。時間帯別の履歴はそのパターンを発見するのに役立ちます: 多くのプレイヤーが午後9時には正常な勝率を持ち、深夜過ぎは7-8ポイント悪化します。その観察は25試合に収まらない時間的サンプルを比較することからのみ得られます。各プレミアムユーザーの個人統計ページはそれらの切り口を表示するので、いつ止めるのが賢明かを決められます。',
    analysisParagraph3: '3番目、より目立たない使い方はメタとの比較です。BrawlVisionが、お気に入りのマップで最もプレイしているブロウラーのグローバル勝率が53%で、そのブロウラーでそのマップでの個人勝率が数週間45%にあると伝えるなら、明確な手がかりがあります: あなたはおそらく「そのブロウラーが下手」なのではなく — ドラフトやマップローテーションで何かが失敗しているのです。履歴なしでは質問さえ形成できません。',
    whyTitle: 'アカウントに触れずにどう実現するか',
    whyParagraph1: 'BrawlVisionはあなたのPlayer Tagに対してSupercellの公開APIを読むことでバトルログを同期します。パスワードやゲームの認証情報を求めることはありません — 公式APIはバトルエンドポイントの認証を必要とせず、タグだけです。cronが実行されるたびに、APIが公開する新しいバトル（直近25）をダウンロードし、データベースにあるものと相互参照し、見ていないものだけを保存します。',
    whyParagraph2: 'そのcronは同期がアクティブな限り、手動ステップなしで履歴を最新に保ちます。サービスを一時停止したりプレミアムをキャンセルしても、履歴はそのまま残ります — 私たちは何も削除しません — そして同期の再アクティブ化は止まったところから再開します。完全な方法論（ポーリング頻度、重複処理、保持ポリシー）は方法論ページに文書化されています。',
  },

  zh: {
    analysisTitle: '为什么保存你的历史会改变你的玩法',
    analysisParagraph1: '没有历史，"我在进步"是直觉。你可能花了三周用同一个英雄，感觉自己在进步，但荒野乱斗 API 只显示最近 25 场比赛。最近一天糟糕？应用说你在 tilt。好的一天？相反。两种读法都不是真相。有了一个月的保存历史，最后一天的噪音停止重要，真正的模式（每个英雄、每张地图、每天每小时的胜率）显现。',
    analysisParagraph2: '另一个典型情况是 tilt。连续四败后，大脑倾向于继续选择相同的英雄，希望"扳回来"。每小时历史分解有助于发现这种模式：许多玩家晚上 9 点有正常胜率，过午夜后差 7-8 分。这个观察只能通过比较 25 场比赛中无法容纳的时间样本得出。每个高级用户的个人统计页面显示这些切片，让你决定何时停止更明智。',
    analysisParagraph3: '第三个不太明显的用途是与元的比较。如果 BrawlVision 告诉你在你最喜欢的地图上你最常玩的英雄的全球胜率为 53%，但你用那个英雄在那张地图上的个人胜率几周以来一直是 45%，你就有了明确的线索：你可能不是"用那个英雄不行"——你的 draft 或地图轮换中有什么东西在让你失败。没有历史，你甚至无法形成问题。',
    whyTitle: '我们如何在不触碰你的账户的情况下做到',
    whyParagraph1: 'BrawlVision 通过对你的 Player Tag 读取 Supercell 的公开 API 来同步你的战斗日志。我们从不询问密码或游戏凭据 — 官方 API 不需要战斗端点的身份验证，只需要标签。每次 cron 运行时，它都会下载 API 暴露的新战斗（最近 25 场），与我们数据库中已有的内容交叉引用，并仅保存我们尚未看到的内容。',
    whyParagraph2: '只要同步处于激活状态，该 cron 就会无需手动步骤地保持你的历史最新。如果你暂停服务或取消高级，你的历史保持原样 — 我们不删除任何内容 — 重新激活同步会从停止的地方继续。完整的方法论（轮询频率、重复处理、保留策略）记录在方法论页面上。',
  },
}

let totalAdditions = 0
for (const locale of LOCALES) {
  const filePath = path.join(__dirname, '..', 'messages', `${locale}.json`)
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!data.battleHistory) data.battleHistory = {}
  const ns = TRANSLATIONS[locale]
  if (!ns) {
    console.warn(`  ${locale.padEnd(3)}  SKIP — no translation defined`)
    continue
  }
  Object.assign(data.battleHistory, ns)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  totalAdditions += Object.keys(ns).length
  console.log(`  ${locale.padEnd(3)}  battleHistory editorial keys (${Object.keys(ns).length})`)
}
console.log(`\n✓ ${LOCALES.length}/${LOCALES.length} locales updated`)
console.log(`  Total: ${totalAdditions} key-additions`)
