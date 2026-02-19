import { NextRequest, NextResponse } from 'next/server';
import { aiCache, TTL } from '@/lib/cache';

export const maxDuration = 300; // 5 minutes — needed for slow models (Opus + web search)

const ANALYSIS_PROMPT = `Role: You are an elite Property Investment Consultant and Local Area Specialist. Your goal is to provide a "360-degree" due diligence report on a residential property using the provided JSON data and real-time web research. Every claim, statistic, and local sentiment must be accompanied by a specific citation (URL or source name).

Input Data:
The property JSON data is provided in the user message.

Task Instructions:
Please analyze the property above and provide a report structured into the following sections:

1. The "Word on the Street" (Community & Lifestyle)
- Search Mumsnet, Reddit, and Nextdoor for the specific street and immediate neighborhood.
- Identify the "prestige" level of the road versus the surrounding area.
- Note recurring local complaints.
- Citation Requirement: Provide direct links or specific thread titles for all forum insights.

2. The Schooling "Catchment" Reality
- Analyze the schools listed in the JSON using Ofsted and local parent forums.
- Identify which schools are "oversubscribed" or have "shifting catchment" issues.
- Citation Requirement: Reference the latest Ofsted report dates and any school-specific news articles.

3. Commuter Logistics & Traffic
- Evaluate the nearest stations. Search for current commuter sentiment on line reliability.
- Identify local traffic bottlenecks that would affect a daily drive.
- Citation Requirement: Cite Police.uk, National Rail, or local news for traffic/commute data.

4. Planning & Neighbor Analysis
- Search the local Council Planning Portal for the subject property and immediate neighbors.
- Flag active applications, historical enforcement cases, or TPOs.
- Citation Requirement: Provide Planning Application Reference Numbers and links to the Council portal.

5. Environmental & Safety Risk
- Provide a definitive assessment of Flood Risk (Rivers, Sea, Surface Water, and Groundwater).
- Provide current Crime Statistics for the specific postcode compared to the Borough average.
- Citation Requirement: Cite specific sources for all risk data.`;

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const ALLOWED_MODELS = [
  'google/gemini-3-flash-preview',
  'anthropic/claude-opus-4.6',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyJson, model } = body;

    if (!propertyJson || typeof propertyJson !== 'object') {
      return NextResponse.json(
        { success: false, error: 'propertyJson is required in request body' },
        { status: 400 }
      );
    }

    const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your-key-here') {
      return NextResponse.json(
        { success: false, error: 'OpenRouter API key is not configured' },
        { status: 500 }
      );
    }

    // Cache key: stable property identifier + model
    const propertyId = propertyJson?.id || propertyJson?.address?.postcode || JSON.stringify(propertyJson).slice(0, 100);
    const cacheKey = `${selectedModel}::${propertyId}`;
    const cached = aiCache.get(cacheKey);
    if (cached) {
      console.log(`[AI Analysis] Cache HIT | model=${selectedModel} | key=${cacheKey}`);
      return NextResponse.json({ success: true, analysis: cached, model: selectedModel, cached: true });
    }

    const startTime = Date.now();
    console.log(`[AI Analysis] Cache MISS — calling OpenRouter | model=${selectedModel}`);

    const abort = new AbortController();
    const abortTimer = setTimeout(() => abort.abort(), 240_000); // 240s hard timeout

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: abort.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          { role: 'system', content: ANALYSIS_PROMPT },
          { role: 'user', content: JSON.stringify(propertyJson, null, 2) },
        ],
        plugins: [{ id: 'web', max_results: 5 }],
      }),
    });
    clearTimeout(abortTimer);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AI Analysis] ERROR | model=${selectedModel} | status=${response.status} | elapsed=${elapsed}s`);
      console.error(`[AI Analysis] Response headers:`, Object.fromEntries(response.headers.entries()));
      console.error(`[AI Analysis] Response body:`, errorText);
      return NextResponse.json(
        { success: false, error: `AI service error (${response.status})` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Log OpenRouter metadata
    const usage = data.usage;
    const routerModel = data.model;
    const finishReason = data.choices?.[0]?.finish_reason;
    console.log(`[AI Analysis] Response received | model=${selectedModel} | routed_to=${routerModel || 'unknown'} | elapsed=${elapsed}s | finish_reason=${finishReason || 'unknown'}`);
    if (usage) {
      console.log(`[AI Analysis] Token usage | prompt=${usage.prompt_tokens} | completion=${usage.completion_tokens} | total=${usage.total_tokens}`);
    }
    if (data.id) {
      console.log(`[AI Analysis] OpenRouter ID: ${data.id}`);
    }

    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      console.error(`[AI Analysis] No content in response | model=${selectedModel} | data keys: ${Object.keys(data).join(', ')}`);
      console.error(`[AI Analysis] Full response:`, JSON.stringify(data, null, 2));
      return NextResponse.json(
        { success: false, error: 'No analysis returned from AI service' },
        { status: 502 }
      );
    }

    aiCache.set(cacheKey, analysis, TTL.AI);
    console.log(`[AI Analysis] Success | model=${selectedModel} | response_length=${analysis.length} chars | cached for ${TTL.AI / 3600}h`);
    return NextResponse.json({ success: true, analysis, model: selectedModel, cached: false });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[AI Analysis] TIMEOUT after 240s`);
      return NextResponse.json(
        { success: false, error: 'AI analysis timed out (model took too long to respond)' },
        { status: 504 }
      );
    }
    console.error('[AI Analysis] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
