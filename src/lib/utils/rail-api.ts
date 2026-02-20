// National Rail operator lookup using Wikidata API
// Wikidata has structured data about UK train stations and their operators

interface WikidataSearchResult {
  search: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
}

interface WikidataEntity {
  entities: Record<string, {
    claims: {
      P361?: Array<{ mainsnak: { datavalue: { value: { id: string } } } }>; // part of (for TOCs)
      P137?: Array<{ mainsnak: { datavalue: { value: { id: string } } } }>; // operator
    };
  }>;
}

// Major UK train operating companies (TOCs) with their common names
const tocNames: Record<string, string> = {
  'Q1480969': 'Avanti West Coast',
  'Q1829079': 'c2c',
  'Q1480991': 'Chiltern Railways',
  'Q1480963': 'CrossCountry',
  'Q1480987': 'East Midlands Railway',
  'Q1480945': 'Eurostar',
  'Q1480981': 'Great Western Railway',
  'Q1480979': 'Greater Anglia',
  'Q1480989': 'London North Eastern Railway',
  'Q1480959': 'Northern',
  'Q1480971': 'ScotRail',
  'Q1480985': 'Southeastern',
  'Q1480967': 'Southern',
  'Q1480957': 'South Western Railway',
  'Q1480993': 'Thameslink',
  'Q1480975': 'TransPennine Express',
  'Q1480977': 'Transport for Wales',
  'Q1480955': 'West Midlands Railway',
  'Q201966': 'London Overground',
  'Q185532': 'Elizabeth Line',
  'Q215682': 'Merseyrail',
  'Q783533': 'Heathrow Express',
  'Q666639': 'Island Line',
};

/**
 * Get train operator for a station using Wikidata API
 * @param stationName - The station name from Google Places
 * @returns Array of operator names or empty array if not found
 */
export async function getRailOperatorsFromWikidata(stationName: string): Promise<string[]> {
  try {
    // Clean up station name
    const searchQuery = stationName
      .replace(/\s+station$/i, '')
      .replace(/\s+railway$/i, '');
    
    // Step 1: Search for the station in Wikidata
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchQuery + ' railway station')}&format=json&language=en&type=item&origin=*`;
    
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      console.log(`Wikidata search error for ${stationName}: ${searchResponse.status}`);
      return [];
    }
    
    const searchData: WikidataSearchResult = await searchResponse.json();
    
    if (!searchData.search || searchData.search.length === 0) {
      return [];
    }
    
    // Find best match
    const upperQuery = searchQuery.toUpperCase();
    const match = searchData.search.find(s => 
      s.label.toUpperCase().includes(upperQuery) ||
      (s.description && s.description.toLowerCase().includes('railway station'))
    ) || searchData.search[0];
    
    // Step 2: Get entity details to find operator
    const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${match.id}&format=json&props=claims&origin=*`;
    
    const entityResponse = await fetch(entityUrl);
    if (!entityResponse.ok) {
      return [];
    }
    
    const entityData: WikidataEntity = await entityResponse.json();
    const entity = entityData.entities[match.id];
    
    if (!entity || !entity.claims) {
      return [];
    }
    
    // Look for operator (P137) or part of (P361) claims
    const operatorIds: string[] = [];
    
    if (entity.claims.P137) {
      entity.claims.P137.forEach(claim => {
        if (claim.mainsnak?.datavalue?.value?.id) {
          operatorIds.push(claim.mainsnak.datavalue.value.id);
        }
      });
    }
    
    if (entity.claims.P361) {
      entity.claims.P361.forEach(claim => {
        if (claim.mainsnak?.datavalue?.value?.id) {
          operatorIds.push(claim.mainsnak.datavalue.value.id);
        }
      });
    }
    
    // Map operator IDs to names
    const operators = operatorIds
      .map(id => tocNames[id])
      .filter(Boolean);
    
    return [...new Set(operators)];
    
  } catch (error) {
    console.error(`Error fetching Wikidata for ${stationName}:`, error);
    return [];
  }
}

/**
 * Alternative: Use a simple heuristic based on station name patterns
 * This works for many stations without API calls
 */
export function getOperatorFromHeuristics(stationName: string): string[] {
  const upper = stationName.toUpperCase();
  const operators: string[] = [];
  
  // London terminals
  if (upper.includes('LONDON')) {
    if (upper.includes('EUSTON')) operators.push('Avanti West Coast');
    if (upper.includes('KING') || upper.includes('ST PANCRAS')) operators.push('Great Northern', 'Eurostar', 'Thameslink');
    if (upper.includes('LIVERPOOL')) operators.push('Greater Anglia');
    if (upper.includes('PADDINGTON')) operators.push('Great Western Railway', 'Elizabeth');
    if (upper.includes('VICTORIA')) operators.push('Southeastern', 'Southern');
    if (upper.includes('WATERLOO')) operators.push('South Western Railway');
    if (upper.includes('BRIDGE')) operators.push('Southeastern', 'Thameslink');
    if (upper.includes('CANNON')) operators.push('Southeastern');
    if (upper.includes('CHARING')) operators.push('Southeastern');
    if (upper.includes('MARYLEBONE')) operators.push('Chiltern Railways');
    if (upper.includes('FENCHURCH')) operators.push('c2c');
  }
  
  // Regional patterns
  if (upper.includes('MANCHESTER')) operators.push('Avanti West Coast', 'Northern', 'TransPennine Express');
  if (upper.includes('BIRMINGHAM')) operators.push('Avanti West Coast', 'West Midlands Railway', 'CrossCountry');
  if (upper.includes('LEEDS')) operators.push('Avanti West Coast', 'Northern', 'TransPennine Express');
  if (upper.includes('GLASGOW')) operators.push('Avanti West Coast', 'ScotRail', 'CrossCountry');
  if (upper.includes('EDINBURGH')) operators.push('Avanti West Coast', 'ScotRail', 'CrossCountry', 'TransPennine Express');
  if (upper.includes('BRISTOL')) operators.push('Great Western Railway', 'CrossCountry');
  if (upper.includes('CARDIFF')) operators.push('Transport for Wales', 'CrossCountry');
  if (upper.includes('LIVERPOOL')) operators.push('Avanti West Coast', 'Northern', 'TransPennine Express', 'Merseyrail');
  if (upper.includes('NEWCASTLE')) operators.push('Avanti West Coast', 'Northern', 'TransPennine Express', 'CrossCountry', 'LNER');
  if (upper.includes('SHEFFIELD')) operators.push('Avanti West Coast', 'Northern', 'TransPennine Express', 'East Midlands Railway');
  if (upper.includes('NOTTINGHAM')) operators.push('East Midlands Railway', 'CrossCountry');
  if (upper.includes('LEICESTER')) operators.push('East Midlands Railway', 'CrossCountry');
  if (upper.includes('OXFORD')) operators.push('Great Western Railway', 'CrossCountry', 'Chiltern Railways');
  if (upper.includes('CAMBRIDGE')) operators.push('Greater Anglia', 'Thameslink');
  if (upper.includes('BRIGHTON')) operators.push('Southern', 'Thameslink', 'Great Western Railway');
  if (upper.includes('READING')) operators.push('Great Western Railway', 'Elizabeth', 'CrossCountry');
  
  // Suburban London patterns
  if (upper.includes('BARNET') || upper.includes('OAKLEIGH') || upper.includes('HADLEY')) {
    operators.push('Great Northern');
  }
  if (upper.includes('KENT') || upper.includes('ORPINGTON') || upper.includes('BROMLEY')) {
    operators.push('Southeastern');
  }
  if (upper.includes('SURREY') || upper.includes('WOKING') || upper.includes('GUILDFORD')) {
    operators.push('South Western Railway');
  }
  
  return [...new Set(operators)];
}

/**
 * Combined function: Try lookup table first, then Wikidata API, then heuristics
 */
export async function getRailOperators(stationName: string): Promise<string[]> {
  // This will be implemented in station-lines.ts to combine all sources
  return [];
}