'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { usePlayerData } from '@/hooks/usePlayerData'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'

export default function SharePage() {
  const params = useParams<{ tag: string; locale: string }>()
  const t = useTranslations('share')
  const tProfile = useTranslations('profile')
  const tag = decodeURIComponent(params.tag)
  const locale = params.locale || 'es'
  const { data, isLoading, error } = usePlayerData(tag)
  const [copied, setCopied] = useState(false)

  if (isLoading) {
    return (
      <div className="animate-pulse py-20 text-center">
        <p className="text-slate-400 font-['Lilita_One'] text-2xl">{t('loading')}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || t('error')}</p>
      </div>
    )
  }

  const prestigeCount = data.stats?.totalPrestigeLevel ?? 0
  const shareText = `${t('text', { gems: data.totalGems.toLocaleString(), prestige: prestigeCount.toString() })}`
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + `/${locale}/profile/${encodeURIComponent(tag)}` : ''

  async function handleShare() {
    const shareData = {
      title: t('title'),
      text: shareText,
      url: shareUrl,
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // User cancelled or not supported — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Clipboard failed
    }
  }

  return (
    <div className="space-y-6 flex flex-col items-center pb-10">

      {/* Banner Ad Space */}
      <AdPlaceholder className="mb-6" />

      {/* Share Card Area */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-2deg]">
          {t('flexTitle')}
        </h1>
        <p className="font-['Inter'] font-semibold text-[var(--color-brawl-gold)] mt-2">
          {t('flexSubtitle')}
        </p>
      </div>

      {/* The 9:16 Viral Card Container */}
      <div id="viral-card" className="relative w-[340px] h-[600px] sm:w-[380px] sm:h-[675px] bg-[#121A2F] rounded-[32px] overflow-hidden border-8 border-[var(--color-brawl-dark)] shadow-[0_12px_24px_rgba(0,0,0,0.5)] flex flex-col items-center p-6 mx-auto">

        {/* Dynamic Background Pattern (HTML2Canvas safe implementation) */}
        <div className="absolute inset-0 bg-[#0A101D] z-0 overflow-hidden">
          {/* Base radial gradient for depth */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1C5CF1_0%,transparent_70%)] opacity-80" />
          
          {/* Geometric shards to mimic the "Razor Shield" aesthetic */}
          <div className="absolute top-0 right-0 w-[200%] h-[150%] bg-[#4EC0FA]/10 transform rotate-[30deg] translate-x-1/4 -translate-y-1/4" />
          <div className="absolute bottom-0 left-0 w-[150%] h-[100%] bg-[#F82F41]/10 transform -rotate-[25deg] -translate-x-1/3 translate-y-1/3" />
        </div>

        {/* Holographic Foil Overlay */}
        <div className="absolute inset-0 pointer-events-none z-20" 
             style={{ background: 'linear-gradient(135deg, rgba(255,0,0,0.05) 0%, rgba(255,255,0,0.05) 25%, rgba(0,255,0,0.05) 50%, rgba(0,255,255,0.05) 75%, rgba(0,0,255,0.05) 100%)' }} />
        <div className="absolute inset-0 pointer-events-none z-20" 
             style={{ background: 'linear-gradient(225deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0) 50%)' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center h-full w-full">

          <div 
            className="px-6 py-2 rounded-xl border-[4px] border-[#0D1321] shadow-[0_6px_0_0_#0D1321] transform rotate-[-3deg] mt-6 mb-auto"
            style={{ backgroundColor: (data.player as any)?.nameColor 
                ? ((data.player as any).nameColor.startsWith('0x') 
                    ? '#' + (data.player as any).nameColor.slice(2) 
                    : (data.player as any).nameColor) 
                : '#1C5CF1' }}
          >
            <span className="font-['Lilita_One'] text-white text-2xl drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] text-stroke-brawl tracking-widest uppercase">
              {data.playerName}
            </span>
          </div>

          <div className="text-center mt-auto mb-6 w-full px-4 relative">
            <p className="font-['Lilita_One'] text-[var(--color-brawl-gold)] text-xl tracking-widest uppercase mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {tProfile('gemEquivalent')}
            </p>
            {/* Razor Shield polygon container for main stat */}
            <div className="relative mx-auto w-full max-w-[280px] h-[120px] flex items-center justify-center bg-[#F82F41] shadow-[0_12px_30px_rgba(248,47,65,0.4)] transition-all duration-300"
                 style={{ clipPath: 'polygon(5% 0, 95% 0, 100% 50%, 80% 100%, 20% 100%, 0% 50%)' }}>
              <div className="absolute inset-1 bg-[#121A2F]" style={{ clipPath: 'polygon(5% 0, 95% 0, 100% 50%, 80% 100%, 20% 100%, 0% 50%)' }}>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#2A3B5C_0%,transparent_80%)] opacity-50" />
              </div>
              <h2 className="relative z-10 text-6xl sm:text-7xl font-['Lilita_One'] text-white text-stroke-brawl tracking-wider drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]">
                {data.totalGems.toLocaleString()}
              </h2>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-3 w-full mb-6">
            <div className="bg-[#0A101D]/60 rounded-xl p-3 text-center border-l-4 border-l-yellow-400">
              <p className="font-['Lilita_One'] text-white text-xl drop-shadow-md">{data.player?.trophies.toLocaleString()}</p>
              <p className="text-[9px] text-[#4EC0FA] uppercase font-black tracking-widest">🏆 {tProfile('trophies')}</p>
            </div>
            <div className="bg-[#0A101D]/60 rounded-xl p-3 text-center border-l-4 border-l-red-500">
              <p className="font-['Lilita_One'] text-white text-xl drop-shadow-md">{data.player?.brawlers.length}</p>
              <p className="text-[9px] text-[#4EC0FA] uppercase font-black tracking-widest">👥 {tProfile('brawlerCount')}</p>
            </div>
            <div className="bg-[#0A101D]/60 rounded-xl p-3 text-center border-l-4 border-l-blue-500">
              <p className="font-['Lilita_One'] text-white text-xl drop-shadow-md">P{data.player?.totalPrestigeLevel ?? 0}</p>
              <p className="text-[9px] text-[#4EC0FA] uppercase font-black tracking-widest">👑 {tProfile('prestige')}</p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-center bg-[var(--color-brawl-dark)] w-full py-3 rounded-xl border-4 border-[#121A2F]">
            <span className="font-bold text-xl font-['Righteous'] bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-wide text-center">
              BrawlValue
            </span>
          </div>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="mt-8 flex gap-4 flex-wrap justify-center">
        <button
          onClick={handleShare}
          className="brawl-button px-8 py-4 text-xl flex items-center gap-2 group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {copied ? t('copied') : t('button')}
        </button>
      </div>
    </div>
  )
}
