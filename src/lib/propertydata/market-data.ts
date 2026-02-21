import { propertyDataGet, PropertyDataError } from '@/lib/propertydata/client';
import { marketDataCache, TTL } from '@/lib/cache';
import type { MarketDataResult } from '@/lib/types/property';

interface ValuationSaleResponse {
  status: 'success' | 'error';
  data?: {
    estimate?: number;
    margin?: string;
    confidence?: string;
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

interface GrowthResponse {
  status: 'success' | 'error';
  data?: {
    per_year?: number;
    growth_5_year?: number;
  };
  code?: string;
  message?: string;
}

interface CouncilTaxResponse {
  status: 'success' | 'error';
  data?: {
    band?: string;
  };
  code?: string;
  message?: string;
}

interface CrimeResponse {
  status: 'success' | 'error';
  data?: {
    rating?: string;
  };
  code?: string;
  message?: string;
}

interface FloodRiskResponse {
  status: 'success' | 'error';
  data?: {
    risk?: string;
    level?: 'low' | 'medium' | 'high';
  };
  code?: string;
  message?: string;
}

interface ConservationAreaResponse {
  status: 'success' | 'error';
  data?: {
    in_conservation_area?: boolean;
    name?: string;
  };
  code?: string;
  message?: string;
}

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

export async function getMarketData(
  postcode: string,
  bedrooms: number | null,
  propertyType: string,
  listingPrice: number | null,
  squareFootage: number | null
): Promise<MarketDataResult> {
  const cacheKey = buildCacheKey(postcode, bedrooms, propertyType);
  
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
      comparables: { averagePrice: null, count: 0, timeRange: '' }
    }
  };

  try {
    // Fetch all endpoints in parallel with Promise.allSettled
    const [
      valuationResult,
      pricesResult,
      growthResult,
      councilTaxResult,
      crimeResult,
      floodRiskResult,
      conservationResult
    ] = await Promise.allSettled([
      // Valuation endpoint - requires bedrooms and internal area for best results
      propertyDataGet<ValuationSaleResponse>('valuation-sale', {
        postcode,
        ...(bedrooms && { bedrooms: String(bedrooms) }),
        ...(squareFootage && { internal_area: String(squareFootage) })
      }, { retriesOnThrottle: 2 }),
      
      // Prices endpoint for comparables
      propertyDataGet<PricesResponse>('prices', {
        postcode,
        points: 20,
        ...(bedrooms && { bedrooms: String(bedrooms) })
      }, { retriesOnThrottle: 2 }),
      
      // Growth endpoint
      propertyDataGet<GrowthResponse>('growth', { postcode }, { retriesOnThrottle: 2 }),
      
      // Council tax endpoint
      propertyDataGet<CouncilTaxResponse>('council-tax', { postcode }, { retriesOnThrottle: 2 }),
      
      // Crime endpoint
      propertyDataGet<CrimeResponse>('crime', { postcode }, { retriesOnThrottle: 2 }),
      
      // Flood risk endpoint
      propertyDataGet<FloodRiskResponse>('flood-risk', { postcode }, { retriesOnThrottle: 2 }),
      
      // Conservation area endpoint
      propertyDataGet<ConservationAreaResponse>('conservation-area', { postcode }, { retriesOnThrottle: 2 })
    ]);

    // Process valuation result
    if (valuationResult.status === 'fulfilled' && valuationResult.value.status === 'success') {
      const estimate = valuationResult.value.data?.estimate ?? null;
      baseResult.data!.valuation.estimate = estimate;
      baseResult.data!.valuation.margin = calculateMargin(listingPrice, estimate);
      baseResult.data!.valuation.confidence = valuationResult.value.data?.confidence ?? null;
    }

    // Process prices result (for comparables)
    if (pricesResult.status === 'fulfilled' && pricesResult.value.status === 'success') {
      baseResult.data!.comparables!.averagePrice = pricesResult.value.data?.average ?? null;
      baseResult.data!.comparables!.count = pricesResult.value.data?.points_analysed ?? 0;
      if (pricesResult.value.data?.date_latest) {
        const date = new Date(pricesResult.value.data.date_latest);
        baseResult.data!.comparables!.timeRange = date.toLocaleDateString('en-GB', { 
          month: 'short', 
          year: 'numeric' 
        });
      }
    }

    // Process growth result
    if (growthResult.status === 'fulfilled' && growthResult.value.status === 'success') {
      baseResult.data!.growth.fiveYear = growthResult.value.data?.growth_5_year ?? 
                                        (growthResult.value.data?.per_year ? growthResult.value.data.per_year * 5 : null);
      
      // Determine trend
      const growth = baseResult.data!.growth.fiveYear;
      if (growth !== null) {
        if (growth > 10) baseResult.data!.growth.trend = 'up';
        else if (growth < -5) baseResult.data!.growth.trend = 'down';
        else baseResult.data!.growth.trend = 'stable';
      }
    }

    // Process council tax result
    if (councilTaxResult.status === 'fulfilled' && councilTaxResult.value.status === 'success') {
      baseResult.data!.ownership.councilTaxBand = councilTaxResult.value.data?.band ?? null;
    }

    // Process crime result
    if (crimeResult.status === 'fulfilled' && crimeResult.value.status === 'success') {
      baseResult.data!.risks.crimeRating = crimeResult.value.data?.rating ?? null;
    }

    // Process flood risk result
    if (floodRiskResult.status === 'fulfilled' && floodRiskResult.value.status === 'success') {
      baseResult.data!.risks.floodRisk = floodRiskResult.value.data?.risk ?? null;
      baseResult.data!.risks.floodRiskLevel = floodRiskResult.value.data?.level ?? null;
    }

    // Process conservation area result
    if (conservationResult.status === 'fulfilled' && conservationResult.value.status === 'success') {
      baseResult.data!.ownership.isConservationArea = conservationResult.value.data?.in_conservation_area ?? false;
    }

    // Mark as successful if we got at least some data
    const hasSomeData = 
      baseResult.data!.valuation.estimate !== null ||
      baseResult.data!.ownership.councilTaxBand !== null ||
      baseResult.data!.risks.crimeRating !== null ||
      baseResult.data!.risks.floodRisk !== null ||
      baseResult.data!.growth.fiveYear !== null ||
      (baseResult.data!.comparables?.count ?? 0) > 0;
    
    baseResult.success = hasSomeData;

    // Cache the result
    marketDataCache.set(cacheKey, baseResult, TTL.MARKET_DATA);

    return baseResult;

  } catch (error) {
    // Return partial data even if overall fetch had issues
    baseResult.success = false;
    baseResult.error = error instanceof PropertyDataError ? error.message : 'Failed to fetch market data';
    
    // Still cache failures briefly (5 minutes) to avoid hammering the API
    marketDataCache.set(cacheKey, baseResult, 300);
    
    return baseResult;
  }
}

export async function getMarketDataBatch(
  requests: Array<{
    postcode: string;
    bedrooms: number | null;
    propertyType: string;
    listingPrice: number | null;
    squareFootage: number | null;
  }>
): Promise<MarketDataResult[]> {
  return Promise.all(
    requests.map(req => 
      getMarketData(req.postcode, req.bedrooms, req.propertyType, req.listingPrice, req.squareFootage)
    )
  );
}
