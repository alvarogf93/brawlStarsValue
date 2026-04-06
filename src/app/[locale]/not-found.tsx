import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function NotFound() {
  const t = await getTranslations('notFound')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A101D]">
      <div className="text-center p-8 max-w-md">
        <div className="text-8xl font-['Lilita_One'] text-[#FFC91B] drop-shadow-[0_6px_0_rgba(18,26,47,0.8)] mb-4 block">
          404
        </div>
        <h1 className="text-3xl font-['Lilita_One'] text-white mb-4">{t('title')}</h1>
        <p className="text-slate-400 mb-8 font-['Inter']">{t('description')}</p>
        <Link
          href="/"
          className="brawl-button px-8 py-3 text-lg inline-flex items-center gap-2"
        >
          {t('back')}
        </Link>
      </div>
    </div>
  )
}
