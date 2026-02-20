// London Underground station line mappings
// Key is the station name (partial match supported)
export const tubeStationLines: Record<string, string[]> = {
  'Aldgate': ['Metropolitan', 'Circle', 'Hammersmith & City'],
  'Aldgate East': ['District', 'Hammersmith & City'],
  'Angel': ['Northern'],
  'Archway': ['Northern'],
  'Arsenal': ['Piccadilly'],
  'Baker Street': ['Metropolitan', 'Circle', 'Hammersmith & City', 'Bakerloo', 'Jubilee'],
  'Bank': ['Central', 'Northern', 'DLR'],
  'Barbican': ['Metropolitan', 'Circle', 'Hammersmith & City'],
  'Battersea Power Station': ['Northern'],
  'Battersea Park': ['Northern'],
  'Bayswater': ['District', 'Circle'],
  'Beckton': ['DLR'],
  'Barking': ['District', 'Hammersmith & City'],
  'Belsize Park': ['Northern'],
  'Bethnal Green': ['Central'],
  'Blackfriars': ['District', 'Circle'],
  'Bond Street': ['Central', 'Jubilee', 'Elizabeth'],
  'Borough': ['Northern'],
  'Boston Manor': ['Piccadilly'],
  'Bounds Green': ['Piccadilly'],
  'Bow Road': ['District', 'Hammersmith & City'],
  'Brixton': ['Victoria'],
  'Bromley-by-Bow': ['District', 'Hammersmith & City'],
  'Buckingham Palace': ['Jubilee', 'Victoria', 'Circle'],
  'Burnt Oak': ['Northern'],
  'Caledonian Road': ['Piccadilly'],
  'Camden Town': ['Northern'],
  'Canary Wharf': ['Jubilee', 'DLR', 'Elizabeth'],
  'Cannon Street': ['District', 'Circle'],
  'Canons Park': ['Jubilee'],
  'Chalfont & Latimer': ['Metropolitan', 'Chorleywood'],
  'Chalk Farm': ['Northern'],
  'Chancery Lane': ['Central'],
  'Charing Cross': ['Bakerloo', 'Northern', 'Jubilee'],
  'Chiswick Park': ['District'],
  'Chorleywood': ['Metropolitan'],
  'Clapham Common': ['Northern'],
  'Clapham North': ['Northern'],
  'Clapham South': ['Northern'],
  'Cockfosters': ['Piccadilly'],
  'Colindale': ['Northern'],
  'Colliers Wood': ['Northern'],
  'Covent Garden': ['Piccadilly', 'Northern'],
  'Crossharbour': ['DLR'],
  'Curzon Street': ['Elizabeth'],
  'Cutty Sark': ['DLR'],
  'Dagenham East': ['District'],
  'Dagenham Heathway': ['District'],
  'Dalston King\'s Cross': ['Victoria', 'Northern', 'Overground'],
  'Debden': ['Central'],
  'Deptford Bridge': ['DLR'],
  'Diamond Way': ['Northern'],
  'Dolman\'s Hill': ['Northern'],
  'Drypool': ['Northern'],
  'Duke\'s Park': ['DLR'],
  'East Acton': ['Central'],
  'East Finchley': ['Northern'],
  'East Ham': ['District', 'Hammersmith & City'],
  'East Putney': ['District'],
  'Eastcote': ['Metropolitan', 'Piccadilly'],
  'Edgware': ['Northern'],
  'Edgware Road': ['Circle', 'District', 'Hammersmith & City', 'Bakerloo'],
  'Elephant & Castle': ['Northern', 'Bakerloo'],
  'Elverson Road': ['DLR'],
  'Embankment': ['Bakerloo', 'Circle', 'District', 'Northern'],
  'Euston': ['Northern', 'Victoria'],
  'Euston Square': ['Metropolitan', 'Circle', 'Hammersmith & City'],
  'Fair Street': ['DLR'],
  'Farringdon': ['Metropolitan', 'Circle', 'Hammersmith & City', 'Elizabeth'],
  'Fenchurch Street': ['District', 'Circle'],
  'Finchley Central': ['Northern'],
  'Finchley Road': ['Metropolitan', 'Jubilee'],
  'Finsbury Park': ['Victoria', 'Piccadilly', 'Northern'],
  'Fitzrovia': ['Victoria'],
  'Flamstead End': ['Victoria'],
  'Fleet Street': ['District', 'Circle'],
  'Forest Gate': ['District', 'Hammersmith & City'],
  'Frickley': ['Northern'],
  'Fulham Broadway': ['District'],
  'Gallions Reach': ['DLR'],
  'Gants Hill': ['Central'],
  'Gloucester Road': ['Circle', 'District', 'Piccadilly'],
  'Golders Green': ['Northern'],
  'Goldhawk Road': ['Circle', 'Hammersmith & City'],
  'Goodge Street': ['Northern'],
  'Grange Park': ['Victoria'],
  'Great Portland Street': ['Metropolitan', 'Circle', 'Hammersmith & City'],
  'Green Park': ['Piccadilly', 'Victoria', 'Jubilee'],
  'Greenwich': ['DLR'],
  'Greenwich Peninsular': ['DLR'],
  'Grove Park': ['District'],
  'Gunnersbury': ['District'],
  'Hackney Central': ['Overground'],
  'Hackney Wick': ['Overground'],
  'Hammersmith': ['Circle', 'District', 'Hammersmith & City', 'Piccadilly'],
  'Hampstead': ['Northern'],
  'Hampstead Heath': ['Northern'],
  'Harrow & Wealdstone': ['Bakerloo'],
  'Harrow-on-the-Hill': ['Metropolitan'],
  'Hatton Cross': ['Piccadilly'],
  'Heathrow Airport': ['Piccadilly', 'Elizabeth'],
  'Heathrow Terminal 5': ['Elizabeth'],
  'Heathrow Terminals 2 & 3': ['Piccadilly', 'Elizabeth'],
  'Hendon Central': ['Northern'],
  'Heron Quays': ['DLR'],
  'High Street Kensington': ['Circle', 'District', 'Piccadilly'],
  'Highbury & Islington': ['Victoria', 'Northern', 'Overground'],
  'Highgate': ['Northern'],
  'Hillingdon': ['Metropolitan', 'Piccadilly'],
  'Holborn': ['Central', 'Piccadilly'],
  'Holland Park': ['Central'],
  'Holloway Road': ['Piccadilly'],
  'Homerton': ['Overground'],
  'Hornchurch': ['District'],
  'Hornsey': ['Northern'],
  'Hounslow Central': ['Piccadilly'],
  'Hounslow East': ['Piccadilly'],
  'Hounslow West': ['Piccadilly'],
  'Hyde Park Corner': ['Piccadilly'],
  'Ibrox': ['Northern'],
  'Imperial Wharf': ['District'],
  'Island Gardens': ['DLR'],
  'Kennington': ['Northern'],
  'Kensal Green': ['Bakerloo'],
  'Kensington Olympia': ['District'],
  'Kentish Town': ['Northern'],
  'Kentish Town West': ['Overground'],
  'Kings Cross St Pancras': ['Northern', 'Piccadilly', 'Victoria', 'Circle', 'Metropolitan', 'Hammersmith & City', 'Elizabeth'],
  'Kingsbury': ['Jubilee'],
  'King\'s Cross': ['Northern', 'Piccadilly', 'Victoria', 'Circle', 'Metropolitan', 'Hammersmith & City', 'Elizabeth'],
  'Knightsbridge': ['Piccadilly'],
  'Ladbroke Grove': ['Circle', 'Hammersmith & City'],
  'Lambeth North': ['Bakerloo'],
  'Lancaster Gate': ['Central'],
  'Latimer Road': ['Circle', 'Hammersmith & City'],
  'Lea Bridge': ['Overground'],
  'Leicester Square': ['Piccadilly', 'Northern'],
  'Lewisham': ['DLR'],
  'Leyton': ['Central'],
  'Leytonstone': ['Central'],
  'Liverpool Street': ['Central', 'Circle', 'Hammersmith & City', 'Metropolitan', 'Elizabeth'],
  'London Bridge': ['Jubilee', 'Northern'],
  'London City Airport': ['DLR'],
  'London Eye': ['Bakerloo', 'Northern', 'Jubilee'],
  'Loop': ['Metropolitan'],
  'Lord\'s': ['Metropolitan'],
  'Loughton': ['Central'],
  'Maida Vale': ['Bakerloo'],
  'Manor House': ['Piccadilly', 'Victoria'],
  'Mansion House': ['District', 'Circle'],
  'Marble Arch': ['Central'],
  'Marylebone': ['Bakerloo'],
  'Mile End': ['Central', 'District', 'Hammersmith & City'],
  'Mill Hill East': ['Northern'],
  'Moor Park': ['Metropolitan'],
  'Moorgate': ['Northern', 'Circle', 'Metropolitan', 'Hammersmith & City'],
  'Morden': ['Northern'],
  'Mornington Crescent': ['Northern'],
  'Mudchute': ['DLR'],
  'Neasden': ['Metropolitan', 'Jubilee'],
  'New Cross': ['Overground', 'DLR'],
  'New Cross Gate': ['Overground'],
  'Newbury Park': ['Central'],
  'North Acton': ['Central', 'Elizabeth'],
  'North Colonnade': ['DLR'],
  'North Greenwich': ['Jubilee'],
  'North Harrow': ['Metropolitan'],
  'North Wembley': ['Bakerloo'],
  'Northfields': ['Piccadilly'],
  'Northwick Park': ['Metropolitan'],
  'Northwood': ['Metropolitan'],
  'Northwood Hills': ['Metropolitan'],
  'Notting Hill Gate': ['Central', 'Circle', 'District'],
  'Oakwood': ['Piccadilly'],
  'Obsidian Way': ['DLR'],
  'Old Street': ['Northern'],
  'Olmpia': ['District'],
  'Olympic Stadium': ['DLR'],
  'Osterley': ['Piccadilly'],
  'Oval': ['Northern'],
  'Oxford Circus': ['Central', 'Bakerloo', 'Victoria'],
  'Paddington': ['Bakerloo', 'Circle', 'District', 'Hammersmith & City', 'Elizabeth'],
  'Park Royal': ['Piccadilly'],
  'Parsons Green': ['District'],
  'Passing': ['Northern'],
  'Peckham': ['Northern'],
  'Peckham Rye': ['Overground'],
  'Pentonville': ['Northern'],
  'Perivale': ['Central'],
  'Piccadilly Circus': ['Piccadilly', 'Bakerloo'],
  'Pimlico': ['Victoria'],
  'Plaistow': ['District', 'Hammersmith & City'],
  'Poplar': ['DLR'],
  'Prince Regent': ['DLR'],
  'Puddington': ['District', 'Circle'],
  'Putney Bridge': ['District'],
  'Queen\'s Park': ['Bakerloo'],
  'Queensbury': ['Jubilee'],
  'Queensway': ['Central'],
  'Rathbone': ['Northern'],
  'Ravenscourt Park': ['District'],
  'Rayners Lane': ['Metropolitan', 'Piccadilly'],
  'Redbridge': ['Central'],
  'Regent\'s Park': ['Bakerloo'],
  'Richmond': ['District'],
  'Rickmansworth': ['Metropolitan'],
  'Rotherhithe': ['DLR'],
  'Royal Albert': ['DLR'],
  'Royal Oak': ['Circle', 'Hammersmith & City'],
  'Royal Victoria': ['DLR'],
  'Ruislip': ['Metropolitan', 'Piccadilly'],
  'Ruislip Gardens': ['Central'],
  'Russell Square': ['Piccadilly'],
  'Seven Sisters': ['Victoria'],
  'Shadwell': ['DLR', 'Overground'],
  'Shepherd\'s Bush': ['Central', 'Overground'],
  'Shepherd\'s Bush Market': ['Circle', 'Hammersmith & City'],
  'Sloane Square': ['Circle', 'District'],
  'Snaresbrook': ['Central'],
  'South Acton': ['Overground'],
  'South Ealing': ['Piccadilly'],
  'Southfields': ['District'],
  'Southgate': ['Piccadilly'],
  'Southwark': ['Jubilee', 'Northern'],
  'St James\'s Park': ['Circle', 'District', 'Victoria'],
  'St John\'s Wood': ['Jubilee'],
  'St Paul\'s': ['Central'],
  'Stamford Brook': ['District'],
  'Stanmore': ['Jubilee'],
  'Stepney Green': ['District', 'Hammersmith & City'],
  'Stockwell': ['Northern', 'Victoria'],
  'Stonebridge Park': ['Bakerloo'],
  'Stratford': ['Central', 'Jubilee', 'DLR', 'Elizabeth', 'Overground'],
  'Stratford High Street': ['DLR'],
  'Stratford International': ['DLR', 'Elizabeth'],
  'Sudbury': ['Piccadilly'],
  'Sudbury Town': ['Piccadilly'],
  'Surrey Docks': ['DLR'],
  'Swiss Cottage': ['Jubilee'],
  'Temple': ['District', 'Circle'],
  'Theydon Bois': ['Central'],
  'Thorpedale': ['Northern'],
  'Tottenham Court Road': ['Northern', 'Central', 'Elizabeth'],
  'Tottenham Hale': ['Victoria'],
  'Tower Bridge': ['DLR'],
  'Tower Gateway': ['DLR'],
  'Tufnell Park': ['Northern'],
  'Turnpike Lane': ['Piccadilly'],
  'Twickenham': ['District'],
  'Typhoon': ['Northern'],
  'Upminster': ['District'],
  'Upminster Bridge': ['District'],
  'Upney': ['District'],
  'Upton Park': ['District', 'Hammersmith & City'],
  'Uxbridge': ['Metropolitan', 'Piccadilly'],
  'Vauxhall': ['Victoria'],
  'Victoria': ['Victoria', 'Circle', 'District'],
  'Walthamstow Central': ['Victoria', 'Overground'],
  'Walthamstow Queens Road': ['Overground'],
  'Wanstead': ['Central'],
  'Warren Street': ['Northern', 'Victoria'],
  'Warwick Avenue': ['Bakerloo'],
  'Washington': ['Northern'],
  'Waterloo': ['Bakerloo', 'Jubilee', 'Northern', 'Waterloo & City'],
  'Watford': ['Metropolitan'],
  'Wembley Central': ['Bakerloo'],
  'Wembley Park': ['Metropolitan', 'Jubilee'],
  'West Acton': ['Central'],
  'West Brompton': ['District'],
  'West Finchley': ['Northern'],
  'West Ham': ['District', 'Hammersmith & City', 'DLR', 'Elizabeth'],
  'West Hampstead': ['Jubilee'],
  'West Harrow': ['Metropolitan'],
  'West Kensington': ['District'],
  'West Ruislip': ['Central'],
  'Westbourne Park': ['Circle', 'Hammersmith & City'],
  'Westminster': ['Circle', 'District', 'Jubilee'],
  'Whitechapel': ['District', 'Hammersmith & City', 'Overground', 'DLR'],
  'White City': ['Central'],
  'Willesden Green': ['Jubilee'],
  'Willesden Junction': ['Overground'],
  'Wimbledon': ['District'],
  'Wimbledon Chase': ['District'],
  'Wood Green': ['Piccadilly'],
  'Wood Lane': ['Circle', 'Hammersmith & City'],
  'Woodford': ['Central'],
  'Woodside Park': ['Northern'],
};

// UK Train station operators (station name -> operators array)
// This is a subset of major stations - not exhaustive
export const trainStationOperators: Record<string, string[]> = {
  // London terminals with multiple operators
  'London Cannon Street': ['Southeastern'],
  'London Charing Cross': ['Southeastern'],
  'London Euston': ['Avanti West Coast'],
  'London King\'s Cross': ['Great Northern'],
  'London Liverpool Street': ['Greater Anglia'],
  'London Paddington': ['Great Western Railway'],
  'London St Pancras': ['Eurostar', 'Southeastern'],
  'London Victoria': ['Southeastern'],
  'London Waterloo': ['South Western Railway'],
  'London Blackfriars': ['Southeastern', 'Thameslink'],
  'London Fenchurch Street': ['c2c'],
  'London Marylebone': ['Chiltern Railways'],
  'Liverpool Street': ['Greater Anglia'],
  'Manchester Piccadilly': ['Avanti West Coast'],
  'Manchester Victoria': ['Northern'],
  'Birmingham New Street': ['Avanti West Coast'],
  'Birmingham Moor Street': ['Chiltern Railways'],
  'Birmingham Snow Hill': ['West Midlands Railway'],
  'Leeds': ['Avanti West Coast'],
  'Glasgow Central': ['Avanti West Coast'],
  'Edinburgh Waverley': ['ScotRail'],
  'Bristol Temple Meads': ['Great Western Railway'],
  'Bristol Parkway': ['Great Western Railway'],
  'Cardiff Central': ['Transport for Wales'],
  'Liverpool Lime Street': ['Avanti West Coast'],
  'Sheffield': ['Avanti West Coast'],
  'Newcastle': ['Avanti West Coast'],
  'Leicester': ['East Midlands Railway'],
  'Nottingham': ['East Midlands Railway'],
  'Derby': ['East Midlands Railway'],
  'Oxford': ['Great Western Railway'],
  'Cambridge': ['Greater Anglia', 'Thameslink'],
  'Brighton': ['Southern', 'Thameslink'],
  'Southampton Central': ['South Western Railway'],
  'Watford Junction': ['Avanti West Coast', 'London Northwestern'],
  'Milton Keynes Central': ['Avanti West Coast'],
  'Stevenage': ['Great Northern'],
  'Peterborough': ['Great Northern', 'East Midlands Railway'],
  'Stansted Airport': ['Greater Anglia'],
  'Luton Airport': ['East Midlands Railway'],
  'Gatwick Airport': ['Southern', 'Thameslink'],
  'Heathrow Terminal': ['Heathrow Express', 'Great Western Railway'],
  // Essex Greater Anglia/Elizabeth Line stations
  'Ingatestone': ['Greater Anglia'],
  'Chelmsford': ['Greater Anglia'],
  'Colchester': ['Greater Anglia'],
  'Ipswich': ['Greater Anglia'],
  'Norwich': ['Greater Anglia'],
  'Witham': ['Greater Anglia'],
  'Hatfield Peverel': ['Greater Anglia'],
  'Kelvedon': ['Greater Anglia'],
  'Marks Tey': ['Greater Anglia'],
  'Manningtree': ['Greater Anglia'],
  'Harwich': ['Greater Anglia'],
  'Dovercourt': ['Greater Anglia'],
  'Wrabness': ['Greater Anglia'],
  'Mistley': ['Greater Anglia'],
  'Bradfield': ['Greater Anglia'],
  'Wivenhoe': ['Greater Anglia'],
  'Alresford': ['Greater Anglia'],
  'Great Bentley': ['Greater Anglia'],
  'Weeley': ['Greater Anglia'],
  'Thorpe-le-Soken': ['Greater Anglia'],
  'Kirby Cross': ['Greater Anglia'],
  'Frinton-on-Sea': ['Greater Anglia'],
  'Walton-on-the-Naze': ['Greater Anglia'],
  'Clacton-on-Sea': ['Greater Anglia'],
  'Thorpe Bay': ['c2c'],
  'Southend Central': ['c2c'],
  'Southend East': ['c2c'],
  'Shoeburyness': ['c2c'],
  'Laindon': ['c2c'],
  'Basildon': ['c2c'],
  'Pitsea': ['c2c'],
  'Benfleet': ['c2c'],
  'Leigh-on-Sea': ['c2c'],
  'Chalkwell': ['c2c'],
  'Westcliff': ['c2c'],
  'Southend Victoria': ['Greater Anglia'],
  'Prittlewell': ['Greater Anglia'],
  'Hockley': ['Greater Anglia'],
  'Rayleigh': ['Greater Anglia'],
  'Wickford': ['Greater Anglia'],
  'Billericay': ['Greater Anglia'],
  'West Horndon': ['c2c'],
  'Upminster': ['c2c'],
  'Romford': ['Elizabeth', 'Greater Anglia'],
  'Gidea Park': ['Elizabeth', 'Greater Anglia'],
  'Harold Wood': ['Elizabeth', 'Greater Anglia'],
  'Shenfield': ['Elizabeth', 'Greater Anglia'],
  'Brentwood': ['Elizabeth', 'Greater Anglia'],
  'Chadwell Heath': ['Elizabeth', 'Greater Anglia'],
  'Goodmayes': ['Elizabeth', 'Greater Anglia'],
  'Seven Kings': ['Elizabeth', 'Greater Anglia'],
  'Ilford': ['Elizabeth', 'Greater Anglia'],
  'Manor Park': ['Elizabeth', 'Greater Anglia'],
  'Forest Gate': ['Elizabeth', 'Greater Anglia', 'London Overground'],
  'Maryland': ['Elizabeth'],
  'Stratford': ['Elizabeth', 'Greater Anglia', 'c2c', 'London Overground'],
  'Whitechapel': ['Elizabeth', 'London Overground'],
  'Canary Wharf': ['Elizabeth'],
  'Custom House': ['Elizabeth', 'DLR'],
  'Woolwich': ['Elizabeth', 'Southeastern'],
  'Abbey Wood': ['Elizabeth', 'Southeastern'],
  'Acton Main Line': ['Elizabeth'],
  'West Ealing': ['Elizabeth'],
  'Hanwell': ['Elizabeth'],
  'Southall': ['Elizabeth'],
  'Hayes & Harlington': ['Elizabeth', 'Great Western Railway'],
  'West Drayton': ['Elizabeth', 'Great Western Railway'],
  'Iver': ['Elizabeth'],
  'Langley': ['Elizabeth'],
  'Slough': ['Elizabeth', 'Great Western Railway'],
  'Burnham': ['Elizabeth'],
  'Taplow': ['Elizabeth'],
  'Maidenhead': ['Elizabeth'],
  'Twyford': ['Elizabeth'],
  'Reading': ['Elizabeth', 'Great Western Railway'],
  // Thameslink stations
  'Bedford': ['Thameslink'],
  'Luton': ['Thameslink'],
  'Luton Airport Parkway': ['Thameslink'],
  'Harpenden': ['Thameslink'],
  'St Albans City': ['Thameslink'],
  'Radlett': ['Thameslink'],
  'Elstree & Borehamwood': ['Thameslink'],
  'Mill Hill Broadway': ['Thameslink'],
  'Hendon': ['Thameslink'],
  'Cricklewood': ['Thameslink'],
  'West Hampstead Thameslink': ['Thameslink'],
  'Kentish Town': ['Thameslink'],
  'London St Pancras International': ['Thameslink'],
  'Farringdon': ['Thameslink', 'Elizabeth'],
  'City Thameslink': ['Thameslink'],
  'Elephant & Castle': ['Thameslink', 'Southeastern'],
  'East Croydon': ['Thameslink', 'Southern'],
  'Three Bridges': ['Thameslink'],
  'Haywards Heath': ['Thameslink'],
  'Burgess Hill': ['Thameslink'],
  'Hassocks': ['Thameslink'],
  'Hitchin': ['Thameslink'],
  'Letchworth Garden City': ['Thameslink'],
  'Baldock': ['Thameslink'],
  'Arlesey': ['Thameslink'],
  'Biggleswade': ['Thameslink'],
  'Sandy': ['Thameslink'],
  'London Bridge': ['Southeastern', 'Thameslink'],
  // Southeastern stations
  'Chatham': ['Southeastern'],
  'Gillingham': ['Southeastern'],
  'Rainham': ['Southeastern'],
  'Sittingbourne': ['Southeastern'],
  'Faversham': ['Southeastern'],
  'Whitstable': ['Southeastern'],
  'Canterbury': ['Southeastern'],
  'Margate': ['Southeastern'],
  'Ramsgate': ['Southeastern'],
  'Dover Priory': ['Southeastern'],
  'Ashford International': ['Southeastern'],
  'Tonbridge': ['Southeastern'],
  'Tunbridge Wells': ['Southeastern'],
  'Sevenoaks': ['Southeastern'],
  'Orpington': ['Southeastern'],
  'Bromley South': ['Southeastern'],
  'Bickley': ['Southeastern'],
  'Petts Wood': ['Southeastern'],
  'Chislehurst': ['Southeastern'],
  'Elmstead Woods': ['Southeastern'],
  'Grove Park': ['Southeastern'],
  'Hither Green': ['Southeastern'],
  'Blackheath': ['Southeastern'],
  'Charlton': ['Southeastern'],
  'Woolwich Dockyard': ['Southeastern'],
  'Woolwich Arsenal': ['Southeastern'],
  'Plumstead': ['Southeastern'],
  'Belvedere': ['Southeastern'],
  'Erith': ['Southeastern'],
  'Slade Green': ['Southeastern'],
  'Dartford': ['Southeastern'],
  'Stone Crossing': ['Southeastern'],
  'Greenhithe': ['Southeastern'],
  'Swanscombe': ['Southeastern'],
  'Northfleet': ['Southeastern'],
  'Gravesend': ['Southeastern'],
  'Higham': ['Southeastern'],
  'Strood': ['Southeastern'],
};

// Map common operator names to display-friendly versions
export const operatorDisplayNames: Record<string, string> = {
  'Southeastern': 'Southeastern',
  'Great Northern': 'Great Northern',
  'Greater Anglia': 'Greater Anglia',
  'Great Western Railway': 'GWR',
  'South Western Railway': 'SWR',
  'Avanti West Coast': 'Avanti',
  'East Midlands Railway': 'EMR',
  'Northern': 'Northern',
  'Transport for Wales': 'TfW',
  'ScotRail': 'ScotRail',
  'Southern': 'Southern',
  'c2c': 'c2c',
  'Chiltern Railways': 'Chiltern',
  'West Midlands Railway': 'West Midlands',
  'London Northwestern': 'LNWR',
  'Heathrow Express': 'Heathrow',
  'Eurostar': 'Eurostar',
  'Thameslink': 'Thameslink',
  'Elizabeth': 'Elizabeth Line',
};

// Map tube line names to their colors
export const tubeLineColors: Record<string, string> = {
  'Bakerloo': '#B36305',
  'Central': '#DC241F',
  'Circle': '#FFD300',
  'District': '#007D32',
  'Hammersmith & City': '#F3A9BB',
  'Jubilee': '#A0A5A9',
  'Metropolitan': '#9B0056',
  'Northern': '#000000',
  'Piccadilly': '#00095B',
  'Victoria': '#0088D3',
  'Waterloo & City': '#94CEBE',
  'DLR': '#00A4A7',
  'Overground': '#E86100',
  'Elizabeth': '#B97AC0',
};

export function getTubeLines(stationName: string): string[] {
  const upperName = stationName.toUpperCase();
  
  // First try exact match
  for (const [key, lines] of Object.entries(tubeStationLines)) {
    if (stationName.toUpperCase().includes(key.toUpperCase())) {
      return lines;
    }
  }
  
  // Try partial match
  for (const [key, lines] of Object.entries(tubeStationLines)) {
    if (key.toUpperCase().includes(upperName) || upperName.includes(key.toUpperCase())) {
      return lines;
    }
  }
  
  return [];
}

export function getTrainOperators(stationName: string): string[] {
  const upperName = stationName.toUpperCase();
  
  // Try exact match first
  for (const [key, operators] of Object.entries(trainStationOperators)) {
    if (stationName.toUpperCase() === key.toUpperCase()) {
      return operators;
    }
  }
  
  // Try partial match
  for (const [key, operators] of Object.entries(trainStationOperators)) {
    if (upperName.includes(key.toUpperCase()) || key.toUpperCase().includes(upperName)) {
      return operators;
    }
  }
  
  return [];
}

// Legacy function for backwards compatibility
export function getTrainOperator(stationName: string): string | undefined {
  const operators = getTrainOperators(stationName);
  return operators.length > 0 ? operators[0] : undefined;
}

export function getOperatorDisplayName(operator: string): string {
  return operatorDisplayNames[operator] || operator;
}

export function getOperatorDisplayNames(operators: string[]): string[] {
  return operators.map(op => getOperatorDisplayName(op));
}

export function getLineColor(line: string): string {
  return tubeLineColors[line] || '#888888';
}

// ============================================
// API INTEGRATION FOR COMPREHENSIVE COVERAGE
// ============================================

import { getTfLLines } from './tfl-api';
import { getRailOperatorsFromWikidata, getOperatorFromHeuristics } from './rail-api';

/**
 * Enhanced async version: Get tube lines with API fallback
 * Tries lookup table first, then TfL API for stations not in our database
 */
export async function getTubeLinesWithApi(stationName: string): Promise<string[]> {
  // Try lookup table first (fast, no API call)
  const lookupLines = getTubeLines(stationName);
  if (lookupLines.length > 0) {
    return lookupLines;
  }
  
  // Fall back to TfL API for stations not in our database
  try {
    const apiLines = await getTfLLines(stationName);
    return apiLines;
  } catch (error) {
    console.error(`Failed to get TfL lines for ${stationName}:`, error);
    return [];
  }
}

/**
 * Enhanced async version: Get train operators with API fallback
 * Tries lookup table first, then Wikidata API, then heuristics
 */
export async function getTrainOperatorsWithApi(stationName: string): Promise<string[]> {
  // Try lookup table first (fast, no API call)
  const lookupOperators = getTrainOperators(stationName);
  if (lookupOperators.length > 0) {
    return lookupOperators;
  }
  
  // Try Wikidata API for stations not in our database
  try {
    const apiOperators = await getRailOperatorsFromWikidata(stationName);
    if (apiOperators.length > 0) {
      return apiOperators;
    }
  } catch (error) {
    console.error(`Failed to get Wikidata operators for ${stationName}:`, error);
  }
  
  // Fall back to heuristics based on station name patterns
  const heuristicOperators = getOperatorFromHeuristics(stationName);
  if (heuristicOperators.length > 0) {
    return heuristicOperators;
  }
  
  return [];
}

/**
 * Batch fetch tube lines for multiple stations
 * Optimized to run API calls in parallel
 */
export async function getTubeLinesForStations(stationNames: string[]): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  
  await Promise.all(
    stationNames.map(async (name) => {
      const lines = await getTubeLinesWithApi(name);
      results.set(name, lines);
    })
  );
  
  return results;
}

/**
 * Batch fetch train operators for multiple stations
 * Optimized to run API calls in parallel
 */
export async function getTrainOperatorsForStations(stationNames: string[]): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();
  
  await Promise.all(
    stationNames.map(async (name) => {
      const operators = await getTrainOperatorsWithApi(name);
      results.set(name, operators);
    })
  );
  
  return results;
}