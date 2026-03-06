import { NextRequest, NextResponse } from 'next/server';
import { getPlotSizeAcres } from '@/lib/propertydata/plot-size';
import type { PlotSizeResult } from '@/lib/propertydata/plot-size';
import logger from '@/lib/logger';

/**
 * POST /api/plot-size
 *
 * Resolves the Land Registry plot size (in acres) for a property address via
 * the sequential PropertyData chain: address-match-uprn → uprn-title → title.
 *
 * This endpoint runs separately from /api/market-data so the market insights
 * card can appear immediately while plot size loads in the background.
 *
 * Body: { address, postcode, doorNumber, streetName, bustCache?, lat?, lng? }
 */
export async function POST(request: NextRequest): Promise<NextResponse<PlotSizeResult & { logs?: unknown[] }>> {
    try {
        const body = await request.json();
        const { address, postcode, doorNumber, streetName, bustCache, lat, lng } = body;

        if (!address || typeof address !== 'string') {
            return NextResponse.json(
                { plotSizeAcres: null, uprn: null, titleNumber: null, matchedAddress: null, method: null },
                { status: 400 }
            );
        }

        const coordinates =
            typeof lat === 'number' && typeof lng === 'number'
                ? { latitude: lat, longitude: lng }
                : null;

        logger.info(`Plot size lookup: "${address}"`, 'plot-size');

        const result = await getPlotSizeAcres({
            address,
            postcode: postcode ?? null,
            streetName: streetName ?? null,
            doorNumber: doorNumber ?? null,
            coordinates,
            bustCache: !!bustCache,
        });

        if (result.plotSizeAcres !== null) {
            logger.info(`Plot size found: ${result.plotSizeAcres} acres (${result.method})`, 'plot-size');
        } else {
            logger.info('Plot size not found (no matching title)', 'plot-size');
        }

        return NextResponse.json({ ...result, logs: logger.getAll() });
    } catch (error) {
        logger.error(`Plot size API error: ${String(error)}`, 'plot-size');
        return NextResponse.json(
            { plotSizeAcres: null, uprn: null, titleNumber: null, matchedAddress: null, method: null },
            { status: 500 }
        );
    }
}
