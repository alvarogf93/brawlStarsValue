'use client'

import { useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { usePlayerData } from '@/hooks/usePlayerData'
import { useSkinClassifications } from '@/hooks/useSkinClassifications'
import { GemIcon } from '@/components/ui/GemIcon'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { SKIN_TIER_PRICES, SKIN_TIER_LABELS, PIN_TIER_PRICES, PIN_TIER_LABELS } from '@/lib/constants'
import { AdPlaceholder } from '@/components/ui/AdPlaceholder'
import { Minus, Plus } from 'lucide-react'
import { StatsSkeleton } from '@/components/ui/Skeleton'

const SKIN_TIERS = [
  { key: 'special',       color: '#22c55e', icon: '🟢' },
  { key: 'superSpecial',  color: '#3b82f6', icon: '🔵' },
  { key: 'epic',          color: '#a855f7', icon: '🟣' },
  { key: 'mythic',        color: '#ef4444', icon: '🔴' },
  { key: 'legendary',     color: '#f59e0b', icon: '🟡' },
  { key: 'hypercharge',   color: '#ec4899', icon: '💗' },
] as const

const PIN_TIERS = [
  { key: 'pinSpecial',    color: '#22c55e', icon: '💬' },
  { key: 'pinEpic',       color: '#a855f7', icon: '💜' },
  { key: 'pinCollector',  color: '#f59e0b', icon: '⭐' },
] as const

export default function CosmeticsPage() {
  const params = useParams<{ tag: string }>()
  const t = useTranslations('cosmetics')
  const locale = useLocale()
  const tag = decodeURIComponent(params.tag)
  const { data, isLoading, error } = usePlayerData(tag)
  const { counts, setCount, totalSkinGems, totalPinGems, totalCosmeticGems, classifiedCount } = useSkinClassifications(tag)

  const skinLabels = SKIN_TIER_LABELS[locale] || SKIN_TIER_LABELS.en
  const pinLabels = PIN_TIER_LABELS[locale] || PIN_TIER_LABELS.en

  if (isLoading) {
    return <StatsSkeleton />
  }

  if (error || !data) {
    return (
      <div className="brawl-card-dark p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{error || t('error')}</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">

      {/* Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#B23DFF] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#B23DFF] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center transform rotate-6 shadow-[0_4px_0_0_#121A2F]">
            <span className="text-3xl">🎨</span>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              {t('title')}
            </h1>
            <p className="font-['Inter'] font-semibold text-[#E9D5FF]">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </div>

      <AdPlaceholder className="mb-2" />

      {/* Instructions */}
      <div className="brawl-card p-5 border-l-4 border-[var(--color-brawl-gold)]">
        <p className="text-sm text-[var(--color-brawl-dark)] font-['Inter'] font-semibold">
          {t('instructions')}
        </p>
      </div>

      {/* ═══ SKINS SECTION ═══ */}
      <CosmeticSection
        title={t('skinsSection')}
        emoji="🎨"
        tiers={SKIN_TIERS}
        prices={SKIN_TIER_PRICES}
        labels={skinLabels}
        counts={counts}
        setCount={setCount}
        total={totalSkinGems}
        t={t}
      />

      {/* ═══ PINS / REACTIONS SECTION ═══ */}
      <CosmeticSection
        title={t('pinsSection')}
        emoji="💬"
        tiers={PIN_TIERS}
        prices={PIN_TIER_PRICES}
        labels={pinLabels}
        counts={counts}
        setCount={setCount}
        total={totalPinGems}
        t={t}
      />

      {/* ═══ GRAND TOTAL ═══ */}
      {data.totalGems !== undefined && (
        <div className="brawl-card p-6 md:p-8 text-center bg-gradient-to-r from-[#121A2F] via-[#1C5CF1] to-[#121A2F]">
          <p className="text-sm text-slate-300 font-bold uppercase mb-3">{t('grandTotal')}</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-['Lilita_One'] text-5xl text-white text-stroke-brawl">
              <AnimatedCounter value={data.totalGems + totalCosmeticGems} duration={1500} />
            </span>
            <GemIcon className="w-10 h-10" />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-xs text-slate-400">
            <span>{data.totalGems.toLocaleString()} {t('verified')}</span>
            <span className="text-slate-600">+</span>
            <span>{totalSkinGems.toLocaleString()} {t('fromSkins')}</span>
            <span className="text-slate-600">+</span>
            <span>{totalPinGems.toLocaleString()} {t('fromPins')}</span>
          </div>
        </div>
      )}

      <AdPlaceholder className="mt-8" />
    </div>
  )
}

/* ── Reusable section for skins / pins ─────────────────────── */

function CosmeticSection({
  title, emoji, tiers, prices, labels, counts, setCount, total, t,
}: {
  title: string
  emoji: string
  tiers: ReadonlyArray<{ key: string; color: string; icon: string }>
  prices: Record<string, number>
  labels: Record<string, string>
  counts: Record<string, number>
  setCount: (key: string, count: number) => void
  total: number
  t: (key: string) => string
}) {
  return (
    <div
      className="bg-[#24355B] border-4 border-[var(--color-brawl-dark)] rounded-3xl shadow-[4px_8px_0px_var(--color-brawl-dark),inset_0px_-6px_0px_rgba(0,0,0,0.3),inset_0px_4px_0px_rgba(255,255,255,0.1)] p-5 md:p-6 space-y-3"
    >
      {/* Section title */}
      <h2 className="font-['Lilita_One'] text-xl text-white flex items-center gap-2 pb-2 border-b border-white/10">
        <span className="text-2xl">{emoji}</span> {title}
      </h2>

      {/* Table header */}
      <div className="hidden sm:grid grid-cols-[1fr_5rem_7rem_5.5rem] gap-4 px-4 py-2 text-[10px] font-bold uppercase text-slate-400 tracking-widest">
        <span>{t('tierLabel')}</span>
        <span className="text-center">{t('pricePerSkin')}</span>
        <span className="text-center">{t('quantity')}</span>
        <span className="text-right">{t('subtotal')}</span>
      </div>

      {tiers.map((tier) => {
        const count = counts[tier.key] || 0
        const price = prices[tier.key] || 0
        const subtotal = count * price

        return (
          <div
            key={tier.key}
            className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_5rem_7rem_5.5rem] gap-3 sm:gap-4 items-center px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
          >
            {/* Name */}
            <div className="flex items-center gap-3">
              <span className="text-lg">{tier.icon}</span>
              <div>
                <p className="font-['Lilita_One'] text-base text-white leading-tight">{labels[tier.key] || tier.key}</p>
                <p className="text-[10px] text-slate-500 font-bold sm:hidden">{price} 💎</p>
              </div>
            </div>

            {/* Price — desktop */}
            <span className="hidden sm:flex items-center justify-center gap-1 font-['Lilita_One'] text-sm text-slate-300">
              {price} <GemIcon className="w-3 h-3" />
            </span>

            {/* Stepper */}
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => setCount(tier.key, count - 1)}
                disabled={count <= 0}
                className="w-8 h-8 rounded-lg bg-[#121A2F] border-2 border-[#0D1321] flex items-center justify-center text-slate-400 hover:text-white hover:border-[#4EC0FA] transition-colors disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={0}
                max={999}
                value={count}
                onChange={(e) => setCount(tier.key, parseInt(e.target.value) || 0)}
                className="w-14 h-8 text-center bg-[#121A2F] border-2 border-[#0D1321] rounded-lg font-['Lilita_One'] text-white text-sm outline-none focus:border-[var(--color-brawl-gold)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => setCount(tier.key, count + 1)}
                className="w-8 h-8 rounded-lg bg-[#121A2F] border-2 border-[#0D1321] flex items-center justify-center text-slate-400 hover:text-white hover:border-[#4EC0FA] transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Subtotal */}
            <div className="hidden sm:flex items-center justify-end gap-1">
              <span className={`font-['Lilita_One'] text-sm tabular-nums ${subtotal > 0 ? 'text-white' : 'text-slate-500'}`}>
                {subtotal.toLocaleString()}
              </span>
              <GemIcon className="w-3.5 h-3.5 shrink-0" />
            </div>
          </div>
        )
      })}

      {/* Section total */}
      <div className="border-t-2 border-white/10 pt-3 flex items-center justify-between px-4">
        <span className="font-['Lilita_One'] text-base text-[var(--color-brawl-gold)]">{t('total')}</span>
        <span className="flex items-center gap-2">
          <span className="font-['Lilita_One'] text-2xl text-white text-stroke-brawl">
            <AnimatedCounter value={total} duration={600} />
          </span>
          <GemIcon className="w-5 h-5" />
        </span>
      </div>
    </div>
  )
}
