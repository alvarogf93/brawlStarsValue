import { ImageResponse } from 'next/og'

export const size = { width: 48, height: 48 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1C5CF1 0%, #121A2F 100%)',
          borderRadius: 10,
        }}
      >
        <span style={{ fontSize: 30 }}>💎</span>
      </div>
    ),
    { ...size },
  )
}
