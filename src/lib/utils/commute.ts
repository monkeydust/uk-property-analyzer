// Commute time calculation using Google Directions API
// Calculates transit times to benchmark destinations with step-by-step breakdown

interface CommuteDestination {
  name: string;
  address: string;
  icon: string;
}

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

export interface CommuteStep {
  mode: 'WALKING' | 'TRANSIT' | string;
  durationSeconds: number;
  durationText: string;
  /** For TRANSIT steps: the transit line name / short name */
  transitLine?: string;
  /** For TRANSIT steps: e.g. "HEAVY_RAIL", "SUBWAY", "BUS" */
  transitType?: string;
  /** For TRANSIT steps: departure stop */
  departureStop?: string;
  /** For TRANSIT steps: arrival stop */
  arrivalStop?: string;
  /** For TRANSIT steps: number of stops */
  numStops?: number;
  /** Brief instruction text */
  instruction: string;
}

export interface CommuteTime {
  destination: string;
  durationSeconds: number;
  durationText: string;
  arrivalTime: string;
  steps: CommuteStep[];
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
    
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', originAddress);
    url.searchParams.set('destination', destination.address);
    url.searchParams.set('mode', 'transit');
    url.searchParams.set('departure_time', departureTime.toString());
    url.searchParams.set('alternatives', 'false');
    url.searchParams.set('key', apiKey);
    
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`Commute API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.routes?.[0]?.legs?.[0]) {
      return null;
    }
    
    const leg = data.routes[0].legs[0];
    const durationSeconds = leg.duration.value;
    
    // Parse steps into our simplified format
    const steps: CommuteStep[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const step of (leg.steps || []) as any[]) {
      const mode: string = step.travel_mode || 'UNKNOWN';
      const stepDuration = step.duration?.value || 0;
      const stepDurationText = step.duration?.text || formatDuration(stepDuration);
      
      const commuteStep: CommuteStep = {
        mode,
        durationSeconds: stepDuration,
        durationText: stepDurationText,
        instruction: (step.html_instructions || '').replace(/<[^>]*>/g, ''),
      };
      
      if (mode === 'TRANSIT' && step.transit_details) {
        const td = step.transit_details;
        commuteStep.transitLine = td.line?.short_name || td.line?.name || '';
        commuteStep.transitType = td.line?.vehicle?.type || '';
        commuteStep.departureStop = td.departure_stop?.name || '';
        commuteStep.arrivalStop = td.arrival_stop?.name || '';
        commuteStep.numStops = td.num_stops || undefined;
      }
      
      steps.push(commuteStep);
    }
    
    // Merge consecutive WALKING steps (Google sometimes splits them)
    const mergedSteps: CommuteStep[] = [];
    for (const step of steps) {
      const prev = mergedSteps[mergedSteps.length - 1];
      if (prev && prev.mode === 'WALKING' && step.mode === 'WALKING') {
        prev.durationSeconds += step.durationSeconds;
        prev.durationText = formatDuration(prev.durationSeconds);
        prev.instruction = prev.instruction || step.instruction;
      } else {
        mergedSteps.push({ ...step });
      }
    }
    
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
      arrivalTime,
      steps: mergedSteps,
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