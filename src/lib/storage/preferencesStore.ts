import { readJson, writeJson } from './jsonStore';

/**
 * Device-local preferences. They describe how this phone should behave, not who the user is, so
 * they stay on the device rather than syncing with the account.
 */
export type Preferences = {
  /** Vibration on taps, wheels and timers. Some people find it distracting rather than helpful. */
  haptics: boolean;
};

const KEY = 'preferences';

export const DEFAULT_PREFERENCES: Preferences = { haptics: true };

export async function loadPreferences(): Promise<Preferences> {
  const stored = await readJson<Partial<Preferences>>(KEY);
  // Merged over the defaults, so a preference added later has a value on existing installs.
  return { ...DEFAULT_PREFERENCES, ...(stored ?? {}) };
}

export async function updatePreferences(changes: Partial<Preferences>): Promise<Preferences> {
  const next = { ...(await loadPreferences()), ...changes };
  await writeJson(KEY, next);
  return next;
}
