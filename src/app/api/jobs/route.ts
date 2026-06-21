import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { startJob } from '@/lib/jobs/job-runner';
import { isValidRightmoveUrl } from '@/lib/scraper/rightmove';
import logger from '@/lib/logger';

/** Normalize a URL for deduplication (strip query/hash/trailing slash) */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/$/, '');
  } catch {
    return url.split('?')[0].split('#')[0].replace(/\/$/, '');
  }
}

/**
 * POST /api/jobs — Create a new analysis job (or return existing active one)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, bustCache } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    if (!isValidRightmoveUrl(url)) {
      return NextResponse.json({ success: false, error: 'Invalid Rightmove URL' }, { status: 400 });
    }

    // Get userId from cookie (matching existing auth pattern)
    const userId = request.cookies.get('user_id')?.value || 'admin';

    const normUrl = normalizeUrl(url);

    // Check for existing active job on the same URL (unless bustCache forces a new run)
    if (!bustCache) {
      const existingJobs = await prisma.analysisJob.findMany({
        where: {
          userId,
          status: { notIn: ['complete', 'error'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      const activeForUrl = existingJobs.find((j) => normalizeUrl(j.url) === normUrl);
      if (activeForUrl) {
        logger.info(`[JOB ${activeForUrl.id}] Returning existing active job for ${url}`, 'jobs');
        return NextResponse.json({
          success: true,
          jobId: activeForUrl.id,
          status: activeForUrl.status,
          existing: true,
        });
      }
    }

    // Create the job
    const job = await prisma.analysisJob.create({
      data: {
        url,
        userId,
        status: 'queued',
      },
    });

    logger.info(`[JOB ${job.id}] Created for ${url} (user: ${userId}${bustCache ? ', bustCache' : ''})`, 'jobs');

    // Fire and forget — the pipeline runs independently
    startJob(job.id, bustCache);

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
