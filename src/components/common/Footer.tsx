import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')

  return (
    <footer className="shrink-0 w-full py-2 px-4 text-center text-[10px] font-['Inter'] text-slate-400 bg-[#0F172A] border-t-2 border-[#030712] z-50">
      <p className="max-w-2xl mx-auto leading-snug">
        {t('disclaimerBefore')}
        <a
          href="https://supercell.com/en/fan-content-policy/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-brawl-sky)] hover:text-white underline underline-offset-2 transition-colors mx-0.5"
        >
          {t('disclaimerLink')}
        </a>
        {t('disclaimerAfter')}
      </p>
    </footer>
  )
}
