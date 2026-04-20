import { ImageResponse } from 'next/og'

// Next.js 16 file convention: `generateImageMetadata` returns one
// entry per icon size. Next auto-generates routes `/icon/<id>` and
// injects the corresponding `<link rel="icon" sizes="...">` tags
// into every page's <head>.
//
// Previous implementation exported a `sizes` array and tried to read
// `params.size`, but that's not a valid Next 16 convention: the
// non-dynamic `icon.tsx` route doesn't receive params, and the
// manifest.json entries for `/icon?size=192` / `?size=512` were
// returning 404. `generateImageMetadata` is the supported path.
export function generateImageMetadata() {
  return [
    { id: 'small', contentType: 'image/png', size: { width: 48, height: 48 } },
    { id: 'medium', contentType: 'image/png', size: { width: 192, height: 192 } },
    { id: 'large', contentType: 'image/png', size: { width: 512, height: 512 } },
  ]
}

const SIZE_MAP: Record<string, number> = {
  small: 48,
  medium: 192,
  large: 512,
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = await id
  const width = SIZE_MAP[String(iconId)] ?? 48
  const fontSize = Math.round(width * 0.45)
  const radius = Math.round(width * 0.2)

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
          borderRadius: radius,
        }}
      >
        <span style={{ fontSize, fontWeight: 900, color: '#FFFFFF', textShadow: '0 2px 0 #121A2F', letterSpacing: -1 }}>BV</span>
      </div>
    ),
    { width, height: width },
  )
}
