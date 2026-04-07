'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { getBrawlerPortraitUrl } from '@/lib/utils'

const LEFT_BRAWLERS = [
  { id: 16000000, name: 'Shelly', top: '15%', left: '2%', size: 100, delay: 0 },
  { id: 16000005, name: 'Spike', top: '45%', left: '8%', size: 90, delay: 0.5 },
  { id: 16000011, name: 'Mortis', top: '72%', left: '3%', size: 95, delay: 1.0 },
]

const RIGHT_BRAWLERS = [
  { id: 16000012, name: 'Crow', top: '12%', right: '2%', size: 100, delay: 0.3 },
  { id: 16000023, name: 'Leon', top: '43%', right: '7%', size: 90, delay: 0.8 },
  { id: 16000010, name: 'El Primo', top: '70%', right: '3%', size: 105, delay: 1.2 },
]

export function HeroBrawlers() {
  return (
    <>
      {LEFT_BRAWLERS.map((b) => (
        <motion.div
          key={b.id}
          className="absolute hidden lg:block pointer-events-none md:block md:opacity-20 lg:opacity-100"
          style={{ top: b.top, left: b.left }}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: b.delay }}
        >
          <Image
            src={getBrawlerPortraitUrl(b.id)}
            alt={b.name}
            width={b.size}
            height={b.size}
            className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
          />
        </motion.div>
      ))}
      {RIGHT_BRAWLERS.map((b) => (
        <motion.div
          key={b.id}
          className="absolute hidden lg:block pointer-events-none md:block md:opacity-20 lg:opacity-100"
          style={{ top: b.top, right: b.right }}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: b.delay }}
        >
          <Image
            src={getBrawlerPortraitUrl(b.id)}
            alt={b.name}
            width={b.size}
            height={b.size}
            className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
          />
        </motion.div>
      ))}
    </>
  )
}
