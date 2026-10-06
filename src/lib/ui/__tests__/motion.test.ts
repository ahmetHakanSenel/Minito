import { PRESS_SPRING, SETTLE_SPRING } from '../motion';

type Spring = { damping: number; stiffness: number; mass: number };

const dampingRatio = ({ damping, stiffness, mass }: Spring) =>
  damping / (2 * Math.sqrt(stiffness * mass));

/** Displacement of a spring released from 1 at rest, as a fraction of its travel. */
function displacement({ damping, stiffness, mass }: Spring, seconds: number): number {
  const zeta = dampingRatio({ damping, stiffness, mass });
  const w0 = Math.sqrt(stiffness / mass);
  if (zeta >= 1) return Math.exp(-w0 * seconds) * (1 + w0 * seconds);
  const w1 = w0 * Math.sqrt(1 - zeta * zeta);
  return (
    Math.exp(-zeta * w0 * seconds) *
    (Math.cos(w1 * seconds) + ((zeta * w0) / w1) * Math.sin(w1 * seconds))
  );
}

/** Largest overshoot past the target, and the last millisecond outside 2 % of it. */
function stepResponse(spring: Spring) {
  let overshoot = 0;
  let settledAfterMs = 0;
  for (let ms = 0; ms <= 5000; ms++) {
    const x = displacement(spring, ms / 1000);
    overshoot = Math.max(overshoot, -x);
    if (Math.abs(x) > 0.02) settledAfterMs = ms;
  }
  return { overshoot, settledAfterMs };
}

describe('motion springs', () => {
  it('press feedback lands within a tap and does not bounce', () => {
    const { overshoot, settledAfterMs } = stepResponse(PRESS_SPRING);
    expect(overshoot).toBeLessThan(0.01);
    expect(settledAfterMs).toBeLessThanOrEqual(200);
  });

  it('a dialog settles inside the time a modal should take, with no visible bounce', () => {
    const { overshoot, settledAfterMs } = stepResponse(SETTLE_SPRING);
    expect(overshoot).toBeLessThan(0.02);
    expect(settledAfterMs).toBeGreaterThanOrEqual(150);
    expect(settledAfterMs).toBeLessThanOrEqual(300);
  });

  it('names the mass, because a config without one runs at mass 4', () => {
    // The same numbers at Reanimated 4's default mass are the wobble this file exists to prevent.
    expect(stepResponse({ ...PRESS_SPRING, mass: 4 }).overshoot).toBeGreaterThan(0.2);
    for (const spring of [PRESS_SPRING, SETTLE_SPRING]) {
      expect(spring.mass).toBe(1);
    }
  });
});
