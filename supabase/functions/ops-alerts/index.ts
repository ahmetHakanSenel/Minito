import { corsHeaders, describeError, jsonResponse, requireEnv } from '../_shared/http.ts';
import { createAdminClient } from '../_shared/supabase.ts';
import { createOpsAlertsHandler, type OpsAlertsDeps } from './handler.ts';
import type { AlertState, Snapshot } from './rules.ts';

/**
 * Edge Function: ops-alerts
 *
 * Wiring only; see ./handler.ts and ./rules.ts. Deploy with `--no-verify-jwt`: the caller is a
 * scheduler holding OPS_ALERTS_SECRET, not a signed-in user.
 */

const SEND_TIMEOUT_MS = 5_000;

function log(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown>) {
  const write = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  write(JSON.stringify({ level, event, ...fields }));
}

function buildDeps(): OpsAlertsDeps {
  const admin = createAdminClient();
  const format = Deno.env.get('ALERT_WEBHOOK_FORMAT') === 'slack' ? 'slack' : 'discord';

  return {
    secret: requireEnv('OPS_ALERTS_SECRET'),
    webhookUrl: Deno.env.get('ALERT_WEBHOOK_URL') || null,
    webhookFormat: format,
    snapshot: async () => {
      const { data, error } = await admin.rpc('ops_health_snapshot');
      if (error) throw new Error(`${error.code}: ${error.message}`);
      return data as Snapshot;
    },
    loadState: async () => {
      const { data, error } = await admin.from('ops_alert_state').select('*');
      if (error) throw new Error(`${error.code}: ${error.message}`);
      return (data ?? []) as AlertState[];
    },
    saveState: async (states) => {
      const { error } = await admin.from('ops_alert_state').upsert(states, { onConflict: 'rule' });
      if (error) throw new Error(`${error.code}: ${error.message}`);
    },
    send: async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`webhook answered ${response.status}`);
    },
    log,
  };
}

let handler: ((req: Request) => Promise<Response>) | null = null;

Deno.serve(async (req) => {
  try {
    handler ??= createOpsAlertsHandler(buildDeps());
  } catch (error) {
    log('error', 'ops_alerts.misconfigured', { error: describeError(error) });
    return jsonResponse({ error: 'Internal server error' }, 500, corsHeaders(['POST']));
  }
  return handler(req);
});
