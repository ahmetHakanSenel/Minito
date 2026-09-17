/**
 * Deciding, from the accelerometer, whether the phone has been picked up.
 *
 * A phone lying still reads 1 g whichever way it faces: turning it from portrait to landscape
 * moves gravity onto another axis without changing its magnitude. The deviation from 1 g is
 * therefore a measure of handling, not of orientation.
 *
 * What separates handling from a nudge is duration, not force. Turning the phone over, or
 * sliding it to the other side of the desk, is about a second of movement that ends in
 * stillness. A phone that has been picked up is never still, because a hand is never still. So
 * this integrates rather than thresholds: motion has to persist before it counts, and a short
 * burst drains away without ever reaching the mark.
 *
 * Kept apart from the screen so the rule can be tested against a stream of samples instead of
 * being judged by waving a phone around.
 */

/** Deviation from 1 g above which the phone is considered to be moving at all. */
export const MOTION_THRESHOLD_G = 0.16;
/**
 * How much motion has to add up before it counts as a pickup. It is a budget, not a stopwatch:
 * stillness pays some of it back (see MOTION_DECAY_RATE), so a single burst can never reach it
 * however hard the phone is shoved, while a phone being used reaches it within a few seconds.
 */
export const MOTION_BUDGET_MS = 2_500;
/**
 * How fast stillness pays the budget back, relative to how fast motion spends it. Below 1, so
 * a held phone that goes quiet for a moment — the hand steadying, a pause mid-scroll — does not
 * lose everything it has accumulated. Above 0, so a rotation and a nudge minutes apart never
 * add up to a pickup between them.
 */
export const MOTION_DECAY_RATE = 0.5;
/**
 * A sample gap longer than this is the sensor being throttled, not the phone being handled for
 * that whole time. Clamping keeps a backgrounded stream from arriving as one large jump.
 */
export const MAX_SAMPLE_GAP_MS = 500;

export type PickupDetector = {
  /**
   * Feeds one accelerometer sample, in g, with the time it arrived.
   * Returns true exactly once per spell of handling, at the moment it becomes one.
   */
  sample: (magnitudeG: number, atMs: number) => boolean;
};

export function createPickupDetector(startedAtMs: number): PickupDetector {
  let lastAt = startedAtMs;
  let motionMs = 0;
  // A spell of handling counts once. The phone has to come to rest before the next one.
  let counted = false;

  return {
    sample(magnitudeG, atMs) {
      const elapsed = Math.min(Math.max(atMs - lastAt, 0), MAX_SAMPLE_GAP_MS);
      lastAt = atMs;

      const moving = Math.abs(magnitudeG - 1) >= MOTION_THRESHOLD_G;
      motionMs = moving
        ? Math.min(motionMs + elapsed, MOTION_BUDGET_MS)
        : Math.max(0, motionMs - elapsed * MOTION_DECAY_RATE);

      // Back on the table: whatever comes next is a new pickup.
      if (motionMs === 0) counted = false;

      if (counted || motionMs < MOTION_BUDGET_MS) return false;
      counted = true;
      return true;
    },
  };
}

/** The magnitude of an accelerometer reading, in g. */
export function magnitude({ x, y, z }: { x: number; y: number; z: number }): number {
  return Math.sqrt(x * x + y * y + z * z);
}
