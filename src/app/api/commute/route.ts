import { NextRequest, NextResponse } from 'next/server';
import { calculateAllCommuteTimes } from '@/lib/utils/commute';
import { commuteCache, TTL } from '@/lib/cache';
import logger from '@/lib/logger';

function commuteCacheKey(origin: string): string {
  return `commute::${origin.trim().toLowerCase()}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const address = searchParams.get('address');
    const bustCacheParam = searchParams.get('bustCache') === '1';

    const origin = lat && lng ? `${lat},${lng}` : address;

    if (!origin) {
      return NextResponse.json(
        { success: false, error: 'lat/lng or address is required' },
        { status: 400 }
      );
    }

    const cacheKey = commuteCacheKey(origin);

    if (bustCacheParam) {
      logger.info(`Cache BUST requested | commute`, 'commute');
      commuteCache.delete(cacheKey);
    }

    const cached = commuteCache.get(cacheKey);
    if (cached) {
      logger.info(`Cache HIT | commute from ${origin}`, 'commute');
      return NextResponse.json({ ...cached, logs: logger.getAll() });
    }

    logger.info(`Cache MISS — calculating commute times from ${origin}`, 'commute');

    const commuteMap = await calculateAllCommuteTimes(origin);
    const commuteTimes = Array.from(commuteMap.values());

    logger.info(`Calculated ${commuteTimes.length} commute times`, 'commute');

    const responseData = {
      success: true,
      commuteTimes,
    };

    commuteCache.set(cacheKey, responseData, TTL.COMMUTE);
    logger.info(`Cached commute for ${TTL.COMMUTE / 3600 / 24}d`, 'commute');

    return NextResponse.json({
      ...responseData,
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
