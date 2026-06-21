import { prisma } from '@/lib/db';
import logger from '@/lib/logger';

const BASE_URL = process.env.INTERNAL_BASE_URL || 'http://localhost:3000';

// Track active jobs to prevent duplicates
const activeJobs = new Set<string>();

/**
 * Internal fetch helper — calls our own API routes
 */
async function apiFetch(path: string, options?: RequestInit & { timeout?: number }): Promise<Response> {
  const timeout = options?.timeout || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Update job status and optional data fields in the DB
 */
async function updateJob(jobId: string, data: Record<string, unknown>) {
  try {
    await prisma.analysisJob.update({
      where: { id: jobId },
      data: { ...data, updatedAt: new Date() },
    });
  } catch (e) {
    logger.error(`Failed to update job ${jobId}: ${e}`, 'job-runner');
  }
}

/**
 * Run the full property analysis pipeline for a job.
 * This is fire-and-forget — updates the DB as it progresses.
 */
export async function runJob(jobId: string, bustCache = false): Promise<void> {
  if (activeJobs.has(jobId)) {
    logger.warn(`Job ${jobId} already running, skipping`, 'job-runner');
    return;
  }
  activeJobs.add(jobId);

  try {
    const job = await prisma.analysisJob.findUnique({ where: { id: jobId } });
    if (!job) {
      logger.error(`Job ${jobId} not found`, 'job-runner');
      return;
    }

    logger.info(`[JOB ${jobId}] Starting pipeline for ${job.url}`, 'job-runner');

    // ════════════════════════════════════════════════
    // PHASE 1: Scrape property
    // ════════════════════════════════════════════════
    await updateJob(jobId, { status: 'scraping' });

    let propertyResult: Record<string, unknown>;
    try {
      const res = await apiFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: job.url, bustCache }),
        timeout: 30000,
      });
      const data = await res.json();
      if (!data.success || !data.data?.property) {
        throw new Error(data.error || 'Scrape failed');
      }
      propertyResult = data.data.property;
      await updateJob(jobId, {
        propertyData: JSON.stringify(propertyResult),
        propertyId: data.data.id || (propertyResult as { id?: string }).id || null,
        status: 'enriching',
      });
      logger.info(`[JOB ${jobId}] Scrape complete — ${(propertyResult as { address?: { displayAddress?: string } }).address?.displayAddress || 'unknown'}`, 'job-runner');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await updateJob(jobId, { status: 'error', error: `Scrape failed: ${msg}` });
      logger.error(`[JOB ${jobId}] Scrape error: ${msg}`, 'job-runner');
      return;
    }

    // ════════════════════════════════════════════════
    // PHASE 2: Parallel enrichment
    // ════════════════════════════════════════════════
    const prop = propertyResult as {
      address?: { displayAddress?: string; postcode?: string; doorNumber?: string; streetName?: string };
      coordinates?: { latitude?: number; longitude?: number };
      bedrooms?: number;
      propertyType?: string;
      price?: number;
      squareFootage?: number;
    };

    const lat = prop.coordinates?.latitude;
    const lng = prop.coordinates?.longitude;
    const postcode = prop.address?.postcode;
    const displayAddress = prop.address?.displayAddress || '';
    const doorNumber = prop.address?.doorNumber;
    const streetName = prop.address?.streetName;
    const fullAddress = [doorNumber, streetName, displayAddress?.split(',').slice(1).join(',').trim(), postcode]
      .filter(Boolean)
      .join(', ')
      .replace(/, ,/g, ',');

    // Build search address for schools
    const schoolAddress = [doorNumber, displayAddress, postcode].filter(Boolean).join(', ').replace(/, ,/g, ',');

    const enrichmentTasks: Promise<void>[] = [];

    // Schools
    enrichmentTasks.push(
      (async () => {
        try {
          const params = new URLSearchParams({ address: schoolAddress });
          if (lat) params.append('lat', String(lat));
          if (lng) params.append('lng', String(lng));
          const res = await apiFetch(`/api/schools?${params}`, { timeout: 120000 });
          const data = await res.json();
          if (data.success) {
            await updateJob(jobId, { schoolsData: JSON.stringify(data) });
            logger.info(`[JOB ${jobId}] Schools complete`, 'job-runner');
          } else {
            logger.warn(`[JOB ${jobId}] Schools failed: ${data.error}`, 'job-runner');
          }
        } catch (e) {
          logger.warn(`[JOB ${jobId}] Schools error: ${e instanceof Error ? e.message : e}`, 'job-runner');
        }
      })()
    );

    // Market data (+ plot size chain)
    enrichmentTasks.push(
      (async () => {
        try {
          const res = await apiFetch('/api/market-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postcode,
              bedrooms: prop.bedrooms,
              propertyType: prop.propertyType,
              listingPrice: prop.price,
              squareFootage: prop.squareFootage,
              doorNumber,
              streetName,
            }),
            timeout: 60000,
          });
          const data = await res.json();
          if (data.success) {
            await updateJob(jobId, { marketData: JSON.stringify(data) });
            logger.info(`[JOB ${jobId}] Market data complete`, 'job-runner');

            // Chain: plot size (depends on market data address info)
            try {
              const plotRes = await apiFetch('/api/plot-size', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  address: fullAddress,
                  postcode,
                  doorNumber,
                  streetName,
                  lat,
                  lng,
                }),
                timeout: 60000,
              });
              const plotData = await plotRes.json();
              if (plotData.plotSizeAcres !== null && plotData.plotSizeAcres !== undefined) {
                await updateJob(jobId, { plotSizeData: JSON.stringify(plotData) });
                logger.info(`[JOB ${jobId}] Plot size complete: ${plotData.plotSizeAcres} acres`, 'job-runner');
              }
            } catch (e) {
              logger.warn(`[JOB ${jobId}] Plot size error: ${e instanceof Error ? e.message : e}`, 'job-runner');
            }
          }
        } catch (e) {
          logger.warn(`[JOB ${jobId}] Market data error: ${e instanceof Error ? e.message : e}`, 'job-runner');
        }
      })()
    );

    // Transactions
    enrichmentTasks.push(
      (async () => {
        try {
          if (!postcode) return;
          const params = new URLSearchParams({ postcode });
          if (doorNumber) params.append('doorNumber', doorNumber);
          if (streetName) params.append('streetName', streetName);
          const res = await apiFetch(`/api/transactions?${params}`, { timeout: 30000 });
          const data = await res.json();
          if (data.success) {
            await updateJob(jobId, { transactionsData: JSON.stringify(data) });
            logger.info(`[JOB ${jobId}] Transactions complete`, 'job-runner');
          }
        } catch (e) {
          logger.warn(`[JOB ${jobId}] Transactions error: ${e instanceof Error ? e.message : e}`, 'job-runner');
        }
      })()
    );

    // Stations
    enrichmentTasks.push(
      (async () => {
        try {
          if (!lat || !lng) return;
          const res = await apiFetch(`/api/stations?lat=${lat}&lng=${lng}`, { timeout: 30000 });
          const data = await res.json();
          if (data.success) {
            await updateJob(jobId, { stationsData: JSON.stringify(data) });
            logger.info(`[JOB ${jobId}] Stations complete`, 'job-runner');
          }
        } catch (e) {
          logger.warn(`[JOB ${jobId}] Stations error: ${e instanceof Error ? e.message : e}`, 'job-runner');
        }
      })()
    );

    // Commute
    enrichmentTasks.push(
      (async () => {
        try {
          if (!lat || !lng) return;
          const res = await apiFetch(`/api/commute?lat=${lat}&lng=${lng}`, { timeout: 30000 });
          const data = await res.json();
          if (data.success) {
            await updateJob(jobId, { commuteData: JSON.stringify(data) });
            logger.info(`[JOB ${jobId}] Commute complete`, 'job-runner');
          }
        } catch (e) {
          logger.warn(`[JOB ${jobId}] Commute error: ${e instanceof Error ? e.message : e}`, 'job-runner');
        }
      })()
    );

    // Wait for all enrichment
    await Promise.allSettled(enrichmentTasks);
    logger.info(`[JOB ${jobId}] All enrichment complete`, 'job-runner');

    // ════════════════════════════════════════════════
    // PHASE 3: AI Analysis
    // ════════════════════════════════════════════════
    await updateJob(jobId, { status: 'analyzing' });

    try {
      // Re-read job to get latest enrichment data
      const enrichedJob = await prisma.analysisJob.findUnique({ where: { id: jobId } });
      if (!enrichedJob) throw new Error('Job disappeared');

      // Build combined JSON for AI (property + schools + market + commute + transactions)
      const combinedJson: Record<string, unknown> = { ...propertyResult };
      if (enrichedJob.schoolsData) {
        try {
          const schools = JSON.parse(enrichedJob.schoolsData);
          if (schools.areaName || schools.primarySchools || schools.secondarySchools) {
            combinedJson.schoolsAttended = {
              areaName: schools.areaName,
              primarySchools: schools.primarySchools,
              secondarySchools: schools.secondarySchools,
            };
          }
        } catch { /* ignore parse errors */ }
      }
      if (enrichedJob.marketData) {
        try { combinedJson.marketData = JSON.parse(enrichedJob.marketData); } catch { /* ignore */ }
      }
      if (enrichedJob.commuteData) {
        try { combinedJson.commuteTimes = JSON.parse(enrichedJob.commuteData); } catch { /* ignore */ }
      }
      if (enrichedJob.transactionsData) {
        try { combinedJson.transactions = JSON.parse(enrichedJob.transactionsData); } catch { /* ignore */ }
      }
      if (enrichedJob.stationsData) {
        try { combinedJson.nearbyStations = JSON.parse(enrichedJob.stationsData); } catch { /* ignore */ }
      }

      const res = await apiFetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyJson: combinedJson,
          model: 'google/gemini-3.1-pro-preview',
          bustCache,
        }),
        timeout: 120000,
      });
      const data = await res.json();
      if (data.success) {
        await updateJob(jobId, {
          aiAnalysis: data.analysis,
          aiModel: data.model || 'google/gemini-3.1-pro-preview',
        });
        logger.info(`[JOB ${jobId}] AI analysis complete`, 'job-runner');
      } else {
        logger.warn(`[JOB ${jobId}] AI failed: ${data.error}`, 'job-runner');
      }
    } catch (e) {
      logger.warn(`[JOB ${jobId}] AI error: ${e instanceof Error ? e.message : e}`, 'job-runner');
    }

    // ════════════════════════════════════════════════
    // PHASE 4: Save to SavedProperty + mark complete
    // ════════════════════════════════════════════════
    try {
      const finalJob = await prisma.analysisJob.findUnique({ where: { id: jobId } });
      if (finalJob && finalJob.propertyId) {
        const propData = finalJob.propertyData ? JSON.parse(finalJob.propertyData) : {};
        
        // Merge market data into property if available
        if (finalJob.marketData) {
          try { propData.marketData = JSON.parse(finalJob.marketData); } catch { /* ignore */ }
        }
        // Merge stations into property if available
        if (finalJob.stationsData) {
          try {
            const stData = JSON.parse(finalJob.stationsData);
            propData.nearestStations = stData.nearestStations;
            propData.nearestTubeStations = stData.nearestTubeStations;
          } catch { /* ignore */ }
        }
        // Merge commute into property
        if (finalJob.commuteData) {
          try {
            const cData = JSON.parse(finalJob.commuteData);
            propData.commuteTimes = cData.commuteTimes;
          } catch { /* ignore */ }
        }
        // Merge plot size into property
        if (finalJob.plotSizeData) {
          try {
            const pData = JSON.parse(finalJob.plotSizeData);
            if (!propData.marketData) propData.marketData = { success: true, data: {} };
            if (propData.marketData?.data) propData.marketData.data.plotSize = pData;
          } catch { /* ignore */ }
        }
        // Merge transactions into property
        if (finalJob.transactionsData) {
          try {
            const tData = JSON.parse(finalJob.transactionsData);
            propData.transactions = tData.data || tData;
          } catch { /* ignore */ }
        }

        await prisma.savedProperty.upsert({
          where: { id: finalJob.propertyId },
          create: {
            id: finalJob.propertyId,
            userId: finalJob.userId,
            url: finalJob.url,
            propertyData: JSON.stringify(propData),
            schoolsData: finalJob.schoolsData || null,
            aiAnalysis: finalJob.aiAnalysis || null,
            aiModel: finalJob.aiModel || null,
            commuteTimes: finalJob.commuteData || '[]',
          },
          update: {
            propertyData: JSON.stringify(propData),
            schoolsData: finalJob.schoolsData || undefined,
            aiAnalysis: finalJob.aiAnalysis || undefined,
            aiModel: finalJob.aiModel || undefined,
            commuteTimes: finalJob.commuteData || undefined,
            updatedAt: new Date(),
          },
        });
        logger.info(`[JOB ${jobId}] Saved to SavedProperty`, 'job-runner');
      }
    } catch (e) {
      logger.warn(`[JOB ${jobId}] Save error: ${e instanceof Error ? e.message : e}`, 'job-runner');
    }

    await updateJob(jobId, { status: 'complete' });
    logger.info(`[JOB ${jobId}] ✅ Pipeline complete`, 'job-runner');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateJob(jobId, { status: 'error', error: msg });
    logger.error(`[JOB ${jobId}] Fatal error: ${msg}`, 'job-runner');
  } finally {
    activeJobs.delete(jobId);
  }
}

/**
 * Start a job (fire-and-forget). Returns immediately.
 */
export function startJob(jobId: string, bustCache = false): void {
  // Don't await — this runs in the background
  runJob(jobId, bustCache).catch((e) => {
    logger.error(`[JOB ${jobId}] Unhandled error: ${e}`, 'job-runner');
  });
}

/**
 * Check if a job is currently running
 */
export function isJobActive(jobId: string): boolean {
  return activeJobs.has(jobId);
}
