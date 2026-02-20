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
          background: 'linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Modern House Silhouette */}
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="white"
          style={{ display: 'flex' }}
        >
          <path d="M12 3L3 12H6V21H18V12H21L12 3Z" />
        </svg>

        {/* Sparkle */}
        <svg
          width={size * 0.25}
          height={size * 0.25}
          viewBox="0 0 24 24"
          fill="#FDE047"
          style={{
            position: 'absolute',
            top: size * 0.15,
            right: size * 0.15,
            display: 'flex',
          }}
        >
          <path d="M12 1L13.5 9.5L22 11L13.5 12.5L12 21L10.5 12.5L2 11L10.5 9.5L12 1Z" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
