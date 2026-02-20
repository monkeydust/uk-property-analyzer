// Commute time calculation using Google Directions API
// Calculates transit times to benchmark destinations

interface CommuteDestination {
  name: string;
  address: string;
  icon: string;
}

export const BENCHMARK_ORIGIN = '20 Woodcroft, London NW7 2AG';

export const COMMUTE_DESTINATIONS: CommuteDestination[] = [
  {
    name: 'Bloomberg',
    address: '50 Finsbury Square, London EC2A 1HD',
    icon: 'briefcase',
  },
  {
    name: 'UCL',
    address: 'Gower Street, London WC1E 6BT',
    icon: 'graduation-cap',
  },
];

// Pre-calculated benchmark times (Wednesday 6:40 AM departure)
export const BENCHMARK_TIMES: Record<string, number> = {
  'Bloomberg': 2820, // 47 minutes
  'UCL': 2987,       // 50 minutes
};

export interface CommuteTime {
  destination: string;
  durationSeconds: number;
  durationText: string;
  benchmarkDiffSeconds: number;
  benchmarkDiffText: string;
  isFaster: boolean;
  arrivalTime: string;
}

function getNextWednesday640AM(): number {
  const now = new Date();
  const currentDay = now.getDay();
  const daysUntilWednesday = (3 - currentDay + 7) % 7 || 7;
  
  const nextWednesday = new Date(now);
  nextWednesday.setDate(now.getDate() + daysUntilWednesday);
  nextWednesday.setHours(6, 40, 0, 0);
  
  return Math.floor(nextWednesday.getTime() / 1000);
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

function formatDiff(seconds: number): string {
  const absSeconds = Math.abs(seconds);
  const minutes = Math.floor(absSeconds / 60);
  
  if (minutes === 0) {
    return 'same';
  } else if (minutes === 1) {
    return seconds < 0 ? 'saves 1 min' : '+1 min';
  } else {
    return seconds < 0 ? `saves ${minutes} mins` : `+${minutes} mins`;
  }
}

export async function calculateCommuteTime(
  originAddress: string,
  destination: CommuteDestination
): Promise<CommuteTime | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.log('GOOGLE_MAPS_API_KEY not set');
    return null;
  }
  
  try {
    const departureTime = getNextWednesday640AM();
    
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', originAddress);
    url.searchParams.set('destinations', destination.address);
    url.searchParams.set('mode', 'transit');
    url.searchParams.set('departure_time', departureTime.toString());
    url.searchParams.set('key', apiKey);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`Commute API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      return null;
    }
    
    const element = data.rows[0].elements[0];
    
    if (element.status !== 'OK') {
      return null;
    }
    
    const durationSeconds = element.duration.value;
    const benchmarkSeconds = BENCHMARK_TIMES[destination.name];
    const diffSeconds = durationSeconds - benchmarkSeconds;
    
    const arrivalTimestamp = (departureTime + durationSeconds) * 1000;
    const arrivalDate = new Date(arrivalTimestamp);
    const arrivalTime = arrivalDate.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    return {
      destination: destination.name,
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      benchmarkDiffSeconds: diffSeconds,
      benchmarkDiffText: formatDiff(diffSeconds),
      isFaster: diffSeconds < 0,
      arrivalTime,
    };
    
  } catch (error) {
    console.error(`Error calculating commute:`, error);
    return null;
  }
}

export async function calculateAllCommuteTimes(
  originAddress: string
): Promise<Map<string, CommuteTime>> {
  const results = new Map<string, CommuteTime>();
  
  await Promise.all(
    COMMUTE_DESTINATIONS.map(async (dest) => {
      const commute = await calculateCommuteTime(originAddress, dest);
      if (commute) {
        results.set(dest.name, commute);
      }
    })
  );
  
  return results;
}