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

    // Parse JSON strings back to objects
    const formattedProperties = savedProperties.map((prop) => {
      // Strip namespace prefixes from the ID so the frontend can properly correlate it
      const cleanId = prop.id.replace(/^(demo__|stratgroup__)/, '');

      return {
        id: cleanId,
        url: prop.url,
        timestamp: prop.timestamp.getTime(),
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
    });

    return NextResponse.json({ success: true, data: formattedProperties });
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

