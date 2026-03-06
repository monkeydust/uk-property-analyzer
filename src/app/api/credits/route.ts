import { NextResponse } from 'next/server';

/**
 * GET /api/credits
 *
 * Returns credit/balance info for PropertyData and OpenRouter APIs.
 * Called on mount to display small status indicators in the dashboard header.
 */
export async function GET(): Promise<NextResponse> {
    const [pdResult, orResult] = await Promise.allSettled([
        fetchPropertyDataCredits(),
        fetchOpenRouterCredits(),
    ]);

    return NextResponse.json({
        propertyData: pdResult.status === 'fulfilled' ? pdResult.value : null,
        openRouter: orResult.status === 'fulfilled' ? orResult.value : null,
    });
}

// ── PropertyData /account/credits ────────────────────────────────────────────
// Uses the same base URL and auth as src/lib/propertydata/client.ts:
//   base: https://api.propertydata.co.uk/
//   auth: Authorization: Bearer <key>

interface PropertyDataCredits {
    creditsRemaining: number | null;
    creditsUsed: number | null;
    creditsTotal: number | null;
}

async function fetchPropertyDataCredits(): Promise<PropertyDataCredits> {
    const apiKey = process.env.PROPERTYDATA_API_KEY;
    if (!apiKey) return { creditsRemaining: null, creditsUsed: null, creditsTotal: null };

    const res = await fetch(`https://api.propertydata.co.uk/account/credits?key=${apiKey}`, {
        headers: {
            'Accept': 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { creditsRemaining: null, creditsUsed: null, creditsTotal: null };
    const data = await res.json();
    return {
        creditsRemaining: data?.result?.credits_remaining ?? null,
        creditsUsed: data?.result?.credits_used ?? null,
        creditsTotal: data?.result?.credits_limit ?? null,
    };
}

// ── OpenRouter GET /api/v1/credits ────────────────────────────────────────────
// Using /api/v1/credits (account-level) rather than /api/v1/key (key-level).
// /api/v1/key returns limit_remaining = null for unlimited keys, making it
// useless for balance display. /api/v1/credits gives total_credits and
// total_usage so we can compute the real available balance.

interface OpenRouterCredits {
    balance: number | null;   // total_credits - total_usage (USD)
    totalUsage: number | null;
}

async function fetchOpenRouterCredits(): Promise<OpenRouterCredits> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { balance: null, totalUsage: null };

    const res = await fetch('https://openrouter.ai/api/v1/credits', {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { balance: null, totalUsage: null };
    const body = await res.json();
    const d = body?.data ?? body;
    const totalCredits = typeof d.total_credits === 'number' ? d.total_credits : null;
    const totalUsage = typeof d.total_usage === 'number' ? d.total_usage : null;
    const balance = totalCredits !== null && totalUsage !== null ? totalCredits - totalUsage : null;
    return { balance, totalUsage };
}
