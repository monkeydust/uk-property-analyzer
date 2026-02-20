'use client';

import { X } from 'lucide-react';
import { SavedProperty, formatTimeAgo } from '@/lib/storage';

interface PropertyCardProps {
  property: SavedProperty;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function PropertyCard({ property, onClick, onDelete }: PropertyCardProps) {
  const { data, timestamp } = property;
  const { property: propData } = data;
  
  // Get first image or placeholder
  const imageUrl = propData.images?.[0] || '/placeholder-property.jpg';
  
  // Format price
  const priceText = propData.price 
    ? `£${propData.price.toLocaleString()}`
    : 'Price N/A';
  
  return (
    <div 
      onClick={onClick}
      className="group flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img 
          src={imageUrl} 
          alt={propData.address.displayAddress}
          className="w-full h-full object-cover"
          loading="lazy"
        />
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
      
      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="flex-shrink-0 p-2.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 sm:opacity-100"
        aria-label="Delete property"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}