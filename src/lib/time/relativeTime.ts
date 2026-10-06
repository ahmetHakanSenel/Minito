const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

export type RelativeTime =
  { unit: 'justNow' } | { unit: 'minutes' | 'hours' | 'days'; count: number } | { unit: 'date' };

/**
 * How long ago something happened, in the largest whole unit that fits, by elapsed time.
 *
 * Elapsed time, not calendar days: "1 day ago" is anything from 24 to 48 hours, the convention
 * most apps share. Past a week a relative phrase stops helping and the date says more. A time in
 * the future — the server's clock a little ahead of the phone's — reads as just now.
 */
export function relativeTime(elapsedMs: number): RelativeTime {
  if (elapsedMs < MINUTE_MS) return { unit: 'justNow' };
  if (elapsedMs < HOUR_MS) return { unit: 'minutes', count: Math.floor(elapsedMs / MINUTE_MS) };
  if (elapsedMs < DAY_MS) return { unit: 'hours', count: Math.floor(elapsedMs / HOUR_MS) };
  if (elapsedMs < WEEK_MS) return { unit: 'days', count: Math.floor(elapsedMs / DAY_MS) };
  return { unit: 'date' };
}
