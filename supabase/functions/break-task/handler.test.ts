import {
  assert,
  assertEquals,
  assertStringIncludes,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  type BreakTaskDeps,
  createBreakTaskHandler,
  type LogLevel,
  RATE_LIMITS,
  sanitizeDisplayName,
  type TaskRecord,
} from './handler.ts';
import type { ModerationVerdict } from './moderation.ts';
import { PROMPT_VERSION } from './pipeline.ts';
import type { ProviderAdapter } from './providers.ts';

const TASK = 'Clean the kitchen before my parents arrive';

// Deterministic and, like a real HMAC, free of the text it was computed from.
function fakeHash(value: string): string {
  let h = 7;
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return `h${h.toString(16)}`;
}

const plan = {
  language: 'en',
  empathy_bridge: 'A visit makes every crumb look bigger.',
  first_step_hook: 'Stand in the kitchen doorway.',
  steps: [1, 2, 3].map((n) => ({
    id: `step-${n}`,
    title: `Small kitchen action ${n}`,
    instruction: 'Do this one thing and stop.',
    estimated_minutes: 2,
    difficulty: n === 1 ? 'easy' : 'medium',
  })),
  stopping_point: 'You can stop here.',
};

type Harness = {
  deps: BreakTaskDeps;
  logs: Array<{ level: LogLevel; event: string; fields: Record<string, unknown> }>;
  persisted: TaskRecord[];
  quotaCalls: string[];
  providerCalls: () => number;
  moderatedInputs: string[];
  settle: () => Promise<void>;
};

function harness(
  overrides: Partial<BreakTaskDeps> = {},
  options: {
    reply?: string;
    moderation?: ModerationVerdict;
    deniedScopes?: string[];
    quotaError?: boolean;
  } = {}
): Harness {
  const logs: Harness['logs'] = [];
  const persisted: TaskRecord[] = [];
  const quotaCalls: string[] = [];
  const moderatedInputs: string[] = [];
  const background: Promise<unknown>[] = [];
  let calls = 0;

  const provider: ProviderAdapter = {
    model: 'fake-model',
    send: () => {
      calls += 1;
      return Promise.resolve({
        content: options.reply ?? JSON.stringify(plan),
        tokenUsage: 1500,
        promptTokens: 1200,
        completionTokens: 300,
        finishReason: 'stop',
      });
    },
  };

  const deps: BreakTaskDeps = {
    provider,
    moderator: (input) => {
      moderatedInputs.push(input);
      return Promise.resolve(options.moderation ?? { flagged: false, checked: true });
    },
    allowUnmoderated: false,
    authenticate: (token) =>
      Promise.resolve(
        token === 'user-jwt' ? { id: 'user-1', metadata: { display_name: 'Hako' } } : null
      ),
    consumeQuota: (identifier) => {
      quotaCalls.push(identifier);
      if (options.quotaError) return Promise.reject(new Error('PGRST000: connection refused'));
      const scope = identifier.split(':')[0];
      return Promise.resolve(!(options.deniedScopes ?? []).includes(scope));
    },
    hash: (value) => Promise.resolve(fakeHash(value)),
    persistTask: (record) => {
      persisted.push(record);
      return Promise.resolve();
    },
    runInBackground: (work) => {
      background.push(work);
    },
    clientIp: () => '203.0.113.7',
    log: (level, event, fields) => logs.push({ level, event, fields }),
    newRequestId: () => '00000000-0000-4000-8000-000000000001',
    ...overrides,
  };

  return {
    deps,
    logs,
    persisted,
    quotaCalls,
    moderatedInputs,
    providerCalls: () => calls,
    settle: async () => {
      await Promise.all(background);
    },
  };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://edge.test/break-task', {
    method: 'POST',
    headers: { Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function call(h: Harness, req: Request) {
  const response = await createBreakTaskHandler(h.deps)(req);
  await h.settle();
  return { status: response.status, headers: response.headers, body: await response.json() };
}

Deno.test('a valid request returns the plan with its server-issued request id', async () => {
  const h = harness();
  const { status, headers, body } = await call(h, post({ input: TASK }));

  assertEquals(status, 200);
  assertEquals(body.success, true);
  assertEquals(body.meta, {
    prompt_version: PROMPT_VERSION,
    source: 'model',
    request_id: '00000000-0000-4000-8000-000000000001',
  });
  assertEquals(headers.get('x-request-id'), '00000000-0000-4000-8000-000000000001');
  assertEquals(h.providerCalls(), 1);
});

Deno.test(
  'telemetry is written once, keyed by the server id, and never holds the task text',
  async () => {
    const h = harness();
    await call(h, post({ input: `  ${TASK}  `, request_id: crypto.randomUUID() }));

    assertEquals(h.persisted.length, 1);
    const [record] = h.persisted;
    assertEquals(record.request_id, '00000000-0000-4000-8000-000000000001');
    assertEquals(record.user_id, 'user-1');
    assertEquals(record.input_hash, fakeHash(TASK));
    assertEquals(record.breakdown_source, 'model');
    assertEquals(record.token_usage, 1500);
    assert(!JSON.stringify(record).includes('parents'), 'the task text must not be persisted');

    const completed = h.logs.find((entry) => entry.event === 'break_task.completed');
    assert(completed);
    assert(!JSON.stringify(h.logs).includes('parents'), 'the task text must not be logged');
  }
);

Deno.test('a request without a user JWT is rejected before any work', async () => {
  const h = harness();
  for (const authorization of ['', 'Bearer anon-key', 'Basic user-jwt']) {
    const { status } = await call(h, post({ input: TASK }, { Authorization: authorization }));
    assertEquals(status, 401, authorization);
  }
  assertEquals(h.quotaCalls.length, 0);
  assertEquals(h.moderatedInputs.length, 0);
  assertEquals(h.providerCalls(), 0);
});

Deno.test('an Auth outage is a 503, never a 401 that would sign everyone out', async () => {
  const h = harness({
    authenticate: () => Promise.reject(new Error('AuthRetryableFetchError (502): Bad Gateway')),
  });
  const { status, body } = await call(h, post({ input: TASK }));

  assertEquals(status, 503);
  assertEquals(body.success, false);
  assertEquals(h.providerCalls(), 0);
  assertEquals(
    h.logs.map((entry) => entry.event),
    ['break_task.auth_unavailable']
  );
});

Deno.test('the bearer scheme is matched case-insensitively', async () => {
  const h = harness();
  const { status } = await call(h, post({ input: TASK }, { Authorization: 'bearer user-jwt' }));
  assertEquals(status, 200);
});

Deno.test('a whitespace-only task fails validation instead of reaching the model', async () => {
  const h = harness();
  for (const body of [{ input: '     ' }, { input: '\n\t' }, {}, 'not json']) {
    const { status, body: reply } = await call(h, post(body));
    assertEquals(status, 400, JSON.stringify(body));
    assertEquals(reply.fallback_reason, 'VALIDATION');
  }
  assertEquals(h.providerCalls(), 0);
});

Deno.test('a task over 1000 characters after trimming is rejected', async () => {
  const h = harness();
  assertEquals((await call(h, post({ input: 'a'.repeat(1001) }))).status, 400);
  assertEquals((await call(h, post({ input: `  ${'a'.repeat(1000)}  ` }))).status, 200);
});

Deno.test(
  'the IP quota is checked before the user quota, and a denial spares the user quota',
  async () => {
    const h = harness({}, { deniedScopes: ['ip'] });
    const { status, body } = await call(h, post({ input: TASK }));

    assertEquals(status, 429);
    assertEquals(body.fallback_reason, 'RATE_DOWN');
    assertEquals(h.quotaCalls, [`ip:${fakeHash('ip:203.0.113.7')}`]);
    assertEquals(h.providerCalls(), 0);
    assertEquals(h.persisted.length, 0);
  }
);

Deno.test('the user quota is enforced with its own limit', async () => {
  const limits: Array<[string, number, number]> = [];
  const h = harness({
    consumeQuota: (identifier, max, windowSeconds) => {
      limits.push([identifier.split(':')[0], max, windowSeconds]);
      return Promise.resolve(!identifier.startsWith('user:'));
    },
  });
  const { status } = await call(h, post({ input: TASK }));

  assertEquals(status, 429);
  assertEquals(limits, [
    ['ip', RATE_LIMITS.perIp.max, RATE_LIMITS.perIp.windowSeconds],
    ['user', RATE_LIMITS.perUser.max, RATE_LIMITS.perUser.windowSeconds],
  ]);
});

Deno.test('without a client IP only the user quota applies', async () => {
  const h = harness({ clientIp: () => null });
  await call(h, post({ input: TASK }));
  assertEquals(h.quotaCalls, ['user:user-1']);
});

Deno.test('a failing quota check fails open and is logged as an error', async () => {
  const h = harness({}, { quotaError: true });
  const { status } = await call(h, post({ input: TASK }));

  assertEquals(status, 200);
  const failures = h.logs.filter((entry) => entry.event === 'break_task.quota_check_failed');
  assertEquals(
    failures.map((entry) => entry.fields.scope),
    ['ip', 'user']
  );
  assert(failures.every((entry) => entry.level === 'error'));
});

Deno.test('flagged content wins over an exhausted quota and never reaches the model', async () => {
  const h = harness({}, { moderation: { flagged: true, checked: true }, deniedScopes: ['user'] });
  const { status, body } = await call(h, post({ input: TASK }));

  assertEquals(status, 200);
  assertEquals(body, { success: false, fallback_reason: 'CONTENT_FLAGGED' });
  assertEquals(h.providerCalls(), 0);
  assertEquals(
    h.persisted.map((record) => record.fallback_reason),
    ['CONTENT_FLAGGED']
  );
});

Deno.test('moderation sees the normalized task', async () => {
  const h = harness();
  await call(h, post({ input: 'Clean   the\n\nkitchen' }));
  assertEquals(h.moderatedInputs, ['Clean the kitchen']);
});

Deno.test('a skipped moderation check is served but logged', async () => {
  const h = harness({}, { moderation: { flagged: false, checked: false, reason: 'timeout' } });
  const { status } = await call(h, post({ input: TASK }));

  assertEquals(status, 200);
  const skipped = h.logs.find((entry) => entry.event === 'break_task.moderation_skipped');
  assertEquals(skipped?.fields.reason, 'timeout');
});

Deno.test('a deployment without moderation answers 503 even to anonymous probes', async () => {
  const h = harness({ moderator: null });
  const { status, body } = await call(h, post({ input: TASK }, { Authorization: '' }));

  assertEquals(status, 503);
  assertEquals(body.fallback_reason, 'MOD_DOWN');
});

Deno.test('running unmoderated is possible only when the deployment opts in', async () => {
  const h = harness({ moderator: null, allowUnmoderated: true });
  assertEquals((await call(h, post({ input: TASK }))).status, 200);
});

Deno.test('a deployment without a provider answers 503 AI_DOWN', async () => {
  const h = harness({ provider: null });
  const { status, body } = await call(h, post({ input: TASK }, { Authorization: '' }));

  assertEquals(status, 503);
  assertEquals(body.fallback_reason, 'AI_DOWN');
});

Deno.test('an unreachable provider is reported as AI_DOWN and still recorded', async () => {
  const provider: ProviderAdapter = {
    model: 'fake-model',
    send: () => Promise.reject(new Error('connection reset')),
  };
  const h = harness({ provider });
  const { status, body } = await call(h, post({ input: TASK }));

  assertEquals(status, 503);
  assertEquals(body.fallback_reason, 'AI_DOWN');
  assertEquals(
    h.persisted.map((record) => record.fallback_reason),
    ['AI_DOWN']
  );
});

Deno.test('an unusable model reply still yields a plan, marked as the fallback', async () => {
  const h = harness({}, { reply: '{"nope": true}' });
  const { status, body } = await call(h, post({ input: TASK }));

  assertEquals(status, 200);
  assertEquals(body.meta.source, 'fallback');
  assertEquals(h.providerCalls(), 2);
  assertEquals(h.persisted[0].response_language, null);
  assertEquals(h.persisted[0].language_match, null);
});

Deno.test(
  'an unexpected failure returns a generic 500 and logs only the error summary',
  async () => {
    const h = harness({
      hash: () => Promise.reject(new Error('crypto exploded')),
    });
    const { status, body } = await call(h, post({ input: TASK }));

    assertEquals(status, 500);
    assertEquals(body, { success: false, error: 'Internal server error' });
    const failure = h.logs.find((entry) => entry.event === 'break_task.unhandled_error');
    assertStringIncludes(String(failure?.fields.error), 'crypto exploded');
  }
);

Deno.test('only POST is served, and the preflight is answered without work', async () => {
  const h = harness();
  const handler = createBreakTaskHandler(h.deps);

  const preflight = await handler(
    new Request('https://edge.test/break-task', { method: 'OPTIONS' })
  );
  assertEquals(preflight.status, 204);
  assertStringIncludes(preflight.headers.get('Access-Control-Allow-Methods') ?? '', 'POST');

  const get = await handler(new Request('https://edge.test/break-task', { method: 'GET' }));
  assertEquals(get.status, 405);
  assertEquals(get.headers.get('Allow'), 'POST, OPTIONS');
  await get.body?.cancel();
});

Deno.test('the display name is reduced to short, inert text', () => {
  assertEquals(sanitizeDisplayName('  Ha ko  "the" <b>{great}</b>  '), 'Hako the bgreat/b');
  assertEquals(sanitizeDisplayName('x'.repeat(50))?.length, 30);
  assertEquals(sanitizeDisplayName('   '), null);
  assertEquals(sanitizeDisplayName(42), null);
});
