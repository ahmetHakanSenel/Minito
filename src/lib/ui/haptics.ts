import { Platform } from 'react-native';
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

// On Android, expo-haptics' selection feedback is a long, faint pulse (50 ms at amplitude 30):
// stacked by a turning dial it reads as a buzz. Its medium impact is shorter and firmer (43 ms at
// amplitude 50), so it lands as a distinct click, and it still ends well inside the dial's 90 ms
// gap between ticks. A raw vibration shorter than that is not a fix: many motors cannot spin up in
// ~10 ms, and the tick is simply not felt.

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
      Platform.OS === 'android'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Haptics.selectionAsync()
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
