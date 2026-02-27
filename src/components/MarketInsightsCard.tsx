'use client';

import { useState } from 'react';
import { TrendingUp, Building, ShieldAlert, TrendingDown, Minus, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, PoundSterling, CalendarDays, Home, Building2, Loader2 } from 'lucide-react';
import type { MarketDataResult, TransactionRecord } from '@/lib/types/property';

interface MarketInsightsCardProps {
  marketData: MarketDataResult | null | undefined;
  listingPrice: number | null;
  transactions?: TransactionRecord[] | null;
  transactionsLoading?: boolean;
  address?: {
    doorNumber: string | null;
    streetName: string | null;
    postcode: string | null;
  };
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

/** Sort crime types by count descending and return top N */
function getTopCrimeTypes(types: Record<string, number> | undefined, limit: number = 5): [string, number][] {
  if (!types) return [];
  return Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function getCrimeTypeColor(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('violence') || lower.includes('robbery') || lower.includes('weapon')) return 'bg-red-500';
  if (lower.includes('burglary') || lower.includes('theft') || lower.includes('vehicle')) return 'bg-amber-500';
  if (lower.includes('anti-social') || lower.includes('public order')) return 'bg-orange-400';
  if (lower.includes('drugs') || lower.includes('shoplifting')) return 'bg-yellow-500';
  return 'bg-slate-400';
}

export function MarketInsightsCard({ marketData, listingPrice, transactions, transactionsLoading, address }: MarketInsightsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'insights' | 'transactions'>('insights');

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

  if ((!marketData || (!marketData.success && !hasAnyData)) && (!transactions || transactions.length === 0) && !transactionsLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-slate-500" />
          Market Data & Sales
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Market data and transaction history are unavailable for this location.
        </p>
      </div>
    );
  }

  const data = marketData?.data;

  // Check if this is partial data (only some fields available)
  const isPartialData =
    data?.valuation?.estimate === null ||
    data?.growth?.fiveYear === null ||
    data?.ownership?.councilTaxBand === null ||
    data?.risks?.crimeRating === null;

  // Check if we have any expanded data to show
  const hasExpandedData =
    (data?.risks?.crimeTypes && Object.keys(data.risks.crimeTypes).length > 0) ||
    data?.risks?.crimesPerThousand != null ||
    data?.ownership?.councilTaxAmount ||
    data?.ownership?.councilName ||
    data?.ownership?.councilRating ||
    data?.ownership?.conservationAreaName ||
    (data?.growth?.yearByYear && data.growth.yearByYear.length > 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
        <button
          onClick={() => setActiveTab('insights')}
          className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'insights'
            ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 bg-white dark:bg-slate-900'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <TrendingUp className="w-4 h-4" />
          Market Insights
          {isPartialData && activeTab === 'insights' && (
            <span className="ml-2 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
              Partial
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 py-3 px-4 text-sm font-semibold text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'transactions'
            ? 'text-teal-600 dark:text-teal-400 border-b-2 border-teal-500 bg-white dark:bg-slate-900'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
        >
          <PoundSterling className="w-4 h-4" />
          Similar Sales
          {transactionsLoading ? (
            <Loader2 className="w-3 h-3 animate-spin ml-1 text-slate-400" />
          ) : (
            transactions && transactions.length > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full">
                {transactions.length}
              </span>
            )
          )}
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'insights' && (!marketData || (!marketData.success && !hasAnyData)) ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
            Market insights unavailable for this location.
          </p>
        ) : activeTab === 'insights' ? (
          <>
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
                  <div className="text-right">
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {data?.ownership.councilTaxBand || 'N/A'}
                    </p>
                    {data?.ownership?.councilTaxAmount && (
                      <p className="text-xs text-slate-400">{data.ownership.councilTaxAmount}/yr</p>
                    )}
                  </div>
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

            {/* ── Expandable "More Info" Section ── */}
            {hasExpandedData && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  {expanded ? 'Less Info' : 'More Info'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded ? 'max-h-[800px] opacity-100 mt-3' : 'max-h-0 opacity-0'
                    }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* ── Crime Breakdown ── */}
                    {data?.risks?.crimeTypes && Object.keys(data.risks.crimeTypes).length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Crime Breakdown
                        </h4>

                        {/* Stats row */}
                        <div className="flex gap-4 mb-3">
                          {data.risks.crimesPerThousand != null && (
                            <div>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {data.risks.crimesPerThousand.toFixed(0)}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">per 1,000 pop</p>
                            </div>
                          )}
                          {data.risks.crimesLast12m != null && (
                            <div>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {data.risks.crimesLast12m.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">total (12 months)</p>
                            </div>
                          )}
                          {data.risks.crimePopulation != null && (
                            <div>
                              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {data.risks.crimePopulation.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wide">local population</p>
                            </div>
                          )}
                        </div>

                        {/* Crime type bars */}
                        <div className="space-y-1.5">
                          {(() => {
                            const topCrimes = getTopCrimeTypes(data.risks.crimeTypes, 6);
                            const maxCount = topCrimes[0]?.[1] || 1;
                            return topCrimes.map(([type, count]) => (
                              <div key={type}>
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate mr-2">{type}</span>
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex-shrink-0">{count}</span>
                                </div>
                                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${getCrimeTypeColor(type)} transition-all duration-500`}
                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}

                    {/* ── Council & Area Details ── */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5" />
                        Council &amp; Area
                      </h4>

                      <div className="space-y-2.5">
                        {data?.ownership?.councilName && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Local Authority</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.ownership.councilName}</p>
                          </div>
                        )}

                        {data?.ownership?.councilRating && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Council Tax Rating</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.ownership.councilRating}</p>
                          </div>
                        )}

                        {data?.ownership?.councilTaxBand && data?.ownership?.councilTaxAmount && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Annual Council Tax (Band {data.ownership.councilTaxBand})</p>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{data.ownership.councilTaxAmount}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {transactionsLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm">Fetching registry data...</span>
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
                No similar property transactions found on this street in the last 10 years.
              </p>
            ) : (
              (() => {
                const normalizedDoor = address?.doorNumber?.toLowerCase().trim();
                const exactMatchIndex = transactions.findIndex((t) => {
                  const p = t.paon?.toLowerCase().trim();
                  const s = t.saon?.toLowerCase().trim();
                  return p === normalizedDoor || s === normalizedDoor;
                });

                const displayTransactions = expanded ? transactions : transactions.slice(0, 5);

                return (
                  <>
                    <p className="text-xs text-slate-500 dark:text-slate-400 my-2 px-1">
                      Recent properties sold on {address?.streetName || 'this street'} with matching attributes.
                    </p>
                    {displayTransactions.map((tx, idx) => {
                      const isExactMatch = idx === exactMatchIndex && !expanded;
                      const isThisProperty = normalizedDoor && (tx.paon?.toLowerCase().trim() === normalizedDoor || tx.saon?.toLowerCase().trim() === normalizedDoor);

                      return (
                        <div
                          key={`${tx.date}-${tx.paon}-${tx.saon}`}
                          className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isThisProperty
                            ? 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800/50'
                            : 'bg-white border-slate-100 dark:bg-slate-800/50 dark:border-slate-700/50'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-md ${isThisProperty ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                              {tx.propertyType?.includes('Flat') || tx.propertyType?.includes('Maisonette') ? (
                                <Building2 className="w-4 h-4" />
                              ) : (
                                <Home className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {[tx.saon, tx.paon, tx.street].filter(Boolean).join(' ')}
                                {isThisProperty && (
                                  <span className="text-[9px] uppercase tracking-wider font-bold bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400 py-0.5 px-1.5 rounded-full">
                                    This Property
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <CalendarDays className="w-3 h-3" />
                                  {new Date(tx.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                                </span>
                                {tx.newBuild && (
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-purple-600 dark:text-purple-400">
                                    NEW BUILD
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 sm:text-right pl-11 sm:pl-0">
                            £{tx.amount.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}

                    {transactions.length > 5 && (
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full mt-2 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
                      >
                        {expanded ? (
                          <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
                        ) : (
                          <>View All {transactions.length} Transactions <ChevronDown className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}
      </div>
    </div>
  );
}
