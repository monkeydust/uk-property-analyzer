import { NextRequest, NextResponse } from 'next/server';
import { scrapeRightmoveProperty, isValidRightmoveUrl } from '@/lib/scraper/rightmove';
import { AnalysisResponse } from '@/lib/types/property';
import { getWalkingDistances, reverseGeocode, findNearbyTrainStations, findNearbyTubeStations, getCoordinatesFromPostcode } from '@/lib/utils/google-maps';
import { propertyCache, TTL } from '@/lib/cache';

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!isValidRightmoveUrl(url)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Rightmove URL. Please provide a valid property URL.' },
        { status: 400 }
      );
    }

    // Normalise URL for cache key (strip tracking params)
    const cacheKey = url.split('?')[0].replace(/\/$/, '');
    const cached = propertyCache.get(cacheKey);
    if (cached) {
      console.log(`[Analyze] Cache HIT | ${cacheKey}`);
      return NextResponse.json(cached);
    }
    console.log(`[Analyze] Cache MISS — scraping | ${cacheKey}`);

    // Scrape the property
    const scrapeResult = await scrapeRightmoveProperty(url);

    if (!scrapeResult.success || !scrapeResult.property) {
      return NextResponse.json(
        { success: false, error: scrapeResult.error || 'Failed to scrape property' },
        { status: 422 }
      );
    }

    const property = scrapeResult.property;

    // Find nearest stations
    let coordinates = property.coordinates;

    // If no coordinates from Rightmove, try Postcodes.io
    if (!coordinates && property.address.postcode) {
      console.log('Fetching coordinates from Postcodes.io for:', property.address.postcode);
      coordinates = await getCoordinatesFromPostcode(property.address.postcode);
      if (coordinates) {
        property.coordinates = coordinates;
        console.log('Coordinates from Postcodes.io:', coordinates);
      }
    }

    // Try to get door number via reverse geocoding if we have coordinates
    if (coordinates && !property.address.doorNumber) {
      console.log('Attempting reverse geocoding for door number...');
      const geocodeResult = await reverseGeocode(
        coordinates.latitude,
        coordinates.longitude
      );

      if (geocodeResult?.streetNumber) {
        property.address.doorNumber = geocodeResult.streetNumber;
        console.log('Door number from reverse geocoding:', geocodeResult.streetNumber);
      }

      // Also update street name if we got a better one
      if (geocodeResult?.streetName && !property.address.streetName) {
        property.address.streetName = geocodeResult.streetName;
      }
    }

    // Find nearest rail stations via Google Places
    if (coordinates) {
      const trainStations = await findNearbyTrainStations(
        coordinates.latitude,
        coordinates.longitude,
        3
      );
      console.log('Nearest train stations:', trainStations);

      if (trainStations && trainStations.length > 0) {
        const walkingResults = await getWalkingDistances(
          coordinates.latitude,
          coordinates.longitude,
          trainStations
        );

        property.nearestStations = trainStations.map((station) => {
          const walkingData = walkingResults?.find((w) => w.destination === station.name);
          return {
            name: station.name,
            walkingTime: walkingData ? Math.round(walkingData.durationSeconds / 60) : undefined,
            walkingDistance: walkingData?.distanceMeters,
          };
        });

        if (walkingResults) {
          console.log('Rail walking times fetched from Google Maps');
        }
      } else {
        property.nearestStations = trainStations; // null (API error) or [] (none found)
      }

      // Find nearest tube stations via Google Places
      const tubeStations = await findNearbyTubeStations(
        coordinates.latitude,
        coordinates.longitude,
        3
      );

      if (tubeStations && tubeStations.length > 0) {
        const tubeWalkingResults = await getWalkingDistances(
          coordinates.latitude,
          coordinates.longitude,
          tubeStations
        );

        property.nearestTubeStations = tubeStations.map((station) => {
          const walkingData = tubeWalkingResults?.find((w) => w.destination === station.name);
          return {
            name: station.name,
            walkingTime: walkingData ? Math.round(walkingData.durationSeconds / 60) : undefined,
            walkingDistance: walkingData?.distanceMeters,
          };
        });

        if (tubeWalkingResults) {
          console.log('Tube walking times fetched from Google Maps');
        }
      } else {
        property.nearestTubeStations = tubeStations; // null (API error) or [] (none found)
      }
    }

    const responseData = {
      success: true,
      data: {
        id: property.id,
        property,
        postcode: property.address.postcode,
      },
    };
    propertyCache.set(cacheKey, responseData, TTL.PROPERTY);
    console.log(`[Analyze] Cached for ${TTL.PROPERTY / 3600}h | ${cacheKey}`);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
