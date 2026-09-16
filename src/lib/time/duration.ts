/**
 * Durations are stored and passed around as whole seconds; these helpers are the only place
 * that splits them into the hours / minutes / seconds a person reads and sets.
 */

export type DurationParts = { hours: number; minutes: number; seconds: number };

export function splitDuration(totalSeconds: number): DurationParts {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor((safe % 3600) / 60),
    seconds: safe % 60,
  };
}

export function joinDuration({ hours, minutes, seconds }: DurationParts): number {
  return hours * 3600 + minutes * 60 + seconds;
}

const pad = (value: number) => value.toString().padStart(2, '0');

/** "04:05" under an hour, "1:04:05" from an hour up: the leading field never wastes space. */
export function formatCountdown(totalSeconds: number): string {
  const { hours, minutes, seconds } = splitDuration(totalSeconds);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function formatWallClock(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
