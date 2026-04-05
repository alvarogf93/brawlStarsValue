import { useTranslations } from 'next-intl'

export default function SharePage() {
  const t = useTranslations('nav')
  const st = useTranslations('share')
  
  return (
    <div className="w-full animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[var(--color-brawl-gold)] to-[var(--color-brawl-purple)] flex items-center justify-center p-0.5">
          <div className="w-full h-full bg-[var(--color-brawl-dark)] rounded-[10px] flex items-center justify-center">
            <span className="text-xl">📤</span>
          </div>
        </div>
        <h2 className="text-3xl font-bold font-['Righteous']">{t('share')}</h2>
      </div>
      
      <div className="glass p-8 rounded-2xl border-white/5 flex flex-col items-center max-w-md mx-auto">
        <p className="text-slate-300 font-['Inter'] mb-6 text-center">{st('title')}</p>
        <button className="w-full h-12 bg-white/10 hover:bg-[var(--color-brawl-blue)] hover:border-transparent transition-colors text-white font-semibold rounded-xl border border-white/20">
          {st('button')}
        </button>
      </div>
    </div>
  )
}
