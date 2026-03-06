import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const userId = request.cookies.get('user_id')?.value || 'admin';
    return NextResponse.json({ userId });
}
