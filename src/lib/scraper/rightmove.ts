import * as cheerio from 'cheerio';
import { Property, ScrapeResult } from '@/lib/types/property';
import { extractPostcode, parsePostcode } from '@/lib/utils/postcode';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Extract Rightmove property ID from URL
 */
export function extractRightmoveId(url: string): string | null {
  const patterns = [
    /rightmove\.co\.uk\/properties\/(\d+)/,
    /rightmove\.co\.uk\/property-for-sale\/property-(\d+)/,
    /rightmove\.co\.uk\/property-to-rent\/property-(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Validate Rightmove URL
 */
export function isValidRightmoveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('rightmove.co.uk') && extractRightmoveId(url) !== null;
  } catch {
    return false;
  }
}

/**
 * Scrape property data from Rightmove URL
 */
export async function scrapeRightmoveProperty(url: string): Promise<ScrapeResult> {
  const rightmoveId = extractRightmoveId(url);
  if (!rightmoveId) {
    return { success: false, error: 'Invalid Rightmove URL format' };
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        return { success: false, error: 'Access blocked by Rightmove - try again later' };
      }
      return { success: false, error: `HTTP error: ${response.status}` };
    }

    const html = await response.text();
    const property = parseRightmoveHtml(html, url, rightmoveId);

    if (property) {
      return { success: true, property };
    }

    return { success: false, error: 'Failed to parse property data from page' };
  } catch (error) {
    console.error('Scraping error:', error);
    return { success: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

/**
 * Unpack Rightmove's packed JSON format.
 * The format uses an array where index 0 is the root schema object,
 * and numeric values in objects are references (indices) into the array.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unpackPageModel(dataStr: string): Record<string, any> | null {
  try {
    const arr = JSON.parse(dataStr);
    if (!Array.isArray(arr) || arr.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function resolve(val: any, depth: number): any {
      if (depth > 20) return val; // Prevent infinite recursion
      if (val === null || val === undefined) return val;
      if (typeof val === 'string' || typeof val === 'boolean') return val;
      if (typeof val === 'number') {
        // In the schema objects (depth > 0), integers are references into the array.
        // After dereferencing, if the result is a primitive, it's the final value — don't re-resolve.
        if (Number.isInteger(val) && val >= 0 && val < arr.length) {
          const resolved = arr[val];
          if (resolved === null || resolved === undefined) return resolved;
          if (typeof resolved === 'string' || typeof resolved === 'boolean') return resolved;
          if (typeof resolved === 'number') return resolved; // Literal number — don't re-resolve
          // For objects/arrays, continue resolving their contents
          return resolve(resolved, depth + 1);
        }
        return val; // Floating point or out of range — literal
      }
      if (Array.isArray(val)) {
        return val.map(v => resolve(v, depth + 1));
      }
      if (typeof val === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out: Record<string, any> = {};
        for (const key of Object.keys(val)) {
          out[key] = resolve(val[key], depth + 1);
        }
        return out;
      }
      return val;
    }

    return resolve(arr[0], 0);
  } catch (e) {
    console.error('Failed to unpack PAGE_MODEL:', e);
    return null;
  }
}

/**
 * Extract property data from a decoded PAGE_MODEL object (works with both old and new formats).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromDecodedPageModel(model: Record<string, any>): {
  postcode: string | null;
  streetName: string | null;
  doorNumber: string | null;
  latitude: number | null;
  longitude: number | null;
  epcCurrentRating: string | null;
  epcPotentialRating: string | null;
  epcGraphUrl: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  squareFootage: number | null;
} {
  const pd = model.propertyData || model;
  const address = pd.address || {};
  const location = pd.location || {};

  // Postcode from structured address
  let postcode: string | null = null;
  if (address.outcode && address.incode) {
    postcode = `${address.outcode.toUpperCase()} ${address.incode.toUpperCase()}`;
  }

  // Street name from display address
  let streetName: string | null = null;
  if (address.displayAddress) {
    streetName = address.displayAddress.split(',')[0].trim();
  }

  // Door number
  const doorNumber = address.buildingNumber || address.buildingName || address.propertyNumber || null;

  // Coordinates
  const latitude = typeof location.latitude === 'number' ? location.latitude : null;
  const longitude = typeof location.longitude === 'number' ? location.longitude : null;

  // EPC
  let epcCurrentRating: string | null = null;
  let epcPotentialRating: string | null = null;
  let epcGraphUrl: string | null = null;

  if (pd.epcGraphs && Array.isArray(pd.epcGraphs) && pd.epcGraphs.length > 0) {
    epcGraphUrl = pd.epcGraphs[0]?.url || null;
    epcCurrentRating = pd.epcGraphs[0]?.currentEnergyRating || null;
    epcPotentialRating = pd.epcGraphs[0]?.potentialEnergyRating || null;
  }
  // Also check top-level fields
  if (!epcCurrentRating) {
    epcCurrentRating = pd.eerCurrentRating || pd.currentEnergyRating || pd.epcRating || null;
  }
  if (!epcPotentialRating) {
    epcPotentialRating = pd.eerPotentialRating || pd.potentialEnergyRating || null;
  }
  if (epcCurrentRating) epcCurrentRating = epcCurrentRating.toUpperCase();
  if (epcPotentialRating) epcPotentialRating = epcPotentialRating.toUpperCase();

  // Bedrooms and bathrooms
  const bedrooms = typeof pd.bedrooms === 'number' ? pd.bedrooms : null;
  const bathrooms = typeof pd.bathrooms === 'number' ? pd.bathrooms : null;

  // Property type
  let propertyType: string | null = null;
  if (pd.propertySubType) {
    propertyType = pd.propertySubType.toLowerCase();
  } else if (pd.soldPropertyType) {
    propertyType = pd.soldPropertyType.toLowerCase();
  }

  // Square footage from sizings
  let squareFootage: number | null = null;
  if (pd.sizings && Array.isArray(pd.sizings)) {
    for (const s of pd.sizings) {
      if (s.unit === 'sqft' && typeof s.maximumSize === 'number') {
        squareFootage = s.maximumSize;
        break;
      }
    }
  }

  return {
    postcode, streetName, doorNumber,
    latitude, longitude,
    epcCurrentRating, epcPotentialRating, epcGraphUrl,
    bedrooms, bathrooms, propertyType, squareFootage,
  };
}

/**
 * Parse Rightmove HTML and extract property data
 */
function parseRightmoveHtml(html: string, sourceUrl: string, rightmoveId: string): Property | null {
  const $ = cheerio.load(html);

  // Try to find JSON data embedded in page (most reliable)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let decodedPageModel: Record<string, any> | null = null;

  $('script').each((_, element) => {
    const content = $(element).html() || '';

    // Strategy A: New packed format — window.__PAGE_MODEL = { data: "...", encoding: "on" }
    if (content.includes('__PAGE_MODEL')) {
      const idx = content.indexOf('__PAGE_MODEL');
      const jsonStart = content.indexOf('{', idx);
      if (jsonStart !== -1) {
        // Find matching closing brace using depth counting
        let depth = 0;
        let jsonEnd = jsonStart;
        for (let i = jsonStart; i < content.length; i++) {
          if (content[i] === '{') depth++;
          if (content[i] === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
        }
        try {
          const wrapper = JSON.parse(content.substring(jsonStart, jsonEnd));
          if (wrapper.encoding === 'on' && typeof wrapper.data === 'string') {
            decodedPageModel = unpackPageModel(wrapper.data);
            console.log('Decoded __PAGE_MODEL (packed format)');
          } else if (typeof wrapper.data === 'object') {
            decodedPageModel = wrapper.data;
            console.log('Decoded __PAGE_MODEL (plain format)');
          }
        } catch {
          // Try legacy parse
        }
      }
    }

    // Strategy B: Legacy format — window.PAGE_MODEL = { ... }
    if (!decodedPageModel && content.includes('PAGE_MODEL') && !content.includes('__PAGE_MODEL')) {
      const pageModelMatch = content.match(/window\.PAGE_MODEL\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|<\/script>|$)/);
      if (pageModelMatch) {
        try {
          decodedPageModel = JSON.parse(pageModelMatch[1]);
          console.log('Decoded PAGE_MODEL (legacy format)');
        } catch {
          // Ignore parse errors
        }
      }
    }
  });

  // Extract data from HTML elements
  const price = parsePrice($);
  const displayAddress = parseAddress($);
  const details = parsePropertyDetails($);
  const description = parseDescription($);
  const images = parseImages($);
  const features = parseFeatures($);

  // Determine listing type from URL
  const listingType: 'sale' | 'rent' = sourceUrl.includes('property-to-rent') ? 'rent' : 'sale';

  // Extract postcode - try multiple strategies
  let postcode: string | null = null;
  console.log('Address found:', displayAddress);

  let streetName: string | null = null;
  let doorNumber: string | null = null;
  let epcCurrentRating: string | null = null;
  let epcPotentialRating: string | null = null;
  let epcGraphUrl: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  // Strategy 1: Extract from decoded PAGE_MODEL (most reliable)
  if (decodedPageModel) {
    const extracted = extractFromDecodedPageModel(decodedPageModel);
    if (extracted.postcode) { postcode = extracted.postcode; console.log('Postcode from PAGE_MODEL:', postcode); }
    if (extracted.streetName) { streetName = extracted.streetName; console.log('Street name from PAGE_MODEL:', streetName); }
    if (extracted.doorNumber) { doorNumber = extracted.doorNumber; console.log('Door number from PAGE_MODEL:', doorNumber); }
    if (extracted.latitude !== null && extracted.longitude !== null) {
      latitude = extracted.latitude;
      longitude = extracted.longitude;
      console.log('Coordinates from PAGE_MODEL:', latitude, longitude);
    }
    if (extracted.epcCurrentRating) { epcCurrentRating = extracted.epcCurrentRating; console.log('EPC current from PAGE_MODEL:', epcCurrentRating); }
    if (extracted.epcPotentialRating) { epcPotentialRating = extracted.epcPotentialRating; console.log('EPC potential from PAGE_MODEL:', epcPotentialRating); }
    if (extracted.epcGraphUrl) { epcGraphUrl = extracted.epcGraphUrl; }
    // Override HTML-parsed details with structured data when available
    if (extracted.bedrooms !== null && details.bedrooms === null) details.bedrooms = extracted.bedrooms;
    if (extracted.bathrooms !== null && details.bathrooms === null) details.bathrooms = extracted.bathrooms;
    if (extracted.propertyType && details.propertyType === 'unknown') details.propertyType = extracted.propertyType;
    if (extracted.squareFootage !== null && details.squareFootage === null) details.squareFootage = extracted.squareFootage;
  }

  // Strategy 2: Fallback — regex-based extraction from raw script content
  if (!postcode || !latitude) {
    $('script').each((_, element) => {
      const content = $(element).html() || '';
      if (content.includes('PAGE_MODEL') || content.includes('propertyData')) {
        if (!postcode) {
          const outcodeMatch = content.match(/"outcode"\s*:\s*"([A-Z]{1,2}\d{1,2}[A-Z]?)"/i);
          const incodeMatch = content.match(/"incode"\s*:\s*"(\d[A-Z]{2})"/i);
          if (outcodeMatch && incodeMatch) {
            postcode = `${outcodeMatch[1].toUpperCase()} ${incodeMatch[1].toUpperCase()}`;
            console.log('Postcode from regex (outcode+incode):', postcode);
          }
        }
        if (!postcode) {
          const postcodeMatch = content.match(/"postcode"\s*:\s*"([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})"/i);
          if (postcodeMatch) {
            postcode = postcodeMatch[1].toUpperCase().replace(/\s+/g, ' ');
            console.log('Postcode from regex (direct):', postcode);
          }
        }
        if (!streetName) {
          const displayMatch = content.match(/"displayAddress"\s*:\s*"([^"]+)"/);
          if (displayMatch) { streetName = displayMatch[1].split(',')[0].trim(); }
        }
        if (!doorNumber) {
          const buildingMatch = content.match(/"(?:buildingNumber|buildingName|propertyNumber)"\s*:\s*"([^"]+)"/);
          if (buildingMatch) { doorNumber = buildingMatch[1]; }
        }
        if (!latitude) {
          const latMatch = content.match(/"latitude"\s*:\s*([-\d.]+)/);
          const lngMatch = content.match(/"longitude"\s*:\s*([-\d.]+)/);
          if (latMatch && lngMatch) {
            latitude = parseFloat(latMatch[1]);
            longitude = parseFloat(lngMatch[1]);
            console.log('Coordinates from regex:', latitude, longitude);
          }
        }
        if (!epcCurrentRating) {
          const epcPatterns = [
            /"currentEnergyRating"\s*:\s*"([A-G])"/i,
            /"epcRating"\s*:\s*"([A-G])"/i,
            /"eerCurrentRating"\s*:\s*"([a-gA-G])"/,
          ];
          for (const pattern of epcPatterns) {
            const match = content.match(pattern);
            if (match) { epcCurrentRating = match[1].toUpperCase(); break; }
          }
        }
        if (!epcPotentialRating) {
          const match = content.match(/"(?:potentialEnergyRating|eerPotentialRating)"\s*:\s*"([a-gA-G])"/);
          if (match) { epcPotentialRating = match[1].toUpperCase(); }
        }
        if (!epcGraphUrl) {
          const match = content.match(/"epcGraphs"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
          if (match) { epcGraphUrl = match[1]; }
        }
      }
    });
  }

  // Fallback: Check HTML body for EPC rating text
  if (!epcCurrentRating) {
    // Look for patterns like "EPC Rating D" or "Energy Rating: C"
    const bodyText = $('body').text();
    const epcTextMatch = bodyText.match(/EPC\s*(?:Rating)?[:\s]*([A-G])\b/i);
    if (epcTextMatch) {
      epcCurrentRating = epcTextMatch[1].toUpperCase();
      console.log('EPC from body text:', epcCurrentRating);
    }

    // Also check for "Current X | Potential Y" pattern
    const currentPotentialMatch = bodyText.match(/Current\s*([A-G])\s*\|?\s*Potential\s*([A-G])/i);
    if (currentPotentialMatch) {
      epcCurrentRating = currentPotentialMatch[1].toUpperCase();
      epcPotentialRating = currentPotentialMatch[2].toUpperCase();
      console.log('EPC from Current/Potential pattern:', epcCurrentRating, epcPotentialRating);
    }
  }

  // Strategy 2: Extract from display address
  if (!postcode) {
    postcode = extractPostcode(displayAddress);
    console.log('Postcode from address:', postcode);
  }

  // Strategy 3: Look for postcode in location section
  if (!postcode) {
    const locationSection = $('[data-testid="region-link"], .region-link, [class*="location"]').text();
    postcode = extractPostcode(locationSection);
    console.log('Postcode from location section:', postcode);
  }

  // Strategy 4: Try meta tags
  if (!postcode) {
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    postcode = extractPostcode(metaDesc) || extractPostcode(ogTitle);
    console.log('Postcode from meta:', postcode);
  }

  // Strategy 5: Search for outcode only in the address area text (partial postcode)
  if (!postcode) {
    const bodyText = $('article, main, [role="main"]').first().text();
    // Look for partial postcode patterns like "N20" at word boundaries
    const partialMatch = bodyText.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/g);
    if (partialMatch) {
      // Filter to likely postcodes (not random letter-number combos)
      const likelyPostcodes = partialMatch.filter(p => /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(p));
      if (likelyPostcodes.length > 0) {
        postcode = likelyPostcodes[0]; // This is partial (outcode only)
        console.log('Partial postcode (outcode) found:', postcode);
      }
    }
  }

  // Parse postcode components
  const parsedPostcode = postcode ? parsePostcode(postcode) : null;

  // Calculate price per square foot
  const pricePerSqFt = (price && details.squareFootage)
    ? Math.round(price / details.squareFootage)
    : null;

  const property: Property = {
    id: rightmoveId,
    sourceUrl,
    price,
    pricePerSqFt,
    priceQualifier: parsePriceQualifier($),
    listingType,
    bedrooms: details.bedrooms,
    bathrooms: details.bathrooms,
    squareFootage: details.squareFootage,
    propertyType: details.propertyType,
    address: {
      displayAddress,
      streetName,
      doorNumber,
      postcode: parsedPostcode?.full || null,
      postcodeOutward: parsedPostcode?.outward || null,
      postcodeInward: parsedPostcode?.inward || null,
    },
    epc: (epcCurrentRating || epcPotentialRating || epcGraphUrl) ? {
      currentRating: epcCurrentRating,
      potentialRating: epcPotentialRating,
      graphUrl: epcGraphUrl,
    } : null,
    coordinates: (latitude && longitude) ? { latitude, longitude } : null,
    nearestStations: null, // Will be populated by API route
    nearestTubeStations: null, // Will be populated by API route
    description,
    features,
    images,
    scrapedAt: new Date().toISOString(),
  };

  // Only return if we got at least some meaningful data
  if (price !== null || displayAddress.length > 0) {
    return property;
  }

  return null;
}

function parsePrice($: cheerio.CheerioAPI): number | null {
  // Try multiple selectors - Rightmove changes structure
  const selectors = [
    'article [data-testid="price"]',
    '[data-testid="price"]',
    '._1gfnqJ3Vtd1z40MlC0MzXu',
    '.propertyHeaderPrice',
    'h1[class*="price"]',
    'span[class*="price"]',
  ];

  for (const selector of selectors) {
    const priceText = $(selector).first().text().trim();
    if (priceText) {
      // Parse UK price format: "£450,000" or "£1,500 pcm"
      const cleaned = priceText.replace(/[£,\s]/g, '').replace(/pcm|pw|pa/gi, '');
      const price = parseInt(cleaned, 10);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }
  return null;
}

function parsePriceQualifier($: cheerio.CheerioAPI): string | undefined {
  const text = $('body').text().toLowerCase();
  if (text.includes('guide price')) return 'guide_price';
  if (text.includes('offers over')) return 'offers_over';
  if (text.includes('offers in region') || text.includes('oiro')) return 'offers_in_region';
  return undefined;
}

function parseAddress($: cheerio.CheerioAPI): string {
  const selectors = [
    '[data-testid="address-label"]',
    'h1[itemprop="streetAddress"]',
    'address',
    '._2uQQ3SV0eMHL1P6t5ZDo2q h1',
    '.property-header-bedroom-and-price address',
  ];

  for (const selector of selectors) {
    const address = $(selector).first().text().trim();
    if (address && address.length > 3) {
      return address;
    }
  }

  // Try meta tags
  const metaAddress = $('meta[property="og:title"]').attr('content');
  if (metaAddress) {
    // Often format is "3 bed house for sale in Address - Price"
    const parts = metaAddress.split(' in ');
    if (parts.length > 1) {
      return parts[1].split(' - ')[0].trim();
    }
  }

  return '';
}

function parsePropertyDetails($: cheerio.CheerioAPI): {
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  propertyType: string;
} {
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let squareFootage: number | null = null;

  // Strategy 1: Extract from PAGE_MODEL JSON (most reliable)
  $('script').each((_, element) => {
    const content = $(element).html() || '';
    if (content.includes('PAGE_MODEL') || content.includes('propertyData')) {
      // Look for bedrooms
      const bedMatch = content.match(/"bedrooms"\s*:\s*(\d+)/);
      if (bedMatch) {
        const num = parseInt(bedMatch[1], 10);
        if (num >= 0 && num <= 20) bedrooms = num;
      }

      // Look for bathrooms
      const bathMatch = content.match(/"bathrooms"\s*:\s*(\d+)/);
      if (bathMatch) {
        const num = parseInt(bathMatch[1], 10);
        if (num >= 0 && num <= 20) bathrooms = num;
      }

      // Look for size
      const sizeMatch = content.match(/"size"\s*:\s*\{\s*"magnitude"\s*:\s*(\d+)/);
      if (sizeMatch) {
        squareFootage = parseInt(sizeMatch[1], 10);
      }

      if (bedrooms !== null) return false; // found what we need
    }
  });

  // Strategy 2: Look in specific UI elements (fallback)
  if (bedrooms === null) {
    // Look for bedroom icons/labels in the header area
    const headerText = $('[data-testid="property-header"], .property-header, article header').text();
    const bedMatch = headerText.match(/(\d{1,2})\s*bed/i);
    if (bedMatch) {
      const num = parseInt(bedMatch[1], 10);
      if (num >= 0 && num <= 20) bedrooms = num;
    }
  }

  if (bathrooms === null) {
    const headerText = $('[data-testid="property-header"], .property-header, article header').text();
    const bathMatch = headerText.match(/(\d{1,2})\s*bath/i);
    if (bathMatch) {
      const num = parseInt(bathMatch[1], 10);
      if (num >= 0 && num <= 20) bathrooms = num;
    }
  }

  // Strategy 3: Look for square footage in text
  const text = $('body').text();
  if (squareFootage === null) {
    const sqftMatch = text.match(/(\d{1,4}(?:,\d{3})?)\s*(?:sq\.?\s*ft|square\s*feet)/i);
    if (sqftMatch) {
      squareFootage = parseInt(sqftMatch[1].replace(',', ''), 10);
    }
  }

  // Detect property type
  const propertyType = detectPropertyType(text);

  return { bedrooms, bathrooms, squareFootage, propertyType };
}

function detectPropertyType(text: string): string {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('detached house') || (lowerText.includes('detached') && !lowerText.includes('semi'))) {
    return 'detached';
  }
  if (lowerText.includes('semi-detached') || lowerText.includes('semi detached')) return 'semi-detached';
  if (lowerText.includes('terraced') || lowerText.includes('terrace house')) return 'terraced';
  if (lowerText.includes('flat') || lowerText.includes('apartment')) return 'flat';
  if (lowerText.includes('bungalow')) return 'bungalow';
  if (lowerText.includes('maisonette')) return 'maisonette';
  if (lowerText.includes('cottage')) return 'cottage';
  if (lowerText.includes('townhouse') || lowerText.includes('town house')) return 'townhouse';

  return 'unknown';
}

function parseDescription($: cheerio.CheerioAPI): string {
  const selectors = [
    '[data-testid="truncated-description-text"]',
    '.property-description',
    '[itemprop="description"]',
    '.STw8udCxUaBUMfOOZu0iL',
  ];

  for (const selector of selectors) {
    const desc = $(selector).first().text().trim();
    if (desc && desc.length > 20) {
      return desc.slice(0, 2000); // Limit length
    }
  }

  return '';
}

function parseFeatures($: cheerio.CheerioAPI): string[] {
  const features: string[] = [];

  // Try key features list
  $('[data-testid="key-features-list"] li, .key-features li, ._3nPVwR0HZYQah5tkVJHFh5 li').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 2 && text.length < 200) {
      features.push(text);
    }
  });

  return features.slice(0, 15); // Limit to 15 features
}

function parseImages($: cheerio.CheerioAPI): string[] {
  const images: string[] = [];

  // Method 1: Look for images in the main gallery (new Rightmove structure)
  $('div[data-test="property-gallery"] img, div[data-testid="property-gallery"] img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset')?.split(',')[0]?.split(' ')[0];
    if (src && !images.includes(src)) {
      images.push(src);
    }
  });

  // Method 2: Look for any images from media.rightmove.co.uk
  $('img[src*="media.rightmove"]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !images.includes(src)) {
      images.push(src);
    }
  });

  // Method 3: Look for hero/main image
  $('img[src*="hero"], img[src*="main"], [data-testid="hero-image"] img, [data-test="hero-image"] img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !images.includes(src)) {
      images.push(src);
    }
  });

  // Method 4: Look in script tags for image URLs (JSON-LD or other embedded data)
  $('script').each((_, el) => {
    const content = $(el).html() || '';
    const imageMatches = content.match(/https:\/\/media\.rightmove\.co\.uk\/[^"'\s]+/g);
    if (imageMatches) {
      imageMatches.forEach(url => {
        if (!images.includes(url)) {
          images.push(url);
        }
      });
    }
  });

  // Method 5: Try meta image (Open Graph)
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage && !images.includes(ogImage)) {
    images.unshift(ogImage);
  }

  // Method 6: Try Twitter card image
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage && !images.includes(twitterImage)) {
    images.unshift(twitterImage);
  }

  // Clean up URLs - remove size parameters and get full resolution
  const cleanedImages = images.map(url => {
    // Remove _max or other size suffixes to get full resolution
    return url.replace(/_\d+x\d+/, '').replace(/_max/, '');
  });

  // Filter out non-property images (agent logos, branch profiles, etc.)
  // Prioritize actual property photos
  const propertyImages = cleanedImages.filter(url => 
    url.includes('property-photo') || // Actual property photos
    url.includes('prop') || // Property images
    (url.includes('media.rightmove') && !url.includes('partner-branchprofile')) // Media images excluding agent logos
  );

  // Reorder: put property photos first, then other images
  const reorderedImages = [
    ...propertyImages,
    ...cleanedImages.filter(url => !propertyImages.includes(url))
  ];

  return reorderedImages.slice(0, 10); // Limit to 10 images
}
