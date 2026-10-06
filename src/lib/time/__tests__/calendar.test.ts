import { daysBefore, localDateKey, splitByHour } from '../calendar';

const MIN = 60_000;
/** A moment on the local wall clock of the zone the suite runs in. */
const local = (iso: string) => new Date(iso).getTime();

describe('the suite time zone', () => {
  // Without this the date tests below would pass on a UTC runner for the wrong reason: UTC is the
  // one zone in which the bug they guard against cannot happen.
  it('is pinned to a zone that is not UTC', () => {
    expect(new Date('2026-10-02T00:00:00Z').getTimezoneOffset()).toBe(-180);
  });
});

describe('localDateKey', () => {
  it('names the day on the wall, not the day in Greenwich', () => {
    // 22:30 UTC on the 1st is half past one in the morning on the 2nd in Istanbul.
    expect(localDateKey(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02');
    expect(new Date('2026-10-01T22:30:00Z').toISOString().slice(0, 10)).toBe('2026-10-01');
  });

  it('pads months and days', () => {
    expect(localDateKey(local('2026-03-07T12:00:00'))).toBe('2026-03-07');
  });

  it('accepts a timestamp as well as a date', () => {
    expect(localDateKey(local('2026-12-31T23:59:00'))).toBe('2026-12-31');
  });
});

describe('daysBefore', () => {
  it('steps back calendar days, across a month and a year', () => {
    expect(localDateKey(daysBefore(local('2026-03-01T10:00:00'), 1))).toBe('2026-02-28');
    expect(localDateKey(daysBefore(local('2026-01-01T10:00:00'), 1))).toBe('2025-12-31');
  });

  it('leaves what it was given alone', () => {
    const from = new Date(local('2026-10-02T10:00:00'));
    daysBefore(from, 5);
    expect(localDateKey(from)).toBe('2026-10-02');
  });
});

describe('splitByHour', () => {
  it('shares a span between the hours it covers', () => {
    expect(splitByHour(local('2026-10-02T09:40:00'), local('2026-10-02T11:10:00'))).toEqual([
      [9, 20 * MIN],
      [10, 60 * MIN],
      [11, 10 * MIN],
    ]);
  });

  it('carries across midnight', () => {
    expect(splitByHour(local('2026-10-02T23:30:00'), local('2026-10-03T00:30:00'))).toEqual([
      [23, 30 * MIN],
      [0, 30 * MIN],
    ]);
  });

  it('keeps a span inside one hour in that hour', () => {
    expect(splitByHour(local('2026-10-02T14:05:00'), local('2026-10-02T14:50:00'))).toEqual([
      [14, 45 * MIN],
    ]);
  });

  it('returns nothing for an empty or backwards span', () => {
    expect(splitByHour(local('2026-10-02T14:00:00'), local('2026-10-02T14:00:00'))).toEqual([]);
    expect(splitByHour(local('2026-10-02T15:00:00'), local('2026-10-02T14:00:00'))).toEqual([]);
  });
});
