'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { Gift, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export function ReferralCard() {
  const { profile } = useAuth()
  const t = useTranslations('premium')
  const locale = useLocale()
  const [copied, setCopied] = useState(false)

  if (!profile?.referral_code) return null

  const code = profile.referral_code
  const referralLink = `https://brawlvision.com/${locale}?ref=${code}`
  const count = profile.referral_count ?? 0

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      toast.success(t('referralCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = referralLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      toast.success(t('referralCopied'))
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="brawl-card-dark p-4 border-[#090E17]">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-[#FFC91B]" />
        <h3 className="font-['Lilita_One'] text-base text-white">{t('referralTitle')}</h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">{t('referralBody')}</p>

      {/* Code + copy */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 font-mono text-sm text-[#FFC91B] select-all">
          {code}
        </div>
        <button
          onClick={handleCopy}
          className={`p-2.5 rounded-lg transition-all ${
            copied
              ? 'bg-green-500/20 text-green-400'
              : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
          }`}
          title={t('referralCopied')}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      {/* Count */}
      <p className="text-[10px] text-slate-500 font-semibold">
        {t('referralCount', { count: String(count) })}
      </p>
    </div>
  )
}
