import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const size = parseInt(request.nextUrl.searchParams.get('size') || '192');

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #0f172a 0%, #0d9488 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: size * 0.02,
        }}
      >
        <div
          style={{
            fontSize: size * 0.3,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '-0.02em',
          }}
        >
          PA
        </div>
        <div
          style={{
            width: size * 0.4,
            height: size * 0.04,
            background: '#2dd4bf',
            borderRadius: size * 0.02,
          }}
        />
      </div>
    ),
    { width: size, height: size },
  );
}
