import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// DELETE /api/saved-properties/[id] - Delete a saved property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // First, get the property to return it (for undo functionality)
    const property = await prisma.savedProperty.findUnique({
      where: { id },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: 'Property not found' },
        { status: 404 }
      );
    }

    // Delete the property
    await prisma.savedProperty.delete({
      where: { id },
    });

    // Return the deleted property (for undo functionality)
    return NextResponse.json({
      success: true,
      data: {
        id: property.id,
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
      },
    });
  } catch (error) {
    console.error('Failed to delete property:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete property' },
      { status: 500 }
    );
  }
}
