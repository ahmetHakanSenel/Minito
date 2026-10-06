import { formatCountdown, joinDuration, splitDuration, secondsLeft } from '../duration';

describe('duration helpers', () => {
  it('splits and joins without losing a second', () => {
    for (const total of [0, 1, 59, 60, 61, 3599, 3600, 3661, 5 * 3600 + 59 * 60 + 59]) {
      expect(joinDuration(splitDuration(total))).toBe(total);
    }
  });

  it('never produces negative or fractional parts', () => {
    expect(splitDuration(-5)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
    expect(splitDuration(90.9)).toEqual({ hours: 0, minutes: 1, seconds: 30 });
  });

  it('shows hours only once there are any', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(65)).toBe('01:05');
    expect(formatCountdown(25 * 60)).toBe('25:00');
    expect(formatCountdown(3600 + 4 * 60 + 5)).toBe('1:04:05');
  });
});

describe('secondsLeft', () => {
  const END = 1_000_000;

  it('shows the whole duration at the moment the countdown starts', () => {
    expect(secondsLeft(END, END - 25 * 60 * 1000)).toBe(25 * 60);
  });

  // The display must not read 00:00 while any time is left, or a session would look finished a
  // second early and the completion would seem to lag behind the clock.
  it('reads zero only once the time is actually over', () => {
    expect(secondsLeft(END, END - 1)).toBe(1);
    expect(secondsLeft(END, END - 999)).toBe(1);
    expect(secondsLeft(END, END)).toBe(0);
  });

  it('never goes below zero, however late it is asked', () => {
    expect(secondsLeft(END, END + 60_000)).toBe(0);
  });

  it('steps once per whole second', () => {
    expect(secondsLeft(END, END - 1000)).toBe(1);
    expect(secondsLeft(END, END - 1001)).toBe(2);
  });
});
