import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { propertyCache, schoolsCache, aiCache } from '@/lib/cache';

function getUserId(request: NextRequest): string {
  return request.cookies.get('user_id')?.value || 'admin';
}

function formatPropertyResponse(property: {
  id: string; url: string; timestamp: Date;
  propertyData: string; schoolsData: string | null;
  aiAnalysis: string | null; aiModel: string | null;
  ai2Analysis: string | null; ai2Model: string | null;
  commuteTimes: string;
}) {
  const cleanId = property.id.replace(/^(demo__|stratgroup__)/, '');
  return {
    id: cleanId,
    url: property.url,
    timestamp: property.timestamp.getTime(),
    data: {
      property: JSON.parse(property.propertyData),
      schools: property.schoolsData ? JSON.parse(property.schoolsData) : null,
      aiAnalysis: property.aiAnalysis,
      aiModel: property.aiModel,
      ai2Analysis: property.ai2Analysis,
      ai2Model: property.ai2Model,
      commuteTimes: JSON.parse(property.commuteTimes || '[]'),
    },
  };
}

function clearCaches(property: { url: string; propertyData: string }) {
  if (property.url) {
    const cacheKey = property.url.split('?')[0].replace(/\/$/, '');
    propertyCache.delete(cacheKey);
    aiCache.deleteMatching(cacheKey);
  }
  const propertyData = JSON.parse(property.propertyData);
  if (propertyData?.address?.postcode) {
    schoolsCache.deleteMatching(propertyData.address.postcode);
  }
  if (propertyData?.address?.displayAddress) {
    schoolsCache.deleteMatching(propertyData.address.displayAddress);
  }
}

// DELETE /api/saved-properties/[id] - Delete a saved property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const userId = getUserId(request);

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Property ID is required' },
        { status: 400 }
      );
    }

    if (userId === 'demo') {
      // Case 1: demo has their own copy of this property (demo__id prefix)
      const demoId = `demo__${id}`;
      const demoRow = await prisma.savedProperty.findUnique({ where: { id: demoId } });

      if (demoRow) {
        await prisma.savedProperty.delete({ where: { id: demoId } });
        clearCaches(demoRow);
        return NextResponse.json({ success: true, data: formatPropertyResponse(demoRow) });
      }

      // Case 2: deleting a shared admin property — soft-delete (hide from demo's view only)
      const adminRow = await prisma.savedProperty.findUnique({ where: { id } });
      if (adminRow && adminRow.userId === 'admin') {
        await prisma.demoHiddenProperty.upsert({
          where: { propertyId: id },
          update: {},
          create: { propertyId: id },
        });
        // Admin's row is untouched; return property data so undo toast works for demo
        return NextResponse.json({ success: true, data: formatPropertyResponse(adminRow) });
      }

      return NextResponse.json({ success: true, data: null });
    }

    if (userId === 'stratgroup') {
      const stratId = `stratgroup__${id}`;
      const stratRow = await prisma.savedProperty.findUnique({ where: { id: stratId } });

      if (stratRow) {
        await prisma.savedProperty.delete({ where: { id: stratId } });
        clearCaches(stratRow);
        return NextResponse.json({ success: true, data: formatPropertyResponse(stratRow) });
      }

      return NextResponse.json({ success: true, data: null });
    }

    // Admin: hard delete their own row
    const property = await prisma.savedProperty.findUnique({ where: { id } });

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    await prisma.savedProperty.delete({ where: { id } });
    clearCaches(property);

    return NextResponse.json({ success: true, data: formatPropertyResponse(property) });
  } catch (error) {
    console.error('Failed to delete property:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}
