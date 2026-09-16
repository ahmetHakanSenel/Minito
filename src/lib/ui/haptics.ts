import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

let enabled = true;

/** Applied app-wide from the saved preference; every vibration in the app goes through here. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

// Takes a thunk, not a promise: a promise would already have vibrated by the time the switch is
// checked. Platforms without a haptic engine reject, which is harmless.
function fire(feedback: () => Promise<void> | void): void {
  if (!enabled) return;
  try {
    Promise.resolve(feedback()).catch(() => {});
  } catch {
    // A vibrator that throws synchronously is as harmless as one that rejects.
  }
}

// On Android, expo-haptics' selection feedback is a 50 ms pulse at low amplitude. One of them is
// fine; a dial passing values every few tens of milliseconds stacks them into a continuous buzz.
// A detent needs a pulse short enough to end before the next one starts.
const ANDROID_TICK_MS = 12;

/**
 * One tactile vocabulary for the whole app, so the same kind of gesture always feels the same.
 *
 * Everything goes through the vibration motor rather than Android's view haptic constants: those
 * obey the system-wide touch-feedback setting, which many phones ship switched off, and then the
 * app would feel nothing at all.
 */
export const haptics = {
  /** A detent on a dial: the shortest, sharpest click, made to be felt many times in a row. */
  tick: () =>
    fire(() =>
      Platform.OS === 'android' ? Vibration.vibrate(ANDROID_TICK_MS) : Haptics.selectionAsync()
    ),
  /** Scrolling, toggling a choice, moving focus. */
  selection: () => fire(() => Haptics.selectionAsync()),
  /** Secondary taps: back, dismiss, open a sheet. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Primary actions: submit, resume, confirm. */
  press: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** The heavy thud reserved for committing to something: an AI breakdown, a session start. */
  commit: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
