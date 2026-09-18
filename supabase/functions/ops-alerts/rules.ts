/**
 * Alert rules and the decision of when to tell a person. Pure: no clock, network or database.
 *
 * Thresholds mirror docs/RUNBOOK.md. Every rule needs a minimum sample before it may fire: on a
 * quiet hour, one failed request is 100% unavailability, and an alert that cries wolf teaches
 * people to ignore alerts.
 */

export type Snapshot = {
  generated_at: string;
  last_hour: { eligible: number; answered: number; from_model: number; fast: number };
  budget_28d: { eligible: number; failed: number };
  spend: { tokens_today: number; tokens_daily_average: number };
};

export type Severity = 'page' | 'ticket';

export type RuleResult = {
  rule: string;
  severity: Severity;
  firing: boolean;
  /** One line a person can act on: the value, the threshold and the sample behind it. */
  detail: string;
  runbook: string;
};

const RUNBOOK = 'docs/RUNBOOK.md';

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function evaluate(snapshot: Snapshot): RuleResult[] {
  const { last_hour: hour, budget_28d: budget, spend } = snapshot;
  const results: RuleResult[] = [];

  const availability = hour.eligible > 0 ? hour.answered / hour.eligible : 1;
  results.push({
    rule: 'availability',
    severity: 'page',
    firing: hour.eligible >= 20 && availability < 0.95,
    detail: `availability ${pct(availability)} over the last hour (${hour.eligible} requests), threshold 95%`,
    runbook: `${RUNBOOK}#provider-outage`,
  });

  // Where the plan came from, not how good it was: a fallback is a worse plan, but a model
  // plan is not automatically a good one. Plan quality is measured offline, by the evaluation.
  const modelRate = hour.answered > 0 ? hour.from_model / hour.answered : 1;
  results.push({
    rule: 'model_response_rate',
    severity: 'ticket',
    firing: hour.answered >= 20 && modelRate < 0.9,
    detail: `${pct(modelRate)} of plans came from the model over the last hour (${hour.answered} plans), threshold 90%`,
    runbook: `${RUNBOOK}#model-response-rate-falls-after-a-prompt-or-model-change`,
  });

  const fast = hour.answered > 0 ? hour.fast / hour.answered : 1;
  results.push({
    rule: 'latency',
    severity: 'ticket',
    firing: hour.answered >= 20 && fast < 0.9,
    detail: `${pct(fast)} of plans arrived within 12 s over the last hour (${hour.answered} plans), threshold 90%`,
    runbook: `${RUNBOOK}#provider-outage`,
  });

  const allowedFailures = Math.floor(budget.eligible * 0.01);
  results.push({
    rule: 'error_budget',
    severity: 'ticket',
    firing: budget.eligible >= 100 && budget.failed > allowedFailures,
    detail: `${budget.failed} failed of ${budget.eligible} requests in 28 days; the 99% SLO allows ${allowedFailures}`,
    runbook: `${RUNBOOK}#service-level-objectives`,
  });

  const ratio =
    spend.tokens_daily_average > 0 ? spend.tokens_today / spend.tokens_daily_average : 0;
  results.push({
    rule: 'spend',
    severity: 'ticket',
    firing: spend.tokens_today >= 50_000 && ratio > 3,
    detail: `${spend.tokens_today} tokens today, ${ratio.toFixed(1)}× the 7-day daily average`,
    runbook: `${RUNBOOK}#quota-pressure`,
  });

  return results;
}

export type AlertState = {
  rule: string;
  firing: boolean;
  since: string;
  notified_at: string | null;
  detail: string | null;
};

export type Notification = { kind: 'firing' | 'reminder' | 'resolved'; result: RuleResult };

/** While an alert keeps firing, a person hears about it again at this interval. */
export const REMINDER_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Compares this run with the last one. A person is told when a rule starts firing, when it stops,
 * and periodically while it keeps firing; nothing else produces a message.
 */
export function transition(
  results: RuleResult[],
  previous: AlertState[],
  now: Date
): { next: AlertState[]; notifications: Notification[] } {
  const byRule = new Map(previous.map((state) => [state.rule, state]));
  const next: AlertState[] = [];
  const notifications: Notification[] = [];
  const nowIso = now.toISOString();

  for (const result of results) {
    const before = byRule.get(result.rule);
    const wasFiring = before?.firing ?? false;

    if (result.firing && !wasFiring) {
      notifications.push({ kind: 'firing', result });
      next.push({
        rule: result.rule,
        firing: true,
        since: nowIso,
        notified_at: nowIso,
        detail: result.detail,
      });
    } else if (result.firing) {
      const lastTold = Date.parse(before?.notified_at ?? before?.since ?? nowIso);
      const remind = now.getTime() - lastTold >= REMINDER_INTERVAL_MS;
      if (remind) notifications.push({ kind: 'reminder', result });
      next.push({
        rule: result.rule,
        firing: true,
        since: before?.since ?? nowIso,
        notified_at: remind ? nowIso : (before?.notified_at ?? null),
        detail: result.detail,
      });
    } else if (wasFiring) {
      notifications.push({ kind: 'resolved', result });
      next.push({
        rule: result.rule,
        firing: false,
        since: nowIso,
        notified_at: nowIso,
        detail: result.detail,
      });
    } else if (before) {
      next.push({ ...before, detail: result.detail });
    } else {
      next.push({
        rule: result.rule,
        firing: false,
        since: nowIso,
        notified_at: null,
        detail: result.detail,
      });
    }
  }
  return { next, notifications };
}

export type WebhookFormat = 'discord' | 'slack';

const ICON = { firing: '🔴', reminder: '🟠', resolved: '✅' } as const;

export function formatMessage(notifications: Notification[], format: WebhookFormat): unknown {
  const lines = notifications.map(({ kind, result }) => {
    const label = kind === 'resolved' ? 'RESOLVED' : `${kind.toUpperCase()} · ${result.severity}`;
    return `${ICON[kind]} **${result.rule}** ${label}\n${result.detail}\nRunbook: ${result.runbook}`;
  });
  const text = ['Minito · break-task', ...lines].join('\n\n');
  // Discord caps a message at 2000 characters; Slack at far more.
  return format === 'slack' ? { text } : { content: text.slice(0, 2000) };
}
