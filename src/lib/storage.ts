import { Property } from '@/lib/types/property';
import { AttendedSchoolsResult } from '@/lib/types/property';

export interface SavedProperty {
  id: string;
  url: string;
  timestamp: number;
  data: {
    property: Property;
    schools: AttendedSchoolsResult | null;
    aiAnalysis: string | null;
    aiModel: string | null;
    ai2Analysis?: string | null;
    ai2Model?: string | null;
    commuteTimes: any[];
  };
}

const STORAGE_KEY = 'savedProperties';

export function saveProperty(propertyId: string, url: string, data: SavedProperty['data']): void {
  try {
    const existing = getSavedProperties();
    const newProperty: SavedProperty = {
      id: propertyId,
      url,
      timestamp: Date.now(),
      data,
    };
    
    // Remove if exists (update case)
    const filtered = existing.filter(p => p.id !== propertyId);
    
    // Add to beginning (newest first)
    const updated = [newProperty, ...filtered];
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save property:', error);
  }
}

export function getSavedProperties(): SavedProperty[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as SavedProperty[];
  } catch (error) {
    console.error('Failed to load saved properties:', error);
    return [];
  }
}

export function getProperty(id: string): SavedProperty | null {
  const properties = getSavedProperties();
  return properties.find(p => p.id === id) || null;
}

export function deleteProperty(id: string): SavedProperty | null {
  try {
    const existing = getSavedProperties();
    const toDelete = existing.find(p => p.id === id);
    
    if (toDelete) {
      const filtered = existing.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
    
    return toDelete || null;
  } catch (error) {
    console.error('Failed to delete property:', error);
    return null;
  }
}

export function restoreProperty(property: SavedProperty): void {
  try {
    const existing = getSavedProperties();
    const filtered = existing.filter(p => p.id !== property.id);
    const updated = [property, ...filtered];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to restore property:', error);
  }
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}