import { flingTarget, nearestDetent, stripTranslate, wrap } from '../dialMath';

const ROW = 40;
const OFFSET = 80;

// The label drawn at the window's centre, for a strip that starts at `firstIndex`.
function labelAtCentre(position: number, count: number, firstIndex: number): number {
  const translate = stripTranslate(position, count, firstIndex, OFFSET, ROW);
  const row = Math.round((OFFSET - translate) / ROW);
  return wrap(firstIndex + row, count);
}

describe('wrap', () => {
  it('folds any integer into the lap, negatives included', () => {
    expect(wrap(0, 60)).toBe(0);
    expect(wrap(60, 60)).toBe(0);
    expect(wrap(61, 60)).toBe(1);
    expect(wrap(-1, 60)).toBe(59);
    expect(wrap(-121, 60)).toBe(59);
  });
});

describe('stripTranslate', () => {
  it('shows the rounded position at the centre, on every detent of several laps', () => {
    for (let position = -130; position <= 130; position++) {
      expect(labelAtCentre(position, 60, 56)).toBe(wrap(position, 60));
    }
  });

  it('crosses the 59 → 00 seam without a visible jump', () => {
    // Just before and just after the seam, the centre label is the same neighbour pair.
    expect(labelAtCentre(59.49, 60, 56)).toBe(59);
    expect(labelAtCentre(59.51, 60, 56)).toBe(0);
    expect(labelAtCentre(60.0, 60, 56)).toBe(0);
    expect(labelAtCentre(-0.51, 60, 56)).toBe(59);
  });

  it('moves smoothly between detents rather than stepping', () => {
    const a = stripTranslate(17, 60, 56, OFFSET, ROW);
    const b = stripTranslate(17.25, 60, 56, OFFSET, ROW);
    expect(a - b).toBeCloseTo(ROW * 0.25);
  });

  it('works for a short lap such as hours', () => {
    for (let position = -12; position <= 12; position++) {
      expect(labelAtCentre(position, 5, 1)).toBe(wrap(position, 5));
    }
  });
});

describe('nearestDetent', () => {
  it('turns forward across the seam when that is shorter', () => {
    expect(nearestDetent(58, 2, 60)).toBe(62);
  });

  it('turns backward across the seam when that is shorter', () => {
    expect(nearestDetent(2, 58, 60)).toBe(-2);
  });

  it('stays put when the value is already showing', () => {
    expect(nearestDetent(17.4, 17, 60)).toBe(17);
    expect(nearestDetent(137, 17, 60)).toBe(137);
  });

  it('lands on a detent that actually shows the value', () => {
    for (const current of [-75.3, -1, 0, 29.9, 30.1, 119, 1234.6]) {
      for (const value of [0, 1, 29, 30, 31, 59]) {
        const target = nearestDetent(current, value, 60);
        expect(Number.isInteger(target)).toBe(true);
        expect(wrap(target, 60)).toBe(value);
        expect(Math.abs(target - current)).toBeLessThanOrEqual(30.5);
      }
    }
  });
});

describe('flingTarget', () => {
  it('drops a slow release into the nearest detent, whichever way it was drifting', () => {
    expect(flingTarget(10.4, 1)).toBe(10);
    expect(flingTarget(10.6, -1)).toBe(11);
    expect(flingTarget(10.49, 0)).toBe(10);
  });

  it('never snaps back against the direction of a throw', () => {
    // Just past a detent and thrown forward: forward, not back to 10.
    expect(flingTarget(10.1, 3)).toBe(11);
    // Just before a detent and thrown backward: backward, not on to 11.
    expect(flingTarget(10.9, -3)).toBe(10);
  });

  it('stays put when released exactly on a detent with a gentle throw', () => {
    expect(flingTarget(10, 2.6)).toBe(10);
    expect(flingTarget(10, -2.6)).toBe(10);
  });

  it('carries a harder throw further, in its own direction', () => {
    expect(flingTarget(10, 20)).toBe(14);
    expect(flingTarget(10, -20)).toBe(6);
  });

  it('caps a violent throw', () => {
    expect(flingTarget(10, 10_000)).toBe(10 + 24);
    expect(flingTarget(10, -10_000)).toBe(10 - 24);
  });

  it('always lands on a whole detent', () => {
    for (const position of [-3.7, 0, 0.5, 12.25, 59.9]) {
      for (const velocity of [-40, -3, -1, 0, 1, 3, 40]) {
        expect(Number.isInteger(flingTarget(position, velocity))).toBe(true);
      }
    }
  });
});
