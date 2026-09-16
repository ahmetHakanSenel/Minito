import {
  bearerToken,
  corsHeaders,
  describeError,
  guardMethod,
  jsonResponse,
} from '../_shared/http.ts';
import {
  type AlertState,
  evaluate,
  formatMessage,
  type Snapshot,
  transition,
  type WebhookFormat,
} from './rules.ts';

/**
 * Edge Function handler: ops-alerts
 *
 * Called on a schedule, never by the app. It authenticates with its own secret instead of a user
 * JWT, and does nothing but report when no webhook is configured.
 */

export type OpsAlertsDeps = {
  /** Required to call the function at all. */
  secret: string;
  /** null: alert delivery is switched off. */
  webhookUrl: string | null;
  webhookFormat: WebhookFormat;
  snapshot: () => Promise<Snapshot>;
  loadState: () => Promise<AlertState[]>;
  saveState: (states: AlertState[]) => Promise<void>;
  send: (url: string, body: unknown) => Promise<void>;
  log: (level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>) => void;
  now?: () => Date;
};

const CORS = corsHeaders(['POST']);

/** Compares without leaking, through timing, how much of a guessed secret was right. */
export function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}

export function createOpsAlertsHandler(deps: OpsAlertsDeps): (req: Request) => Promise<Response> {
  const now = deps.now ?? (() => new Date());

  return async (req) => {
    const rejected = guardMethod(req, ['POST'], CORS);
    if (rejected) return rejected;

    const token = bearerToken(req);
    if (!token || !constantTimeEqual(token, deps.secret)) {
      return jsonResponse({ error: 'Unauthorized' }, 401, CORS);
    }

    try {
      const results = evaluate(await deps.snapshot());
      const firing = results.filter((result) => result.firing).map((result) => result.rule);

      if (!deps.webhookUrl) {
        deps.log('info', 'ops_alerts.delivery_disabled', { firing });
        return jsonResponse({ status: 'disabled', firing }, 200, CORS);
      }

      const { next, notifications } = transition(results, await deps.loadState(), now());
      if (notifications.length > 0) {
        // Sent before the state is saved: if sending fails, the next run tries again.
        await deps.send(deps.webhookUrl, formatMessage(notifications, deps.webhookFormat));
      }
      await deps.saveState(next);

      deps.log(firing.length > 0 ? 'warn' : 'info', 'ops_alerts.evaluated', {
        firing,
        notified: notifications.map(({ kind, result }) => `${result.rule}:${kind}`),
      });
      return jsonResponse({ status: 'ok', firing, notified: notifications.length }, 200, CORS);
    } catch (error) {
      deps.log('error', 'ops_alerts.failed', { error: describeError(error) });
      return jsonResponse({ error: 'Internal server error' }, 500, CORS);
    }
  };
}
