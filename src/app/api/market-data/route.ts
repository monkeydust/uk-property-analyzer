import { NextRequest, NextResponse } from 'next/server';
import { getMarketData } from '@/lib/propertydata/market-data';
import { marketDataCache, TTL } from '@/lib/cache';
import logger from '@/lib/logger';
import type { MarketDataResult } from '@/lib/types/property';

export async function POST(request: NextRequest): Promise<NextResponse<MarketDataResult>> {
  try {
    const body = await request.json();
    const { postcode, bedrooms, propertyType, listingPrice, squareFootage, bustCache } = body;

    if (!postcode || typeof postcode !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Postcode is required' } as MarketDataResult,
        { status: 400 }
      );
    }

    const cacheKey = `marketData::${postcode.toUpperCase().replace(/\s+/g, '')}::${bedrooms ?? 'unknown'}::${propertyType || 'unknown'}`;

    // If bustCache is set, clear the cache
    if (bustCache) {
      logger.info(`Cache BUST requested for market data | ${cacheKey}`, 'market-data');
      marketDataCache.delete(cacheKey);
    }

    const cached = marketDataCache.get(cacheKey);
    if (cached) {
      logger.info(`Market data cache HIT | ${cacheKey}`, 'market-data');
      return NextResponse.json({ ...cached, cached: true });
    }

    logger.info(`Market data cache MISS | ${cacheKey}`, 'market-data');

    const result = await getMarketData(
      postcode,
      bedrooms ?? null,
      propertyType ?? '',
      listingPrice ?? null,
      squareFootage ?? null
    );

    if (result.success) {
      logger.info(
        `Market data retrieved for ${postcode}: estimate=£${result.data?.valuation.estimate?.toLocaleString() ?? 'N/A'}`,
        'market-data'
      );
    } else {
      logger.warn(`Market data partially unavailable for ${postcode}`, 'market-data');
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`Market data API error: ${String(error)}`, 'market-data');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market data' } as MarketDataResult,
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // For GET requests, extract params from query string
  const { searchParams } = new URL(request.url);
  const postcode = searchParams.get('postcode');
  const bedrooms = searchParams.get('bedrooms');
  const propertyType = searchParams.get('propertyType');
  const listingPrice = searchParams.get('listingPrice');
  const squareFootage = searchParams.get('squareFootage');

  if (!postcode) {
    return NextResponse.json(
      { success: false, error: 'Postcode is required' } as MarketDataResult,
      { status: 400 }
    );
  }

  try {
    const result = await getMarketData(
      postcode,
      bedrooms ? parseInt(bedrooms, 10) : null,
      propertyType ?? '',
      listingPrice ? parseInt(listingPrice, 10) : null,
      squareFootage ? parseInt(squareFootage, 10) : null
    );

    return NextResponse.json(result);
  } catch (error) {
    logger.error(`Market data GET error: ${String(error)}`, 'market-data');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market data' } as MarketDataResult,
      { status: 500 }
    );
  }
}
