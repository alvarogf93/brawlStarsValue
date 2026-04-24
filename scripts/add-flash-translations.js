#!/usr/bin/env node
/**
 * Adds the `flash` translation namespace across all 13 locales — powers
 * the UrlFlashMessage component that surfaces auth/payment/upgrade
 * status from the URL query string.
 *
 * Keys: flash.authError, flash.paymentError, flash.upgraded.
 *
 * Idempotent: safe to re-run.
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')

const FLASH = {
  es: {
    authError: 'No pudimos iniciar sesión. Inténtalo de nuevo.',
    paymentError: 'El pago no se completó. Vuelve a intentarlo o escríbenos si crees que es un error.',
    upgraded: '¡Bienvenido a Premium! Historial ilimitado activado.',
  },
  en: {
    authError: "Sign-in failed. Please try again.",
    paymentError: "Payment didn't go through. Try again or contact us if you think this is an error.",
    upgraded: 'Welcome to Premium! Unlimited battle history unlocked.',
  },
  fr: {
    authError: "La connexion a échoué. Réessaie s'il te plaît.",
    paymentError: "Le paiement n'a pas abouti. Réessaie ou contacte-nous si tu penses que c'est une erreur.",
    upgraded: 'Bienvenue sur Premium ! Historique illimité activé.',
  },
  pt: {
    authError: 'Não foi possível entrar. Tente novamente.',
    paymentError: 'O pagamento não foi concluído. Tente novamente ou entre em contato se achar que é um erro.',
    upgraded: 'Bem-vindo ao Premium! Histórico ilimitado ativado.',
  },
  de: {
    authError: 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.',
    paymentError: 'Die Zahlung wurde nicht abgeschlossen. Versuch es erneut oder melde dich, falls du das für einen Fehler hältst.',
    upgraded: 'Willkommen bei Premium! Unbegrenzter Kampfverlauf freigeschaltet.',
  },
  it: {
    authError: 'Accesso non riuscito. Riprova.',
    paymentError: 'Il pagamento non è andato a buon fine. Riprova o contattaci se pensi che sia un errore.',
    upgraded: 'Benvenuto nel Premium! Cronologia illimitata attivata.',
  },
  ru: {
    authError: 'Не удалось войти. Попробуй ещё раз.',
    paymentError: 'Оплата не прошла. Попробуй снова или напиши нам, если считаешь это ошибкой.',
    upgraded: 'Добро пожаловать в Premium! Безлимитная история включена.',
  },
  tr: {
    authError: 'Giriş başarısız. Lütfen tekrar dene.',
    paymentError: 'Ödeme tamamlanmadı. Tekrar dene ya da hata olduğunu düşünüyorsan bize yaz.',
    upgraded: "Premium'a hoş geldin! Sınırsız savaş geçmişi açıldı.",
  },
  pl: {
    authError: 'Nie udało się zalogować. Spróbuj ponownie.',
    paymentError: 'Płatność nie została zrealizowana. Spróbuj ponownie lub napisz do nas, jeśli uważasz, że to błąd.',
    upgraded: 'Witaj w Premium! Nielimitowana historia walk aktywna.',
  },
  ar: {
    authError: 'فشل تسجيل الدخول. الرجاء المحاولة مرة أخرى.',
    paymentError: 'لم يكتمل الدفع. حاول مرة أخرى أو راسلنا إذا كنت تعتقد أن هذا خطأ.',
    upgraded: 'مرحباً بك في البريميوم! تم تفعيل السجل غير المحدود.',
  },
  ko: {
    authError: '로그인에 실패했습니다. 다시 시도해 주세요.',
    paymentError: '결제가 완료되지 않았습니다. 다시 시도하거나 오류라고 생각되면 문의해 주세요.',
    upgraded: '프리미엄에 오신 것을 환영합니다! 무제한 전투 기록이 활성화되었습니다.',
  },
  ja: {
    authError: 'ログインに失敗しました。もう一度お試しください。',
    paymentError: '支払いが完了しませんでした。もう一度お試しいただくか、エラーだと思われる場合はご連絡ください。',
    upgraded: 'プレミアムへようこそ！無制限のバトル履歴が有効になりました。',
  },
  zh: {
    authError: '登录失败，请重试。',
    paymentError: '支付未完成。请重试，或如果你认为这是错误请联系我们。',
    upgraded: '欢迎加入高级会员！无限战斗历史已激活。',
  },
}

const KEYS = ['authError', 'paymentError', 'upgraded']

let updatedCount = 0
let unchangedCount = 0
const missingFiles = []

for (const [locale, copy] of Object.entries(FLASH)) {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`)
  if (!fs.existsSync(filePath)) {
    missingFiles.push(locale)
    continue
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)

  const existing = data.flash ?? {}
  const allMatch = KEYS.every((k) => existing[k] === copy[k])
  data.flash = { ...existing, ...copy }

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
