import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  type AlertState,
  evaluate,
  formatMessage,
  REMINDER_INTERVAL_MS,
  type Snapshot,
  transition,
} from './rules.ts';

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    generated_at: '2026-09-16T12:00:00Z',
    last_hour: { eligible: 100, answered: 100, from_model: 100, fast: 100 },
    budget_28d: { eligible: 5000, failed: 0 },
    spend: { tokens_today: 10_000, tokens_daily_average: 10_000 },
    ...overrides,
  };
}

const firingRules = (s: Snapshot) =>
  evaluate(s)
    .filter((result) => result.firing)
    .map((result) => result.rule);

Deno.test('a healthy snapshot fires nothing', () => {
  assertEquals(firingRules(snapshot()), []);
});

Deno.test('each rule fires on its own symptom', () => {
  assertEquals(
    firingRules(snapshot({ last_hour: { eligible: 100, answered: 90, from_model: 90, fast: 90 } })),
    ['availability']
  );
  assertEquals(
    firingRules(
      snapshot({ last_hour: { eligible: 100, answered: 100, from_model: 80, fast: 100 } })
    ),
    ['quality']
  );
  assertEquals(
    firingRules(
      snapshot({ last_hour: { eligible: 100, answered: 100, from_model: 100, fast: 70 } })
    ),
    ['latency']
  );
  assertEquals(firingRules(snapshot({ budget_28d: { eligible: 5000, failed: 51 } })), [
    'error_budget',
  ]);
  assertEquals(
    firingRules(snapshot({ spend: { tokens_today: 90_000, tokens_daily_average: 20_000 } })),
    ['spend']
  );
});

Deno.test('a quiet hour never fires, however bad its few requests look', () => {
  const quiet = snapshot({
    last_hour: { eligible: 3, answered: 0, from_model: 0, fast: 0 },
    budget_28d: { eligible: 40, failed: 40 },
    spend: { tokens_today: 4_000, tokens_daily_average: 100 },
  });
  assertEquals(firingRules(quiet), []);
});

Deno.test('the error budget allows exactly 1% of requests to fail', () => {
  assertEquals(firingRules(snapshot({ budget_28d: { eligible: 5000, failed: 50 } })), []);
  assertEquals(firingRules(snapshot({ budget_28d: { eligible: 5000, failed: 51 } })), [
    'error_budget',
  ]);
});

Deno.test('every rule links to the runbook', () => {
  for (const result of evaluate(snapshot())) {
    assert(result.runbook.startsWith('docs/RUNBOOK.md#'), result.rule);
  }
});

const T0 = new Date('2026-09-16T12:00:00Z');
const later = (ms: number) => new Date(T0.getTime() + ms);
const unhealthy = snapshot({
  last_hour: { eligible: 100, answered: 50, from_model: 50, fast: 50 },
});

function kinds(notifications: { kind: string; result: { rule: string } }[]) {
  return notifications.map(({ kind, result }) => `${result.rule}:${kind}`);
}

Deno.test('an alert notifies when it starts, stays quiet, reminds, and resolves', () => {
  const first = transition(evaluate(unhealthy), [], T0);
  assertEquals(kinds(first.notifications), ['availability:firing']);

  const quiet = transition(evaluate(unhealthy), first.next, later(60 * 60 * 1000));
  assertEquals(kinds(quiet.notifications), []);

  const reminder = transition(evaluate(unhealthy), quiet.next, later(REMINDER_INTERVAL_MS));
  assertEquals(kinds(reminder.notifications), ['availability:reminder']);
  const since = reminder.next.find((state) => state.rule === 'availability')?.since;
  assertEquals(since, T0.toISOString(), 'a reminder keeps the original start');

  const resolved = transition(evaluate(snapshot()), reminder.next, later(REMINDER_INTERVAL_MS + 1));
  assertEquals(kinds(resolved.notifications), ['availability:resolved']);

  const calm = transition(evaluate(snapshot()), resolved.next, later(2 * REMINDER_INTERVAL_MS));
  assertEquals(kinds(calm.notifications), []);
});

Deno.test('state is kept for every rule, firing or not', () => {
  const { next } = transition(evaluate(snapshot()), [], T0);
  assertEquals(
    next.map((state: AlertState) => [state.rule, state.firing]),
    [
      ['availability', false],
      ['quality', false],
      ['latency', false],
      ['error_budget', false],
      ['spend', false],
    ]
  );
});

Deno.test('messages fit each webhook format', () => {
  const { notifications } = transition(evaluate(unhealthy), [], T0);

  const discord = formatMessage(notifications, 'discord') as { content: string };
  assert(discord.content.includes('availability'));
  assert(discord.content.length <= 2000);

  const slack = formatMessage(notifications, 'slack') as { text: string };
  assert(slack.text.includes('docs/RUNBOOK.md#provider-outage'));
});
