interface GooglePlacesNearbyResponse {
  results: {
    name: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    vicinity: string;
  }[];
  status: string;
}

interface ReverseGeocodeResult {
  formattedAddress: string;
  streetNumber: string | null;
  streetName: string | null;
  postcode: string | null;
}

interface GoogleGeocodeResponse {
  results: {
    formatted_address: string;
    address_components: {
      long_name: string;
      short_name: string;
      types: string[];
    }[];
  }[];
  status: string;
}

interface DistanceMatrixResult {
  destination: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
}

interface GoogleDistanceMatrixResponse {
  rows: {
    elements: {
      status: string;
      distance?: { value: number; text: string };
      duration?: { value: number; text: string };
    }[];
  }[];
  status: string;
}

/**
 * Get walking distances and times from origin to multiple destinations
 * using Google Maps Distance Matrix API
 */
export async function getWalkingDistances(
  originLat: number,
  originLng: number,
  destinations: { name: string; lat: number; lng: number }[]
): Promise<DistanceMatrixResult[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.log('GOOGLE_MAPS_API_KEY not set, skipping walking time calculation');
    return null;
  }

  if (destinations.length === 0) {
    return [];
  }

  try {
    const origin = `${originLat},${originLng}`;
    const destinationsStr = destinations
      .map((d) => `${d.lat},${d.lng}`)
      .join('|');

    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', origin);
    url.searchParams.set('destinations', destinationsStr);
    url.searchParams.set('mode', 'walking');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Google Maps API error:', response.status);
      return null;
    }

    const data: GoogleDistanceMatrixResponse = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Maps API status:', data.status);
      return null;
    }

    const results: DistanceMatrixResult[] = [];
    const elements = data.rows[0]?.elements || [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.status === 'OK' && element.distance && element.duration) {
        results.push({
          destination: destinations[i].name,
          distanceMeters: element.distance.value,
          distanceText: element.distance.text,
          durationSeconds: element.duration.value,
          durationText: element.duration.text,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error calling Google Maps API:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to get full address including door number
 * using Google Maps Geocoding API
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.log('GOOGLE_MAPS_API_KEY not set, skipping reverse geocoding');
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('result_type', 'street_address|premise');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Google Geocoding API error:', response.status);
      return null;
    }

    const data: GoogleGeocodeResponse = await response.json();

    if (data.status !== 'OK' || !data.results[0]) {
      console.log('Reverse geocoding status:', data.status);
      return null;
    }

    const result = data.results[0];
    const components = result.address_components;

    // Extract address components
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
      // Also check for premise (building name)
      if (component.types.includes('premise') && !streetNumber) {
        streetNumber = component.long_name;
      }
    }

    console.log('Reverse geocode result:', {
      formattedAddress: result.formatted_address,
      streetNumber,
      streetName,
      postcode,
    });

    return {
      formattedAddress: result.formatted_address,
      streetNumber,
      streetName,
      postcode,
    };
  } catch (error) {
    console.error('Error calling Google Geocoding API:', error);
    return null;
  }
}

/**
 * Find nearby stations of a given type using Google Places Nearby Search API.
 * Uses rankby=distance to get results sorted by proximity.
 * Returns null if no API key or API error; returns [] if no stations found.
 */
async function findNearbyStations(
  lat: number,
  lng: number,
  type: 'train_station' | 'subway_station',
  count: number = 3
): Promise<{ name: string; lat: number; lng: number }[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.log(`GOOGLE_MAPS_API_KEY not set, skipping ${type} lookup`);
    return null;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('rankby', 'distance');
    url.searchParams.set('type', type);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Google Places API error:', response.status);
      return null;
    }

    const data: GooglePlacesNearbyResponse = await response.json();

    if (data.status === 'ZERO_RESULTS') {
      console.log(`No ${type} stations found nearby`);
      return [];
    }

    if (data.status !== 'OK') {
      console.error('Google Places API status:', data.status);
      return null;
    }

    // Results are already sorted by distance thanks to rankby=distance
    return data.results.slice(0, count).map((place) => ({
      name: place.name,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    }));
  } catch (error) {
    console.error(`Error calling Google Places API (${type}):`, error);
    return null;
  }
}

/**
 * Find nearby National Rail / train stations via Google Places.
 */
export async function findNearbyTrainStations(
  lat: number,
  lng: number,
  count: number = 3
): Promise<{ name: string; lat: number; lng: number }[] | null> {
  return findNearbyStations(lat, lng, 'train_station', count);
}

/**
 * Find nearby London Underground (Tube) stations via Google Places.
 */
export async function findNearbyTubeStations(
  lat: number,
  lng: number,
  count: number = 3
): Promise<{ name: string; lat: number; lng: number }[] | null> {
  return findNearbyStations(lat, lng, 'subway_station', count);
}

/**
 * Get coordinates from a UK postcode using Postcodes.io API
 */
export async function getCoordinatesFromPostcode(
  postcode: string
): Promise<{ latitude: number; longitude: number } | null> {
  try {
    // Clean and encode the postcode
    const cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(cleanPostcode)}`
    );

    if (!response.ok) {
      console.log('Postcodes.io API error:', response.status);
      return null;
    }

    const data = await response.json();

    if (data.status === 200 && data.result) {
      return {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching coordinates from postcode:', error);
    return null;
  }
}

/**
 * Calculate the Haversine (crow-flies) distance between two lat/lng points.
 * Returns distance in kilometres.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
