'use client'

import { useTranslations } from 'next-intl'

interface ErrorProps {
  error: Error & { digest?: string }
  unstable_retry: () => void
}

export default function Error({ unstable_retry }: ErrorProps) {
  const t = useTranslations('errorPage')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A101D]">
      <div className="text-center p-8 max-w-md">
        <div className="text-8xl mb-4">⚠️</div>
        <h1 className="text-3xl font-['Lilita_One'] text-red-400 mb-4">{t('title')}</h1>
        <p className="text-slate-400 mb-8 font-['Inter']">{t('description')}</p>
        <button
          onClick={unstable_retry}
          className="brawl-button px-8 py-3 text-lg"
        >
          {t('retry')}
        </button>
      </div>
    </div>
  )
}
