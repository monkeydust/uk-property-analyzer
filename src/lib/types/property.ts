export interface Property {
  id: string;
  sourceUrl: string;

  // Price
  price: number | null;
  pricePerSqFt: number | null;
  priceQualifier?: string;
  listingType: 'sale' | 'rent';

  // Property details
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  propertyType: string;

  // Location
  address: {
    displayAddress: string;
    streetName: string | null;
    doorNumber: string | null;
    postcode: string | null;
    postcodeOutward: string | null;
    postcodeInward: string | null;
  };

  // EPC
  epc: {
    currentRating: string | null;
    potentialRating: string | null;
    graphUrl: string | null;
  } | null;

  // Additional
  description: string;
  features: string[];
  images: string[];

  // Location
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;

  // Nearest rail stations (via Google Places)
  nearestStations: {
    name: string;
    operators?: string[];    // e.g. ["Thameslink", "Great Western"]
    walkingTime?: number;    // minutes
    walkingDistance?: number; // meters
  }[] | null;

  // Nearest tube stations (via Google Places)
  nearestTubeStations: {
    name: string;
    lines?: string[];        // e.g. ["Central", "Victoria"]
    walkingTime?: number;    // minutes
    walkingDistance?: number; // meters
  }[] | null;

  // Commute times to benchmark destinations
  commuteTimes?: {
    destination: string;
    durationSeconds: number;
    durationText: string;
    benchmarkDiffSeconds: number;
    benchmarkDiffText: string;
    isFaster: boolean;
    arrivalTime: string;
  }[];

  // Meta
  scrapedAt: string;
}

export interface ScrapeResult {
  success: boolean;
  property?: Property;
  error?: string;
}

export interface AnalysisResponse {
  success: boolean;
  data?: {
    id: string;
    property: Property;
    postcode: string | null;
  };
  logs?: {
    id: string;
    timestamp: string;
    level: string;
    message: string;
    source?: string;
  }[];
  error?: string;
}

// School attendance data from Locrating — "Schools Attended" panel
// Shows which schools pupils from a given LSOA (neighbourhood) actually attend

export interface AttendedSchool {
  urn: string;                   // e.g. "urn101333"
  name: string;                  // e.g. "Queen Elizabeth's Girls' School"
  phase: 'primary' | 'secondary';
  percentage: number;            // % of local pupils attending (e.g. 20)
  ofstedRating: string | null;   // "Outstanding" | "Good" | "Requires Improvement" | "Inadequate"
  ofstedRatingNumber: number | null; // 1=Outstanding, 2=Good, 3=RI, 4=Inadequate
  admissionsPolicy: string;      // "" or "selective" (Grammar schools)
  isGrammar: boolean;            // true if admissionsPolicy === "selective"
  coordinates: {
    lat: number;
    lng: number;
  };
  locratingRatingNumber: string; // from API (usually "0")
  crowFliesDistance?: number;  // km, straight-line from property
  walkingTime?: number;        // minutes (Google Distance Matrix)
  walkingDistance?: number;     // meters (Google Distance Matrix)
}

export interface AttendedSchoolsResult {
  success: boolean;
  areaName: string | null;       // LSOA area name, e.g. "Barnet 005C"
  coordinates: {                 // coordinates used for lookup
    lat: number;
    lng: number;
  } | null;
  primarySchools: AttendedSchool[];
  secondarySchools: AttendedSchool[];
  error?: string;
}
