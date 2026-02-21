import { NextRequest, NextResponse } from 'next/server';
import { aiCache, TTL } from '@/lib/cache';
import logger from '@/lib/logger';

export const maxDuration = 300; // 5 minutes — needed for slow models (Opus + web search)

const ANALYSIS_PROMPT = `Role: You are an elite Property Consultant specializing in advice for home BUYERS. Your goal is to provide a "360-degree" due diligence report on a residential property using the provided JSON data and real-time web research. Every claim, statistic, and local sentiment must be accompanied by a specific citation (URL or source name).

Input Data:
The property JSON data is provided in the user message. This includes:
- Property details (price, size, bedrooms, etc.)
- Market data from PropertyData API (estimated value, 5-year growth, council tax band, crime rating, flood risk, conservation area status)
- Schools attended data from the local neighbourhood
- Nearest stations and commute times

Task Instructions:
Please analyze the property above and provide a report structured into the following sections. Focus your analysis on buyer-specific concerns: long-term capital appreciation, negotiation leverage, ownership costs, and area risks.

0. MARKET VALUATION & NEGOTIATION LEVERAGE (Priority Section)
- Compare the Rightmove listing price against the PropertyData estimated value.
- If overpriced: Suggest negotiation strategies and a realistic offer range.
- If underpriced: Explain why this might represent good value (e.g., motivated seller, quick sale needed).
- Analyze the 5-year capital growth trend for the area.
- Discuss council tax implications (Band comparison to similar properties).
- Citation Requirement: Reference the provided marketData values and current market conditions.

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

4. Planning & Ownership Constraints
- Search the local Council Planning Portal for the subject property and immediate neighbors.
- Flag active applications, historical enforcement cases, or TPOs.
- If the property is in a Conservation Area (check marketData), explain the restrictions on alterations.
- Citation Requirement: Provide Planning Application Reference Numbers and links to the Council portal.

5. Environmental & Safety Risk
- Provide a definitive assessment of Flood Risk (Rivers, Sea, Surface Water, and Groundwater) based on the provided marketData.
- Provide current Crime Statistics for the specific postcode compared to the Borough average.
- Citation Requirement: Cite specific sources for all risk data.

Remember: Frame everything from the perspective of someone looking to BUY this property as their home, considering long-term value, safety, and quality of life.`;

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const ALLOWED_MODELS = [
  'google/gemini-3-flash-preview',
  'anthropic/claude-opus-4.6',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyJson, model, bustCache } = body;


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

    if (bustCache) {
      logger.info(`Cache BUST requested | key=${cacheKey}`, 'ai-analysis');
      aiCache.delete(cacheKey);
    }

    const cached = aiCache.get(cacheKey);
    if (cached) {
      logger.info(`Cache HIT | model=${selectedModel} | key=${cacheKey}`, 'ai-analysis');
      return NextResponse.json({ success: true, analysis: cached, model: selectedModel, cached: true, logs: logger.getAll() });
    }

    const startTime = Date.now();
    logger.info(`Cache MISS — calling OpenRouter | model=${selectedModel}`, 'ai-analysis');

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
      logger.error(`ERROR | model=${selectedModel} | status=${response.status} | elapsed=${elapsed}s`, 'ai-analysis');
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
    logger.info(`Response received | model=${selectedModel} | routed_to=${routerModel || 'unknown'} | elapsed=${elapsed}s | finish_reason=${finishReason || 'unknown'}`, 'ai-analysis');
    if (usage) {
      logger.info(`Token usage | prompt=${usage.prompt_tokens} | completion=${usage.completion_tokens} | total=${usage.total_tokens}`, 'ai-analysis');
    }
    if (data.id) {
      logger.info(`OpenRouter ID: ${data.id}`, 'ai-analysis');
    }

    const analysis = data.choices?.[0]?.message?.content;

    if (!analysis) {
      logger.error(`No content in response | model=${selectedModel}`, 'ai-analysis');
      return NextResponse.json(
        { success: false, error: 'No analysis returned from AI service' },
        { status: 502 }
      );
    }

    aiCache.set(cacheKey, analysis, TTL.AI);
    logger.info(`Success | model=${selectedModel} | response_length=${analysis.length} chars | cached for ${TTL.AI / 3600}h`, 'ai-analysis');
    return NextResponse.json({ success: true, analysis, model: selectedModel, cached: false, logs: logger.getAll() });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.error(`TIMEOUT after 240s`, 'ai-analysis');
      return NextResponse.json(
        { success: false, error: 'AI analysis timed out (model took too long to respond)' },
        { status: 504 }
      );
    }
    logger.error(`Unexpected error: ${error}`, 'ai-analysis');
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
