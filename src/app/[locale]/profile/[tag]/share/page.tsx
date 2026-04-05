'use client'

import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { usePlayerData } from '@/hooks/usePlayerData'

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
        <p className="text-slate-400 font-['Lilita_One'] text-2xl">Loading...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || 'Could not load data.'}</p>
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
      <div className="w-full max-w-xl h-[90px] bg-slate-800/50 border-2 border-dashed border-slate-600/50 rounded-xl flex items-center justify-center">
        <span className="text-slate-500 font-['Lilita_One'] tracking-wider">AD SPACE (728x90)</span>
      </div>

      {/* Share Card Area */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-2deg]">
          FLEX YOUR SCORE
        </h1>
        <p className="font-['Inter'] font-semibold text-[var(--color-brawl-gold)] mt-2">
          Download your Player Card for TikTok or Instagram Reels!
        </p>
      </div>

      {/* The 9:16 Viral Card Container */}
      <div id="viral-card" className="relative w-[340px] h-[600px] sm:w-[380px] sm:h-[675px] bg-[#121A2F] rounded-[32px] overflow-hidden border-8 border-[var(--color-brawl-dark)] shadow-[0_12px_24px_rgba(0,0,0,0.5)] flex flex-col items-center p-6 mx-auto">

        {/* Dynamic Background Pattern */}
        <div className="absolute inset-0 bg-[#1C5CF1] z-0">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_20px,rgba(0,0,0,0.1)_20px,rgba(0,0,0,0.1)_40px)]" />
          <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-[conic-gradient(from_0deg,transparent_0deg_15deg,rgba(255,255,255,0.1)_15deg_30deg,transparent_30deg_45deg,rgba(255,255,255,0.1)_45deg_60deg,transparent_60deg_75deg,rgba(255,255,255,0.1)_75deg_90deg,transparent_90deg_105deg,rgba(255,255,255,0.1)_105deg_120deg,transparent_120deg_135deg,rgba(255,255,255,0.1)_135deg_150deg,transparent_150deg_165deg,rgba(255,255,255,0.1)_165deg_180deg,transparent_180deg_195deg,rgba(255,255,255,0.1)_195deg_210deg,transparent_210deg_225deg,rgba(255,255,255,0.1)_225deg_240deg,transparent_240deg_255deg,rgba(255,255,255,0.1)_255deg_270deg,transparent_270deg_285deg,rgba(255,255,255,0.1)_285deg_300deg,transparent_300deg_315deg,rgba(255,255,255,0.1)_315deg_330deg,transparent_330deg_345deg,rgba(255,255,255,0.1)_345deg_360deg)] transform -translate-x-1/2 -translate-y-1/2 opacity-30" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center h-full w-full">

          <div className="bg-[#121A2F] px-4 py-2 rounded-xl border-4 border-[#121A2F] shadow-[0_4px_0_0_#121A2F] transform rotate-[-3deg] mt-4 mb-auto">
            <span className="font-['Lilita_One'] text-[#4EC0FA] text-xl">
              {data.playerName}
            </span>
          </div>

          <div className="text-center mt-auto mb-4 w-full">
            <p className="font-['Lilita_One'] text-[var(--color-brawl-gold)] text-xl tracking-widest uppercase mb-2 drop-shadow-md">
              {tProfile('gemEquivalent')}
            </p>
            <div className="brawl-card-dark w-full py-4 border-8 border-[#121A2F] transform scale-105 shadow-[0_8px_0_0_#121A2F,inset_0_4px_0_rgba(255,255,255,0.2)] bg-[#F82F41]">
              <h2 className="text-6xl sm:text-7xl font-['Lilita_One'] text-white text-stroke-brawl tracking-wider">
                {data.totalGems.toLocaleString()}
              </h2>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-2 w-full mb-4">
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="font-['Lilita_One'] text-white text-lg">{data.player?.trophies.toLocaleString()}</p>
              <p className="text-[8px] text-white/60 uppercase font-bold">🏆 Trophies</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="font-['Lilita_One'] text-white text-lg">{data.player?.brawlers.length}</p>
              <p className="text-[8px] text-white/60 uppercase font-bold">👥 Brawlers</p>
            </div>
            <div className="bg-black/30 rounded-lg p-2 text-center">
              <p className="font-['Lilita_One'] text-white text-lg">P{data.player?.totalPrestigeLevel}</p>
              <p className="text-[8px] text-white/60 uppercase font-bold">👑 Prestige</p>
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
