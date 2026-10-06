import {
  assert,
  assertEquals,
  assertRejects,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import type { ChatMessage } from './pipeline.ts';
import {
  createMeter,
  geminiProvider,
  isRetryableStatus,
  openAiProvider,
  type ProviderAdapter,
  ProviderError,
  resolveProvider,
  withBudget,
} from './providers.ts';

const messages: ChatMessage[] = [{ role: 'user', content: 'hello' }];
const A_MINUTE = 60_000;

type Outcome = { ok: true; tokenUsage?: number } | { ok: false; error: Error };

// A provider that answers from a script and spends a measurable amount of time doing it.
function fakeProvider(outcomes: Outcome[]) {
  let calls = 0;
  const adapter: ProviderAdapter = {
    model: 'fake-model',
    send: async () => {
      const outcome = outcomes[calls];
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (!outcome || !outcome.ok) {
        throw outcome ? outcome.error : new Error('unscripted call');
      }
      return { content: '{}', tokenUsage: outcome.tokenUsage ?? 10 };
    },
  };
  return { adapter, callCount: () => calls };
}

Deno.test('a successful call is returned and its model time is measured', async () => {
  const provider = fakeProvider([{ ok: true, tokenUsage: 42 }]);
  const meter = createMeter();

  const completion = await withBudget(
    provider.adapter,
    Date.now() + A_MINUTE,
    meter
  )(messages, {
    attempts: 2,
  });

  assertEquals(completion?.tokenUsage, 42);
  assertEquals(provider.callCount(), 1);
  assert(meter.aiLatencyMs > 0, 'the attempt should have been measured');
});

Deno.test('a retryable failure is retried, and every attempt counts as model time', async () => {
  const provider = fakeProvider([
    { ok: false, error: new ProviderError('OpenAI API error: 503', true) },
    { ok: true },
  ]);
  const meter = createMeter();

  const completion = await withBudget(
    provider.adapter,
    Date.now() + A_MINUTE,
    meter
  )(messages, {
    attempts: 2,
  });

  assertEquals(completion?.content, '{}');
  assertEquals(provider.callCount(), 2);
  // Both attempts slept 5ms, and the retry delay in between must not be counted as model time.
  assert(
    meter.aiLatencyMs >= 10,
    `expected both attempts to be measured, got ${meter.aiLatencyMs}`
  );
  assert(meter.aiLatencyMs < 400, `retry delay leaked into model time: ${meter.aiLatencyMs}`);
});

Deno.test('a non-retryable failure gives up at once, but is still measured', async () => {
  const provider = fakeProvider([
    { ok: false, error: new ProviderError('OpenAI API error: 429', false) },
    { ok: true },
  ]);
  const meter = createMeter();

  const completion = await withBudget(
    provider.adapter,
    Date.now() + A_MINUTE,
    meter
  )(messages, {
    attempts: 2,
  });

  assertEquals(completion, null);
  assertEquals(provider.callCount(), 1);
  assert(meter.aiLatencyMs > 0);
});

Deno.test('an exhausted budget never reaches the provider', async () => {
  const provider = fakeProvider([{ ok: true }]);
  const meter = createMeter();

  const completion = await withBudget(
    provider.adapter,
    Date.now(),
    meter
  )(messages, {
    attempts: 2,
  });

  assertEquals(completion, null);
  assertEquals(provider.callCount(), 0);
  assertEquals(meter.aiLatencyMs, 0);
});

Deno.test('only transient statuses are retryable', () => {
  assertEquals(isRetryableStatus(500), true);
  assertEquals(isRetryableStatus(408), true);
  // An exhausted quota is not transient; retrying it only burns the budget.
  assertEquals(isRetryableStatus(429), false);
  assertEquals(isRetryableStatus(400), false);
});

Deno.test('the provider is resolved by name, and only with a key', () => {
  const keys = { openaiKey: 'sk-test', geminiKey: 'g-test', geminiModel: 'gemini-2.0-flash' };

  assertEquals(resolveProvider('openai', keys)?.model, 'gpt-4o-mini');
  assertEquals(resolveProvider('gemini', keys)?.model, 'gemini-2.0-flash');
  assertEquals(resolveProvider('openai', { ...keys, openaiKey: '' }), null);
  assertEquals(resolveProvider('mystery-model', keys), null);
});

Deno.test('the OpenAI model can be overridden by deployment', () => {
  const keys = {
    openaiKey: 'sk-test',
    openaiModel: 'gpt-4.1-mini',
    geminiKey: '',
    geminiModel: '',
  };

  assertEquals(resolveProvider('openai', keys)?.model, 'gpt-4.1-mini');
  // An empty override falls back rather than sending an empty model id.
  assertEquals(resolveProvider('openai', { ...keys, openaiModel: '' })?.model, 'gpt-4o-mini');
});

Deno.test('a timed-out attempt gives up and still counts as model time', async () => {
  let calls = 0;
  // Never resolves on its own; only the abort signal ends it.
  const adapter: ProviderAdapter = {
    model: 'slow-model',
    send: (_messages, signal) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    },
  };
  const meter = createMeter();

  // A 2.6s deadline caps the per-call timeout below the usual 9s, keeping the test short.
  const completion = await withBudget(
    adapter,
    Date.now() + 2_600,
    meter
  )(messages, {
    attempts: 1,
  });

  assertEquals(completion, null);
  assertEquals(calls, 1);
  assert(meter.aiLatencyMs >= 2_000, `timed-out attempt was not measured: ${meter.aiLatencyMs}`);
});

// Replaces fetch for one call, so the adapter's parsing can be tested without a network.
async function withStubbedFetch(response: Response, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(response);
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test('the OpenAI adapter reads the reply, its token split and why it stopped', async () => {
  const body = {
    choices: [{ message: { content: '{"language":"en"}' }, finish_reason: 'stop' }],
    usage: {
      prompt_tokens: 1200,
      completion_tokens: 212,
      total_tokens: 1412,
      prompt_tokens_details: { cached_tokens: 1024 },
    },
  };

  await withStubbedFetch(new Response(JSON.stringify(body), { status: 200 }), async () => {
    const completion = await openAiProvider('sk-test').send(messages, AbortSignal.timeout(1000));

    assertEquals(completion.content, '{"language":"en"}');
    assertEquals(completion.tokenUsage, 1412);
    assertEquals(completion.promptTokens, 1200);
    assertEquals(completion.completionTokens, 212);
    assertEquals(completion.cachedTokens, 1024);
    assertEquals(completion.finishReason, 'stop');
  });
});

Deno.test('a truncated OpenAI reply is reported as finish_reason length', async () => {
  const body = {
    choices: [{ message: { content: '{"language":"en"' }, finish_reason: 'length' }],
    usage: { prompt_tokens: 1200, completion_tokens: 1000, total_tokens: 2200 },
  };

  await withStubbedFetch(new Response(JSON.stringify(body), { status: 200 }), async () => {
    const completion = await openAiProvider('sk-test').send(messages, AbortSignal.timeout(1000));

    // The content is broken JSON; only finishReason explains that it hit the output ceiling
    // rather than the model ignoring the contract.
    assertEquals(completion.finishReason, 'length');
  });
});

Deno.test('the Gemini adapter maps its own usage and finish fields', async () => {
  const body = {
    candidates: [
      { content: { parts: [{ text: '{"language":' }, { text: '"tr"}' }] }, finishReason: 'STOP' },
    ],
    usageMetadata: {
      promptTokenCount: 1180,
      candidatesTokenCount: 320,
      totalTokenCount: 1500,
      cachedContentTokenCount: 0,
    },
  };

  await withStubbedFetch(new Response(JSON.stringify(body), { status: 200 }), async () => {
    const completion = await geminiProvider('g-test', 'gemini-2.0-flash').send(
      messages,
      AbortSignal.timeout(1000)
    );

    // Gemini streams the object across parts; they are joined before parsing.
    assertEquals(completion.content, '{"language":"tr"}');
    assertEquals(completion.tokenUsage, 1500);
    assertEquals(completion.promptTokens, 1180);
    assertEquals(completion.completionTokens, 320);
    assertEquals(completion.finishReason, 'STOP');
  });
});

Deno.test('the OpenAI adapter marks 5xx as retryable and 429 as not', async () => {
  await withStubbedFetch(new Response('upstream boom', { status: 503 }), async () => {
    const error = await assertRejects(
      () => openAiProvider('sk-test').send(messages, AbortSignal.timeout(1000)),
      ProviderError
    );
    assertEquals(error.retryable, true);
  });

  await withStubbedFetch(new Response('quota exceeded', { status: 429 }), async () => {
    const error = await assertRejects(
      () => openAiProvider('sk-test').send(messages, AbortSignal.timeout(1000)),
      ProviderError
    );
    assertEquals(error.retryable, false);
  });
});
