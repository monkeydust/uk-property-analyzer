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
 * Parse Rightmove HTML and extract property data
 */
function parseRightmoveHtml(html: string, sourceUrl: string, rightmoveId: string): Property | null {
  const $ = cheerio.load(html);

  // Try to find JSON data embedded in page (most reliable)
  let jsonData: Record<string, unknown> | null = null;

  $('script').each((_, element) => {
    const content = $(element).html() || '';

    // Look for window.PAGE_MODEL
    const pageModelMatch = content.match(/window\.PAGE_MODEL\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|<\/script>|$)/);
    if (pageModelMatch) {
      try {
        jsonData = JSON.parse(pageModelMatch[1]);
      } catch {
        // Try alternative parsing
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

  // Strategy 1: Look for postcode in PAGE_MODEL JSON (most reliable for this property)
  let streetName: string | null = null;
  let doorNumber: string | null = null;
  let epcCurrentRating: string | null = null;
  let epcPotentialRating: string | null = null;
  let epcGraphUrl: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  $('script').each((_, element) => {
    const content = $(element).html() || '';

    // Look for PAGE_MODEL which contains property details
    if (content.includes('PAGE_MODEL') || content.includes('propertyData')) {
      // Look for outcode pattern (the area code like N20, SW1, etc.)
      const outcodeMatch = content.match(/"outcode"\s*:\s*"([A-Z]{1,2}\d{1,2}[A-Z]?)"/i);
      const incodeMatch = content.match(/"incode"\s*:\s*"(\d[A-Z]{2})"/i);

      if (outcodeMatch && incodeMatch) {
        postcode = `${outcodeMatch[1].toUpperCase()} ${incodeMatch[1].toUpperCase()}`;
        console.log('Postcode from PAGE_MODEL (outcode+incode):', postcode);
      }

      // Try direct postcode field
      if (!postcode) {
        const postcodeMatch = content.match(/"postcode"\s*:\s*"([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})"/i);
        if (postcodeMatch) {
          postcode = postcodeMatch[1].toUpperCase().replace(/\s+/g, ' ');
          console.log('Postcode from PAGE_MODEL (direct):', postcode);
        }
      }

      // Extract street name from display address (first part before comma)
      const displayMatch = content.match(/"displayAddress"\s*:\s*"([^"]+)"/);
      if (displayMatch) {
        streetName = displayMatch[1].split(',')[0].trim();
        console.log('Street name parsed from displayAddress:', streetName);
      }

      // Extract building/door number (may be called various things)
      const buildingMatch = content.match(/"(?:buildingNumber|buildingName|propertyNumber)"\s*:\s*"([^"]+)"/);
      if (buildingMatch) {
        doorNumber = buildingMatch[1];
        console.log('Door/building number from PAGE_MODEL:', doorNumber);
      }

      // Extract EPC ratings - try multiple field names
      const epcPatterns = [
        /"currentEnergyRating"\s*:\s*"([A-G])"/i,
        /"epcRating"\s*:\s*"([A-G])"/i,
        /"energyRating"\s*:\s*"([A-G])"/i,
        /"current(?:Epc)?Rating"\s*:\s*"([A-G])"/i,
      ];

      for (const pattern of epcPatterns) {
        const match = content.match(pattern);
        if (match && !epcCurrentRating) {
          epcCurrentRating = match[1].toUpperCase();
          console.log('EPC current rating found:', epcCurrentRating);
          break;
        }
      }

      const epcPotentialPatterns = [
        /"potentialEnergyRating"\s*:\s*"([A-G])"/i,
        /"potential(?:Epc)?Rating"\s*:\s*"([A-G])"/i,
      ];

      for (const pattern of epcPotentialPatterns) {
        const match = content.match(pattern);
        if (match && !epcPotentialRating) {
          epcPotentialRating = match[1].toUpperCase();
          console.log('EPC potential rating found:', epcPotentialRating);
          break;
        }
      }

      // Look for EPC ratings in various formats
      // Format: "eerCurrentRating": "d" or "eerPotentialRating": "c"
      const eerCurrentMatch = content.match(/"eerCurrentRating"\s*:\s*"([a-gA-G])"/);
      if (eerCurrentMatch && !epcCurrentRating) {
        epcCurrentRating = eerCurrentMatch[1].toUpperCase();
        console.log('EPC current (eerCurrentRating):', epcCurrentRating);
      }

      const eerPotentialMatch = content.match(/"eerPotentialRating"\s*:\s*"([a-gA-G])"/);
      if (eerPotentialMatch && !epcPotentialRating) {
        epcPotentialRating = eerPotentialMatch[1].toUpperCase();
        console.log('EPC potential (eerPotentialRating):', epcPotentialRating);
      }

      // Extract EPC graph URL
      const epcGraphMatch = content.match(/"epcGraphs"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/);
      if (epcGraphMatch && !epcGraphUrl) {
        epcGraphUrl = epcGraphMatch[1];
        console.log('EPC graph URL:', epcGraphUrl);
      }

      // Extract latitude and longitude
      const latMatch = content.match(/"latitude"\s*:\s*([-\d.]+)/);
      const lngMatch = content.match(/"longitude"\s*:\s*([-\d.]+)/);
      if (latMatch && lngMatch) {
        latitude = parseFloat(latMatch[1]);
        longitude = parseFloat(lngMatch[1]);
        console.log('Coordinates from PAGE_MODEL:', latitude, longitude);
      }

      if (postcode) return false;
    }
  });

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

  // Try to get images from various sources
  $('img[src*="media.rightmove"], [data-testid="gallery-image"] img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src');
    if (src && !images.includes(src)) {
      images.push(src);
    }
  });

  // Try meta image
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage && !images.includes(ogImage)) {
    images.unshift(ogImage);
  }

  return images.slice(0, 10); // Limit to 10 images
}
