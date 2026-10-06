import {
  MOTION_THRESHOLD_G,
  MOTION_BUDGET_MS,
  createPickupDetector,
  magnitude,
} from '../pickupDetector';

const INTERVAL_MS = 100;

/**
 * Feeds a stretch of samples at the sensor's rate and reports how many pickups were counted.
 * `magnitudeAt` returns the reading in g for each sample, so a test can describe a movement as
 * a shape over time rather than as a list of numbers.
 */
function feed(
  detector: ReturnType<typeof createPickupDetector>,
  startMs: number,
  durationMs: number,
  magnitudeAt: (elapsedMs: number) => number
): { pickups: number; endedAt: number } {
  let pickups = 0;
  let at = startMs;
  for (let elapsed = INTERVAL_MS; elapsed <= durationMs; elapsed += INTERVAL_MS) {
    at = startMs + elapsed;
    if (detector.sample(magnitudeAt(elapsed), at)) pickups += 1;
  }
  return { pickups, endedAt: at };
}

const STILL = () => 1;
// Unbroken movement, well above the threshold: the budget is spent at full rate.
const MOVING = () => 1.4;
// A phone in a hand: mostly moving, but never quite the same reading twice, so it dips below
// the threshold between swings and the budget is spent more slowly than it is by MOVING.
const HANDLED = (elapsed: number) => 1 + 0.3 * Math.sin(elapsed / 90);

describe('createPickupDetector', () => {
  it('ignores a phone lying on the desk', () => {
    const detector = createPickupDetector(0);
    expect(feed(detector, 0, 60_000, STILL).pickups).toBe(0);
  });

  // The complaint that prompted this: gravity moving to another axis is not a distraction.
  it('ignores turning the phone to landscape', () => {
    const detector = createPickupDetector(0);
    // Roughly a second of movement, then the phone is still again in its new orientation.
    const { pickups } = feed(detector, 0, 30_000, (elapsed) => (elapsed <= 1_000 ? 1 + 0.45 : 1));
    expect(pickups).toBe(0);
  });

  it('ignores nudging the phone across the desk', () => {
    const detector = createPickupDetector(0);
    const { pickups } = feed(detector, 0, 30_000, (elapsed) =>
      elapsed <= 600 || (elapsed > 5_000 && elapsed <= 5_800) ? 1 + 0.5 : 1
    );
    expect(pickups).toBe(0);
  });

  it('counts a phone that is picked up and held', () => {
    const detector = createPickupDetector(0);
    expect(feed(detector, 0, 10_000, HANDLED).pickups).toBe(1);
  });

  it('counts a long spell of handling only once', () => {
    const detector = createPickupDetector(0);
    expect(feed(detector, 0, 5 * 60_000, HANDLED).pickups).toBe(1);
  });

  it('counts the second pickup after the phone has been put down', () => {
    const detector = createPickupDetector(0);
    const first = feed(detector, 0, 8_000, HANDLED);
    const rest = feed(detector, first.endedAt, 20_000, STILL);
    const second = feed(detector, rest.endedAt, 8_000, HANDLED);
    expect(first.pickups).toBe(1);
    expect(rest.pickups).toBe(0);
    expect(second.pickups).toBe(1);
  });

  it('survives a still moment mid-handling without restarting the tally', () => {
    const detector = createPickupDetector(0);
    // Moving, briefly steady, moving again. The still spell costs half of what it lasted, so
    // 2.9 s of movement around a 0.4 s pause still pays the 2.5 s budget.
    const { pickups } = feed(detector, 0, 3_300, (elapsed) =>
      elapsed > 1_200 && elapsed <= 1_600 ? 1 : MOVING()
    );
    expect(pickups).toBe(1);
  });

  it('does not count motion that only just misses the threshold', () => {
    const detector = createPickupDetector(0);
    const { pickups } = feed(detector, 0, 60_000, () => 1 + MOTION_THRESHOLD_G * 0.9);
    expect(pickups).toBe(0);
  });

  it('spends the whole budget before it counts', () => {
    const detector = createPickupDetector(0);
    const justShort = feed(detector, 0, MOTION_BUDGET_MS - INTERVAL_MS, MOVING);
    expect(justShort.pickups).toBe(0);
    expect(feed(detector, justShort.endedAt, INTERVAL_MS, MOVING).pickups).toBe(1);
  });

  // A hand is not a shaker: the readings dip below the threshold between movements, so a real
  // pickup takes longer than the budget to register. It still registers well inside the time
  // anyone spends looking at a phone.
  it('registers a real pickup within a few seconds', () => {
    const detector = createPickupDetector(0);
    expect(feed(detector, 0, 5_000, HANDLED).pickups).toBe(0);
    expect(feed(detector, 5_000, 3_000, HANDLED).pickups).toBe(1);
  });

  // The sensor stops delivering while the screen is off or the app is backgrounded. The gap
  // that follows must not be spent as if the phone had been held throughout.
  it('does not credit a gap in the sample stream as handling', () => {
    const detector = createPickupDetector(0);
    expect(detector.sample(1.4, 60_000)).toBe(false);
    expect(detector.sample(1.4, 120_000)).toBe(false);
  });

  it('treats a sample from the past as no time at all', () => {
    const detector = createPickupDetector(10_000);
    expect(detector.sample(1.4, 0)).toBe(false);
  });
});

describe('magnitude', () => {
  it('reads 1 g for a phone at rest, whichever way it faces', () => {
    expect(magnitude({ x: 0, y: -1, z: 0 })).toBeCloseTo(1);
    expect(magnitude({ x: -1, y: 0, z: 0 })).toBeCloseTo(1);
    expect(magnitude({ x: 0, y: 0, z: 1 })).toBeCloseTo(1);
  });

  it('grows when the phone is accelerated', () => {
    expect(magnitude({ x: 0, y: -1, z: 0.8 })).toBeGreaterThan(1);
  });
});
