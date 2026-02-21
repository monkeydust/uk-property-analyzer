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

// ── Global serial queue ─────────────────────────────────────────────
// PropertyData enforces a strict rate limit (~1 req/sec on some plans).
// This queue ensures ALL calls across the entire server (plot-size,
// market-data, etc.) are serialised with a minimum gap between them.
// This eliminates throttling entirely.

const MIN_GAP_MS = 1_200; // minimum ms between consecutive API calls
let lastCallTime = 0;
let queuePromise: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = queuePromise.then(async () => {
    const now = Date.now();
    const elapsed = now - lastCallTime;
    if (elapsed < MIN_GAP_MS) {
      await sleep(MIN_GAP_MS - elapsed);
    }
    lastCallTime = Date.now();
    return fn();
  });
  // Update the queue tail (ignore the return value for chaining)
  queuePromise = task.then(() => {}, () => {});
  return task;
}

// ── Public API ──────────────────────────────────────────────────────

export async function propertyDataGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  options?: { timeoutMs?: number; retriesOnThrottle?: number }
): Promise<T> {
  const retriesOnThrottle = options?.retriesOnThrottle ?? 2;

  // Each attempt goes through the global queue
  for (let attempt = 0; attempt <= retriesOnThrottle; attempt++) {
    try {
      const result = await enqueue(() => singleFetch<T>(path, params, options?.timeoutMs ?? 20_000));
      return result;
    } catch (err) {
      if (err instanceof PropertyDataError && String(err.code) === 'X14' && attempt < retriesOnThrottle) {
        // Throttled — the queue gap will handle spacing; just retry
        continue;
      }
      throw err;
    }
  }

  throw new PropertyDataError('PropertyData request failed after retries');
}

async function singleFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  timeoutMs: number
): Promise<T> {
  const apiKey = getApiKey();
  const url = `https://api.propertydata.co.uk/${path}?${toQuery(params)}`;

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
      throw new PropertyDataError(payload?.message || 'PropertyData error', {
        status: payload?.status,
        code: payload?.code,
        message: payload?.message,
      });
    }

    return json as T;
  } catch (err) {
    if (err instanceof PropertyDataError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new PropertyDataError('PropertyData request timed out');
    }
    throw new PropertyDataError(`PropertyData request failed: ${String(err)}`);
  } finally {
    clearTimeout(timer);
  }
}
