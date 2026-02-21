'use client';

import { TrendingUp, Building, ShieldAlert, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react';
import type { MarketDataResult } from '@/lib/types/property';

interface MarketInsightsCardProps {
  marketData: MarketDataResult | null | undefined;
  listingPrice: number | null;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return `£${value.toLocaleString()}`;
}

function getCrimeColor(rating: string | null | undefined): string {
  if (!rating) return 'text-slate-500';
  const lower = rating.toLowerCase();
  if (lower.includes('low')) return 'text-green-500';
  if (lower.includes('medium') || lower.includes('average')) return 'text-amber-500';
  if (lower.includes('high')) return 'text-red-500';
  return 'text-slate-500';
}

function getFloodColor(level: string | null | undefined): string {
  if (!level) return 'text-slate-500';
  const lower = level.toLowerCase();
  if (lower === 'low') return 'text-green-500';
  if (lower === 'medium') return 'text-amber-500';
  if (lower === 'high') return 'text-red-500';
  return 'text-slate-500';
}

function getGrowthIcon(trend: string | null | undefined) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-slate-400" />;
}

function getMarginBadge(margin: string | null, estimate: number | null, listingPrice: number | null) {
  if (!margin || !estimate || !listingPrice) return null;
  
  const isOverpriced = margin.toLowerCase().includes('overpriced');
  const isUnderpriced = margin.toLowerCase().includes('underpriced');
  
  if (isOverpriced) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <AlertTriangle className="w-3 h-3" />
        Potentially Overpriced
      </span>
    );
  }
  
  if (isUnderpriced) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle className="w-3 h-3" />
        Good Value
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
      <CheckCircle className="w-3 h-3" />
      Fairly Priced
    </span>
  );
}

export function MarketInsightsCard({ marketData, listingPrice }: MarketInsightsCardProps) {
  // Check if we have ANY data at all
  const hasAnyData = marketData?.data && (
    marketData.data.valuation?.estimate !== null ||
    marketData.data.valuation?.margin !== null ||
    marketData.data.growth?.fiveYear !== null ||
    marketData.data.ownership?.councilTaxBand !== null ||
    marketData.data.risks?.crimeRating !== null ||
    marketData.data.risks?.floodRisk !== null ||
    (marketData.data.comparables?.count ?? 0) > 0
  );

  if (!marketData || (!marketData.success && !hasAnyData)) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-500" />
          Market Insights
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Market data unavailable for this location.
        </p>
      </div>
    );
  }

  const data = marketData.data;
  
  // Check if this is partial data (only some fields available)
  const isPartialData = 
    data?.valuation?.estimate === null ||
    data?.growth?.fiveYear === null ||
    data?.ownership?.councilTaxBand === null ||
    data?.risks?.crimeRating === null;
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-500" />
          Market Insights
        </h3>
        {isPartialData && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-full">
            Partial Data
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Valuation & Growth */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Estimated Value</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(data?.valuation.estimate)}
            </p>
            {listingPrice && data?.valuation.estimate && (
              <div className="mt-2">
                {getMarginBadge(data.valuation.margin, data.valuation.estimate, listingPrice)}
              </div>
            )}
            {data?.valuation.confidence && (
              <p className="text-xs text-slate-400 mt-1">
                Confidence: {data.valuation.confidence}
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">5-Year Growth</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {data?.growth?.fiveYear != null 
                  ? `${data.growth.fiveYear > 0 ? '+' : ''}${data.growth.fiveYear.toFixed(1)}%`
                  : 'N/A'
                }
              </p>
              {getGrowthIcon(data?.growth?.trend)}
            </div>
          </div>

          {data?.comparables && data.comparables.count > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Recent Sales</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {data.comparables.count} sales avg {formatCurrency(data.comparables.averagePrice)}
              </p>
              {data.comparables.timeRange && (
                <p className="text-xs text-slate-400">
                  to {data.comparables.timeRange}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Ownership Costs */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Building className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Council Tax Band</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {data?.ownership.councilTaxBand || 'N/A'}
              </p>
            </div>
          </div>

          {data?.ownership.tenure && (
            <div className="flex items-start gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-5 h-5 flex-shrink-0" /> {/* Spacer */}
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Tenure</p>
                <p className="text-lg font-medium text-slate-900 dark:text-slate-100">
                  {data.ownership.tenure}
                </p>
              </div>
            </div>
          )}

          {data?.ownership.isConservationArea && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3" />
                Conservation Area
              </span>
              <p className="text-xs text-slate-500 mt-1">
                Restrictions may apply to alterations
              </p>
            </div>
          )}
        </div>

        {/* Column 3: Risks & Safety */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Crime Rating</p>
              <p className={`text-xl font-bold ${getCrimeColor(data?.risks.crimeRating)}`}>
                {data?.risks.crimeRating || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="w-5 h-5 flex-shrink-0" /> {/* Spacer */}
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Flood Risk</p>
              <p className={`text-xl font-bold ${getFloodColor(data?.risks.floodRiskLevel)}`}>
                {data?.risks.floodRisk || 'N/A'}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            <p>Data provided by PropertyData</p>
          </div>
        </div>
      </div>
    </div>
  );
}
