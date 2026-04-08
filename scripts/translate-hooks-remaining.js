const fs = require('fs');

// Translations for the 10 remaining locales (pt, de, it, ru, tr, pl, ar, ko, ja, zh)
const translations = {
  pt: {
    hooks: [
      "Bro, mais uma skin? Sério. Pelo mesmo preço tens um sistema que guarda TODAS as tuas partidas e fica mais esperto a cada dia. Tu decides: parecer pro ou jogar como um de verdade.",
      "Já tens todos os brawlers no 11, todas as skins, todo o ouro do mundo. E agora? Agora começa o bom: saber como realmente jogas.",
      "Aquele Kenji que te destruiu 4 vezes seguidas não é melhor que tu. Só sabe o que jogar e quando. Agora tu também vais saber.",
      "3 temporadas a comprar o Brawl Pass e continuas nas mesmas troféus. Um León te mata, um Spike te destrói e tu sem saber nem que pick escolher. Acabou.",
      "Gastaste mais em skins do que em comida este mês e continuas a perder contra o mesmo Mortis. E se por uma vez gastas em algo que te faça GANHAR?",
      "Perdes e não sabes porquê. Ganhas e não sabes como repetir. Aqui acaba o mistério: cada partida guardada, cada rival analisado, cada erro visível.",
      "O teu amigo com skins default ganha-te porque sabe que brawler jogar em cada mapa. Tu tens 200 skins e nem ideia de porquê um Edgar random te elimina sempre. Aqui vais descobrir.",
      "Quanto realmente vales no Brawl Stars? Não os teus troféus, não as tuas skins — o teu nível real. Descobre aqui. Aviso: às vezes dói.",
      "Quando o teu amigo disser que é melhor que tu, mostra-lhe os dados. Win rate real, matchups, histórico completo. Vamos ver quem fala agora.",
    ],
    hookSubs: [
      "Não é um gasto. É deixar de dar troféus.",
      "O único upgrade que não vem no Brawl Pass.",
      "Menos skins, mais wins.",
      "A tua vantagem injusta começa aqui.",
      "Cada derrota analisada é uma derrota que não se repete.",
      "Deixar de perder não é sorte. É informação.",
      "Os teus dados. A tua verdade. Sem desculpas.",
      "Se já maxaste a conta, isto é o que falta.",
      "Os dados não mentem. O teu amigo sim.",
    ],
  },
  de: {
    hooks: [
      "Bro, noch ein Skin? Ernsthaft. Für den gleichen Preis bekommst du ein System, das ALLE deine Spiele speichert und jeden Tag schlauer wird. Du entscheidest: Pro aussehen oder wie einer spielen.",
      "Du hast alle Brawler auf 11, alle Skins, alles Gold der Welt. Und jetzt? Jetzt fängt das Gute an: wissen, wie du wirklich spielst.",
      "Der Kenji, der dich 4 Mal hintereinander zerstört hat, ist nicht besser als du. Er weiß nur, was er spielen soll und wann. Jetzt weißt du es auch.",
      "3 Seasons Brawl Pass gekauft und immer noch die gleichen Trophäen. Ein Leon killt dich, ein Spike zerfetzt dich und du weißt nicht mal, was du picken sollst. Schluss damit.",
      "Du hast diesen Monat mehr für Skins als für Essen ausgegeben und verlierst immer noch gegen den gleichen Mortis. Was wenn du einmal für etwas ausgibst, das dich GEWINNEN lässt?",
      "Du verlierst und weißt nicht warum. Du gewinnst und kannst es nicht wiederholen. Rätsel gelöst: jedes Spiel gespeichert, jeder Gegner analysiert, jeder Fehler sichtbar.",
      "Dein Kumpel mit Default-Skins schlägt dich, weil er weiß, welchen Brawler er auf jeder Map spielen muss. Du hast 200 Skins und keine Ahnung, warum ein random Edgar dich immer killt. Hier findest du es raus.",
      "Was bist du wirklich wert in Brawl Stars? Nicht deine Trophäen, nicht deine Skins — dein echtes Level. Finde es hier heraus. Warnung: manchmal tut es weh.",
      "Wenn dein Kumpel sagt, er ist besser als du, zeig ihm die Daten. Echte Win-Rate, Matchups, kompletter Verlauf. Mal sehen, wer jetzt redet.",
    ],
    hookSubs: [
      "Kein Ausgeben. Aufhören, Trophäen zu verschenken.",
      "Das einzige Upgrade, das nicht im Brawl Pass kommt.",
      "Weniger Skins, mehr Wins.",
      "Dein unfairer Vorteil beginnt hier.",
      "Jede analysierte Niederlage wiederholt sich nicht.",
      "Aufhören zu verlieren ist kein Glück. Es ist Information.",
      "Deine Daten. Deine Wahrheit. Keine Ausreden.",
      "Wenn du alles gemaxt hast, fehlt noch das hier.",
      "Daten lügen nicht. Dein Kumpel schon.",
    ],
  },
};

// For remaining locales without custom translations, keep English
const keepEnglish = ['it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'];

for (const [locale, data] of Object.entries(translations)) {
  const path = 'messages/' + locale + '.json';
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  json.premium.hooks = data.hooks;
  json.premium.hookSubs = data.hookSubs;
  fs.writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log('Translated:', locale);
}

console.log('Remaining locales keep EN:', keepEnglish.join(', '));
