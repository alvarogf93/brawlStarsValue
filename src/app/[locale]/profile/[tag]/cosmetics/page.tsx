'use client'

export default function CosmeticsPage() {
  const skins = [
    { id: 1, name: "MECHA CROW", brawler: "CROW", rarity: "Legendary", color: "#FFC91B" },
    { id: 2, name: "VIRUS 8-BIT", brawler: "8-BIT", rarity: "Legendary", color: "#FFC91B" },
    { id: 3, name: "GOLDEN MORTIS", brawler: "MORTIS", rarity: "True Gold", color: "#FBBF24" },
    { id: 4, name: "STREET NINJA TARA", brawler: "TARA", rarity: "Epic", color: "#B23DFF" },
    { id: 5, name: "CHALLENGER COLT", brawler: "COLT", rarity: "Special", color: "#4EC0FA" },
    { id: 6, name: "STAR SHELLY", brawler: "SHELLY", rarity: "Exclusive", color: "#1C5CF1" },
  ]

  return (
    <div className="animate-fade-in w-full pb-10">
      
      {/* Header Panel */}
      <div className="brawl-card p-6 md:p-8 mb-8 flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-[#B23DFF] to-[#121A2F]">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-[#B23DFF] border-4 border-[#121A2F] rounded-2xl flex items-center justify-center transform rotate-12 shadow-[0_4px_0_0_#121A2F]">
             <span className="text-3xl">🎴</span>
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl transform rotate-[-1deg]">
              COSMETICS VAULT
            </h1>
            <p className="font-['Inter'] font-semibold text-[#E9D5FF]">
              34 Skins · 120 Pins · 14 Sprays
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {skins.map((skin) => (
          <div key={skin.id} className="relative group brawl-tilt">
             {/* Showcase Pedestal Frame */}
             <div className="brawl-card-dark bg-[#1E293B] border-4 border-[#121A2F] rounded-[32px] overflow-hidden shadow-[0_8px_0_0_#121A2F] p-4 min-h-[250px] flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)] relative">
                
                {/* Rarity Glow */}
                <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-transparent to-current" style={{ color: skin.color }}></div>
                
                <div className="w-32 h-32 bg-[#121A2F] rounded-full border-4 border-dashed border-slate-600 flex items-center justify-center relative z-10 mb-4 group-hover:rotate-180 transition-transform duration-700">
                   <div className="w-28 h-28 rounded-full border-4 border-[#121A2F] overflow-hidden relative" style={{ backgroundColor: skin.color }}>
                     {/* Fake Silhouette inside */}
                     <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 bg-black/40 rounded-full blur-[10px]"></div>
                     </div>
                   </div>
                   {/* Rarity Star */}
                   <div className="absolute -bottom-2 -right-2 bg-black rounded-full p-2 border-2" style={{ borderColor: skin.color }}>
                     <span className="text-lg">⭐</span>
                   </div>
                </div>
                
                <h3 className="font-['Lilita_One'] text-2xl text-white text-stroke-brawl relative z-10 tracking-widest uppercase mb-1">{skin.name}</h3>
                <span className="bg-[#121A2F] text-xs font-['Inter'] font-bold px-3 py-1 rounded-full uppercase shadow-[0_2px_0_0_rgba(255,255,255,0.1)] relative z-10" style={{ color: skin.color }}>
                  {skin.rarity}
                </span>
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
