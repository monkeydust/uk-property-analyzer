type PropertyDataErrorPayload = {
  status?: string;
  code?: string | number;
  message?: string;
};

export class PropertyDataError extends Error {
  code?: string | number;
  status?: string;

  constructor(message: string, payload?: PropertyDataErrorPayload) {
    super(message);
    this.name = 'PropertyDataError';
    this.code = payload?.code;
    this.status = payload?.status;
  }
}

function getApiKey(): string {
  const key = process.env.PROPERTYDATA_API_KEY;
  if (!key) {
    throw new PropertyDataError('PropertyData API key is not configured');
  }
  return key;
}

function toQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  return sp.toString();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function propertyDataGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  options?: { timeoutMs?: number; retriesOnThrottle?: number }
): Promise<T> {
  const apiKey = getApiKey();
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const retriesOnThrottle = options?.retriesOnThrottle ?? 2;

  const url = `https://api.propertydata.co.uk/${path}?${toQuery(params)}`;

  for (let attempt = 0; attempt <= retriesOnThrottle; attempt++) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: abort.signal,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const text = await res.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        throw new PropertyDataError(`PropertyData returned non-JSON response (HTTP ${res.status})`);
      }

      const payload = (json ?? {}) as PropertyDataErrorPayload & Record<string, unknown>;

      if (!res.ok) {
        throw new PropertyDataError(
          payload?.message || `PropertyData HTTP error (${res.status})`,
          { status: payload?.status, code: payload?.code, message: payload?.message }
        );
      }

      if (payload?.status === 'error') {
        // Throttle retry
        if (String(payload?.code) === 'X14' && attempt < retriesOnThrottle) {
          await sleep(4_000);
          continue;
        }
        throw new PropertyDataError(payload?.message || 'PropertyData error', {
          status: payload?.status,
          code: payload?.code,
          message: payload?.message,
        });
      }

      return json as T;
    } catch (err) {
      // AbortError / fetch errors
      if (err instanceof PropertyDataError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PropertyDataError('PropertyData request timed out');
      }
      throw new PropertyDataError(`PropertyData request failed: ${String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  // Should never reach
  throw new PropertyDataError('PropertyData request failed');
}
