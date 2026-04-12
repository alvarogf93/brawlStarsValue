'use client'

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface Props {
  text: string
  className?: string
}

export function InfoTooltip({ text, className = '' }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white text-[10px] font-bold inline-flex items-center justify-center transition-colors align-middle ${className}`}
          aria-label="Info"
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
