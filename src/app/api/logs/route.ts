import { NextResponse } from 'next/server';
import logger from '@/lib/logger';

export async function GET() {
  const logs = logger.getAll();
  return NextResponse.json({ logs });
}

export async function DELETE() {
  logger.clear();
  return NextResponse.json({ success: true, message: 'Logs cleared' });
}