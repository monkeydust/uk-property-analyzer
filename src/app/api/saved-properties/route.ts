import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/saved-properties - Get all saved properties sorted by timestamp (newest first)
export async function GET(): Promise<NextResponse> {
  try {
    const savedProperties = await prisma.savedProperty.findMany({
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Parse JSON strings back to objects
    const formattedProperties = savedProperties.map((prop) => ({
      id: prop.id,
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
    }));

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
    const body = await request.json();
    const { id, url, data } = body;

    if (!id || !url || !data) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, url, data' },
        { status: 400 }
      );
    }

    // Upsert the property (create or update)
    const savedProperty = await prisma.savedProperty.upsert({
      where: { id },
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
        id,
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
        id: savedProperty.id,
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
