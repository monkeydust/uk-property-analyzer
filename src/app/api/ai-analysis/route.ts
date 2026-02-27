import { NextRequest, NextResponse } from 'next/server';
import { aiCache, TTL } from '@/lib/cache';
import logger from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';

export const maxDuration = 300; // 5 minutes — needed for slow models (Opus + web search)



const DEFAULT_MODEL = 'google/gemini-3-flash-preview';
const ALLOWED_MODELS = [
  'google/gemini-3-flash-preview',
  'anthropic/claude-opus-4.6',
];

export async function POST(request: NextRequest) {
  try {
    const promptPath = path.join(process.cwd(), 'src', 'prompts', 'ai-analysis.md');
    const ANALYSIS_PROMPT = await fs.readFile(promptPath, 'utf8');

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
