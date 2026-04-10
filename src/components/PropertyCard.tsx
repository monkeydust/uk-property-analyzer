'use client';

import { Trash2, Star } from 'lucide-react';
import { SavedProperty, formatTimeAgo } from '@/lib/storage';

interface PropertyCardProps {
  property: SavedProperty;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStar: (e: React.MouseEvent) => void;
}

export function PropertyCard({ property, onClick, onDelete, onStar }: PropertyCardProps) {
  const { data, timestamp, isStarred } = property;
  const { property: propData } = data;

  // Get first image or placeholder based on type
  const imageUrl = propData.images?.[0] || (propData.listingType === 'off-market' ? '/images/off_market.png' : '/placeholder-property.jpg');

  // Format price
  const priceText = propData.price
    ? `£${propData.price.toLocaleString()}`
    : 'Price N/A';

  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border active:bg-slate-50 dark:active:bg-slate-800 ${
        isStarred
          ? 'border-amber-300 dark:border-amber-600/60'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-[120px] h-[84px] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
        <img
          src={imageUrl}
          alt={propData.address.displayAddress}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isStarred && (
          <div className="absolute top-0.5 left-0.5 bg-amber-400 rounded-full p-0.5">
            <Star className="w-2.5 h-2.5 text-white fill-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm sm:text-base">
          {propData.address.displayAddress}
        </h3>
        <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">
          {priceText}
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">
          Saved {formatTimeAgo(timestamp)}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 flex items-center border-l border-slate-100 dark:border-slate-800 pl-1 ml-1 gap-0.5">
        {/* Star Button */}
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

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="p-2.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/40 transition-all"
          aria-label="Delete property"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}