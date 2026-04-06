'use client'

/**
 * Ad slot component. Shows placeholder until AdSense is configured.
 *
 * To activate real ads:
 * 1. Set your publisher ID in ADSENSE_PUB_ID below
 * 2. Add the AdSense script to the root layout:
 *    <Script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXX" strategy="afterInteractive" />
 * 3. Each slot will auto-initialize with the correct format
 */

// Replace with your real publisher ID to activate ads
const ADSENSE_PUB_ID = '' // e.g. 'ca-pub-1234567890123456'

export function AdPlaceholder({ className = '' }: { className?: string }) {
  if (ADSENSE_PUB_ID) {
    // Real ad slot — auto-sized responsive
    return (
      <div className={`w-full min-h-[90px] ${className}`}>
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={ADSENSE_PUB_ID}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    )
  }

  // Placeholder while no publisher ID configured
  return (
    <div className={`w-full min-h-[90px] sm:min-h-[120px] bg-[#090E17]/80 border-2 border-dashed border-[#1C5CF1]/30 rounded-xl flex items-center justify-center relative overflow-hidden shadow-inner ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(28,92,241,0.08)_0%,transparent_70%)]" />
      <span className="text-[#4EC0FA]/40 font-['Lilita_One'] tracking-[0.3em] text-xs sm:text-sm uppercase relative z-10 select-none drop-shadow-md">
        Anuncio - Ad Space
      </span>
    </div>
  )
}
