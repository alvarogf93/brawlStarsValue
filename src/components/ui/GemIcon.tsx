export function GemIcon({ className = "w-8 h-8" }: { className?: string }) {
  // Classic Brawl Stars Green Emerald
  return (
    <svg viewBox="0 0 100 100" className={`filter drop-shadow-[0_4px_0_rgba(18,26,47,1)] ${className}`}>
      {/* Outer black stroke */}
      <polygon points="50,5 95,45 50,95 5,45" fill="#121A2F" />
      {/* Main green body */}
      <polygon points="50,15 85,45 50,85 15,45" fill="#14E245" />
      {/* Top light highlight */}
      <polygon points="50,15 85,45 50,45 15,45" fill="#5EFAA0" />
      {/* Left bright reflection */}
      <polygon points="15,45 50,85 50,45" fill="#3BEE70" />
    </svg>
  );
}
