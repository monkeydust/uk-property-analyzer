import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function getUserId(request: NextRequest): string {
  return request.cookies.get('user_id')?.value || 'admin';
}

/** Normalize a URL for deduplication (strip query/hash/trailing slash) */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return url.split('?')[0].split('#')[0].replace(/\/$/, '');
  }
}

// GET /api/saved-properties - Get all saved properties sorted by timestamp (newest first)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserId(request);

    let whereClause: object;

    if (userId === 'admin') {
      whereClause = { userId: 'admin' };
    } else if (userId === 'demo') {
      // Get list of admin properties demo has hidden (soft-deleted)
      const hidden = await prisma.demoHiddenProperty.findMany({
        select: { propertyId: true },
      });
      const hiddenIds = new Set(hidden.map((h) => h.propertyId));

      whereClause = {
        userId: { in: ['demo', 'admin'] },
        ...(hiddenIds.size > 0 ? { id: { notIn: [...hiddenIds] } } : {}),
      };
    } else if (userId === 'stratgroup') {
      whereClause = { userId: 'stratgroup' };
    } else {
      whereClause = { userId }; // Fallback
    }

    const savedProperties = await prisma.savedProperty.findMany({
      where: whereClause,
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Fetch active jobs (not complete) for this user
    const activeJobs = await prisma.analysisJob.findMany({
      where: {
        userId,
        status: { not: 'complete' },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Auto-timeout stale jobs older than 10 minutes that are still running
    const TEN_MINUTES = 10 * 60 * 1000;
    const now = Date.now();
    for (const job of activeJobs) {
      if (job.status !== 'error' && (now - job.createdAt.getTime()) > TEN_MINUTES) {
        try {
          await prisma.analysisJob.update({
            where: { id: job.id },
            data: { status: 'error', error: 'Timed out (exceeded 10 minutes)' },
          });
          job.status = 'error';
          job.error = 'Timed out (exceeded 10 minutes)';
        } catch { /* ignore */ }
      }
    }

    // Build a lookup of saved properties by normalized URL
    const savedByNormUrl = new Map<string, number>();
    const formattedProperties: Array<Record<string, unknown>> = [];

    for (const prop of savedProperties) {
      try {
        const cleanId = prop.id.replace(/^(demo__|stratgroup__)/, '');
        const normUrl = normalizeUrl(prop.url);
        const formatted = {
          id: cleanId,
          url: prop.url,
          timestamp: prop.timestamp.getTime(),
          isStarred: prop.isStarred,
          // These will be set below if an active job matches
          status: undefined as string | undefined,
          error: undefined as string | null | undefined,
          jobId: undefined as string | undefined,
          data: {
            property: JSON.parse(prop.propertyData),
            schools: prop.schoolsData ? JSON.parse(prop.schoolsData) : null,
            aiAnalysis: prop.aiAnalysis,
            aiModel: prop.aiModel,
            ai2Analysis: prop.ai2Analysis,
            ai2Model: prop.ai2Model,
            commuteTimes: JSON.parse(prop.commuteTimes || '[]'),
          },
        };
        const idx = formattedProperties.length;
        formattedProperties.push(formatted);
        savedByNormUrl.set(normUrl, idx);
      } catch (parseError) {
        console.error(`Skipping corrupted property ${prop.id}:`, parseError);
      }
    }

    // Deduplicate active jobs by normalized URL (keep most recent per URL)
    const seenJobUrls = new Set<string>();
    const dedupedJobs = activeJobs.filter((job) => {
      const norm = normalizeUrl(job.url);
      if (seenJobUrls.has(norm)) return false;
      seenJobUrls.add(norm);
      return true;
    });

    // Merge active jobs into existing saved properties or create virtual cards
    const virtualCards: Array<Record<string, unknown>> = [];
    for (const job of dedupedJobs) {
      const normUrl = normalizeUrl(job.url);
      const savedIdx = savedByNormUrl.get(normUrl);

      if (savedIdx !== undefined) {
        // Merge: attach job status to the existing saved property card
        const existing = formattedProperties[savedIdx];
        existing.status = job.status;
        existing.error = job.error;
        existing.jobId = job.id;
      } else {
        // No saved property yet — create a virtual card
        let propertyDataObj = null;
        if (job.propertyData) {
          try { propertyDataObj = JSON.parse(job.propertyData); } catch { /* ignore */ }
        }
        if (!propertyDataObj) {
          propertyDataObj = {
            id: `job_${job.id}`,
            sourceUrl: job.url,
            price: null,
            pricePerSqFt: null,
            listingType: 'sale',
            bedrooms: null,
            bathrooms: null,
            squareFootage: null,
            propertyType: '',
            address: {
              displayAddress: job.url,
              streetName: null,
              doorNumber: null,
              postcode: null,
              postcodeOutward: null,
              postcodeInward: null,
            },
            epc: null,
            description: 'Analyzing...',
            features: [],
            images: [],
            coordinates: null,
            nearestStations: null,
            nearestTubeStations: null,
            scrapedAt: new Date().toISOString(),
          };
        }

        let schoolsObj = null;
        if (job.schoolsData) {
          try { schoolsObj = JSON.parse(job.schoolsData); } catch { /* ignore */ }
        }

        let commuteTimesObj: unknown[] = [];
        if (job.commuteData) {
          try {
            const parsed = JSON.parse(job.commuteData);
            commuteTimesObj = parsed.commuteTimes || [];
          } catch { /* ignore */ }
        }

        virtualCards.push({
          id: `job_${job.id}`,
          url: job.url,
          timestamp: job.createdAt.getTime(),
          isStarred: false,
          status: job.status,
          error: job.error,
          jobId: job.id,
          data: {
            property: propertyDataObj,
            schools: schoolsObj,
            aiAnalysis: job.aiAnalysis,
            aiModel: job.aiModel,
            commuteTimes: commuteTimesObj,
          },
        });
      }
    }

    // Combine and sort by timestamp (newest first)
    const allItems = [...virtualCards, ...formattedProperties].sort(
      (a, b) => (b.timestamp as number) - (a.timestamp as number)
    );

    return NextResponse.json({ success: true, data: allItems });
  } catch (error) {
    console.error('Failed to fetch saved properties:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch saved properties: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

// POST /api/saved-properties - Save or update a property
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = getUserId(request);
    const body = await request.json();
    const { id, url, data } = body;

    if (!id || !url || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, url, data' },
        { status: 400 }
      );
    }



    // Upsert the property (create or update) — scoped to this user
    // Provide isolated copies for secondary users
    const baseId = id.replace(/^(demo__|stratgroup__)/, '');
    const userScopedId = userId === 'admin' ? baseId : `${userId}__${baseId}`;

    const savedProperty = await prisma.savedProperty.upsert({
      where: { id: userScopedId },
      update: {
        url,
        timestamp: new Date(),
        propertyData: JSON.stringify(data.property),
        schoolsData: data.schools ? JSON.stringify(data.schools) : null,
        aiAnalysis: data.aiAnalysis,
        aiModel: data.aiModel,
        ai2Analysis: data.ai2Analysis,
        ai2Model: data.ai2Model,
        commuteTimes: JSON.stringify(data.commuteTimes || []),
      },
      create: {
        id: userScopedId,
        userId,
        url,
        timestamp: new Date(),
        propertyData: JSON.stringify(data.property),
        schoolsData: data.schools ? JSON.stringify(data.schools) : null,
        aiAnalysis: data.aiAnalysis,
        aiModel: data.aiModel,
        ai2Analysis: data.ai2Analysis,
        ai2Model: data.ai2Model,
        commuteTimes: JSON.stringify(data.commuteTimes || []),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: baseId,
        url: savedProperty.url,
        timestamp: savedProperty.timestamp.getTime(),
      },
    });
  } catch (error) {
    console.error('Failed to save property:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save property: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

