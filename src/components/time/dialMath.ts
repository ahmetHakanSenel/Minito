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
