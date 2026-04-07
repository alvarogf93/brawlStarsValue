import { ImageResponse } from 'next/og'

export const sizes = [
  { width: 48, height: 48 },
  { width: 192, height: 192 },
  { width: 512, height: 512 },
]
export const contentType = 'image/png'

export default function Icon({ params }: { params: { size?: string } }) {
  const s = Number(params?.size) || 48
  const w = sizes.find(sz => sz.width === s) ?? sizes[0]
  const fontSize = Math.round(w.width * 0.6)
  const radius = Math.round(w.width * 0.2)

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
          borderRadius: radius,
        }}
      >
        <span style={{ fontSize }}>💎</span>
      </div>
    ),
    { width: w.width, height: w.height },
  )
}
