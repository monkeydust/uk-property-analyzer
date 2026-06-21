import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import logger from '@/lib/logger';

/**
 * GET /api/jobs/[id] — Get job status and results
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await prisma.analysisJob.findUnique({
      where: { id },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields for the response
    const response: Record<string, unknown> = {
      success: true,
      id: job.id,
      url: job.url,
      propertyId: job.propertyId,
      status: job.status,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };

    // Include parsed data for each completed step
    if (job.propertyData) {
      try { response.propertyData = JSON.parse(job.propertyData); } catch { response.propertyData = null; }
    }
    if (job.schoolsData) {
      try { response.schoolsData = JSON.parse(job.schoolsData); } catch { response.schoolsData = null; }
    }
    if (job.marketData) {
      try { response.marketData = JSON.parse(job.marketData); } catch { response.marketData = null; }
    }
    if (job.plotSizeData) {
      try { response.plotSizeData = JSON.parse(job.plotSizeData); } catch { response.plotSizeData = null; }
    }
    if (job.transactionsData) {
      try { response.transactionsData = JSON.parse(job.transactionsData); } catch { response.transactionsData = null; }
    }
    if (job.stationsData) {
      try { response.stationsData = JSON.parse(job.stationsData); } catch { response.stationsData = null; }
    }
    if (job.commuteData) {
      try { response.commuteData = JSON.parse(job.commuteData); } catch { response.commuteData = null; }
    }
    if (job.aiAnalysis) {
      response.aiAnalysis = job.aiAnalysis;
      response.aiModel = job.aiModel;
    }

    return NextResponse.json(response);
  } catch (e) {
    logger.error(`Job fetch error: ${e}`, 'jobs');
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jobs/[id] — Delete a job
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.analysisJob.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error(`Job delete error: ${e}`, 'jobs');
    return NextResponse.json(
      { success: false, error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}
