const fs = require('fs');

const hooks = {
  es: [
    { hook: 'Bro, ¿otra skin más? En serio. Por lo mismo tienes un sistema que guarda TODAS tus partidas y cada día es más listo. Tú decides: parecer pro o jugar como uno de verdad.', sub: 'No es un gasto. Es dejar de regalar copas.' },
    { hook: 'Ya tienes todos los brawlers al 11, todas las skins, todo el oro del mundo. ¿Y ahora qué? Ahora empieza lo bueno: saber de verdad cómo juegas.', sub: 'El único upgrade que no viene en el Brawl Pass.' },
    { hook: 'Ese Kenji que te reventó 4 veces seguidas no es mejor que tú. Solo sabe qué jugar y cuándo. Ahora tú también vas a saberlo.', sub: 'Menos skins, más wins.' },
    { hook: 'Llevas 3 temporadas comprando el Brawl Pass y sigues en las mismas copas. Un León te mata, un Spike te destroza y tú sin saber ni qué pick elegir. Se acabó.', sub: 'Tu ventaja injusta empieza aquí.' },
    { hook: 'Te has gastado más en skins que en comer este mes y sigues perdiendo contra el mismo Mortis. ¿Y si por una vez gastas en algo que te haga GANAR?', sub: 'Cada derrota analizada es una derrota que no se repite.' },
    { hook: 'Pierdes y no sabes por qué. Ganas y no sabes cómo repetirlo. Aquí se acaba el misterio: cada partida guardada, cada rival analizado, cada error visible.', sub: 'Dejar de perder no es suerte. Es información.' },
    { hook: 'Tu colega con skins de default te gana porque sabe qué brawler jugar en cada mapa. Tú tienes 200 skins y ni idea de por qué un Edgar random te elimina siempre. Aquí lo vas a descubrir.', sub: 'Tus datos. Tu verdad. Sin excusas.' },
    { hook: '¿Cuánto vales realmente en Brawl Stars? No tus copas, no tus skins — tu nivel real. Aquí lo descubres. Y te aviso: a veces duele.', sub: 'Si ya maxeaste la cuenta, esto es lo que falta.' },
    { hook: 'Cuando tu colega te diga que es mejor que tú, enséñale los datos. Win rate real, matchups, historial completo. A ver quién habla ahora.', sub: 'Los datos no mienten. Tu colega sí.' },
  ],
  en: [
    { hook: "Bro, another skin? Seriously. For the same price you get a system that saves ALL your matches and gets smarter every day. Your call: look pro or play like one.", sub: "It's not spending. It's stop giving away trophies." },
    { hook: "You've got every brawler at 11, every skin, all the gold. Now what? Now the real game starts: knowing how you actually play.", sub: "The only upgrade the Brawl Pass can't give you." },
    { hook: "That Kenji who wrecked you 4 times in a row isn't better than you. He just knows what to pick and when. Now you will too.", sub: "Less skins, more wins." },
    { hook: "3 seasons buying the Brawl Pass and you're still stuck at the same trophies. A Leon kills you, a Spike shreds you and you don't even know what to pick. It's over.", sub: "Your unfair advantage starts here." },
    { hook: "You've spent more on skins than on food this month and you're still losing to the same Mortis. What if for once you spend on something that makes you WIN?", sub: "Every analyzed defeat is a defeat that won't repeat." },
    { hook: "You lose and don't know why. You win and can't repeat it. Mystery solved: every match saved, every rival analyzed, every mistake visible.", sub: "Stopping losses isn't luck. It's information." },
    { hook: "Your friend with default skins beats you because he knows what brawler to play on each map. You have 200 skins and no idea why a random Edgar keeps killing you. You'll find out here.", sub: "Your data. Your truth. No excuses." },
    { hook: "How much are you really worth in Brawl Stars? Not your trophies, not your skins — your real level. Find out here. Fair warning: sometimes it hurts.", sub: "If you've maxed your account, this is what's missing." },
    { hook: "When your friend says he's better than you, show him the data. Real win rate, matchups, full history. Let's see who talks now.", sub: "Data doesn't lie. Your friend does." },
  ],
  fr: [
    { hook: "Bro, encore un skin ? Sérieux. Pour le même prix t'as un système qui garde TOUTES tes parties et qui devient plus malin chaque jour. À toi de choisir : avoir l'air pro ou jouer comme un vrai.", sub: "C'est pas une dépense. C'est arrêter de donner des trophées." },
    { hook: "T'as tous les brawlers au 11, tous les skins, tout l'or du monde. Et maintenant ? Maintenant le vrai jeu commence : savoir comment tu joues vraiment.", sub: "Le seul upgrade que le Brawl Pass peut pas te donner." },
    { hook: "Ce Kenji qui t'a détruit 4 fois de suite n'est pas meilleur que toi. Il sait juste quoi jouer et quand. Maintenant toi aussi tu vas le savoir.", sub: "Moins de skins, plus de wins." },
    { hook: "3 saisons à acheter le Brawl Pass et t'es toujours au même nombre de trophées. Un Léon te tue, un Spike te déchire et toi tu sais même pas quoi pick. C'est fini.", sub: "Ton avantage injuste commence ici." },
    { hook: "T'as dépensé plus en skins qu'en bouffe ce mois-ci et tu perds toujours contre le même Mortis. Et si pour une fois tu dépenses pour quelque chose qui te fait GAGNER ?", sub: "Chaque défaite analysée est une défaite qui ne se répétera pas." },
    { hook: "Tu perds et tu sais pas pourquoi. Tu gagnes et tu sais pas comment le refaire. Mystère résolu : chaque partie gardée, chaque rival analysé.", sub: "Arrêter de perdre c'est pas de la chance. C'est de l'info." },
    { hook: "Ton pote avec les skins par défaut te bat parce qu'il sait quel brawler jouer sur chaque map. Toi t'as 200 skins et aucune idée de pourquoi un Edgar random te détruit. Tu vas le découvrir ici.", sub: "Tes données. Ta vérité. Sans excuses." },
    { hook: "Tu vaux combien vraiment sur Brawl Stars ? Pas tes trophées, pas tes skins — ton vrai niveau. Découvre-le ici. Attention : parfois ça fait mal.", sub: "Si t'as déjà tout maxé, c'est ce qui te manque." },
    { hook: "Quand ton pote dit qu'il est meilleur que toi, montre-lui les données. Win rate réel, matchups, historique complet. On verra qui parle maintenant.", sub: "Les données mentent pas. Ton pote si." },
  ],
};

// For other locales, use English as base (they can be refined later)
const otherLocales = ['pt', 'de', 'it', 'ru', 'tr', 'pl', 'ar', 'ko', 'ja', 'zh'];

for (const locale of Object.keys(hooks)) {
  const path = 'messages/' + locale + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  // Store as arrays
  data.premium.hooks = hooks[locale].map(h => h.hook);
  data.premium.hookSubs = hooks[locale].map(h => h.sub);
  // Remove old single hooks
  delete data.premium.hookLine1;
  delete data.premium.hookLine2;
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log('Updated', locale);
}

// Other locales get English version
for (const locale of otherLocales) {
  const path = 'messages/' + locale + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  data.premium.hooks = hooks.en.map(h => h.hook);
  data.premium.hookSubs = hooks.en.map(h => h.sub);
  delete data.premium.hookLine1;
  delete data.premium.hookLine2;
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log('Updated', locale, '(en fallback)');
}
