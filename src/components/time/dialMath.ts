/**
 * The arithmetic behind the detent dial, kept pure so it can be tested without a renderer.
 * Every function is a worklet: the dial calls them on the UI thread, every frame.
 */

/** `value` folded into 0 … count − 1, negatives included. */
export function wrap(value: number, count: number): number {
  'worklet';
  return ((value % count) + count) % count;
}

/**
 * translateY for a strip of labels whose first row is absolute index `firstIndex`, such that the
 * value at `position` lands `offset` pixels from the top of the container.
 *
 * The position always resolves into the middle lap, [count, 2·count). When it wraps from the end
 * of one lap to the start of the next, the strip jumps by exactly one lap, onto rows carrying the
 * same labels, so the jump is invisible.
 */
export function stripTranslate(
  position: number,
  count: number,
  firstIndex: number,
  offset: number,
  rowHeight: number
): number {
  'worklet';
  const index = count + wrap(position, count) - firstIndex;
  return offset - index * rowHeight;
}

/** The detent nearest `current` that shows `value`: the dial always turns the short way round. */
export function nearestDetent(current: number, value: number, count: number): number {
  'worklet';
  const delta = wrap(value - current + count / 2, count) - count / 2;
  return Math.round(current + delta);
}

// Below this release speed (rows per second) a release is a placement, not a throw: the dial just
// falls into the nearest detent. Above it, the throw decides the direction.
export const MIN_FLING_ROWS_PER_S = 2.5;
// How far a throw carries: the distance a dial would coast in this many seconds at release speed.
export const FLING_CARRY_S = 0.18;
// A hard throw still stops within a sensible distance instead of spinning through several laps.
export const MAX_FLING_ROWS = 24;

/**
 * Where a released dial comes to rest.
 *
 * A slow release goes to the nearest detent. A throw carries on in its own direction and never
 * lands behind the point of release, because snapping backwards against the direction of motion is
 * exactly what makes a dial feel as if it could not decide where to go.
 */
export function flingTarget(position: number, velocityRowsPerS: number): number {
  'worklet';
  if (Math.abs(velocityRowsPerS) < MIN_FLING_ROWS_PER_S) {
    return Math.round(position);
  }
  const carry = Math.max(
    -MAX_FLING_ROWS,
    Math.min(MAX_FLING_ROWS, velocityRowsPerS * FLING_CARRY_S)
  );
  const landing = Math.round(position + carry);
  return velocityRowsPerS > 0
    ? Math.max(landing, Math.ceil(position))
    : Math.min(landing, Math.floor(position));
}
