'use client'

interface SkeletonProps {
  className?: string
}

/** Base skeleton element with shimmer animation */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-[#1E293B] rounded-lg animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

/** Skeleton for a stat card (number + label) */
export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`brawl-card-dark rounded-xl p-4 space-y-3 ${className}`}>
      <Skeleton className="h-8 w-20 mx-auto" />
      <Skeleton className="h-3 w-16 mx-auto" />
    </div>
  )
}

/** Skeleton for a brawler row (icon + name + value) */
export function SkeletonRow({ className = '' }: SkeletonProps) {
  return (
    <div className={`flex items-center gap-3 brawl-row rounded-xl px-4 py-3 ${className}`}>
      <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-14 shrink-0" />
    </div>
  )
}

/** Skeleton for the brawlers grid page */
export function BrawlersSkeleton() {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Header */}
      <div className="brawl-card p-6 md:p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      {/* Filters */}
      <div className="flex gap-2">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="brawl-card-dark rounded-2xl p-4 space-y-3">
            <Skeleton className="w-16 h-16 rounded-xl mx-auto" />
            <Skeleton className="h-4 w-20 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the battles page */
export function BattlesSkeleton() {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Header */}
      <div className="brawl-card p-6 md:p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {/* Battle list */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="brawl-card-dark rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="w-10 h-10 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the analytics page */
export function AnalyticsSkeleton() {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Header */}
      <div className="brawl-card p-6 md:p-8 bg-gradient-to-r from-[#FFC91B]/20 to-[#121A2F]">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-xl" />
        ))}
      </div>
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {/* Chart placeholder */}
      <div className="brawl-card-dark rounded-xl p-6">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  )
}

/** Skeleton for the stats page */
export function StatsSkeleton() {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Header */}
      <div className="brawl-card p-6 md:p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </div>
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="brawl-card-dark rounded-xl p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-full mx-auto" />
            <Skeleton className="h-6 w-20 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Skeleton for the club page */
export function ClubSkeleton() {
  return (
    <div className="animate-fade-in w-full pb-10 space-y-6">
      {/* Club header */}
      <div className="brawl-card p-6 md:p-8">
        <div className="flex items-center gap-4">
          <Skeleton className="w-20 h-20 rounded-2xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      {/* Members list */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </div>
  )
}
