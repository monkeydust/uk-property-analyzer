import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';

function isAuthenticated(request: NextRequest): boolean {
  return request.cookies.get('site_auth')?.value === 'authenticated';
}

export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(logger.getAll());
}

export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logger.clear();
  return NextResponse.json({ success: true });
}