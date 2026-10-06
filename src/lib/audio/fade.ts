/**
 * Volume ramps for the ambience.
 *
 * Sound that stops dead is startling, and startling someone is the last thing an app meant to
 * hold their attention should do. Everything that starts or stops a track goes through a ramp:
 * a session ending, a pause, a change of track.
 *
 * expo-audio has no fade of its own, so the ramp is driven from JavaScript by writing `volume`
 * on a short interval. The arithmetic lives here, away from the player, so the curve can be
 * checked without making a sound.
 */

/** Coming in: short enough that starting a track still feels immediate. */
export const FADE_IN_MS = 800;
/** Going out: long enough to read as an ending rather than a cut. */
export const FADE_OUT_MS = 1_500;
/** Swapping one track for another, where a long fade would feel like the app had missed the tap. */
export const FADE_SWITCH_MS = 450;
/**
 * 25 steps a second. Finer than the ear notices a step at these durations, and coarse enough
 * that the ramp costs nothing next to decoding the audio itself.
 */
export const FADE_STEP_MS = 40;

/**
 * Where the ramp is, as a fraction of its full volume, `progress` of the way through.
 *
 * Squared rather than linear. Loudness as heard grows far more slowly than amplitude, so a
 * straight line from 1 to 0 empties most of its audible range in the first third and then
 * appears to hang at the bottom. Squaring takes the amplitude down faster where the ear is
 * least sensitive, which is what makes the fade sound even.
 */
export function fadeCurve(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return clamped * clamped;
}

/** The volume to write `elapsedMs` into a ramp from `from` to `to`. */
export function volumeAt(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  const progress = Math.max(0, elapsedMs) / durationMs;
  // The curve always describes the journey away from silence, so a fade-out is the same shape
  // as a fade-in read backwards, rather than a different, quieter-sounding one.
  const shaped = from > to ? fadeCurve(1 - progress) : fadeCurve(progress);
  const [low, high] = from > to ? [to, from] : [from, to];
  return low + (high - low) * shaped;
}
