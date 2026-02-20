import { NextRequest, NextResponse } from 'next/server';
import { calculateAllCommuteTimes } from '@/lib/utils/commute';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const address = searchParams.get('address');

    const origin = lat && lng ? `${lat},${lng}` : address;

    if (!origin) {
      return NextResponse.json(
        { success: false, error: 'lat/lng or address is required' },
        { status: 400 }
      );
    }

    logger.info(`Calculating commute times from ${origin}`, 'commute');

    const commuteMap = await calculateAllCommuteTimes(origin);
    const commuteTimes = Array.from(commuteMap.values());

    logger.info(`Calculated ${commuteTimes.length} commute times`, 'commute');

    return NextResponse.json({
      success: true,
      commuteTimes,
      logs: logger.getAll(),
    });
  } catch (error) {
    logger.error(`Commute error: ${error}`, 'commute');
    return NextResponse.json(
      { success: false, error: 'Failed to calculate commute times' },
      { status: 500 }
    );
  }
}
