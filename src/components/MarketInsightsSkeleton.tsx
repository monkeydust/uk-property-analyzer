'use client';

export function MarketInsightsSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="w-32 h-6 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2 bg-white/80 dark:bg-slate-900/80 px-4 py-3 rounded-lg backdrop-blur-sm shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <svg className="w-6 h-6 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium text-slate-500 shadow-sm">Fetching market data...</span>
          </div>
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Column 1 skeletons */}
          <div className="space-y-4">
            <div>
              <div className="w-24 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
              <div className="w-28 h-8 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
              <div className="w-20 h-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-20 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
              <div className="w-24 h-7 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-24 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
              <div className="w-full h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>

          {/* Column 2 skeletons */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="w-24 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
                <div className="w-16 h-8 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>

            <div className="flex items-start gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
                <div className="w-24 h-6 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-28 h-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-full h-3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mt-1" />
            </div>
          </div>

          {/* Column 3 skeletons */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="w-20 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
                <div className="w-16 h-8 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>

            <div className="flex items-start gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1">
                <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse mb-2" />
                <div className="w-20 h-8 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="w-24 h-3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
