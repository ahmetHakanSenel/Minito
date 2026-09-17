import { clamp, indexFromOffset, offsetForIndex, rowAppearance } from '../wheelMath';

const ROW = 44;

describe('offsetForIndex', () => {
  it('places the first value at the top of the content', () => {
    expect(offsetForIndex(0, ROW)).toBe(0);
  });

  it('advances one row per value', () => {
    expect(offsetForIndex(7, ROW)).toBe(7 * ROW);
  });
});

describe('indexFromOffset', () => {
  it('reads back the value an offset was built from', () => {
    for (const index of [0, 1, 23, 59]) {
      expect(indexFromOffset(offsetForIndex(index, ROW), ROW, 60)).toBe(index);
    }
  });

  it('settles on the nearer value when released between two', () => {
    expect(indexFromOffset(3 * ROW + 0.49 * ROW, ROW, 60)).toBe(3);
    expect(indexFromOffset(3 * ROW + 0.51 * ROW, ROW, 60)).toBe(4);
  });

  // The scroll view can report an offset outside its content while a finger is still down:
  // rubber banding on iOS, the stretch effect on Android. Neither may name a value that does
  // not exist on the wheel.
  it('never reports a value outside the wheel', () => {
    expect(indexFromOffset(-5 * ROW, ROW, 60)).toBe(0);
    expect(indexFromOffset(200 * ROW, ROW, 60)).toBe(59);
  });

  it('handles a wheel with a single value', () => {
    expect(indexFromOffset(3 * ROW, ROW, 1)).toBe(0);
  });
});

describe('rowAppearance', () => {
  it('leaves the selected row untouched', () => {
    expect(rowAppearance(0)).toEqual({ opacity: 1, scale: 1 });
  });

  it('falls away symmetrically above and below', () => {
    expect(rowAppearance(-2)).toEqual(rowAppearance(2));
  });

  it('dims and shrinks monotonically with distance', () => {
    const steps = [0, 1, 2, 3].map(rowAppearance);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i].opacity).toBeLessThan(steps[i - 1].opacity);
      expect(steps[i].scale).toBeLessThan(steps[i - 1].scale);
    }
  });

  // Rows far outside the window are clipped by the well; their appearance must stop falling
  // rather than cross into a negative opacity or scale.
  it('stops falling beyond the edge of the window', () => {
    expect(rowAppearance(9)).toEqual(rowAppearance(3));
    expect(rowAppearance(3).opacity).toBeGreaterThan(0);
    expect(rowAppearance(3).scale).toBeGreaterThan(0);
  });

  it('is continuous between rows, so scrolling does not jump', () => {
    const half = rowAppearance(0.5);
    expect(half.opacity).toBeLessThan(rowAppearance(0).opacity);
    expect(half.opacity).toBeGreaterThan(rowAppearance(1).opacity);
  });
});

describe('clamp', () => {
  it('holds a value inside its bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
