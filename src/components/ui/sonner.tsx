'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex items-center gap-3 w-full px-4 py-3 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.5)] border-2 border-[#090E17] font-["Lilita_One"] text-sm animate-fade-in',
          success: 'bg-[#34A853] text-white',
          error: 'bg-[var(--color-brawl-red)] text-white',
          info: 'bg-[var(--color-brawl-sky)] text-[#121A2F]',
          warning: 'bg-[var(--color-brawl-gold)] text-[#121A2F]',
          default: 'bg-[#1A2744] text-white',
          description: 'text-xs opacity-80 font-["Inter"] font-normal',
          title: 'font-["Lilita_One"]',
        },
      }}
    />
  )
}
