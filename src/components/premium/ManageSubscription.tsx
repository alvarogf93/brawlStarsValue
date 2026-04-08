'use client'

import { useTranslations } from 'next-intl'
import { useAuth } from '@/hooks/useAuth'
import { Settings } from 'lucide-react'

export function ManageSubscription() {
  const { profile } = useAuth()
  const t = useTranslations('premium')

  if (!profile || profile.tier === 'free') return null

  const portalUrl = 'https://www.paypal.com/myaccount/autopay/'

  return (
    <div className="brawl-card-dark p-4 border-[#090E17] flex items-center justify-between">
      <div>
        <p className="font-['Lilita_One'] text-sm text-[#FFC91B] flex items-center gap-2">
          <span>⭐</span> {t('activePlan')}
        </p>
        <p className="text-[10px] text-slate-500">
          {profile.ls_subscription_status === 'cancelled' ? t('cancelledNotice') : t('activeNotice')}
        </p>
      </div>
      <a
        href={portalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
      >
        <Settings className="w-4 h-4" />
        {t('manage')}
      </a>
    </div>
  )
}
