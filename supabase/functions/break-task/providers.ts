import type { ChatMessage, Complete, Completion } from './pipeline.ts';

/**
 * AI provider adapters, plus the timeout, retry and measurement policy wrapped around them.
 *
 * Kept apart from the HTTP handler so the budget logic can be tested with a fake provider, and
 * so adding a provider never means touching request handling.
 */

export const OPENAI_MODEL = 'gpt-4o-mini';

// The client waits at most 20s, so the whole request, one repair round-trip included, must fit.
export const REQUEST_BUDGET_MS = 17_000;
const AI_CALL_TIMEOUT_MS = 9_000;
// Starting an attempt with less time than this left would only end in a timeout.
const MIN_ATTEMPT_MS = 2_500;
const RETRY_DELAY_MS = 400;
// A 7-step plan with instructions needs room; the schema's length caps keep it well below this.
const MAX_OUTPUT_TOKENS = 1000;

export type ProviderAdapter = {
  /** Exact model id, recorded per request so a change in quality can be traced to a model change. */
  model: string;
  /** One raw chat request. Throws on failure; the retry policy lives in `withBudget`. */
  send: (messages: ChatMessage[], signal: AbortSignal) => Promise<Completion>;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// 429 is usually an exhausted quota, which a retry only makes worse.
export function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 408;
}

export function openAiProvider(apiKey: string): ProviderAdapter {
  return {
    model: OPENAI_MODEL,
    send: async (messages, signal) => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages,
          // JSON mode guarantees syntactically valid JSON; the schema is enforced by the pipeline.
          response_format: { type: 'json_object' },
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new ProviderError(
          `OpenAI API error: ${response.status} ${await response.text()}`,
          isRetryableStatus(response.status)
        );
      }

      const data = await response.json();
      const content: unknown = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new ProviderError('No content in OpenAI response', true);
      }
      // total_tokens is prompt + completion, which is what the cost is billed on.
      return { content, tokenUsage: Number(data.usage?.total_tokens) || 0 };
    },
  };
}

export function geminiProvider(apiKey: string, model: string): ProviderAdapter {
  // v1beta is the API version that supports systemInstruction and JSON mode.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  return {
    model,
    send: async (messages, signal) => {
      const systemText = messages
        .filter((message) => message.role === 'system')
        .map((message) => message.content)
        .join('\n\n');
      const contents = messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        }));

      const response = await fetch(url, {
        method: 'POST',
        signal,
        // Header auth keeps the key out of URLs, and therefore out of proxy and error logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
          },
        }),
      });

      if (!response.ok) {
        throw new ProviderError(
          `Gemini API error: ${response.status} ${await response.text()}`,
          isRetryableStatus(response.status)
        );
      }

      const data = await response.json();
      const parts: Array<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? [];
      const content = parts
        .map((part) => part.text ?? '')
        .join('')
        .trim();
      if (!content) {
        throw new ProviderError('No content in Gemini response', true);
      }
      return { content, tokenUsage: Number(data.usageMetadata?.totalTokenCount) || 0 };
    },
  };
}

export function resolveProvider(
  name: string,
  keys: { openaiKey: string; geminiKey: string; geminiModel: string }
): ProviderAdapter | null {
  if (name === 'openai' && keys.openaiKey) return openAiProvider(keys.openaiKey);
  if (name === 'gemini' && keys.geminiKey) return geminiProvider(keys.geminiKey, keys.geminiModel);
  return null;
}

/** Model time actually spent on a request, failed and timed-out attempts included. */
export type AiMeter = { aiLatencyMs: number };

export function createMeter(): AiMeter {
  return { aiLatencyMs: 0 };
}

/**
 * Adapts a provider to the pipeline: per-call timeouts, bounded retries, one shared deadline,
 * and the model-time measurement that feeds `tasks.ai_latency_ms`.
 */
export function withBudget(provider: ProviderAdapter, deadline: number, meter: AiMeter): Complete {
  return async (messages, { attempts }) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < MIN_ATTEMPT_MS) {
        console.warn(`AI budget exhausted before attempt ${attempt}`);
        return null;
      }

      let retry = false;
      const startedAt = performance.now();
      try {
        return await provider.send(
          messages,
          AbortSignal.timeout(Math.min(AI_CALL_TIMEOUT_MS, remaining))
        );
      } catch (error) {
        console.error(`AI call attempt ${attempt}/${attempts} failed:`, error);
        if (error instanceof ProviderError && !error.retryable) return null;
        retry = attempt < attempts;
      } finally {
        // Measured in the finally block, so a failed attempt still counts as model time spent.
        meter.aiLatencyMs += Math.round(performance.now() - startedAt);
      }

      if (retry) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    return null;
  };
}
