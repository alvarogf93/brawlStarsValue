#!/usr/bin/env node
/**
 * P1 2026-04-24: add `landing.faq` section with 5 Q/A pairs + section
 * title across all 13 locales. Powers the new <FAQSection> component
 * on the landing page and the FAQPage JSON-LD schema emitted alongside
 * it — Google may surface the answers as featured rich-results on the
 * very queries BrawlVision wants to rank for (historial batallas /
 * unlimited history / is it safe to link my account / is it free).
 *
 * Idempotent: re-running overwrites the same keys with the same values.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

// Each locale supplies: sectionTitle + (q1..q5, a1..a5). Exactly 11 keys.
const FAQ = {
  es: {
    sectionTitle: 'Preguntas frecuentes',
    q1: '¿Cuántas batallas guarda Brawl Stars?',
    a1: 'Solo las últimas 25. Después, el juego las borra y no hay forma de recuperarlas desde la app.',
    q2: '¿Cómo ver el historial completo de mis partidas?',
    a2: 'Vincula tu cuenta en BrawlVision y guardamos cada batalla automáticamente desde ese momento. Puedes filtrar por modo, mapa y brawler, y comparar tu evolución semana a semana.',
    q3: '¿Es seguro vincular mi cuenta?',
    a3: 'Sí. Usamos la API oficial de Supercell con solo tu player tag (el código público que aparece bajo tu nombre en el juego). Nunca pedimos contraseña ni acceso al juego.',
    q4: '¿BrawlVision es gratis?',
    a4: 'La consulta de perfil, brawlers y meta es gratis. El historial ilimitado y las analíticas avanzadas están en el plan premium — con 3 días de prueba gratis al registrarte.',
    q5: '¿Funciona para cualquier nivel de trofeos?',
    a5: 'Sí, desde 0 trofeos hasta el top global. La analítica de meta incorpora batallas de jugadores pro para que puedas compararte contra los mejores.',
  },
  en: {
    sectionTitle: 'Frequently asked questions',
    q1: 'How many battles does Brawl Stars save?',
    a1: "Only the last 25. After that, the game deletes them and there's no way to recover them from the app.",
    q2: 'How can I see my complete battle history?',
    a2: 'Link your account in BrawlVision and we automatically save every battle from that moment on. Filter by mode, map and brawler, and compare your evolution week by week.',
    q3: 'Is it safe to link my account?',
    a3: 'Yes. We use the official Supercell API with just your player tag (the public code shown below your name in-game). We never ask for your password or access to the game.',
    q4: 'Is BrawlVision free?',
    a4: 'Profile lookups, brawler stats and meta are free. Unlimited history and advanced analytics are in the premium plan — with 3 days of free trial on sign-up.',
    q5: 'Does it work at any trophy level?',
    a5: 'Yes, from 0 trophies up to the global top. The meta analytics incorporates battles from pro players so you can benchmark yourself against the best.',
  },
  fr: {
    sectionTitle: 'Questions fréquentes',
    q1: 'Combien de combats Brawl Stars sauvegarde-t-il ?',
    a1: "Seulement les 25 derniers. Ensuite, le jeu les supprime et il n'y a aucun moyen de les récupérer depuis l'app.",
    q2: "Comment voir l'historique complet de mes parties ?",
    a2: 'Lie ton compte sur BrawlVision et nous sauvegardons automatiquement chaque combat à partir de ce moment. Filtre par mode, carte et brawler, et compare ton évolution semaine par semaine.',
    q3: 'Est-ce sûr de lier mon compte ?',
    a3: "Oui. Nous utilisons l'API officielle de Supercell avec seulement ton player tag (le code public affiché sous ton nom dans le jeu). Nous ne demandons jamais de mot de passe ni d'accès au jeu.",
    q4: 'BrawlVision est-il gratuit ?',
    a4: "La consultation de profil, brawlers et meta est gratuite. L'historique illimité et les analyses avancées sont dans le plan premium — avec 3 jours d'essai gratuit à l'inscription.",
    q5: "Est-ce que ça marche pour n'importe quel niveau de trophées ?",
    a5: "Oui, de 0 trophée jusqu'au top mondial. L'analyse de meta intègre des combats de joueurs pro pour que tu puisses te comparer aux meilleurs.",
  },
  pt: {
    sectionTitle: 'Perguntas frequentes',
    q1: 'Quantas batalhas o Brawl Stars guarda?',
    a1: 'Apenas as últimas 25. Depois, o jogo as apaga e não há como recuperá-las pelo app.',
    q2: 'Como ver o histórico completo das minhas partidas?',
    a2: 'Vincule sua conta no BrawlVision e guardamos cada batalha automaticamente a partir desse momento. Filtre por modo, mapa e brawler, e compare sua evolução semana a semana.',
    q3: 'É seguro vincular minha conta?',
    a3: 'Sim. Usamos a API oficial da Supercell apenas com seu player tag (o código público mostrado abaixo do seu nome no jogo). Nunca pedimos senha nem acesso ao jogo.',
    q4: 'O BrawlVision é grátis?',
    a4: 'A consulta de perfil, brawlers e meta é gratuita. O histórico ilimitado e as análises avançadas estão no plano premium — com 3 dias de teste grátis ao se cadastrar.',
    q5: 'Funciona para qualquer nível de troféus?',
    a5: 'Sim, de 0 troféus até o top global. A análise de meta incorpora batalhas de jogadores pro para você se comparar com os melhores.',
  },
  de: {
    sectionTitle: 'Häufig gestellte Fragen',
    q1: 'Wie viele Kämpfe speichert Brawl Stars?',
    a1: 'Nur die letzten 25. Danach löscht das Spiel sie und es gibt keine Möglichkeit, sie aus der App wiederherzustellen.',
    q2: 'Wie sehe ich meinen vollständigen Kampfverlauf?',
    a2: 'Verknüpfe dein Konto bei BrawlVision und wir speichern automatisch jeden Kampf ab diesem Moment. Filtere nach Modus, Map und Brawler und vergleiche deine Entwicklung Woche für Woche.',
    q3: 'Ist es sicher, mein Konto zu verknüpfen?',
    a3: 'Ja. Wir nutzen die offizielle Supercell-API nur mit deinem Player Tag (der öffentliche Code unter deinem Namen im Spiel). Wir fragen nie nach deinem Passwort oder Spielzugang.',
    q4: 'Ist BrawlVision kostenlos?',
    a4: 'Profilabfrage, Brawler-Stats und Meta sind kostenlos. Unbegrenzter Verlauf und erweiterte Analysen sind im Premium-Plan — mit 3 Tagen kostenloser Testphase bei der Anmeldung.',
    q5: 'Funktioniert es für jedes Trophäen-Level?',
    a5: 'Ja, von 0 Trophäen bis zur globalen Spitze. Die Meta-Analyse enthält Kämpfe von Pro-Spielern, sodass du dich mit den Besten vergleichen kannst.',
  },
  it: {
    sectionTitle: 'Domande frequenti',
    q1: 'Quante battaglie salva Brawl Stars?',
    a1: "Solo le ultime 25. Dopo, il gioco le cancella e non c'è modo di recuperarle dall'app.",
    q2: 'Come posso vedere la cronologia completa delle mie partite?',
    a2: 'Collega il tuo account a BrawlVision e salveremo automaticamente ogni battaglia da quel momento. Filtra per modalità, mappa e brawler, e confronta la tua evoluzione settimana per settimana.',
    q3: 'È sicuro collegare il mio account?',
    a3: "Sì. Usiamo l'API ufficiale di Supercell solo con il tuo player tag (il codice pubblico mostrato sotto il tuo nome nel gioco). Non chiediamo mai la password o l'accesso al gioco.",
    q4: 'BrawlVision è gratis?',
    a4: 'La consultazione del profilo, brawler e meta è gratuita. La cronologia illimitata e le analisi avanzate sono nel piano premium — con 3 giorni di prova gratuita alla registrazione.',
    q5: 'Funziona per qualsiasi livello di trofei?',
    a5: "Sì, da 0 trofei fino al top globale. L'analisi meta incorpora battaglie di giocatori pro così puoi confrontarti con i migliori.",
  },
  ja: {
    sectionTitle: 'よくある質問',
    q1: 'Brawl Stars は何試合を保存しますか？',
    a1: '直近の25試合のみです。それ以降はゲームが削除し、アプリから復元する方法はありません。',
    q2: 'バトルの完全な履歴を見るには？',
    a2: 'BrawlVision でアカウントを連携すると、その瞬間からすべてのバトルを自動保存します。モード、マップ、ブロウラーでフィルターし、週ごとの進化を比較できます。',
    q3: 'アカウント連携は安全ですか？',
    a3: 'はい。プレイヤータグ（ゲーム内の名前の下に表示される公開コード）のみで Supercell 公式 API を使用します。パスワードやゲームアクセスは一切要求しません。',
    q4: 'BrawlVision は無料ですか？',
    a4: 'プロフィール、ブロウラー、メタの閲覧は無料です。無制限の履歴と高度な分析はプレミアムプランで — 登録時に3日間の無料トライアル付き。',
    q5: 'どのトロフィーレベルでも動作しますか？',
    a5: 'はい、0 トロフィーからグローバルトップまで。メタ分析にはプロプレイヤーのバトルが含まれ、最高の選手と自分を比較できます。',
  },
  ko: {
    sectionTitle: '자주 묻는 질문',
    q1: 'Brawl Stars는 몇 번의 전투를 저장하나요?',
    a1: '최근 25경기만 저장합니다. 이후에는 게임이 삭제하며 앱에서 복구할 방법이 없습니다.',
    q2: '내 전투 기록의 전체 내역을 어떻게 볼 수 있나요?',
    a2: 'BrawlVision에서 계정을 연동하면 그 시점부터 모든 전투를 자동으로 저장합니다. 모드, 맵, 브롤러로 필터링하고 주간 성장 추이를 비교할 수 있습니다.',
    q3: '계정 연동은 안전한가요?',
    a3: '예. 플레이어 태그(게임 내 이름 아래에 표시되는 공개 코드)만으로 Supercell 공식 API를 사용합니다. 비밀번호나 게임 접근 권한은 절대 요청하지 않습니다.',
    q4: 'BrawlVision은 무료인가요?',
    a4: '프로필, 브롤러, 메타 조회는 무료입니다. 무제한 기록과 고급 분석은 프리미엄 플랜에 포함 — 가입 시 3일 무료 체험 제공.',
    q5: '모든 트로피 수준에서 작동하나요?',
    a5: '예, 0 트로피부터 글로벌 탑까지. 메타 분석에는 프로 선수의 전투가 포함되어 최고의 선수들과 자신을 비교할 수 있습니다.',
  },
  zh: {
    sectionTitle: '常见问题',
    q1: 'Brawl Stars 会保存多少场战斗？',
    a1: '仅保存最近 25 场。之后游戏会删除这些记录，从应用内无法恢复。',
    q2: '如何查看我完整的战斗历史？',
    a2: '在 BrawlVision 绑定账号后，从那一刻起我们会自动保存每一场战斗。可按模式、地图和角色筛选，并逐周对比你的进步。',
    q3: '绑定账号安全吗？',
    a3: '安全。我们仅使用你的玩家标签（游戏中名字下方显示的公开代码）通过 Supercell 官方 API 获取数据。从不索要密码或游戏访问权限。',
    q4: 'BrawlVision 免费吗？',
    a4: '档案查询、角色和 meta 数据免费。无限历史和高级分析在高级会员计划中 — 注册即享 3 天免费试用。',
    q5: '任何奖杯水平都能用吗？',
    a5: '可以，从 0 奖杯到全球顶级。Meta 分析包含职业选手的战斗数据，让你能与最强玩家对比。',
  },
  ar: {
    sectionTitle: 'الأسئلة الشائعة',
    q1: 'كم معركة يحفظها Brawl Stars؟',
    a1: 'فقط آخر 25 معركة. بعد ذلك، تقوم اللعبة بحذفها ولا توجد طريقة لاستعادتها من التطبيق.',
    q2: 'كيف يمكنني رؤية السجل الكامل لمعاركي؟',
    a2: 'اربط حسابك في BrawlVision وسنحفظ كل معركة تلقائياً من تلك اللحظة. يمكنك التصفية حسب الوضع والخريطة والبطل، ومقارنة تطورك أسبوعاً بأسبوع.',
    q3: 'هل من الآمن ربط حسابي؟',
    a3: 'نعم. نستخدم API الرسمي لـ Supercell فقط مع player tag الخاص بك (الرمز العام الذي يظهر تحت اسمك في اللعبة). لا نطلب أبداً كلمة المرور أو الوصول إلى اللعبة.',
    q4: 'هل BrawlVision مجاني؟',
    a4: 'البحث عن الملف الشخصي، والأبطال، والميتا مجاني. السجل غير المحدود والتحليلات المتقدمة ضمن الخطة المميزة — مع 3 أيام تجربة مجانية عند التسجيل.',
    q5: 'هل يعمل مع أي مستوى من الكؤوس؟',
    a5: 'نعم، من 0 كأس حتى القمة العالمية. تتضمن تحليلات الميتا معارك اللاعبين المحترفين لتتمكن من مقارنة نفسك بالأفضل.',
  },
  ru: {
    sectionTitle: 'Частые вопросы',
    q1: 'Сколько боёв сохраняет Brawl Stars?',
    a1: 'Только последние 25. После этого игра их удаляет, и вернуть их из приложения нельзя.',
    q2: 'Как посмотреть полную историю моих боёв?',
    a2: 'Привяжи аккаунт к BrawlVision — и мы автоматически сохраняем каждый бой с этого момента. Фильтруй по режиму, карте и бойцу, сравнивай свой прогресс неделя за неделей.',
    q3: 'Безопасно ли привязывать аккаунт?',
    a3: 'Да. Мы используем официальный API Supercell только с твоим player tag (публичный код под твоим именем в игре). Пароль и доступ к игре мы никогда не запрашиваем.',
    q4: 'BrawlVision бесплатный?',
    a4: 'Просмотр профиля, бойцов и меты — бесплатно. Безлимитная история и продвинутая аналитика в премиум-тарифе — с 3 днями бесплатного теста при регистрации.',
    q5: 'Работает ли для любого уровня трофеев?',
    a5: 'Да, от 0 трофеев до глобального топа. Аналитика меты включает бои про-игроков, чтобы ты мог сравниться с лучшими.',
  },
  tr: {
    sectionTitle: 'Sık sorulan sorular',
    q1: 'Brawl Stars kaç savaşı kaydeder?',
    a1: "Sadece son 25'ini. Sonra oyun bunları siler ve uygulama üzerinden geri almanın yolu yoktur.",
    q2: 'Tüm savaş geçmişimi nasıl görebilirim?',
    a2: "Hesabını BrawlVision'a bağla, o andan itibaren her savaşı otomatik olarak kaydediyoruz. Mod, harita ve brawler'a göre filtrele, haftadan haftaya gelişimini karşılaştır.",
    q3: 'Hesabımı bağlamak güvenli mi?',
    a3: "Evet. Sadece player tag'in (oyunda isminin altında görünen herkese açık kod) ile resmi Supercell API'sini kullanıyoruz. Asla şifre ya da oyuna erişim istemiyoruz.",
    q4: 'BrawlVision ücretsiz mi?',
    a4: 'Profil, brawler ve meta sorgulama ücretsizdir. Sınırsız geçmiş ve gelişmiş analizler premium planda — kayıt olduğunda 3 günlük ücretsiz deneme ile birlikte.',
    q5: 'Herhangi bir kupa seviyesi için çalışır mı?',
    a5: 'Evet, 0 kupadan küresel zirveye kadar. Meta analizi, en iyilere karşı kendini karşılaştırabilmen için pro oyuncuların savaşlarını da içerir.',
  },
  pl: {
    sectionTitle: 'Najczęstsze pytania',
    q1: 'Ile walk zapisuje Brawl Stars?',
    a1: 'Tylko ostatnie 25. Potem gra je usuwa i nie ma sposobu na odzyskanie ich z aplikacji.',
    q2: 'Jak zobaczyć pełną historię moich walk?',
    a2: 'Powiąż konto z BrawlVision — automatycznie zapisujemy każdą walkę od tego momentu. Filtruj po trybie, mapie i brawlerze, porównuj postępy tydzień po tygodniu.',
    q3: 'Czy powiązanie konta jest bezpieczne?',
    a3: 'Tak. Używamy oficjalnego API Supercell tylko z twoim player tagiem (publiczny kod pod twoim nickiem w grze). Nigdy nie prosimy o hasło ani dostęp do gry.',
    q4: 'Czy BrawlVision jest darmowy?',
    a4: 'Sprawdzanie profilu, brawlerów i mety jest bezpłatne. Nielimitowana historia i zaawansowane analizy są w planie premium — z 3-dniowym darmowym okresem próbnym po rejestracji.',
    q5: 'Czy działa dla każdego poziomu trofeów?',
    a5: 'Tak, od 0 trofeów po globalny top. Analiza mety zawiera walki zawodowych graczy, abyś mógł porównać się z najlepszymi.',
  },
}

const KEYS = ['sectionTitle', 'q1', 'a1', 'q2', 'a2', 'q3', 'a3', 'q4', 'a4', 'q5', 'a5']

let updatedCount = 0
let unchangedCount = 0
const missingFiles = []

for (const [locale, faq] of Object.entries(FAQ)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    missingFiles.push(locale)
    continue
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)

  if (!data.landing) {
    console.error(`${locale}.json: missing "landing" key — aborting to avoid corruption`)
    process.exit(1)
  }

  const existing = data.landing.faq ?? {}
  const allMatch = KEYS.every((k) => existing[k] === faq[k])

  data.landing.faq = { ...existing, ...faq }

  if (allMatch) {
    unchangedCount++
    console.log(`  ${locale}: no change`)
    continue
  }

  const hadTrailingNewline = raw.endsWith('\n')
  const serialized = JSON.stringify(data, null, 2) + (hadTrailingNewline ? '\n' : '')
  fs.writeFileSync(filePath, serialized, 'utf-8')
  updatedCount++
  console.log(`  ${locale}: updated`)
}

console.log('')
console.log(`Updated:   ${updatedCount}`)
console.log(`Unchanged: ${unchangedCount}`)
if (missingFiles.length > 0) {
  console.log(`Missing files: ${missingFiles.join(', ')}`)
  process.exit(1)
}
