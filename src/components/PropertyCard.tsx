'use client';

import { Trash2, Star, Home } from 'lucide-react';
import { SavedProperty, formatTimeAgo } from '@/lib/storage';

interface PropertyCardProps {
  property: SavedProperty;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStar: (e: React.MouseEvent) => void;
}

const getProgressPercent = (status: string) => {
  switch (status) {
    case 'queued': return 15;
    case 'scraping': return 35;
    case 'enriching': return 70;
    case 'analyzing': return 90;
    default: return 0;
  }
};

export function PropertyCard({ property, onClick, onDelete, onStar }: PropertyCardProps) {
  const { data, timestamp, isStarred, status, error } = property;
  const { property: propData } = data;

  const isActive = !!status && status !== 'complete' && status !== 'error';
  const hasRealImages = propData.images && propData.images.length > 0 && !propData.images[0].startsWith('data:');
  const hasRealAddress = propData.address?.displayAddress && !propData.address.displayAddress.startsWith('http');

  // Get first image or contextual placeholder
  const imageUrl = hasRealImages
    ? propData.images[0]
    : (propData.listingType === 'off-market' ? '/images/off_market.png' : null);

  // Format price
  const priceText = propData.price
    ? `£${propData.price.toLocaleString()}`
    : 'Price N/A';

  // Commute times — available for both completed and in-progress cards
  const commuteTimes = data.commuteTimes && data.commuteTimes.length > 0 ? data.commuteTimes : null;

  const getStatusBadge = () => {
    if (!status) return null;

    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-100 dark:border-red-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
          Failed
        </span>
      );
    }

    const labels: Record<string, string> = {
      queued: 'Queued',
      scraping: 'Scraping',
      enriching: 'Enriching',
      analyzing: 'AI Analyzing',
    };

    const label = labels[status] || 'Processing';

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse flex-shrink-0" />
        {label}
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border active:bg-slate-50 dark:active:bg-slate-800 ${
        isStarred
          ? 'border-amber-300 dark:border-amber-600/60'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-[120px] h-[84px] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={propData.address.displayAddress}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          /* Gradient placeholder with animated icon for in-progress or missing images */
          <div className="w-full h-full bg-gradient-to-br from-teal-100 via-slate-100 to-sky-100 dark:from-teal-900/40 dark:via-slate-800 dark:to-sky-900/40 flex items-center justify-center">
            <Home className={`w-8 h-8 text-teal-300 dark:text-teal-700 ${isActive ? 'animate-pulse' : ''}`} />
          </div>
        )}
        {isStarred && (
          <div className="absolute top-0.5 left-0.5 bg-amber-400 rounded-full p-0.5">
            <Star className="w-2.5 h-2.5 text-white fill-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base">
          {hasRealAddress ? propData.address.displayAddress : 'Analyzing property…'}
        </h3>
        
        {/* Price — show as soon as scraped */}
        {propData.price != null && (
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
            {priceText}
          </p>
        )}

        {/* Status + dynamic info row */}
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
          {/* Status badge for active/error jobs */}
          {status && status !== 'complete' && getStatusBadge()}

          {/* Error message */}
          {status === 'error' && error && (
            <span className="text-xs text-red-500 dark:text-red-400 truncate max-w-[180px] sm:max-w-[280px]" title={error}>
              {error}
            </span>
          )}

          {/* Timestamp for completed cards */}
          {(!status || status === 'complete') && (
            <span>Saved {formatTimeAgo(timestamp)}</span>
          )}

          {/* Commute times — shown for ANY card as soon as available */}
          {commuteTimes && (
            <>
              {(!status || status === 'complete') && (
                <span className="text-slate-300 dark:text-slate-700">·</span>
              )}
              {[...commuteTimes].sort((a, b) => (a.destination === 'Bloomberg' ? -1 : b.destination === 'Bloomberg' ? 1 : 0)).map((c) => (
                <span key={c.destination} className="inline-flex items-center gap-0.5" title={`${c.destination}: ${c.durationText}`}>
                  {c.destination === 'Bloomberg' ? '💼' : '🎓'}
                  <span className="font-medium text-slate-500 dark:text-slate-400">{c.durationText}</span>
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 flex items-center border-l border-slate-100 dark:border-slate-800 pl-1 ml-1 gap-0.5">
        {/* Star Button — only for completed properties */}
        {!status && (
          <button
            onClick={onStar}
            className={`p-2.5 rounded-lg transition-all ${
              isStarred
                ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                : 'text-slate-300 hover:text-amber-400 hover:bg-amber-50 dark:text-slate-600 dark:hover:bg-amber-900/20'
            }`}
            aria-label={isStarred ? 'Remove from shortlist' : 'Add to shortlist'}
            title={isStarred ? 'Remove from shortlist' : 'Add to shortlist'}
          >
            <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
          </button>
        )}

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="p-2.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/40 transition-all"
          aria-label={status ? "Cancel job" : "Delete property"}
          title={status ? "Cancel job" : "Delete property"}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar for active jobs */}
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden rounded-b-xl">
          <div
            className="h-full bg-teal-500 transition-all duration-500 ease-out"
            style={{ width: `${getProgressPercent(status)}%` }}
          />
        </div>
      )}
    </div>
  );
}