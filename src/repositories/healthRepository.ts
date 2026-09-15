import { probeAiGateway, probeCloudApi, type ProbeResult } from '../data/health/healthProbes';

export type ServiceState = 'operational' | 'degraded' | 'down' | 'unconfigured';

export type ServiceHealth = {
  state: ServiceState;
  latencyMs: number | null;
};

// Past this round trip a service still works, but users feel the lag.
const DEGRADED_LATENCY_MS = 1500;

function classify(
  result: ProbeResult | null,
  isHealthyStatus: (status: number) => boolean
): ServiceHealth {
  if (!result) {
    return { state: 'unconfigured', latencyMs: null };
  }
  if (result.status === null || !isHealthyStatus(result.status)) {
    return { state: 'down', latencyMs: result.latencyMs };
  }
  const isSlow = (result.latencyMs ?? 0) > DEGRADED_LATENCY_MS;
  return { state: isSlow ? 'degraded' : 'operational', latencyMs: result.latencyMs };
}

async function checkSystemHealth(): Promise<{ api: ServiceHealth; ai: ServiceHealth }> {
  const [api, ai] = await Promise.all([probeCloudApi(), probeAiGateway()]);
  return {
    api: classify(api, (status) => status >= 200 && status < 300),
    // An anon probe is answered with 401 by design; only a 5xx means the function itself fails.
    ai: classify(ai, (status) => status < 500),
  };
}

export const healthRepository = {
  checkSystemHealth,
};
