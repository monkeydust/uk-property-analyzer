import { NextRequest, NextResponse } from 'next/server';
import { getWalkingDistances, findNearbyTrainStations, findNearbyTubeStations } from '@/lib/utils/google-maps';
import { getTubeLinesForStations, getTrainOperatorsForStations, getOperatorDisplayNames } from '@/lib/utils/station-lines';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { success: false, error: 'lat and lng are required' },
        { status: 400 }
      );
    }

    logger.info(`Fetching stations near ${lat}, ${lng}`, 'stations');

    // Fetch train and tube stations in parallel
    const [trainStations, tubeStations] = await Promise.all([
      findNearbyTrainStations(lat, lng, 3),
      findNearbyTubeStations(lat, lng, 3),
    ]);

    logger.info(`Found ${trainStations?.length || 0} train, ${tubeStations?.length || 0} tube stations`, 'stations');

    // Process train and tube stations in parallel
    const [nearestStations, nearestTubeStations] = await Promise.all([
      // Train stations processing
      (async () => {
        if (!trainStations || trainStations.length === 0) return trainStations;

        const [walkingResults, operatorMap] = await Promise.all([
          getWalkingDistances(lat, lng, trainStations),
          getTrainOperatorsForStations(trainStations.map(s => s.name)),
        ]);

        const result = trainStations.map((station) => {
          const walkingData = walkingResults?.find((w) => w.destination === station.name);
          const operators = operatorMap.get(station.name) || [];
          return {
            name: station.name,
            operators: operators.length > 0 ? getOperatorDisplayNames(operators) : undefined,
            walkingTime: walkingData ? Math.round(walkingData.durationSeconds / 60) : undefined,
            walkingDistance: walkingData?.distanceMeters,
          };
        });

        if (walkingResults) {
          logger.info('Rail walking times fetched', 'stations');
        }
        return result;
      })(),

      // Tube stations processing
      (async () => {
        if (!tubeStations || tubeStations.length === 0) return tubeStations;

        const [tubeWalkingResults, linesMap] = await Promise.all([
          getWalkingDistances(lat, lng, tubeStations),
          getTubeLinesForStations(tubeStations.map(s => s.name)),
        ]);

        const result = tubeStations.map((station) => {
          const walkingData = tubeWalkingResults?.find((w) => w.destination === station.name);
          const lines = linesMap.get(station.name) || [];
          return {
            name: station.name,
            lines: lines.length > 0 ? lines : undefined,
            walkingTime: walkingData ? Math.round(walkingData.durationSeconds / 60) : undefined,
            walkingDistance: walkingData?.distanceMeters,
          };
        });

        if (tubeWalkingResults) {
          logger.info('Tube walking times fetched', 'stations');
        }
        return result;
      })(),
    ]);

    return NextResponse.json({
      success: true,
      nearestStations,
      nearestTubeStations,
      logs: logger.getAll(),
    });
  } catch (error) {
    logger.error(`Stations error: ${error}`, 'stations');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch station data' },
      { status: 500 }
    );
  }
}
