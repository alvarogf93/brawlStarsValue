const fs = require('fs');
const path = require('path');

const ANALYTICS = {
  es: { title: 'Analytics', loading: 'Cargando analytics...', premiumOnly: 'Exclusivo para Premium', winRateByMode: 'Win Rate por Modo', winRateByBrawler: 'Win Rate por Brawler', bestTeammates: 'Mejores Companeros', sortGames: 'Partidas', sortWR: 'Win Rate', games: 'partidas', winRate: 'Win Rate', trophies: 'Trofeos', battles: 'Batallas', totalBattles: '{count} batallas analizadas' },
  en: { title: 'Analytics', loading: 'Loading analytics...', premiumOnly: 'Premium exclusive', winRateByMode: 'Win Rate by Mode', winRateByBrawler: 'Win Rate by Brawler', bestTeammates: 'Best Teammates', sortGames: 'Games', sortWR: 'Win Rate', games: 'games', winRate: 'Win Rate', trophies: 'Trophies', battles: 'Battles', totalBattles: '{count} battles analyzed' },
  fr: { title: 'Analytics', loading: 'Chargement...', premiumOnly: 'Exclusif Premium', winRateByMode: 'Taux de victoire par Mode', winRateByBrawler: 'Taux de victoire par Brawler', bestTeammates: 'Meilleurs Coequipiers', sortGames: 'Parties', sortWR: 'Taux', games: 'parties', winRate: 'Taux de victoire', trophies: 'Trophees', battles: 'Combats', totalBattles: '{count} combats analyses' },
  pt: { title: 'Analytics', loading: 'Carregando...', premiumOnly: 'Exclusivo Premium', winRateByMode: 'Taxa de Vitoria por Modo', winRateByBrawler: 'Taxa de Vitoria por Brawler', bestTeammates: 'Melhores Companheiros', sortGames: 'Jogos', sortWR: 'Taxa', games: 'jogos', winRate: 'Taxa de Vitoria', trophies: 'Trofeus', battles: 'Batalhas', totalBattles: '{count} batalhas analisadas' },
  de: { title: 'Analytics', loading: 'Laden...', premiumOnly: 'Nur fuer Premium', winRateByMode: 'Siegesrate nach Modus', winRateByBrawler: 'Siegesrate nach Brawler', bestTeammates: 'Beste Teamkameraden', sortGames: 'Spiele', sortWR: 'Rate', games: 'Spiele', winRate: 'Siegesrate', trophies: 'Trophaeen', battles: 'Kaempfe', totalBattles: '{count} Kaempfe analysiert' },
  it: { title: 'Analytics', loading: 'Caricamento...', premiumOnly: 'Esclusivo Premium', winRateByMode: '% Vittoria per Modalita', winRateByBrawler: '% Vittoria per Brawler', bestTeammates: 'Migliori Compagni', sortGames: 'Partite', sortWR: 'Percentuale', games: 'partite', winRate: '% Vittoria', trophies: 'Trofei', battles: 'Battaglie', totalBattles: '{count} battaglie analizzate' },
  ru: { title: 'Аналитика', loading: 'Загрузка...', premiumOnly: 'Только для Премиум', winRateByMode: 'Винрейт по режиму', winRateByBrawler: 'Винрейт по бравлеру', bestTeammates: 'Лучшие тиммейты', sortGames: 'Игры', sortWR: 'Винрейт', games: 'игр', winRate: 'Винрейт', trophies: 'Трофеи', battles: 'Бои', totalBattles: '{count} боёв проанализировано' },
  tr: { title: 'Analitik', loading: 'Yukleniyor...', premiumOnly: 'Sadece Premium', winRateByMode: 'Moda Gore Kazanma Orani', winRateByBrawler: 'Brawler Gore Kazanma Orani', bestTeammates: 'En Iyi Takim Arkadaslari', sortGames: 'Oyunlar', sortWR: 'Oran', games: 'oyun', winRate: 'Kazanma Orani', trophies: 'Kupalar', battles: 'Savaslar', totalBattles: '{count} savas analiz edildi' },
  pl: { title: 'Analityka', loading: 'Ladowanie...', premiumOnly: 'Tylko Premium', winRateByMode: 'Win Rate wg trybu', winRateByBrawler: 'Win Rate wg brawlera', bestTeammates: 'Najlepsi wspolgracze', sortGames: 'Gry', sortWR: 'WR', games: 'gier', winRate: 'Win Rate', trophies: 'Trofea', battles: 'Bitwy', totalBattles: '{count} bitew przeanalizowanych' },
  ar: { title: 'التحليلات', loading: 'جارِ التحميل...', premiumOnly: 'حصري للبريميوم', winRateByMode: 'معدل الفوز حسب الوضع', winRateByBrawler: 'معدل الفوز حسب البطل', bestTeammates: 'أفضل زملاء الفريق', sortGames: 'مباريات', sortWR: 'معدل', games: 'مباريات', winRate: 'معدل الفوز', trophies: 'الكؤوس', battles: 'المعارك', totalBattles: '{count} معارك محللة' },
  ko: { title: '분석', loading: '로딩 중...', premiumOnly: '프리미엄 전용', winRateByMode: '모드별 승률', winRateByBrawler: '브롤러별 승률', bestTeammates: '최고의 팀원', sortGames: '게임', sortWR: '승률', games: '게임', winRate: '승률', trophies: '트로피', battles: '전투', totalBattles: '{count}개 전투 분석됨' },
  ja: { title: 'アナリティクス', loading: '読み込み中...', premiumOnly: 'プレミアム専用', winRateByMode: 'モード別勝率', winRateByBrawler: 'ブロウラー別勝率', bestTeammates: 'ベストチームメイト', sortGames: '試合', sortWR: '勝率', games: '試合', winRate: '勝率', trophies: 'トロフィー', battles: 'バトル', totalBattles: '{count}バトル分析済み' },
  zh: { title: '数据分析', loading: '加载中...', premiumOnly: '仅限高级版', winRateByMode: '按模式胜率', winRateByBrawler: '按英雄胜率', bestTeammates: '最佳队友', sortGames: '场次', sortWR: '胜率', games: '场', winRate: '胜率', trophies: '奖杯', battles: '战斗', totalBattles: '已分析 {count} 场战斗' },
};

const TEASER = {
  es: { teaserTitle: 'Historial completo', teaserSubtitle: 'Desbloquea historial ilimitado + analytics desde $2.99/mes', upgradeButton: 'Activar Premium', registerButton: 'Crear cuenta gratis' },
  en: { teaserTitle: 'Full battle history', teaserSubtitle: 'Unlock unlimited history + analytics from $2.99/mo', upgradeButton: 'Activate Premium', registerButton: 'Create free account' },
  fr: { teaserTitle: 'Historique complet', teaserSubtitle: 'Historique illimite + analyses a partir de $2.99/mois', upgradeButton: 'Activer Premium', registerButton: 'Creer un compte gratuit' },
  pt: { teaserTitle: 'Historico completo', teaserSubtitle: 'Historico ilimitado + analises a partir de $2.99/mes', upgradeButton: 'Ativar Premium', registerButton: 'Criar conta gratis' },
  de: { teaserTitle: 'Vollstaendiger Verlauf', teaserSubtitle: 'Unbegrenzter Verlauf + Analysen ab $2.99/Monat', upgradeButton: 'Premium aktivieren', registerButton: 'Kostenloses Konto erstellen' },
  it: { teaserTitle: 'Storico completo', teaserSubtitle: 'Storico illimitato + analisi da $2.99/mese', upgradeButton: 'Attiva Premium', registerButton: 'Crea account gratuito' },
  ru: { teaserTitle: 'Полная история', teaserSubtitle: 'Безлимитная история + аналитика от $2.99/мес', upgradeButton: 'Активировать Премиум', registerButton: 'Создать бесплатный аккаунт' },
  tr: { teaserTitle: 'Tam gecmis', teaserSubtitle: 'Sinirsiz gecmis + analizler $2.99/ay', upgradeButton: 'Premium Etkinlestir', registerButton: 'Ucretsiz hesap olustur' },
  pl: { teaserTitle: 'Pelna historia', teaserSubtitle: 'Nieograniczona historia + analizy od $2.99/mies.', upgradeButton: 'Aktywuj Premium', registerButton: 'Utworz darmowe konto' },
  ar: { teaserTitle: 'السجل الكامل', teaserSubtitle: 'سجل غير محدود + تحليلات من $2.99/شهر', upgradeButton: 'تفعيل بريميوم', registerButton: 'إنشاء حساب مجاني' },
  ko: { teaserTitle: '전체 전투 기록', teaserSubtitle: '무제한 기록 + 분석 월 $2.99부터', upgradeButton: '프리미엄 활성화', registerButton: '무료 계정 만들기' },
  ja: { teaserTitle: '完全なバトル履歴', teaserSubtitle: '無制限履歴 + 分析 月$2.99から', upgradeButton: 'プレミアム有効化', registerButton: '無料アカウント作成' },
  zh: { teaserTitle: '完整战斗历史', teaserSubtitle: '解锁无限历史 + 分析 $2.99/月起', upgradeButton: '激活高级版', registerButton: '创建免费账户' },
};

const PRIVACY = {
  es: { title: 'Politica de Privacidad', dataCollectedTitle: 'Datos que recopilamos', dataTag: 'Tu tag de jugador de Brawl Stars', dataBattles: 'Historial de batallas (usuarios Premium)', dataEmail: 'Email de tu cuenta Google (autenticacion)', thirdPartyTitle: 'Datos de otros jugadores', thirdPartyBody: 'Los datos de companeros y rivales provienen de la API publica de Supercell. Se almacenan para analytics agregados.', retentionTitle: 'Retencion de datos', retentionBody: 'Las batallas se conservan indefinidamente, incluso tras la cancelacion.', gdprTitle: 'Derechos GDPR', gdprBody: 'Solicita exportacion o eliminacion en privacy@brawlvision.com.', cookiesTitle: 'Cookies', cookiesBody: 'Usamos localStorage y cookies de Supabase Auth. AdSense usa cookies publicitarias para usuarios gratuitos.', disclaimerTitle: 'Aviso legal', disclaimerBody: 'BrawlVision no esta afiliado con Supercell Oy. Brawl Stars es marca registrada de Supercell.' },
  en: { title: 'Privacy Policy', dataCollectedTitle: 'Data we collect', dataTag: 'Your Brawl Stars player tag', dataBattles: 'Battle history (Premium users)', dataEmail: 'Google account email (authentication)', thirdPartyTitle: 'Third-party player data', thirdPartyBody: 'Teammate and opponent data comes from Supercell public API for aggregate analytics.', retentionTitle: 'Data retention', retentionBody: 'Battles are preserved indefinitely, even after cancellation.', gdprTitle: 'GDPR Rights', gdprBody: 'Request data export or deletion at privacy@brawlvision.com.', cookiesTitle: 'Cookies', cookiesBody: 'We use localStorage and Supabase Auth cookies. AdSense sets ad cookies for free users.', disclaimerTitle: 'Legal disclaimer', disclaimerBody: 'BrawlVision is not affiliated with Supercell Oy. Brawl Stars is a trademark of Supercell.' },
};

const dir = path.join(__dirname, '..', 'messages');
const locales = ['es','en','fr','pt','de','it','ru','tr','pl','ar','ko','ja','zh'];
for (const locale of locales) {
  const filePath = path.join(dir, locale + '.json');
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  content.analytics = ANALYTICS[locale] || ANALYTICS.en;
  content.premium = { ...(content.premium || {}), ...(TEASER[locale] || TEASER.en) };
  content.privacy = PRIVACY[locale] || PRIVACY.en;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
}
console.log('Done: analytics + teaser + privacy added to all 13 locales');
