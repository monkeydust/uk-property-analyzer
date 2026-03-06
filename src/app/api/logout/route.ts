import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });

    const clearOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 0,
        path: '/',
    };

    response.cookies.set('site_auth', '', clearOpts);
    response.cookies.set('user_id', '', clearOpts);

    return response;
}
