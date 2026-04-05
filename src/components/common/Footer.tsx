import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')

  return (
    <footer className="w-full py-6 px-4 text-center text-xs text-slate-500 border-t border-white/5 bg-[var(--color-brawl-dark)] font-['Inter'] relative z-10">
      <p className="max-w-lg mx-auto leading-relaxed">
        {t.rich('disclaimer', {
          link: (chunks) => (
            <a
              href="https://supercell.com/en/fan-content-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline hover:text-[var(--color-brawl-blue)] transition-colors"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </footer>
  )
}
