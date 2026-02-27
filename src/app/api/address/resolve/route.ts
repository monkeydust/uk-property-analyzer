import { NextRequest, NextResponse } from 'next/server';
import { Property, AnalysisResponse } from '@/lib/types/property';
import { reverseGeocode } from '@/lib/utils/google-maps';
import logger from '@/lib/logger';
import { propertyCache, TTL } from '@/lib/cache';

export async function POST(request: NextRequest): Promise<NextResponse<AnalysisResponse>> {
    try {
        const body = await request.json();
        const { placeId } = body;

        if (!placeId) {
            return NextResponse.json(
                { success: false, error: 'placeId is required' },
                { status: 400 }
            );
        }

        const cacheKey = `place::${placeId}`;
        const cached = propertyCache.get(cacheKey);
        if (cached) {
            logger.info(`Cache HIT | ${cacheKey}`, 'address-resolve');
            return NextResponse.json(cached);
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: 'Google Maps API key is missing' },
                { status: 500 }
            );
        }

        // 1. Fetch Place Details for exact address components and geometry
        const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
        url.searchParams.set('place_id', placeId);
        url.searchParams.set('fields', 'address_components,geometry,formatted_address,name');
        url.searchParams.set('key', apiKey);

        const response = await fetch(url.toString());
        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch Place Details' },
                { status: response.status }
            );
        }

        const data = await response.json();
        if (data.status !== 'OK' || !data.result) {
            logger.error(`Google Places API error: ${data.status}`, 'address-resolve');
            return NextResponse.json(
                { success: false, error: 'Failed to resolve address details' },
                { status: 400 }
            );
        }

        const result = data.result;
        const components = result.address_components || [];
        let streetNumber: string | null = null;
        let streetName: string | null = null;
        let postcode: string | null = null;

        for (const component of components) {
            if (component.types.includes('street_number')) {
                streetNumber = component.long_name;
            }
            if (component.types.includes('route')) {
                streetName = component.long_name;
            }
            if (component.types.includes('postal_code')) {
                postcode = component.long_name;
            }
            if (component.types.includes('premise') && !streetNumber) {
                streetNumber = component.long_name;
            }
        }

        const coordinates = result.geometry?.location
            ? {
                latitude: result.geometry.location.lat,
                longitude: result.geometry.location.lng,
            }
            : null;

        if (!coordinates) {
            return NextResponse.json(
                { success: false, error: 'No coordinates found for this location' },
                { status: 400 }
            );
        }

        const postcodeOutward = postcode ? postcode.split(' ')[0] : null;
        const postcodeInward = postcode && postcode.includes(' ') ? postcode.split(' ')[1] : null;

        const property: Property = {
            id: placeId,
            sourceUrl: `off-market://${placeId}`, // Synthetic URL as internal ID to satisfy DB constraints
            price: null,
            pricePerSqFt: null,
            listingType: 'off-market',
            isOnMarket: false,
            bedrooms: null,
            bathrooms: null,
            squareFootage: null,
            propertyType: 'unknown',
            address: {
                displayAddress: result.formatted_address || '',
                streetName,
                doorNumber: streetNumber,
                postcode,
                postcodeOutward,
                postcodeInward,
            },
            epc: null,
            description: 'Off-Market Property Analysis',
            features: [],
            images: [],
            coordinates,
            nearestStations: null,
            nearestTubeStations: null,
            scrapedAt: new Date().toISOString(),
        };

        const responseData: AnalysisResponse = {
            success: true,
            data: {
                id: property.id,
                property,
                postcode: property.address.postcode,
            },
            logs: logger.getAll(),
        };

        propertyCache.set(cacheKey, responseData, TTL.PROPERTY);
        logger.info(`Cached for ${TTL.PROPERTY / 3600}h | ${cacheKey}`, 'address-resolve');

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Error resolving address:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error while resolving address' },
            { status: 500 }
        );
    }
}
