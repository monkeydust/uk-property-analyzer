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
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-500" />
          Market Insights
        </h3>
        {isPartialData && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
            Partial Data
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: Valuation & Growth */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between items-baseline">
              <p className="text-sm text-slate-500 dark:text-slate-400">Estimated Value</p>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(data?.valuation.estimate)}
              </p>
            </div>
            {listingPrice && data?.valuation.estimate && (
              <div className="mt-1 text-right">
                {getMarginBadge(data.valuation.margin, data.valuation.estimate, listingPrice)}
              </div>
            )}
            {data?.valuation.confidence && (
              <p className="text-xs text-slate-400 mt-0.5 text-right">
                Confidence: {data.valuation.confidence}
              </p>
            )}
          </div>

          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">5-Year Growth</p>
            <div className="flex items-center gap-1.5">
              <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {data?.growth?.fiveYear != null
                  ? `${data.growth.fiveYear > 0 ? '+' : ''}${data.growth.fiveYear.toFixed(1)}%`
                  : 'N/A'
                }
              </p>
              {getGrowthIcon(data?.growth?.trend)}
            </div>
          </div>

          {data?.comparables && data.comparables.count > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-baseline">
                <p className="text-sm text-slate-500 dark:text-slate-400">Recent Sales</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {data.comparables.count} avg {formatCurrency(data.comparables.averagePrice)}
                </p>
              </div>
              {data.comparables.timeRange && (
                <p className="text-xs text-slate-400 text-right">
                  to {data.comparables.timeRange}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Column 2: Ownership Costs */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Building className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Property Details</h4>
          </div>

          <div className="flex justify-between items-baseline">
            <p className="text-sm text-slate-500 dark:text-slate-400">Council Tax Band</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {data?.ownership.councilTaxBand || 'N/A'}
            </p>
          </div>

          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Conservation Area</p>
            {data?.ownership.isConservationArea ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                Yes
              </span>
            ) : (
              <span className="text-base font-semibold text-green-600 dark:text-green-400">
                No
              </span>
            )}
          </div>
        </div>

        {/* Column 3: Risks & Safety */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Local Info</h4>
          </div>

          <div className="flex justify-between items-baseline">
            <p className="text-sm text-slate-500 dark:text-slate-400">Crime</p>
            <p className={`text-base font-semibold ${getCrimeColor(data?.risks.crimeRating)}`}>
              {data?.risks.crimeRating || 'N/A'}
            </p>
          </div>

          <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Flood Risk</p>
            <p className={`text-base font-semibold ${getFloodColor(data?.risks.floodRiskLevel)}`}>
              {data?.risks.floodRisk || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
