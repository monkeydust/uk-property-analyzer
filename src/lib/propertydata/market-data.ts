import { propertyDataGet, PropertyDataError } from '@/lib/propertydata/client';
import { marketDataCache, TTL } from '@/lib/cache';
import type { MarketDataResult } from '@/lib/types/property';

// ── Actual PropertyData API response shapes ──────────────────────────

interface ValuationSaleResponse {
  status: 'success' | 'error';
  result?: {
    estimate?: number;
    estimate_lower?: number;
    estimate_upper?: number;
  };
  code?: string;
  message?: string;
}

interface PricesResponse {
  status: 'success' | 'error';
  data?: {
    average?: number;
    points_analysed?: number;
    date_latest?: string;
  };
  code?: string;
  message?: string;
}

// Growth returns data as an array of [date_label, value, pct_string]
interface GrowthResponse {
  status: 'success' | 'error';
  data?: [string, number, string | null][];
  code?: string;
  message?: string;
}

// Council tax: properties list + council_tax bands at top level
interface CouncilTaxResponse {
  status: 'success' | 'error';
  council?: string;
  council_rating?: string;
  council_tax?: Record<string, string>;
  properties?: { address: string; band: string }[];
  code?: string;
  message?: string;
}

// Crime: fields at top level
interface CrimeResponse {
  status: 'success' | 'error';
  crime_rating?: string;
  crimes_per_thousand?: number;
  crimes_last_12m?: number;
  population?: number;
  observations?: string[];
  types?: Record<string, number>;
  code?: string;
  message?: string;
}

// Flood risk: field at top level
interface FloodRiskResponse {
  status: 'success' | 'error';
  flood_risk?: string;
  code?: string;
  message?: string;
}

// Conservation area: field at top level
interface ConservationAreaResponse {
  status: 'success' | 'error';
  conservation_area?: boolean;
  conservation_area_name?: string | null;
  code?: string;
  message?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildCacheKey(postcode: string, bedrooms: number | null, propertyType: string): string {
  return `marketData::${postcode.toUpperCase().replace(/\s+/g, '')}::${bedrooms ?? 'unknown'}::${propertyType}`;
}

function calculateMargin(listingPrice: number | null, estimate: number | null): string | null {
  if (!listingPrice || !estimate || estimate === 0) return null;

  const diff = listingPrice - estimate;
  const percentage = (diff / estimate) * 100;

  if (Math.abs(percentage) < 2) {
    return 'Fairly priced';
  } else if (percentage > 0) {
    return `Overpriced by ${Math.round(percentage)}%`;
  } else {
    return `Underpriced by ${Math.round(Math.abs(percentage))}%`;
  }
}

/** Map Rightmove property type to PropertyData property_type enum */
function mapPropertyType(type: string): string | null {
  const lower = type.toLowerCase();
  if (lower.includes('detached') && !lower.includes('semi')) return 'detached_house';
  if (lower.includes('semi')) return 'semi-detached_house';
  if (lower.includes('terrace')) return 'terraced_house';
  if (lower.includes('flat') || lower.includes('apartment')) return 'flat';
  if (lower.includes('bungalow')) return 'bungalow';
  return null; // unknown — skip valuation
}

/**
 * Parse growth data array → 5-year cumulative % change.
 * The API returns [[date, value, pct], ...] sorted chronologically.
 * We compute total growth from the earliest to the latest value.
 */
function parseGrowth(data: [string, number, string | null][]): { fiveYear: number | null; trend: 'up' | 'down' | 'stable' | null } {
  if (!Array.isArray(data) || data.length < 2) return { fiveYear: null, trend: null };

  const first = data[0]?.[1];
  const last = data[data.length - 1]?.[1];

  if (typeof first !== 'number' || typeof last !== 'number' || first === 0) {
    return { fiveYear: null, trend: null };
  }

  const fiveYear = ((last - first) / first) * 100;
  const rounded = Math.round(fiveYear * 10) / 10;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (rounded > 10) trend = 'up';
  else if (rounded < -5) trend = 'down';

  return { fiveYear: rounded, trend };
}

/**
 * Find the council tax band for a specific address from the properties list.
 * Falls back to the most common band if no match.
 */
function findCouncilTaxBand(
  properties: { address: string; band: string }[],
  doorNumber: string | null,
  streetName: string | null
): string | null {
  if (!properties || properties.length === 0) return null;

  // Try exact match first
  if (doorNumber) {
    const numMatch = properties.find((p) => {
      const addr = p.address.toUpperCase();
      return addr.startsWith(doorNumber.toUpperCase());
    });
    if (numMatch) return numMatch.band;
  }

  // Fall back to mode (most common band in this postcode)
  const counts: Record<string, number> = {};
  for (const p of properties) {
    counts[p.band] = (counts[p.band] || 0) + 1;
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [band, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = band;
      bestCount = count;
    }
  }
  return best;
}

function classifyFloodRisk(risk: string | null): 'low' | 'medium' | 'high' | null {
  if (!risk) return null;
  const lower = risk.toLowerCase();
  if (lower.includes('very low') || lower.includes('low')) return 'low';
  if (lower.includes('medium')) return 'medium';
  if (lower.includes('high')) return 'high';
  return null;
}

// ── Main fetch ──────────────────────────────────────────────────────

export async function getMarketData(
  postcode: string,
  bedrooms: number | null,
  propertyType: string,
  listingPrice: number | null,
  squareFootage: number | null,
  doorNumber?: string | null,
  streetName?: string | null,
  bustCache?: boolean
): Promise<MarketDataResult> {
  const cacheKey = buildCacheKey(postcode, bedrooms, propertyType);

  if (bustCache) {
    marketDataCache.delete(cacheKey);
  }

  const cached = marketDataCache.get(cacheKey);
  if (cached) {
    return { ...cached, cached: true };
  }

  const baseResult: MarketDataResult = {
    success: false,
    data: {
      valuation: { estimate: null, margin: null, confidence: null },
      growth: { fiveYear: null, trend: null },
      ownership: { councilTaxBand: null, tenure: null, isConservationArea: false },
      risks: { crimeRating: null, floodRisk: null, floodRiskLevel: null },
      comparables: { averagePrice: null, count: 0, timeRange: '' },
    },
  };

  try {
    const mappedType = mapPropertyType(propertyType);

    // Build valuation params — requires many fields; use sensible defaults
    const valuationParams: Record<string, string | number | boolean | undefined | null> = {
      postcode,
      ...(bedrooms != null && { bedrooms: String(bedrooms) }),
      ...(squareFootage && squareFootage >= 300 && { internal_area: String(squareFootage) }),
      ...(mappedType && { property_type: mappedType }),
      construction_date: 'pre_1914',
      finish_quality: 'average',
      outdoor_space: 'garden',
      off_street_parking: '1',
      ...(bedrooms != null && { bathrooms: String(Math.max(1, Math.ceil((bedrooms || 2) / 2))) }),
    };

    // Call endpoints sequentially to avoid PropertyData rate limits.
    // The plot size chain in /api/analyze may have just consumed several calls,
    // so parallel requests here reliably trigger throttling.
    async function safeGet<T>(path: string, params: Record<string, string | number | boolean | undefined | null>): Promise<{ status: 'fulfilled'; value: T } | { status: 'rejected' }> {
      try {
        const value = await propertyDataGet<T>(path, params, { retriesOnThrottle: 3 });
        return { status: 'fulfilled', value };
      } catch {
        return { status: 'rejected' };
      }
    }

    const valuationResult = mappedType
      ? await safeGet<ValuationSaleResponse>('valuation-sale', valuationParams)
      : { status: 'rejected' as const };

    const pricesResult = await safeGet<PricesResponse>('prices', {
      postcode,
      points: 20,
      ...(bedrooms && { bedrooms: String(bedrooms) }),
    });

    const growthResult = await safeGet<GrowthResponse>('growth', { postcode });

    const councilTaxResult = await safeGet<CouncilTaxResponse>('council-tax', { postcode });

    const crimeResult = await safeGet<CrimeResponse>('crime', { postcode });

    const floodRiskResult = await safeGet<FloodRiskResponse>('flood-risk', { postcode });

    const conservationResult = await safeGet<ConservationAreaResponse>('conservation-area', { postcode });

    // ── Valuation ───────────────────────────────────────────────
    if (valuationResult.status === 'fulfilled') {
      const v = valuationResult.value as ValuationSaleResponse;
      if (v.status === 'success' && v.result?.estimate) {
        const estimate = v.result.estimate;
        baseResult.data!.valuation.estimate = estimate;
        baseResult.data!.valuation.margin = calculateMargin(listingPrice, estimate);
        if (v.result.estimate_lower && v.result.estimate_upper) {
          baseResult.data!.valuation.confidence =
            `£${v.result.estimate_lower.toLocaleString()} – £${v.result.estimate_upper.toLocaleString()}`;
        }
      }
    }

    // ── Prices (comparables) ────────────────────────────────────
    if (pricesResult.status === 'fulfilled') {
      const p = pricesResult.value as PricesResponse;
      if (p.status === 'success' && p.data) {
        baseResult.data!.comparables!.averagePrice = p.data.average ?? null;
        baseResult.data!.comparables!.count = p.data.points_analysed ?? 0;
        if (p.data.date_latest) {
          const date = new Date(p.data.date_latest);
          baseResult.data!.comparables!.timeRange = date.toLocaleDateString('en-GB', {
            month: 'short',
            year: 'numeric',
          });
        }
      }
    }

    // ── Growth ──────────────────────────────────────────────────
    if (growthResult.status === 'fulfilled') {
      const g = growthResult.value as GrowthResponse;
      if (g.status === 'success' && Array.isArray(g.data)) {
        const parsed = parseGrowth(g.data);
        baseResult.data!.growth.fiveYear = parsed.fiveYear;
        baseResult.data!.growth.trend = parsed.trend;
      }
    }

    // ── Council Tax ─────────────────────────────────────────────
    if (councilTaxResult.status === 'fulfilled') {
      const ct = councilTaxResult.value as CouncilTaxResponse;
      if (ct.status === 'success') {
        const band = findCouncilTaxBand(ct.properties || [], doorNumber ?? null, streetName ?? null);
        baseResult.data!.ownership.councilTaxBand = band;
      }
    }

    // ── Crime ───────────────────────────────────────────────────
    if (crimeResult.status === 'fulfilled') {
      const c = crimeResult.value as CrimeResponse;
      if (c.status === 'success') {
        baseResult.data!.risks.crimeRating = c.crime_rating ?? null;
      }
    }

    // ── Flood Risk ──────────────────────────────────────────────
    if (floodRiskResult.status === 'fulfilled') {
      const f = floodRiskResult.value as FloodRiskResponse;
      if (f.status === 'success') {
        baseResult.data!.risks.floodRisk = f.flood_risk ?? null;
        baseResult.data!.risks.floodRiskLevel = classifyFloodRisk(f.flood_risk ?? null);
      }
    }

    // ── Conservation Area ───────────────────────────────────────
    if (conservationResult.status === 'fulfilled') {
      const ca = conservationResult.value as ConservationAreaResponse;
      if (ca.status === 'success') {
        baseResult.data!.ownership.isConservationArea = ca.conservation_area ?? false;
      }
    }

    // ── Success check ───────────────────────────────────────────
    const hasSomeData =
      baseResult.data!.valuation.estimate !== null ||
      baseResult.data!.ownership.councilTaxBand !== null ||
      baseResult.data!.risks.crimeRating !== null ||
      baseResult.data!.risks.floodRisk !== null ||
      baseResult.data!.growth.fiveYear !== null ||
      (baseResult.data!.comparables?.count ?? 0) > 0;

    baseResult.success = hasSomeData;

    marketDataCache.set(cacheKey, baseResult, TTL.MARKET_DATA);
    return baseResult;
  } catch (error) {
    baseResult.success = false;
    baseResult.error = error instanceof PropertyDataError ? error.message : 'Failed to fetch market data';
    marketDataCache.set(cacheKey, baseResult, 300);
    return baseResult;
  }
}
