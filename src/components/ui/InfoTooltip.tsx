'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  text: string
  className?: string
}

export function InfoTooltip({ text, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span ref={ref} className={`relative inline-block ${className}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white text-[10px] font-bold inline-flex items-center justify-center transition-colors align-middle"
        aria-label="Info"
      >
        ?
      </button>
      {open && (
        <span className="fixed z-[9999] w-72 p-3 rounded-xl bg-[#1A1F2E] border border-white/10 shadow-xl shadow-black/40 text-xs text-slate-300 leading-relaxed block font-normal"
          style={{
            top: ref.current ? ref.current.getBoundingClientRect().top - 8 + window.scrollY : 0,
            left: ref.current ? Math.min(Math.max(8, ref.current.getBoundingClientRect().left + ref.current.offsetWidth / 2 - 144), window.innerWidth - 296) : 0,
            transform: 'translateY(-100%)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
