export function GemIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`filter drop-shadow-[0_3px_0_rgba(18,26,47,0.8)] ${className}`}>
      <defs>
        <linearGradient id="gem-body" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="50%" stopColor="#16A34A" />
          <stop offset="100%" stopColor="#0D6B30" />
        </linearGradient>
        <linearGradient id="gem-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86EFAC" />
          <stop offset="100%" stopColor="#4ADE80" />
        </linearGradient>
        <linearGradient id="gem-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer stroke */}
      <polygon points="50,2 98,38 50,98 2,38" fill="#121A2F" />

      {/* Main body — deep green */}
      <polygon points="50,10 90,38 50,90 10,38" fill="url(#gem-body)" />

      {/* Top crown facet — lighter */}
      <polygon points="50,10 90,38 50,38 10,38" fill="url(#gem-top)" />

      {/* Center horizontal line */}
      <line x1="10" y1="38" x2="90" y2="38" stroke="#0D6B30" strokeWidth="1.5" opacity="0.5" />

      {/* Left facet — mid green */}
      <polygon points="10,38 50,90 50,38" fill="#22C55E" opacity="0.7" />

      {/* Top-left shine facet */}
      <polygon points="50,10 30,38 50,38" fill="url(#gem-shine)" />

      {/* Small white sparkle */}
      <circle cx="35" cy="28" r="3" fill="white" opacity="0.6" />
      <circle cx="38" cy="25" r="1.5" fill="white" opacity="0.9" />
    </svg>
  )
}
