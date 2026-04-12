import { ImageResponse } from 'next/og'

// Next.js 16 file convention: this file is auto-registered as
// <meta property="og:image"> + <meta name="twitter:image"> in the
// <head> of every route. No manual `images: [...]` needed in
// generateMetadata — that would actually override and break the
// auto-inject (see commit history for debug details).
//
// Intentionally NOT using `runtime = 'edge'`: Vercel recommends
// the default Node.js runtime on Fluid Compute for Next.js 16.

export const alt = 'BrawlVision - Brawl Stars Combat Analytics'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

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
        }}
      >
        {/* Brand text — matches the red BRAWL + white VISION style */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: '#C41E1E',
              textShadow: '0 4px 0 #121A2F',
              letterSpacing: 8,
            }}
          >
            BRAWL
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#FFFFFF',
              textShadow: '0 4px 0 #121A2F',
              letterSpacing: 6,
              marginTop: -10,
            }}
          >
            VISION
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: '#FFC91B',
            marginTop: 24,
            opacity: 0.9,
          }}
        >
          Brawl Stars Combat Analytics
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 20,
            color: '#4EC0FA',
            marginTop: 20,
            letterSpacing: 2,
          }}
        >
          brawlvision.com
        </div>
      </div>
    ),
    { ...size }
  )
}
