import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'BrawlValue - Calculate your Brawl Stars Gem Score'
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
          background: 'linear-gradient(135deg, #1C5CF1 0%, #121A2F 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Gem emoji */}
        <div style={{ fontSize: 120, marginBottom: 20 }}>💎</div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: '#FFC91B',
            textShadow: '0 4px 0 #121A2F',
            letterSpacing: 4,
          }}
        >
          BrawlValue
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: 'white',
            marginTop: 16,
            opacity: 0.9,
          }}
        >
          Calculate your Brawl Stars Gem Score
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 20,
            color: '#4EC0FA',
            marginTop: 32,
            letterSpacing: 2,
          }}
        >
          brawlvalue.com
        </div>
      </div>
    ),
    { ...size }
  )
}
