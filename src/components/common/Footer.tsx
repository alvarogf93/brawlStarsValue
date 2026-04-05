import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')

  return (
    <footer className="w-full py-6 px-4 text-center text-sm font-['Inter'] font-semibold text-white bg-[#121A2F] border-t-4 border-[#0F172A] relative z-40 shadow-[0_-4px_0_0_rgba(18,26,47,0.1)]">
      <p className="max-w-lg mx-auto leading-relaxed">
        {t('disclaimerBefore')}
        <a 
          href="https://supercell.com/en/fan-content-policy/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[var(--color-brawl-sky)] hover:text-white underline decoration-2 underline-offset-2 transition-colors mx-1 font-['Lilita_One']"
        >
          {t('disclaimerLink')}
        </a>
        {t('disclaimerAfter')}
      </p>
    </footer>
  )
}
