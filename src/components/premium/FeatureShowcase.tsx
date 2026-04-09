'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PREVIEWS = [
  { src: '/assets/premium-previews/carousel-1-overview.jpg', captionKey: 'previewCaption1' as const },
  { src: '/assets/premium-previews/carousel-2-performance.jpg', captionKey: 'previewCaption2' as const },
  { src: '/assets/premium-previews/carousel-3-team.jpg', captionKey: 'previewCaption3' as const },
  { src: '/assets/premium-previews/carousel-4-trends.jpg', captionKey: 'previewCaption4' as const },
  { src: '/assets/premium-previews/carousel-5-metapro.jpg', captionKey: 'previewCaption5' as const },
] as const

export function FeatureShowcase() {
  const t = useTranslations('subscribe')
  const [current, setCurrent] = useState(0)

  const prev = () => setCurrent(i => (i === 0 ? PREVIEWS.length - 1 : i - 1))
  const next = () => setCurrent(i => (i === PREVIEWS.length - 1 ? 0 : i + 1))

  return (
    <div className="brawl-card-dark overflow-hidden border-[#090E17]">
      {/* Carousel */}
      <div className="relative">
        <div className="aspect-video w-full bg-[#0F172A] overflow-hidden">
          <img
            src={PREVIEWS[current].src}
            alt={t(PREVIEWS[current].captionKey)}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Nav arrows */}
        <button
          onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {PREVIEWS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current
                  ? 'bg-[#FFC91B] w-5'
                  : 'bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Caption */}
      <p className="px-4 py-3 font-['Lilita_One'] text-sm text-slate-300">
        {t(PREVIEWS[current].captionKey)}
      </p>
    </div>
  )
}
