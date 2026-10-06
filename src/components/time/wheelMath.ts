/**
 * The arithmetic behind the wheel, kept pure so it can be tested without a renderer.
 * The wheel itself is a snapping scroll view; these turn a scroll offset into a value and back.
 */

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Scroll offset that puts `index` in the window. */
export function offsetForIndex(index: number, rowHeight: number): number {
  return index * rowHeight;
}

/** The value a scroll offset rests on, clamped to the available values. */
export function indexFromOffset(offset: number, rowHeight: number, count: number): number {
  return clamp(Math.round(offset / rowHeight), 0, count - 1);
}

/**
 * How a row looks at `distance` rows from the window. The selected row is full size and opaque;
 * its neighbours fall away, which is what makes a flat list read as a wheel.
 */
export function rowAppearance(distance: number): { opacity: number; scale: number } {
  'worklet';
  const away = Math.min(Math.abs(distance), 3);
  return {
    opacity: 1 - away * 0.26,
    scale: 1 - away * 0.09,
  };
}
