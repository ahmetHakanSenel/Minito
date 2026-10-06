import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { constantTimeEqual, createOpsAlertsHandler, type OpsAlertsDeps } from './handler.ts';
import type { AlertState, Snapshot } from './rules.ts';

const healthy: Snapshot = {
  generated_at: '2026-09-16T12:00:00Z',
  last_hour: { eligible: 100, answered: 100, from_model: 100, fast: 100 },
  budget_28d: { eligible: 5000, failed: 0 },
  spend: { tokens_today: 1000, tokens_daily_average: 1000 },
};

const failing: Snapshot = {
  ...healthy,
  last_hour: { eligible: 100, answered: 40, from_model: 40, fast: 40 },
};

function harness(overrides: Partial<OpsAlertsDeps> = {}, current: Snapshot = failing) {
  let state: AlertState[] = [];
  const sent: unknown[] = [];
  const events: string[] = [];
  const deps: OpsAlertsDeps = {
    secret: 'cron-secret',
    webhookUrl: 'https://discord.test/webhook',
    webhookFormat: 'discord',
    snapshot: () => Promise.resolve(current),
    loadState: () => Promise.resolve(state),
    saveState: (next) => {
      state = next;
      return Promise.resolve();
    },
    send: (_url, body) => {
      sent.push(body);
      return Promise.resolve();
    },
    log: (_level, event) => events.push(event),
    now: () => new Date('2026-09-16T12:00:00Z'),
    ...overrides,
  };
  return { handler: createOpsAlertsHandler(deps), sent, events, state: () => state };
}

const call = (auth = 'Bearer cron-secret') =>
  new Request('https://edge.test/ops-alerts', { method: 'POST', headers: { Authorization: auth } });

Deno.test('only the scheduler secret may call it', async () => {
  const { handler, sent } = harness();
  for (const auth of ['', 'Bearer wrong', 'Bearer cron-secre', 'Bearer cron-secret2']) {
    const response = await handler(call(auth));
    assertEquals(response.status, 401, auth);
    await response.body?.cancel();
  }
  assertEquals(sent, []);
});

Deno.test('a firing rule is sent once, and the next run stays quiet', async () => {
  const { handler, sent, state } = harness();

  const first = await handler(call());
  assertEquals(await first.json(), { status: 'ok', firing: ['availability'], notified: 1 });
  assertEquals(sent.length, 1);
  assertEquals(state().find((s) => s.rule === 'availability')?.firing, true);

  const second = await handler(call());
  assertEquals((await second.json()).notified, 0);
  assertEquals(sent.length, 1);
});

Deno.test('with no webhook configured, nothing is sent and nothing is stored', async () => {
  const saved: AlertState[][] = [];
  const { handler, events } = harness({
    webhookUrl: null,
    saveState: (next) => {
      saved.push(next);
      return Promise.resolve();
    },
  });

  const response = await handler(call());
  assertEquals(await response.json(), { status: 'disabled', firing: ['availability'] });
  assertEquals(saved, []);
  assertEquals(events, ['ops_alerts.delivery_disabled']);
});

Deno.test('a failed delivery leaves the state untouched, so the next run retries', async () => {
  const { handler, state, events } = harness({
    send: () => Promise.reject(new Error('webhook answered 502')),
  });

  const response = await handler(call());
  assertEquals(response.status, 500);
  await response.body?.cancel();
  assertEquals(state(), []);
  assertEquals(events, ['ops_alerts.failed']);
});

Deno.test('a healthy system sends nothing', async () => {
  const { handler, sent } = harness({}, healthy);
  const response = await handler(call());
  assertEquals((await response.json()).firing, []);
  assertEquals(sent, []);
});

Deno.test('it serves POST only', async () => {
  const { handler } = harness();
  const response = await handler(new Request('https://edge.test/ops-alerts', { method: 'GET' }));
  assertEquals(response.status, 405);
  await response.body?.cancel();
});

Deno.test('the secret comparison is exact', () => {
  assertEquals(constantTimeEqual('abc', 'abc'), true);
  assertEquals(constantTimeEqual('abc', 'abd'), false);
  assertEquals(constantTimeEqual('abc', 'abcd'), false);
  assertEquals(constantTimeEqual('', 'a'), false);
});
