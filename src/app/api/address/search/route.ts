import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Query parameter q is required' },
                { status: 400 }
            );
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.error('GOOGLE_MAPS_API_KEY is not set');
            return NextResponse.json(
                { success: false, error: 'Google Maps API key is missing' },
                { status: 500 }
            );
        }

        const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
        url.searchParams.set('input', query);
        url.searchParams.set('components', 'country:gb');
        url.searchParams.set('key', apiKey);

        const response = await fetch(url.toString());

        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: 'Failed to fetch from Google Places API' },
                { status: response.status }
            );
        }

        const data = await response.json();

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            console.error('Google Places Autocomplete API error:', data.status, data.error_message);
            return NextResponse.json(
                { success: false, error: data.error_message || 'API Error' },
                { status: 400 }
            );
        }

        const predictions = (data.predictions || []).map((p: any) => ({
            placeId: p.place_id,
            description: p.description,
            mainText: p.structured_formatting?.main_text || '',
            secondaryText: p.structured_formatting?.secondary_text || '',
        }));

        return NextResponse.json({ success: true, predictions });
    } catch (error) {
        console.error('Error in address search:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
