import { NextRequest, NextResponse } from 'next/server';
import { scrapeRightmoveProperty, isValidRightmoveUrl } from '@/lib/scraper/rightmove';
import { AnalysisResponse } from '@/lib/types/property';
import { reverseGeocode, getCoordinatesFromPostcode } from '@/lib/utils/google-maps';
import { propertyCache, schoolsCache, aiCache, TTL } from '@/lib/cache';
import logger from '@/lib/logger';
import { getPlotSizeAcres } from '@/lib/propertydata/plot-size';

function buildFullAddressForPropertyData(input: {
  doorNumber: string | null;
  streetName: string | null;
  displayAddress: string;
  postcode: string | null;
}): string | null {
  if (!input.postcode) return null;
  const normalizedPostcode = input.postcode.toUpperCase().trim();
  const outward = normalizedPostcode.replace(/\s+/g, '').length >= 5
    ? normalizedPostcode.replace(/\s+/g, '').slice(0, -3)
    : normalizedPostcode;

  const parts: string[] = [];

  if (input.doorNumber) parts.push(input.doorNumber);
  if (input.streetName) parts.push(input.streetName);

  // Append the locality (town/county) from displayAddress, minus the street if it repeats.
  const displayParts = input.displayAddress
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const streetLower = (input.streetName || '').toLowerCase();
  const locality = displayParts
    .filter((p) => p.toLowerCase() !== streetLower)
    .filter((p) => {
      const u = p.toUpperCase();
      return u !== outward && u !== normalizedPostcode;
    })
    .join(', ');
  if (locality) parts.push(locality);

  parts.push(normalizedPostcode);

  // De-dupe consecutive duplicates
  const deduped: string[] = [];
  for (const p of parts) {
    if (deduped.length === 0 || deduped[deduped.length - 1].toLowerCase() !== p.toLowerCase()) {
      deduped.push(p);
    }
  }

  return deduped.join(', ');
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
  try {
    const body = await request.json();
    const { url, bustCache } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      logger.warn('URL is required', 'analyze');
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!isValidRightmoveUrl(url)) {
      logger.warn(`Invalid Rightmove URL: ${url}`, 'analyze');
      return NextResponse.json(
        { success: false, error: 'Invalid Rightmove URL. Please provide a valid property URL.' },
        { status: 400 }
      );
    }

    // Normalise URL for cache key (strip tracking params)
    const cacheKey = url.split('?')[0].replace(/\/$/, '');

    // If bustCache is set, clear all caches for this URL
    if (bustCache) {
      logger.info(`Cache BUST requested | ${cacheKey}`, 'analyze');
      propertyCache.delete(cacheKey);
      aiCache.deleteMatching(cacheKey);
      schoolsCache.deleteMatching(cacheKey);
    }

    const cached = propertyCache.get(cacheKey);
    if (cached) {
      logger.info(`Cache HIT | ${cacheKey}`, 'analyze');
      return NextResponse.json(cached);
    }
    logger.info(`Cache MISS — scraping | ${cacheKey}`, 'analyze');

    // Scrape the property
    const scrapeResult = await scrapeRightmoveProperty(url);

    if (!scrapeResult.success || !scrapeResult.property) {
      logger.error(`Scrape failed: ${scrapeResult.error}`, 'analyze');
      return NextResponse.json(
        { success: false, error: scrapeResult.error || 'Failed to scrape property', logs: logger.getAll() },
        { status: 422 }
      );
    }

    const property = scrapeResult.property;

    // Get coordinates
    let coordinates = property.coordinates;

    // If no coordinates from Rightmove, try Postcodes.io
    if (!coordinates && property.address.postcode) {
      logger.info(`Fetching coordinates from Postcodes.io for: ${property.address.postcode}`, 'analyze');
      coordinates = await getCoordinatesFromPostcode(property.address.postcode);
      if (coordinates) {
        property.coordinates = coordinates;
        logger.info(`Coordinates from Postcodes.io: ${coordinates.latitude}, ${coordinates.longitude}`, 'analyze');
      }
    }

    // Try to get door number via reverse geocoding if we have coordinates
    if (coordinates && !property.address.doorNumber) {
      logger.info('Attempting reverse geocoding for door number...', 'analyze');
      const geocodeResult = await reverseGeocode(
        coordinates.latitude,
        coordinates.longitude
      );

      if (geocodeResult?.streetNumber) {
        property.address.doorNumber = geocodeResult.streetNumber;
        logger.info(`Door number from reverse geocoding: ${geocodeResult.streetNumber}`, 'analyze');
      }

      if (geocodeResult?.streetName && !property.address.streetName) {
        property.address.streetName = geocodeResult.streetName;
      }
    }

    // Stations and commute times are now fetched by separate endpoints
    // /api/stations and /api/commute - called in parallel by the frontend

    // PropertyData enrichment: plot size (acres)
    try {
      const fullAddress = buildFullAddressForPropertyData({
        doorNumber: property.address.doorNumber,
        streetName: property.address.streetName,
        displayAddress: property.address.displayAddress,
        postcode: property.address.postcode,
      });

      if (fullAddress) {
        const plot = await getPlotSizeAcres({
          address: fullAddress,
          postcode: property.address.postcode,
          streetName: property.address.streetName,
          doorNumber: property.address.doorNumber,
          coordinates: property.coordinates,
        });

        property.plotSizeAcres = plot.plotSizeAcres;
        property.plotSizeUprn = plot.uprn;
        property.plotSizeTitleNumber = plot.titleNumber;
        property.plotSizeMethod = plot.method;

        if (plot.plotSizeAcres !== null) {
          logger.info(`Plot size found: ${plot.plotSizeAcres} acres (method=${plot.method})`, 'analyze');
        } else {
          logger.info('Plot size not found (PropertyData)', 'analyze');
        }
      }
    } catch (error) {
      logger.warn(`PropertyData plot size lookup failed: ${String(error)}`, 'analyze');
    }

    // Market data is fetched separately by the frontend via /api/market-data
    // This avoids throttling from too many PropertyData calls in one request

    const responseData = {
      success: true,
      data: {
        id: property.id,
        property,
        postcode: property.address.postcode,
      },
      logs: logger.getAll(),
    };
    propertyCache.set(cacheKey, responseData, TTL.PROPERTY);
    logger.info(`Cached for ${TTL.PROPERTY / 3600}h | ${cacheKey}`, 'analyze');
    return NextResponse.json(responseData);
  } catch (error) {
    logger.error(`Analysis error: ${error}`, 'analyze');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
