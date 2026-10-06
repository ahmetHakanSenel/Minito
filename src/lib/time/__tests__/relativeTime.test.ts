import { relativeTime } from '../relativeTime';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
  it('says just now for the first minute', () => {
    expect(relativeTime(0)).toEqual({ unit: 'justNow' });
    expect(relativeTime(MIN - 1)).toEqual({ unit: 'justNow' });
  });

  // The server's clock can run a little ahead of the phone's, which makes a fresh item look like
  // it comes from the future. It is still just now.
  it('treats a time in the future as just now', () => {
    expect(relativeTime(-5 * MIN)).toEqual({ unit: 'justNow' });
  });

  it('moves to the next unit exactly at its boundary', () => {
    expect(relativeTime(MIN)).toEqual({ unit: 'minutes', count: 1 });
    expect(relativeTime(HOUR - 1)).toEqual({ unit: 'minutes', count: 59 });
    expect(relativeTime(HOUR)).toEqual({ unit: 'hours', count: 1 });
    expect(relativeTime(DAY - 1)).toEqual({ unit: 'hours', count: 23 });
    expect(relativeTime(DAY)).toEqual({ unit: 'days', count: 1 });
    expect(relativeTime(7 * DAY - 1)).toEqual({ unit: 'days', count: 6 });
    expect(relativeTime(7 * DAY)).toEqual({ unit: 'date' });
  });

  it('counts whole units, never rounding up', () => {
    expect(relativeTime(2 * DAY - 1)).toEqual({ unit: 'days', count: 1 });
    expect(relativeTime(90 * MIN)).toEqual({ unit: 'hours', count: 1 });
  });
});
