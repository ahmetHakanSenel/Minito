/**
 * Calendar days as the person lives them: the date on the wall where they are.
 *
 * `toISOString()` gives the date in UTC. In Istanbul that moves everything between midnight and
 * three in the morning onto the day before, so a session finished at half past one landed in the
 * wrong square of the heatmap, and "today" itself was labelled with yesterday's date until 3 a.m.
 * Late nights are not rare for the people this app is for.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for the local calendar day containing `at`. */
export function localDateKey(at: Date | number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * The same wall-clock moment `days` calendar days earlier. Calendar arithmetic rather than
 * `days × 24h`, so a day that is 23 or 25 hours long around a clock change still counts as one.
 */
export function daysBefore(from: Date | number, days: number): Date {
  const date = new Date(from);
  date.setDate(date.getDate() - days);
  return date;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Splits the span from `start` to `end` (epoch ms) into the local clock hours it covers, as
 * `[hour of day, milliseconds in that hour]` pairs. A session from 09:40 to 11:10 is 20 minutes at
 * 9, 60 at 10 and 10 at 11 — not 90 minutes at 11, which is what counting it at its end gave.
 */
export function splitByHour(start: number, end: number): [number, number][] {
  const slices: [number, number][] = [];
  let cursor = start;
  while (cursor < end) {
    const hourStart = new Date(cursor);
    hourStart.setMinutes(0, 0, 0);
    const sliceEnd = Math.min(end, hourStart.getTime() + HOUR_MS);
    slices.push([new Date(cursor).getHours(), sliceEnd - cursor]);
    cursor = sliceEnd;
  }
  return slices;
}
