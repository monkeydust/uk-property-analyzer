import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startJob } from '@/lib/jobs/job-runner';
import { isValidRightmoveUrl } from '@/lib/scraper/rightmove';
import logger from '@/lib/logger';

/**
 * POST /api/jobs — Create a new analysis job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    if (!isValidRightmoveUrl(url)) {
      return NextResponse.json({ success: false, error: 'Invalid Rightmove URL' }, { status: 400 });
    }

    // Get userId from cookie (matching existing auth pattern)
    const userId = request.cookies.get('user_id')?.value || 'admin';

    // Create the job
    const job = await prisma.analysisJob.create({
      data: {
        url,
        userId,
        status: 'queued',
      },
    });

    logger.info(`[JOB ${job.id}] Created for ${url} (user: ${userId})`, 'jobs');

    // Fire and forget — the pipeline runs independently
    startJob(job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      status: job.status,
    });
  } catch (e) {
    logger.error(`Job creation error: ${e}`, 'jobs');
    return NextResponse.json(
      { success: false, error: 'Failed to create job' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs — List recent jobs for current user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('user_id')?.value || 'admin';

    const jobs = await prisma.analysisJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        url: true,
        propertyId: true,
        status: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        // Don't return full data blobs in list view
      },
    });

    return NextResponse.json({ success: true, jobs });
  } catch (e) {
    logger.error(`Job list error: ${e}`, 'jobs');
    return NextResponse.json(
      { success: false, error: 'Failed to list jobs' },
      { status: 500 }
    );
  }
}
