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
    commuteTimes: Property['commuteTimes'];
  };
}

// API functions to replace localStorage

export async function saveProperty(propertyId: string, url: string, data: SavedProperty['data']): Promise<boolean> {
  try {
    const response = await fetch('/api/saved-properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: propertyId,
        url,
        data,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to save property');
    }

    return true;
  } catch (error) {
    console.error('Failed to save property:', error);
    return false;
  }
}

export async function getSavedProperties(): Promise<SavedProperty[]> {
  try {
    const response = await fetch('/api/saved-properties');
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to fetch saved properties (${response.status})`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch saved properties');
    }

    return result.data || [];
  } catch (error) {
    console.error('Failed to load saved properties:', error);
    return [];
  }
}

export async function getProperty(id: string): Promise<SavedProperty | null> {
  try {
    const properties = await getSavedProperties();
    return properties.find(p => p.id === id) || null;
  } catch (error) {
    console.error('Failed to get property:', error);
    return null;
  }
}

export async function deleteProperty(id: string): Promise<SavedProperty | null> {
  try {
    const response = await fetch(`/api/saved-properties/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete property');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete property');
    }

    return result.data || null;
  } catch (error) {
    console.error('Failed to delete property:', error);
    return null;
  }
}

export async function restoreProperty(property: SavedProperty): Promise<boolean> {
  try {
    return await saveProperty(property.id, property.url, property.data);
  } catch (error) {
    console.error('Failed to restore property:', error);
    return false;
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

// Migration function to import existing localStorage data
export async function migrateFromLocalStorage(): Promise<number> {
  try {
    const STORAGE_KEY = 'savedProperties';
    const stored = localStorage.getItem(STORAGE_KEY);
    
    if (!stored) return 0;
    
    const properties: SavedProperty[] = JSON.parse(stored);
    let migratedCount = 0;
    
    for (const prop of properties) {
      const success = await saveProperty(prop.id, prop.url, prop.data);
      if (success) migratedCount++;
    }
    
    // Clear localStorage after successful migration
    if (migratedCount > 0) {
      localStorage.removeItem(STORAGE_KEY);
    }
    
    console.log(`Migrated ${migratedCount} properties from localStorage to database`);
    return migratedCount;
  } catch (error) {
    console.error('Failed to migrate from localStorage:', error);
    return 0;
  }
}
