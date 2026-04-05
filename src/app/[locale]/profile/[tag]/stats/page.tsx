import { useTranslations } from 'next-intl'

export default function StatsPage() {
  const t = useTranslations('nav')
  
  return (
    <div className="w-full animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[var(--color-brawl-blue)] to-[var(--color-brawl-purple)] flex items-center justify-center p-0.5">
          <div className="w-full h-full bg-[var(--color-brawl-dark)] rounded-[10px] flex items-center justify-center">
            <span className="text-xl">📊</span>
          </div>
        </div>
        <h2 className="text-3xl font-bold font-['Righteous']">{t('stats')}</h2>
      </div>
      
      <div className="glass p-8 rounded-2xl border-white/5 border-dashed">
        <p className="text-slate-400 font-['Inter']">Detailed stats breakdown coming next sprint.</p>
      </div>
    </div>
  )
}
