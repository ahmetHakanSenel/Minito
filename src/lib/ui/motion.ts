/**
 * The app's spring vocabulary, so the same kind of movement always feels the same.
 *
 * Every config names its `mass`. Reanimated 4 merges a partial config over its own defaults, whose
 * mass is 4, not the 1 most examples assume: `{ damping: 15, stiffness: 300 }` then has a damping
 * ratio of 0.22, overshoots by half its travel and keeps wobbling for two seconds. With mass 1
 * spelled out, the numbers below mean what they say.
 *
 * Damping ratio ζ = damping / (2·√(stiffness·mass)); below 1 the spring overshoots, at 1 it does not.
 */

/**
 * A button giving under a finger and coming back. It happens on every tap, so it is quick and does
 * not bounce: ζ ≈ 0.87, 90 % of the way in ~110 ms, settled in ~150 ms, 0.4 % overshoot.
 */
export const PRESS_SPRING = { damping: 52, stiffness: 900, mass: 1 } as const;

/**
 * Something arriving and coming to rest: a dialog, a glow. ζ ≈ 0.81, settled in ~220 ms with a
 * barely visible 1.3 % overshoot, inside the 200–300 ms a modal should take.
 */
export const SETTLE_SPRING = { damping: 28, stiffness: 300, mass: 1 } as const;
