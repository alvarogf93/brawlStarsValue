import { ImageResponse } from 'next/og'

// Next.js 16 convention: this file is auto-registered as
// <link rel="apple-touch-icon" href="/apple-icon" sizes="180x180" />
// in <head> of every route. Satisfies webhint's apple-touch-icons rule.

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8B0000 0%, #121A2F 100%)',
          borderRadius: 36,
        }}
      >
        <span
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: '#FFFFFF',
            textShadow: '0 2px 0 #121A2F',
            letterSpacing: -1,
          }}
        >
          BV
        </span>
      </div>
    ),
    size,
  )
}
