import { NextRequest, NextResponse } from 'next/server';
import { getAttendedSchools } from '@/lib/scraper/locrating';
import { AttendedSchool, AttendedSchoolsResult } from '@/lib/types/property';
import { getWalkingDistances, haversineDistance } from '@/lib/utils/google-maps';
import { schoolsCache, TTL } from '@/lib/cache';
import logger from '@/lib/logger';

export const maxDuration = 300; // Playwright scrape can take 60-90s

/**
 * Enrich schools with crow-flies distances (all schools) and walking
 * distances (top 5 per phase with ≥1% attendance) when property
 * coordinates are provided.
 */
async function enrichWithDistances(
  result: AttendedSchoolsResult,
  lat: number,
  lng: number
): Promise<void> {
  // 1. Compute crow-flies for ALL schools (free, instant math)
  for (const school of [...result.primarySchools, ...result.secondarySchools]) {
    school.crowFliesDistance = haversineDistance(lat, lng, school.coordinates.lat, school.coordinates.lng);
  }

  // 2. Walking distances for top 5 per phase (≥1% attendance, sorted by %)
  const enrichWithWalking = async (schools: AttendedSchool[]) => {
    const top5 = schools
      .filter(s => s.percentage >= 1)
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    if (top5.length === 0) return;

    const destinations = top5.map(s => ({
      name: s.name,
      lat: s.coordinates.lat,
      lng: s.coordinates.lng,
    }));

    const walkingResults = await getWalkingDistances(lat, lng, destinations);
    if (!walkingResults) return;

    for (const wr of walkingResults) {
      const school = schools.find(s => s.name === wr.destination);
      if (school) {
        school.walkingTime = Math.round(wr.durationSeconds / 60);
        school.walkingDistance = wr.distanceMeters;
      }
    }
  };

  await Promise.all([
    enrichWithWalking(result.primarySchools),
    enrichWithWalking(result.secondarySchools),
  ]);
}

/**
 * GET /api/schools?address=35,+The+Fairway,+Barnet,+EN5+1HH&lat=51.65&lng=-0.19
 *
 * Returns the "Schools Attended" data for a given address — showing which
 * primary and secondary schools pupils from the neighbourhood actually attend,
 * with percentages, Ofsted ratings, and Grammar school flags.
 *
 * When lat/lng are provided, also computes crow-flies distances (all schools)
 * and walking distances (top 5 per phase) via Google Maps.
 *
 * The data comes from Locrating.com's GetAttendedSchools_plugin API,
 * which provides neighbourhood-level (LSOA) school attendance breakdowns.
 */
export async function GET(request: NextRequest): Promise<NextResponse<AttendedSchoolsResult>> {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return NextResponse.json(
        {
          success: false,
          areaName: null,
          coordinates: null,
          primarySchools: [],
          secondarySchools: [],
          error: 'Address is required. Usage: /api/schools?address=35,+The+Fairway,+Barnet,+EN5+1HH',
        },
        { status: 400 }
      );
    }

    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const bustCache = searchParams.get('bustCache') === '1';
    const cacheKey = address.trim().toLowerCase();

    if (bustCache) {
      logger.info(`Cache BUST requested | "${address}"`, 'schools');
      schoolsCache.delete(cacheKey);
    }

    const cached = schoolsCache.get(cacheKey);
    if (cached) {
      logger.info(`Cache HIT | "${address}"`, 'schools');
      return NextResponse.json({ ...cached, logs: logger.getAll() });
    }

    logger.info(`Cache MISS — fetching attended schools for "${address}"${!isNaN(lat) ? ` (coords: ${lat}, ${lng})` : ''}`, 'schools');
    const result = await getAttendedSchools(
      address.trim(),
      !isNaN(lat) ? lat : undefined,
      !isNaN(lng) ? lng : undefined
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    // Enrich with distances if property coordinates provided
    if (!isNaN(lat) && !isNaN(lng)) {
      await enrichWithDistances(result, lat, lng);
    }

    schoolsCache.set(cacheKey, result, TTL.SCHOOLS);
    logger.info(`Cached for ${TTL.SCHOOLS / 3600 / 24}d | "${address}"`, 'schools');
    return NextResponse.json({ ...result, logs: logger.getAll() });
  } catch (error) {
    logger.error(`Schools API error: ${error}`, 'schools');
    return NextResponse.json(
      {
        success: false,
        areaName: null,
        coordinates: null,
        primarySchools: [],
        secondarySchools: [],
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/schools  { address: "35, The Fairway, Barnet, EN5 1HH", lat: 51.65, lng: -0.19 }
 *
 * Alternative method — accepts address (and optional lat/lng) in request body.
 */
export async function POST(request: NextRequest): Promise<NextResponse<AttendedSchoolsResult>> {
  try {
    const body = await request.json();
    const { address, lat, lng } = body;

    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return NextResponse.json(
        {
          success: false,
          areaName: null,
          coordinates: null,
          primarySchools: [],
          secondarySchools: [],
          error: 'Address is required in request body: { "address": "35, The Fairway, Barnet, EN5 1HH" }',
        },
        { status: 400 }
      );
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const cacheKey = address.trim().toLowerCase();
    const cached = schoolsCache.get(cacheKey);
    if (cached) {
      logger.info(`Cache HIT (POST) | "${address}"`, 'schools');
      return NextResponse.json({ ...cached, logs: logger.getAll() });
    }

    logger.info(`Cache MISS (POST) — fetching attended schools for "${address}"${!isNaN(parsedLat) ? ` (coords: ${parsedLat}, ${parsedLng})` : ''}`, 'schools');
    const result = await getAttendedSchools(
      address.trim(),
      !isNaN(parsedLat) ? parsedLat : undefined,
      !isNaN(parsedLng) ? parsedLng : undefined
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      await enrichWithDistances(result, parsedLat, parsedLng);
    }

    schoolsCache.set(cacheKey, result, TTL.SCHOOLS);
    logger.info(`Cached for ${TTL.SCHOOLS / 3600 / 24}d (POST) | "${address}"`, 'schools');
    return NextResponse.json({ ...result, logs: logger.getAll() });
  } catch (error) {
    logger.error(`Schools API error (POST): ${error}`, 'schools');
    return NextResponse.json(
      {
        success: false,
        areaName: null,
        coordinates: null,
        primarySchools: [],
        secondarySchools: [],
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
