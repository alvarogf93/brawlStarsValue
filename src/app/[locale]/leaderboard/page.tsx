'use client'

import { useState } from 'react'
import { GemIcon } from '@/components/ui/GemIcon'
import { AnimatedCounter } from '@/components/ui/AnimatedCounter'
import { Link } from '@/i18n/routing'
import { Home } from 'lucide-react'

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'global' | 'local'>('global')

  // Mock Data
  const topPlayers = [
    { rank: 1, name: "Hyra", tag: "#2P0Q8C2C0", value: 450200, avatar: "👑", color: "#F59E0B" },
    { rank: 2, name: "SpenLC", tag: "#8YV9L9C", value: 420500, avatar: "🦅", color: "#94A3B8" },
    { rank: 3, name: "CryingMan", tag: "#C9P8L2", value: 415300, avatar: "💦", color: "#B45309" },
    { rank: 4, name: "Tensai", tag: "#V9L8Y2P", value: 395000, avatar: "⚔️" },
    { rank: 5, name: "Sitetampo", tag: "#9V8LQ", value: 388200, avatar: "🔥" },
    { rank: 6, name: "GuilleVGX", tag: "#L2Q9", value: 375000, avatar: "🎯" },
  ]

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 max-w-5xl mx-auto animate-fade-in w-full pb-32 relative">
      
      {/* Navigation */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8 z-50">
        <Link href="/" className="flex items-center gap-2 bg-[#121A2F] border-4 border-[#0F172A] text-white px-4 py-2 rounded-xl font-['Lilita_One'] hover:bg-[#1C5CF1] transition-colors shadow-[0_4px_0_0_#0F172A] active:translate-y-1 active:shadow-none">
          <Home size={20} strokeWidth={3} />
          <span>INICIO</span>
        </Link>
      </div>

      {/* Banner Ad Space */}
      <div className="w-full h-[90px] bg-slate-800/50 border-2 border-dashed border-slate-600/50 rounded-xl flex items-center justify-center mb-8 relative z-10">
        <span className="text-slate-500 font-['Lilita_One'] tracking-wider">AD SPACE (728x90)</span>
      </div>

      {/* Header Area */}
      <div className="text-center mb-10 relative z-10 w-full flex flex-col items-center">
         <div className="bg-[#1C5CF1] border-4 border-[#121A2F] rounded-[2rem] w-24 h-24 flex items-center justify-center shadow-[0_8px_0_0_#121A2F,inset_0_4px_0_rgba(255,255,255,0.3)] transform rotate-[-5deg] mb-6 hover:rotate-0 transition-transform">
           <svg className="w-12 h-12 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M5 4h14v2H5V4zm0 5h14v2H5V9zm2 5h10v2H7v-2zm2 5h6v2H9v-2z"></path><path d="M3 4h2v16H3V4zm16 0h2v16h-2V4z"></path></svg>
         </div>
         <h1 className="text-5xl md:text-7xl font-['Lilita_One'] tracking-wide text-white text-stroke-brawl uppercase transform rotate-[1deg] mb-3 drop-shadow-lg">
            RANKING GLOBAL
         </h1>
         <p className="font-['Inter'] font-bold text-[#E2E8F0] text-lg bg-[#121A2F]/50 px-6 py-2 rounded-full border-2 border-white/10 backdrop-blur-sm">
           Las Cuentas Más Ricas de Brawl
         </p>
      </div>

      {/* Toggles / Tabs */}
      <div className="flex justify-center mb-16 relative z-10">
        <div className="bg-[#121A2F] p-2 rounded-full flex border-4 border-black/50 shadow-[0_4px_0_0_rgba(0,0,0,0.5)]">
           <button 
            onClick={() => setActiveTab('global')}
            className={`px-8 py-3 rounded-full font-['Lilita_One'] text-xl transition-all ${activeTab === 'global' ? 'bg-[var(--color-brawl-gold)] text-[#121A2F] shadow-[0_4px_0_0_#B45309]' : 'text-slate-400 hover:text-white'}`}>
             GLOBAL 🌍
           </button>
           <button 
            onClick={() => setActiveTab('local')}
            className={`px-8 py-3 rounded-full font-['Lilita_One'] text-xl transition-all ${activeTab === 'local' ? 'bg-[var(--color-brawl-sku)] text-[#121A2F] shadow-[0_4px_0_0_#94A3B8]' : 'text-slate-400 hover:text-white'}`}>
             LOCAL 📍
           </button>
        </div>
      </div>

      {/* TOP 3 Premium Podium */}
      <div className="flex flex-row items-end justify-center h-[300px] gap-2 md:gap-4 mb-20 relative z-10 mx-auto w-full max-w-4xl px-2">
         
         {/* SECOND PLACE */}
         <div className="w-1/3 flex flex-col items-center relative group brawl-tilt">
           {/* Avatar Floating */}
           <div className="absolute -top-16 bg-[#F8FAFC] w-20 h-20 rounded-3xl border-4 border-[#94A3B8] shadow-[0_0_20px_rgba(148,163,184,0.6)] flex items-center justify-center text-4xl z-20 transform -rotate-3 group-hover:scale-110 transition-transform">
             {topPlayers[1].avatar}
           </div>
           {/* Name Badge */}
           <div className="absolute -top-4 z-30 bg-[#121A2F] border-2 border-white rounded-full px-3 py-1 font-['Lilita_One'] text-white text-stroke-none text-sm text-center shadow-lg truncate max-w-[90%]">
             {topPlayers[1].name}
           </div>
           
           <div className="bg-gradient-to-b from-[#CBD5E1] to-[#94A3B8] w-full border-4 border-[#121A2F] border-b-0 rounded-t-[2rem] pt-12 pb-4 flex flex-col items-center shadow-[inset_0_4px_0_rgba(255,255,255,0.6),inset_0_-8px_0_rgba(0,0,0,0.2)] relative z-10 h-[200px]">
              <span className="font-['Lilita_One'] text-white/50 text-7xl absolute bottom-4">2</span>
              <span className="font-['Lilita_One'] text-[#121A2F] text-xl flex flex-col md:flex-row items-center gap-1 mt-2">
                 <AnimatedCounter value={topPlayers[1].value} /> <GemIcon className="w-5 h-5 hidden md:block" />
              </span>
           </div>
         </div>

         {/* FIRST PLACE */}
         <div className="w-[40%] flex flex-col items-center z-20 relative brawl-tilt transform scale-105">
           {/* Crown & Avatar */}
           <div className="absolute -top-28 animate-float z-30 flex flex-col items-center">
             <span className="text-4xl mb-[-10px] z-40 transform rotate-12 drop-shadow-md">👑</span>
             <div className="bg-[var(--color-brawl-gold)] w-28 h-28 rounded-[2rem] border-4 border-[#121A2F] shadow-[0_0_40px_rgba(245,158,11,0.6),inset_0_4px_0_rgba(255,255,255,0.4)] flex items-center justify-center text-6xl">
               {topPlayers[0].avatar}
             </div>
           </div>
           {/* Name Badge */}
           <div className="absolute -top-2 z-40 bg-[#121A2F] border-4 border-[var(--color-brawl-gold)] rounded-full px-5 py-1.5 font-['Lilita_One'] text-[var(--color-brawl-gold)] text-lg text-center shadow-lg truncate max-w-[90%]">
             {topPlayers[0].name}
           </div>

           <div className="bg-gradient-to-b from-[#FCD34D] to-[#F59E0B] w-full border-4 border-[#121A2F] border-b-0 rounded-t-[2.5rem] pt-16 pb-6 flex flex-col items-center shadow-[0_-10px_30px_rgba(245,158,11,0.2),inset_0_6px_0_rgba(255,255,255,0.6),inset_0_-12px_0_rgba(180,83,9,0.5)] relative h-[260px]">
              <span className="font-['Lilita_One'] text-white/40 text-9xl absolute bottom-2">1</span>
              <span className="bg-[#121A2F] text-[var(--color-brawl-gold)] rounded-xl px-3 py-1 font-['Inter'] font-black text-xs mt-2 shadow-[0_4px_0_0_rgba(180,83,9,0.5)] hidden md:block">
                {topPlayers[0].tag}
              </span>
              <span className="font-['Lilita_One'] text-[#121A2F] text-2xl md:text-3xl flex flex-col md:flex-row items-center gap-1 mt-2 md:mt-4 z-10">
                 <AnimatedCounter value={topPlayers[0].value} /> <GemIcon className="w-6 h-6 md:w-8 md:h-8 hidden md:block" />
              </span>
           </div>
         </div>

         {/* THIRD PLACE */}
         <div className="w-1/3 flex flex-col items-center relative group brawl-tilt">
           {/* Avatar Floating */}
           <div className="absolute -top-14 bg-[#FEF3C7] w-16 h-16 md:w-20 md:h-20 rounded-3xl border-4 border-[#B45309] shadow-[0_0_20px_rgba(180,83,9,0.6)] flex items-center justify-center text-4xl z-20 transform rotate-6 group-hover:scale-110 transition-transform">
             {topPlayers[2].avatar}
           </div>
           {/* Name Badge */}
           <div className="absolute -top-2 z-30 bg-[#121A2F] border-2 border-white rounded-full px-3 py-1 font-['Lilita_One'] text-white text-stroke-none text-sm text-center shadow-lg truncate max-w-[90%]">
             {topPlayers[2].name}
           </div>

           <div className="bg-gradient-to-b from-[#F8FAFC] to-[#D97706] w-full border-4 border-[#121A2F] border-b-0 rounded-t-[2rem] pt-12 pb-4 flex flex-col items-center shadow-[inset_0_4px_0_rgba(255,255,255,0.4),inset_0_-8px_0_rgba(0,0,0,0.3)] relative z-10 h-[170px]">
              <span className="font-['Lilita_One'] text-white/40 text-7xl absolute bottom-4">3</span>
               <span className="font-['Lilita_One'] text-[#121A2F] text-xl flex flex-col md:flex-row items-center gap-1 mt-2">
                 <AnimatedCounter value={topPlayers[2].value} /> <GemIcon className="w-5 h-5 hidden md:block" />
              </span>
           </div>
         </div>
      </div>

      {/* REMAINDER OF LIST (Premium Rows) */}
      <div className="flex flex-col gap-4 relative z-10 max-w-4xl mx-auto px-2">
        {topPlayers.slice(3).map((p, index) => (
          <div key={p.rank} className="bg-white/5 border-4 border-white/10 backdrop-blur-md rounded-[2rem] p-4 flex items-center hover:bg-white/10 hover:border-white/30 transition-all duration-300 transform hover:-translate-y-1 group">
             
             {/* Rank Number with Background */}
             <div className="w-14 h-14 rounded-2xl bg-[#121A2F] border-2 border-white/20 flex items-center justify-center shrink-0">
                <span className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-sky)]">{p.rank}</span>
             </div>

             <div className="bg-slate-100 rounded-2xl w-14 h-14 mx-4 flex items-center justify-center text-3xl shrink-0 group-hover:rotate-12 transition-transform">
               {p.avatar}
             </div>
             
             <div className="flex-1 min-w-0">
               <h3 className="font-['Lilita_One'] text-2xl text-white truncate">{p.name}</h3>
               <span className="font-['Inter'] text-sm font-bold text-slate-400 bg-black/30 px-2 py-0.5 rounded-full">{p.tag}</span>
             </div>
             
             <div className="brawl-card bg-[var(--color-brawl-blue)] px-4 py-2 shrink-0">
               <span className="font-['Lilita_One'] text-xl md:text-2xl text-[var(--color-brawl-gold)] text-stroke-brawl flex items-center gap-2">
                 <AnimatedCounter value={p.value} /> <GemIcon className="w-5 h-5 md:w-6 md:h-6" />
               </span>
             </div>
          </div>
        ))}
        
        <button className="mx-auto mt-8 font-['Lilita_One'] text-xl text-[var(--color-brawl-sky)] hover:text-white transition-colors uppercase tracking-widest border-b-2 border-dashed border-current pb-1">
           Cargar Más ...
        </button>
      </div>

      {/* Sticky Current User Footer (Personal Rank) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pb-6 md:pb-8 flex justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-3xl brawl-card bg-gradient-to-r from-[#121A2F] via-[#1C5CF1] to-[#121A2F] p-4 border-t-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5),0_8px_0_0_#0F172A] flex items-center justify-between mx-4 md:mx-auto animate-slide-up">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-black/30 border-2 border-white/20 flex items-center justify-center font-['Lilita_One'] text-slate-300">
                #142
              </div>
              <div className="flex flex-col">
                 <span className="font-['Inter'] text-xs font-bold text-[var(--color-brawl-sky)] uppercase tracking-wider">Tu Posición Actual</span>
                 <span className="font-['Lilita_One'] text-white text-2xl">AlvaroGF</span>
              </div>
           </div>
           
           <div className="text-right flex items-center gap-2">
              <span className="font-['Lilita_One'] text-2xl text-[var(--color-brawl-gold)] text-stroke-brawl">18,500</span>
              <GemIcon className="w-6 h-6" />
           </div>
        </div>
      </div>
      
    </div>
  )
}
