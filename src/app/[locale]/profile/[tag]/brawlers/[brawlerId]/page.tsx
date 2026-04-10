'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { usePlayerData } from '@/hooks/usePlayerData'
import { useBrawlerMeta } from '@/hooks/useBrawlerMeta'
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics'
import { isPremium } from '@/lib/premium'
import { getCachedRegistry } from '@/lib/brawler-registry'
import { resolveBrawlerName } from '@/lib/brawler-name'
import { HeroBanner } from '@/components/brawler-detail/HeroBanner'
import { MetaIntelligence } from '@/components/brawler-detail/MetaIntelligence'
import { PersonalAnalysis } from '@/components/brawler-detail/PersonalAnalysis'
import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'
import type { Profile } from '@/lib/supabase/types'

function BrawlerDetailSkeleton() {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      <div className="brawl-card p-5 md:p-8">
        <Skeleton className="h-4 w-24 mb-4" />
        <div className="flex flex-col md:flex-row items-center gap-6">
          <Skeleton className="w-[120px] h-[120px] rounded-2xl shrink-0" />
          <div className="space-y-3 flex-1 w-full">
            <Skeleton className="h-10 w-48 mx-auto md:mx-0" />
            <Skeleton className="h-4 w-32 mx-auto md:mx-0" />
            <Skeleton className="h-6 w-24 mx-auto md:mx-0" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="brawl-card-dark p-5 md:p-8">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default function BrawlerDetailPage() {
  const params = useParams<{ tag: string; locale: string; brawlerId: string }>()
  const router = useRouter()

  const brawlerId = parseInt(params.brawlerId, 10)
  const tag = decodeURIComponent(params.tag)

  const { user, profile, loading: authLoading } = useAuth()
  const hasPremium = !authLoading && !!user && !!profile && isPremium(profile as Profile)

  const { data: playerData, isLoading: playerLoading, error: playerError } = usePlayerData(tag)
  const { data: metaData, isLoading: metaLoading, error: metaError } = useBrawlerMeta(brawlerId)
  const { data: analyticsData, isLoading: analyticsLoading } = useAdvancedAnalytics(hasPremium)

  // Redirect if brawlerId is invalid
  useEffect(() => {
    if (isNaN(brawlerId)) {
      router.replace(`/${params.locale}/profile/${params.tag}/brawlers`)
    }
  }, [brawlerId, router, params.locale, params.tag])

  if (isNaN(brawlerId)) {
    return null
  }

  const isLoading = playerLoading || metaLoading || (hasPremium && analyticsLoading)

  if (isLoading) {
    return <BrawlerDetailSkeleton />
  }

  if (playerError || metaError) {
    return (
      <div className="glass p-8 rounded-2xl text-center border-red-500/30">
        <p className="text-red-400">{playerError || metaError}</p>
      </div>
    )
  }

  const playerBrawler = playerData?.player?.brawlers?.find(b => b.id === brawlerId) ?? null
  const brawlerInfo = getCachedRegistry()?.find(b => b.id === brawlerId) ?? null

  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      <HeroBanner
        brawlerId={brawlerId}
        brawlerInfo={brawlerInfo}
        playerBrawler={playerBrawler}
      />

      {metaData && (
        <MetaIntelligence
          data={metaData}
          playerBrawlerNames={playerData?.player?.brawlers?.reduce((m, b) => { m.set(b.id, b.name); return m }, new Map<number, string>())}
        />
      )}

      {playerBrawler && (
        <PersonalAnalysis
          brawlerId={brawlerId}
          analytics={analyticsData}
          metaData={metaData}
          hasPremium={hasPremium}
          tag={tag}
        />
      )}
    </div>
  )
}
