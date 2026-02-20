// TfL Unified API integration for tube/Overground/DLR/Elizabeth line data
// https://api.tfl.gov.uk/

interface TfLMatchedStop {
  id: string;
  name: string;
  modes: string[];
}

interface TfLSearchResponse {
  matches: TfLMatchedStop[];
}

interface TfLStopPointDetail {
  id: string;
  name: string;
  lines: {
    id: string;
    name: string;
  }[];
}

// Map TfL line names to our standard names
const tflLineMapping: Record<string, string> = {
  'bakerloo': 'Bakerloo',
  'central': 'Central',
  'circle': 'Circle',
  'district': 'District',
  'hammersmith-city': 'Hammersmith & City',
  'jubilee': 'Jubilee',
  'metropolitan': 'Metropolitan',
  'northern': 'Northern',
  'piccadilly': 'Piccadilly',
  'victoria': 'Victoria',
  'waterloo-city': 'Waterloo & City',
  'elizabeth': 'Elizabeth',
  'dlr': 'DLR',
  'london-overground': 'Overground',
  'tram': 'Tram',
};

/**
 * Get tube/DLR/Overground/Elizabeth lines for a station using TfL API
 * @param stationName - The station name from Google Places
 * @returns Array of line names or empty array if not found
 */
export async function getTfLLines(stationName: string): Promise<string[]> {
  try {
    // Clean up station name for search
    const searchQuery = stationName
      .replace(/\s+station$/i, '')
      .replace(/\s+tube$/i, '')
      .replace(/\s+underground$/i, '');
    
    const url = `https://api.tfl.gov.uk/StopPoint/Search?query=${encodeURIComponent(searchQuery)}&modes=tube,dlr,overground,elizabeth-line&maxResults=3`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`TfL API error for ${stationName}: ${response.status}`);
      return [];
    }
    
    const data: TfLSearchResponse = await response.json();
    
    if (!data.matches || data.matches.length === 0) {
      return [];
    }
    
    // Find best match - check if name contains our search term
    const upperQuery = searchQuery.toUpperCase();
    const match = data.matches.find(m => 
      m.name.toUpperCase().includes(upperQuery) || 
      upperQuery.includes(m.name.toUpperCase().replace(' STATION', ''))
    ) || data.matches[0];
    
    // Step 2: Get line details using the stop point ID
    const detailUrl = `https://api.tfl.gov.uk/StopPoint/${match.id}`;
    const detailResponse = await fetch(detailUrl);
    
    if (!detailResponse.ok) {
      console.log(`TfL API detail error for ${stationName}: ${detailResponse.status}`);
      return [];
    }
    
    const detailData: TfLStopPointDetail = await detailResponse.json();
    
    // Extract line names
    const lines = detailData.lines
      .map(line => tflLineMapping[line.id] || line.name)
      .filter(Boolean);
    
    // Remove duplicates
    return [...new Set(lines)];
    
  } catch (error) {
    console.error(`Error fetching TfL data for ${stationName}:`, error);
    return [];
  }
}

/**
 * Batch fetch lines for multiple stations
 * Useful when analyzing a property with multiple nearby stations
 */
export async function getTfLLinesForStations(stationNames: string[]): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  
  // Fetch in parallel with rate limiting
  const promises = stationNames.map(async (name) => {
    const lines = await getTfLLines(name);
    results.set(name, lines);
  });
  
  await Promise.all(promises);
  return results;
}