const fs = require('fs');
const translations = {
  es: {
    hookLine1: '¿Ya pagas por otra skin más? Por el mismo precio, lleva tu juego al siguiente nivel.',
    hookLine2: 'Analíticas que mejoran cuanto más juegas. El Brawl Pass siempre es lo mismo — esto crece contigo día a día.',
  },
  en: {
    hookLine1: 'Already paying for yet another skin? For the same price, take your game to the next level.',
    hookLine2: 'Analytics that improve the more you play. The Brawl Pass is always the same — this grows with you every day.',
  },
  fr: {
    hookLine1: 'Tu paies déjà pour un autre skin ? Pour le même prix, passe au niveau supérieur.',
    hookLine2: "Des analyses qui s'améliorent plus tu joues. Le Brawl Pass est toujours pareil — ceci grandit avec toi.",
  },
  pt: {
    hookLine1: 'Já paga por mais uma skin? Pelo mesmo preço, leve seu jogo ao próximo nível.',
    hookLine2: 'Analíticas que melhoram quanto mais você joga. O Brawl Pass é sempre igual — isto cresce com você.',
  },
  de: {
    hookLine1: 'Zahlst du schon für noch einen Skin? Zum gleichen Preis — bring dein Spiel aufs nächste Level.',
    hookLine2: 'Analysen, die besser werden, je mehr du spielst. Der Brawl Pass ist immer gleich — das hier wächst mit dir.',
  },
  it: {
    hookLine1: 'Paghi già per un\'altra skin? Allo stesso prezzo, porta il tuo gioco al livello successivo.',
    hookLine2: 'Analisi che migliorano più giochi. Il Brawl Pass è sempre uguale — questo cresce con te ogni giorno.',
  },
  ru: {
    hookLine1: 'Уже платишь за очередной скин? За ту же цену — выведи игру на новый уровень.',
    hookLine2: 'Аналитика, которая улучшается с каждой игрой. Brawl Pass всегда одинаковый — это растёт вместе с тобой.',
  },
  tr: {
    hookLine1: 'Zaten başka bir kostüm için ödüyor musun? Aynı fiyata oyununu bir üst seviyeye taşı.',
    hookLine2: 'Oynadıkça gelişen analizler. Brawl Pass hep aynı — bu seninle birlikte büyür.',
  },
  pl: {
    hookLine1: 'Już płacisz za kolejny skin? Za tę samą cenę przenieś swoją grę na wyższy poziom.',
    hookLine2: 'Analizy, które się poprawiają, im więcej grasz. Brawl Pass jest zawsze taki sam — to rośnie z tobą.',
  },
  ar: {
    hookLine1: 'تدفع بالفعل مقابل سكن آخر؟ بنفس السعر، ارتقِ بلعبتك للمستوى التالي.',
    hookLine2: 'تحليلات تتحسن كلما لعبت أكثر. الباص دائماً نفسه — هذا ينمو معك يومياً.',
  },
  ko: {
    hookLine1: '또 다른 스킨에 돈을 쓰고 있나요? 같은 가격으로 게임을 다음 레벨로 끌어올리세요.',
    hookLine2: '플레이할수록 좋아지는 분석. 브롤 패스는 항상 같지만 — 이것은 매일 성장합니다.',
  },
  ja: {
    hookLine1: 'また新しいスキンにお金を使ってる？同じ価格でゲームを次のレベルへ。',
    hookLine2: 'プレイするほど良くなるアナリティクス。ブロウルパスはいつも同じ — これは毎日成長する。',
  },
  zh: {
    hookLine1: '又要花钱买皮肤？同样的价格，把你的游戏提升到下一个级别。',
    hookLine2: '玩得越多分析越好。通行证永远一样 — 这个系统与你一起成长。',
  },
};

for (const [locale, texts] of Object.entries(translations)) {
  const path = 'messages/' + locale + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  Object.assign(data.premium, texts);
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
console.log('13/13 locales updated with hook translations');
