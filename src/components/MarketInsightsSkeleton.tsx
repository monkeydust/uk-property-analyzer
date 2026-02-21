'use client';

export function MarketInsightsSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="w-32 h-6 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
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
  );
}
