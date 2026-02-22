import { propertyDataGet, PropertyDataError } from '@/lib/propertydata/client';
import { plotSizeCache, TTL } from '@/lib/cache';
import { haversineDistance } from '@/lib/utils/google-maps';

type AddressMatchUprnResponse = {
  status: 'success' | 'error';
  code?: string | number;
  message?: string;
  data?: unknown;
  matches?: unknown;
};

type UprnsResponseRow = {
  uprn: string | number;
  address?: string;
  addressParts?: {
    primary?: string | null;
    secondary?: string | null;
    street?: string | null;
    town?: string | null;
    district?: string | null;
    postcode?: string | null;
  };
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
};

type UprnsResponse = {
  status: 'success' | 'error';
  code?: string | number;
  message?: string;
  data?: UprnsResponseRow[];
};

type UprnTitleResponse = {
  status: 'success' | 'error';
  code?: string | number;
  message?: string;
  data?: {
    uprn?: string;
    title_data?: { title_number?: string }[];
  };
};

type TitleResponse = {
  status: 'success' | 'error';
  code?: string | number;
  message?: string;
  data?: {
    plot_size?: string | number | null;
  };
};

export type PlotSizeResult = {
  plotSizeAcres: number | null;
  uprn: string | null;
  titleNumber: string | null;
  matchedAddress: string | null;
  method: 'address-match-uprn' | 'uprns-location' | 'uprns-postcode' | null;
};

function normalizePostcode(postcode: string): string {
  const cleaned = postcode.toUpperCase().replace(/\s+/g, '');
  if (cleaned.length >= 5) {
    return `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`;
  }
  return cleaned;
}

function parsePlotSizeAcres(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractMatches(resp: AddressMatchUprnResponse): { uprn: string; address?: string }[] {
  const data = resp.data;
  // Observed shapes:
  // - { data: [] }
  // - { data: { matches: [] } }
  // - { matches: [] }
  const maybeList = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);

  const dataObj: Record<string, unknown> | null =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const respObj = resp as unknown as Record<string, unknown>;

  const list =
    maybeList(dataObj?.matches) ||
    maybeList(respObj.matches) ||
    maybeList(data) ||
    null;

  if (!list) return [];

  const out: { uprn: string; address?: string }[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const itemObj = item as Record<string, unknown>;
    const uprn = itemObj.uprn;
    if (uprn === undefined || uprn === null) continue;
    const address = itemObj.address;
    out.push({ uprn: String(uprn), address: typeof address === 'string' ? address : undefined });
  }
  return out;
}

async function uprnToTitle(uprn: string): Promise<string | null> {
  try {
    const ut = await propertyDataGet<UprnTitleResponse>('uprn-title', { uprn }, { retriesOnThrottle: 2 });
    if (ut.status !== 'success') return null;
    const titles = ut.data?.title_data;
    if (!Array.isArray(titles) || titles.length === 0) return null;
    const t = titles[0]?.title_number;
    return t ? String(t) : null;
  } catch (e) {
    // Common case: some UPRNs have no associated titles.
    if (e instanceof PropertyDataError) {
      if (String(e.code) === '2101') return null;
    }
    return null;
  }
}

async function titleToPlotSize(titleNumber: string): Promise<number | null> {
  const tr = await propertyDataGet<TitleResponse>('title', { title: titleNumber });
  if (tr.status !== 'success') return null;
  return parsePlotSizeAcres(tr.data?.plot_size);
}

function buildCacheKey(input: { address: string; postcode?: string | null; lat?: number | null; lng?: number | null }): string {
  const pc = input.postcode ? normalizePostcode(input.postcode) : '';
  const lat = input.lat ?? '';
  const lng = input.lng ?? '';
  return `plotSize::${input.address.trim().toLowerCase()}::${pc}::${lat}::${lng}`;
}

function pickNearest(rows: UprnsResponseRow[], lat: number, lng: number): UprnsResponseRow[] {
  const withDist = rows
    .map((r) => {
      const rlat = (r.lat ?? r.latitude);
      const rlng = (r.lng ?? r.longitude);
      if (typeof rlat !== 'number' || typeof rlng !== 'number') return null;
      const distKm = haversineDistance(lat, lng, rlat, rlng);
      return { r, distKm };
    })
    .filter(Boolean) as { r: UprnsResponseRow; distKm: number }[];

  withDist.sort((a, b) => a.distKm - b.distKm);
  return withDist.map((x) => x.r);
}

function addrIncludesNumberAndStreet(address: string, numberToken: string, street: string): boolean {
  const a = address.toUpperCase();
  const st = street.toUpperCase();
  if (!a.includes(st)) return false;
  if (!numberToken) return true;
  const re = new RegExp(`\\b${numberToken.replace(/[^0-9A-Z]/g, '')}\\b`, 'i');
  return re.test(a);
}

export async function getPlotSizeAcres(input: {
  address: string;
  postcode?: string | null;
  streetName?: string | null;
  doorNumber?: string | null;
  coordinates?: { latitude: number; longitude: number } | null;
  bustCache?: boolean;
}): Promise<PlotSizeResult> {
  const cacheKey = buildCacheKey({
    address: input.address,
    postcode: input.postcode,
    lat: input.coordinates?.latitude ?? null,
    lng: input.coordinates?.longitude ?? null,
  });

  if (input.bustCache) {
    plotSizeCache.delete(cacheKey);
  }

  const cached = plotSizeCache.get(cacheKey);
  if (cached) return cached as PlotSizeResult;

  const base: PlotSizeResult = {
    plotSizeAcres: null,
    uprn: null,
    titleNumber: null,
    matchedAddress: null,
    method: null,
  };

  // 1) Try address-match-uprn
  try {
    const am = await propertyDataGet<AddressMatchUprnResponse>('address-match-uprn', { address: input.address }, { retriesOnThrottle: 2 });
    if (am.status === 'success') {
      const matches = extractMatches(am);
      if (matches.length > 0) {
        const uprn = matches[0].uprn;
        const matchedAddress = matches[0].address ? String(matches[0].address) : null;
        const titleNumber = await uprnToTitle(uprn);
        if (titleNumber) {
          const plotSizeAcres = await titleToPlotSize(titleNumber);
          const result: PlotSizeResult = {
            plotSizeAcres,
            uprn,
            titleNumber,
            matchedAddress,
            method: 'address-match-uprn',
          };
          plotSizeCache.set(cacheKey, result, TTL.PLOT_SIZE);
          return result;
        }
      }
    }
  } catch (e) {
    // Continue to fallbacks unless API key missing
    if (e instanceof PropertyDataError && String(e.code) === 'PropertyData API key is not configured') {
      throw e;
    }
  }

  // 2) Fallback: uprns by location — prefer exact number+street, then same street, then nearest
  if (input.coordinates) {
    try {
      const { latitude, longitude } = input.coordinates;
      const uprns = await propertyDataGet<UprnsResponse>('uprns', {
        location: `${latitude},${longitude}`,
        results: 30,
      }, { retriesOnThrottle: 2 });
      if (uprns.status === 'success' && Array.isArray(uprns.data) && uprns.data.length > 0) {
        const rawRows = uprns.data as Record<string, unknown>[];
        const street = (input.streetName || '').trim().toUpperCase();
        const door = (input.doorNumber || '').trim();
        const numToken = (door.match(/^\d+/)?.[0]) || '';

        // Search the raw response directly — TypeScript types may strip unknown fields
        const exactMatch = (street && numToken)
          ? rawRows.filter((r) => {
              const parts = r.addressParts as Record<string, unknown> | undefined;
              if (!parts) return false;
              const primary = String(parts.primary || '').trim();
              const s = String(parts.street || '').toUpperCase();
              return primary === numToken && s === street;
            })
          : [];

        // If we have an exact door+street match, only try that one UPRN.
        if (exactMatch.length > 0) {
          const row = exactMatch[0];
          const uprn = row.uprn !== undefined && row.uprn !== null ? String(row.uprn) : null;
          if (uprn) {
            const titleNumber = await uprnToTitle(uprn);
            if (titleNumber) {
              const plotSizeAcres = await titleToPlotSize(titleNumber);
              const result: PlotSizeResult = {
                plotSizeAcres,
                uprn,
                titleNumber,
                matchedAddress: typeof row.address === 'string' ? row.address : null,
                method: 'address-match-uprn',
              };
              plotSizeCache.set(cacheKey, result, TTL.PLOT_SIZE);
              return result;
            }
          }
        }

        // Priority 2: same street (different number — fallback)
        const sameStreet = street
          ? rawRows.filter((r) => {
              const parts = r.addressParts as Record<string, unknown> | undefined;
              if (!parts) return false;
              return String(parts.street || '').toUpperCase() === street;
            })
          : [];

        // No exact match — try up to 3 same-street candidates
        const ordered = pickNearest(uprns.data, latitude, longitude);
        const fallbackCandidates = (sameStreet.length > 0 ? sameStreet : ordered as Record<string, unknown>[]).slice(0, 3);
        for (const row of fallbackCandidates) {
          const uprn = row.uprn !== undefined && row.uprn !== null ? String(row.uprn) : null;
          if (!uprn) continue;
          const titleNumber = await uprnToTitle(uprn);
          if (!titleNumber) continue;
          const plotSizeAcres = await titleToPlotSize(titleNumber);
          const result: PlotSizeResult = {
            plotSizeAcres,
            uprn,
            titleNumber,
            matchedAddress: typeof row.address === 'string' ? row.address : null,
            method: 'uprns-location',
          };
          plotSizeCache.set(cacheKey, result, TTL.PLOT_SIZE);
          return result;
        }
      }
    } catch (e) {
      console.warn('[plot-size] uprns-location failed:', e instanceof Error ? e.message : String(e));
    }
  }

  // 3) Fallback: uprns by strict postcode — prefer same street, then any with title
  if (input.postcode) {
    try {
      const postcode = normalizePostcode(input.postcode);
      const uprns = await propertyDataGet<UprnsResponse>('uprns', {
        postcode,
        strict: true,
        results: 100,
      }, { retriesOnThrottle: 2 });

      if (uprns.status === 'success' && Array.isArray(uprns.data) && uprns.data.length > 0) {
        const street = (input.streetName || '').trim().toUpperCase();
        const door = (input.doorNumber || '').trim();
        const numToken = (door.match(/^\d+/)?.[0]) || '';

        // 3a) Exact match: same street + same number
        const exactMatch = uprns.data.filter((r) => {
          const a = r.address ? String(r.address) : '';
          if (!a) return false;
          if (street) return addrIncludesNumberAndStreet(a, numToken, street);
          if (numToken) return new RegExp(`\\b${numToken}\\b`).test(a);
          return false;
        });

        // 3b) Same-street match (different number — fallback for new-builds etc.)
        const sameStreetMatch = street
          ? uprns.data.filter((r) => {
              const s = r.addressParts?.street || '';
              return s.toUpperCase() === street;
            })
          : [];

        // If exact match found, only try that one UPRN — don't iterate
        if (exactMatch.length > 0) {
          const row = exactMatch[0];
          const uprn = row.uprn !== undefined && row.uprn !== null ? String(row.uprn) : null;
          if (uprn) {
            const titleNumber = await uprnToTitle(uprn);
            if (titleNumber) {
              const plotSizeAcres = await titleToPlotSize(titleNumber);
              const result: PlotSizeResult = {
                plotSizeAcres,
                uprn,
                titleNumber,
                matchedAddress: row.address ? String(row.address) : null,
                method: 'address-match-uprn',
              };
              plotSizeCache.set(cacheKey, result, TTL.PLOT_SIZE);
              return result;
            }
          }
        }

        // No exact match — try up to 3 same-street (or any) candidates
        const fallbackRows = (sameStreetMatch.length > 0 ? sameStreetMatch : uprns.data).slice(0, 3);
        for (const row of fallbackRows) {
          const uprn = row.uprn !== undefined && row.uprn !== null ? String(row.uprn) : null;
          if (!uprn) continue;
          const titleNumber = await uprnToTitle(uprn);
          if (!titleNumber) continue;
          const plotSizeAcres = await titleToPlotSize(titleNumber);
          const result: PlotSizeResult = {
            plotSizeAcres,
            uprn,
            titleNumber,
            matchedAddress: row.address ? String(row.address) : null,
            method: 'uprns-postcode',
          };
          plotSizeCache.set(cacheKey, result, TTL.PLOT_SIZE);
          return result;
        }
      }
    } catch {
      // ignore
    }
  }

  plotSizeCache.set(cacheKey, base, TTL.PLOT_SIZE);
  return base;
}
