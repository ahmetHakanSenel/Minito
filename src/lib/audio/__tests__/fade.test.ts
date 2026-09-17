import { FADE_STEP_MS, fadeCurve, volumeAt } from '../fade';

describe('fadeCurve', () => {
  it('runs from silence to full', () => {
    expect(fadeCurve(0)).toBe(0);
    expect(fadeCurve(1)).toBe(1);
  });

  it('never leaves the audible range, whatever it is handed', () => {
    expect(fadeCurve(-3)).toBe(0);
    expect(fadeCurve(4)).toBe(1);
  });

  it('rises the whole way, without a step back', () => {
    let previous = -1;
    for (let progress = 0; progress <= 1; progress += 0.05) {
      const value = fadeCurve(progress);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  // The point of squaring: half way through, the sound is well under half its amplitude, which
  // is what a fade has to do to sound even to the ear.
  it('spends its amplitude late', () => {
    expect(fadeCurve(0.5)).toBeLessThan(0.5);
  });
});

describe('volumeAt', () => {
  const DURATION = 1_000;

  it('starts where the ramp starts and ends where it ends', () => {
    expect(volumeAt(0, 0.7, 0, DURATION)).toBeCloseTo(0);
    expect(volumeAt(0, 0.7, DURATION, DURATION)).toBeCloseTo(0.7);
    expect(volumeAt(0.7, 0, 0, DURATION)).toBeCloseTo(0.7);
    expect(volumeAt(0.7, 0, DURATION, DURATION)).toBe(0);
  });

  it('holds the destination once the ramp is over', () => {
    expect(volumeAt(0.7, 0, DURATION * 3, DURATION)).toBe(0);
  });

  it('jumps straight there when there is no time to ramp', () => {
    expect(volumeAt(0.7, 0, 0, 0)).toBe(0);
  });

  it('stays inside the ramp at every step of it', () => {
    for (let elapsed = 0; elapsed <= DURATION; elapsed += FADE_STEP_MS) {
      const value = volumeAt(0.2, 0.9, elapsed, DURATION);
      expect(value).toBeGreaterThanOrEqual(0.2);
      expect(value).toBeLessThanOrEqual(0.9);
    }
  });

  it('falls the whole way out, without a step back up', () => {
    let previous = Infinity;
    for (let elapsed = 0; elapsed <= DURATION; elapsed += FADE_STEP_MS) {
      const value = volumeAt(0.7, 0, elapsed, DURATION);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  // A fade-out interrupted half way and reversed has to pick up from where it is, not jump.
  it('ramps from wherever it is asked to start', () => {
    const halfWay = volumeAt(0.7, 0, DURATION / 2, DURATION);
    expect(volumeAt(halfWay, 0.7, 0, DURATION)).toBeCloseTo(halfWay);
  });

  it('is symmetric: fading out is fading in, read backwards', () => {
    for (const elapsed of [0, 250, 500, 750, 1_000]) {
      expect(volumeAt(0.7, 0, elapsed, DURATION)).toBeCloseTo(
        volumeAt(0, 0.7, DURATION - elapsed, DURATION)
      );
    }
  });
});
