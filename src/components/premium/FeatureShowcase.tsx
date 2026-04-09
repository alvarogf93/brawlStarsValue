'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'

const PREVIEWS = [
  { src: '/assets/premium-previews/overview.webp', captionKey: 'previewCaption1' as const },
  { src: '/assets/premium-previews/performance.webp', captionKey: 'previewCaption2' as const },
  { src: '/assets/premium-previews/matchups.webp', captionKey: 'previewCaption3' as const },
] as const

export function FeatureShowcase() {
  const t = useTranslations('subscribe')

  return (
    <div className="space-y-4">
      {PREVIEWS.map(({ src, captionKey }) => (
        <div key={captionKey} className="brawl-card-dark overflow-hidden border-[#090E17]">
          <div className="relative aspect-video w-full bg-[#0F172A]">
            <Image
              src={src}
              alt={t(captionKey)}
              fill
              className="object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
          <p className="px-4 py-3 font-['Lilita_One'] text-sm text-slate-300">{t(captionKey)}</p>
        </div>
      ))}
    </div>
  )
}
