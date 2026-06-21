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

    // BUG FIX (Bug 7): Always check for in-flight jobs, even with bustCache
    // Prevents concurrent pipelines racing to upsert the same SavedProperty
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

    // BUG FIX (Bug 2): If not bustCache, check if a SavedProperty already exists
    // This prevents test packs and accidental resubmissions from creating ghost jobs
    if (!bustCache) {
      const allSaved = await prisma.savedProperty.findMany({
        where: { userId },
        select: { id: true, url: true },
      });

      const existingSaved = allSaved.find((s) => normalizeUrl(s.url) === normUrl);
      if (existingSaved) {
        logger.info(`[JOBS] SavedProperty already exists for ${url} (id: ${existingSaved.id}), skipping job`, 'jobs');
        return NextResponse.json({
          success: true,
          existing: true,
          savedPropertyId: existingSaved.id,
          status: 'complete',
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
