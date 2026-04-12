import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'

// Next.js 16 file convention: this file auto-registers as
// <meta property="og:image"> + <meta name="twitter:image"> in the
// <head> of every [locale]/* route. No manual `images: [...]` in
// generateMetadata — that would override the auto-inject.
//
// The brand logo is read from disk at module-load time and inlined
// as a base64 data URL. Satori (the renderer inside next/og) needs
// images to be fetchable; data URLs avoid any network round-trip
// and side-step the chicken-and-egg of fetching your own site.

export const alt = 'BrawlVision - Brawl Stars Combat Analytics'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Read-once at cold start. The file is ~670 KB so the base64 string
// is ~900 KB; cheap compared to rendering the fonts Satori ships.
const LOGO_DATA_URL = (() => {
  const bytes = readFileSync(
    join(process.cwd(), 'public', 'assets', 'brand', 'logo-full.png'),
  )
  return `data:image/png;base64,${bytes.toString('base64')}`
})()

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8B0000 0%, #121A2F 100%)',
          fontFamily: 'sans-serif',
          padding: 40,
        }}
      >
        {/* Official brand logo — BRAWL / VISION + Tara, transparent PNG */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_DATA_URL}
          alt="BrawlVision"
          width={900}
          height={486}
          style={{
            objectFit: 'contain',
            filter: 'drop-shadow(0 8px 0 rgba(0,0,0,0.55))',
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 30,
            color: '#FFC91B',
            marginTop: 18,
            opacity: 0.95,
            letterSpacing: 1,
          }}
        >
          Brawl Stars Combat Analytics
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 22,
            color: '#4EC0FA',
            marginTop: 8,
            letterSpacing: 2,
          }}
        >
          brawlvision.com
        </div>
      </div>
    ),
    { ...size },
  )
}
