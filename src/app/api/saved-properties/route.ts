import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function getUserId(request: NextRequest): string {
  return request.cookies.get('user_id')?.value || 'admin';
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

    // Format active jobs as virtual SavedProperty cards
    const formattedJobs = activeJobs.map((job) => {
      let propertyDataObj = null;
      if (job.propertyData) {
        try {
          propertyDataObj = JSON.parse(job.propertyData);
        } catch {
          // ignore
        }
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
        try {
          schoolsObj = JSON.parse(job.schoolsData);
        } catch {
          // ignore
        }
      }

      let commuteTimesObj = [];
      if (job.commuteData) {
        try {
          const parsed = JSON.parse(job.commuteData);
          commuteTimesObj = parsed.commuteTimes || [];
        } catch {
          // ignore
        }
      }

      return {
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
      };
    });

    // Parse JSON strings back to objects for completed saved properties
    const formattedProperties = savedProperties
      .map((prop) => {
        try {
          const cleanId = prop.id.replace(/^(demo__|stratgroup__)/, '');
          return {
            id: cleanId,
            url: prop.url,
            timestamp: prop.timestamp.getTime(),
            isStarred: prop.isStarred,
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
        } catch (parseError) {
          console.error(`Skipping corrupted property ${prop.id}:`, parseError);
          return null;
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    // Combine and sort by timestamp (newest first)
    const allItems = [...formattedJobs, ...formattedProperties].sort((a, b) => b.timestamp - a.timestamp);

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

