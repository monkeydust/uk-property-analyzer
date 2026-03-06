import { NextRequest, NextResponse } from 'next/server';

const SITE_PASSWORD = process.env.SITE_PASSWORD || 'Marip0sa';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    let userId: string | null = null;
    if (password === SITE_PASSWORD) {
      userId = 'admin';
    } else if (password === DEMO_PASSWORD) {
      userId = 'demo';
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true, userId });

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    };

    response.cookies.set('site_auth', 'authenticated', cookieOpts);
    response.cookies.set('user_id', userId, cookieOpts);

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}
