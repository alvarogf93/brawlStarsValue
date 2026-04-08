const fs = require('fs');

const translations = {
  es: {
    trialWelcome: '¡3 días de PRO gratis!',
    trialWelcomeBody: 'Tus batallas se guardan desde ahora. Aprovecha al máximo.',
    trialBanner: 'Trial PRO: {time} restantes',
    trialBannerUrgent: 'Trial PRO: ¡última hora!',
    trialBannerSubscribe: 'Suscríbete ahora',
    trialExpired: 'Tu trial ha terminado',
    trialExpiredBody: 'Tienes {battles} batallas guardadas. Suscríbete para conservarlas.',
    draftUsesLeft: '{count} drafts gratuitos restantes',
    draftUsesExhausted: 'Has usado tus 3 drafts gratuitos',
    referralTitle: 'Invitar amigo',
    referralBody: 'Comparte tu código y ambos ganáis 3 días PRO',
    referralCopied: '¡Código copiado!',
    referralCount: '{count}/5 invitaciones usadas',
    referralCodeInvalid: 'Código de invitación no válido',
    referralCodePlaceholder: '¿Tienes código de invitación? (opcional)',
    referralSuccess: '¡Tu amigo se unió! +3 días PRO',
    blurUnlock: 'Desbloquea con PRO',
    hookTilt: 'Estás en tilt y no lo sabías',
    hookMastery: 'Tu curva de mejora con {name}',
    hookMatchup: 'Pierdes el {wr}% contra {name}',
    hookMap: 'En {map} dominas al {wr}%',
    hookClutch: 'Como Star Player ganas un {wr}%',
  },
  en: {
    trialWelcome: '3 days PRO free!',
    trialWelcomeBody: 'Your battles are being saved starting now. Make the most of it.',
    trialBanner: 'PRO Trial: {time} remaining',
    trialBannerUrgent: 'PRO Trial: last hour!',
    trialBannerSubscribe: 'Subscribe now',
    trialExpired: 'Your trial has ended',
    trialExpiredBody: 'You have {battles} saved battles. Subscribe to keep them.',
    draftUsesLeft: '{count} free drafts remaining',
    draftUsesExhausted: "You've used your 3 free drafts",
    referralTitle: 'Invite a friend',
    referralBody: 'Share your code and both get 3 days PRO',
    referralCopied: 'Code copied!',
    referralCount: '{count}/5 invitations used',
    referralCodeInvalid: 'Invalid invitation code',
    referralCodePlaceholder: 'Have an invite code? (optional)',
    referralSuccess: 'Your friend joined! +3 days PRO',
    blurUnlock: 'Unlock with PRO',
    hookTilt: "You're tilting and didn't know it",
    hookMastery: 'Your improvement curve with {name}',
    hookMatchup: 'You lose {wr}% against {name}',
    hookMap: 'You dominate {map} at {wr}%',
    hookClutch: 'As Star Player you win {wr}%',
  },
};

// Apply ES and EN, others get EN fallback
const locales = ['es','en','fr','pt','de','it','ru','tr','pl','ar','ko','ja','zh'];
for (const locale of locales) {
  const path = 'messages/' + locale + '.json';
  const data = JSON.parse(fs.readFileSync(path, 'utf8'));
  const texts = translations[locale] || translations.en;
  Object.assign(data.premium, texts);
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
console.log('13/13 locales updated');
