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
function fire(feedback: () => Promise<void>): void {
  if (!enabled) return;
  feedback().catch(() => {});
}

/**
 * On Android, expo-haptics' impact / selection / notification calls are imitated with the
 * vibration motor, which is what makes them feel like a buzz. The platform haptic constants go
 * through the haptic engine instead and produce a crisp click, so Android uses those.
 */
function feel(ios: () => Promise<void>, android: Haptics.AndroidHaptics): void {
  fire(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(android) : ios()));
}

const { AndroidHaptics, ImpactFeedbackStyle, NotificationFeedbackType } = Haptics;

/**
 * One tactile vocabulary for the whole app, so the same kind of gesture always feels the same.
 */
export const haptics = {
  /** A detent on a dial: the lightest, sharpest click, made to be felt many times in a row. */
  tick: () => feel(() => Haptics.selectionAsync(), AndroidHaptics.Clock_Tick),
  /** Scrolling, toggling a choice, moving focus. */
  selection: () => feel(() => Haptics.selectionAsync(), AndroidHaptics.Segment_Tick),
  /** Secondary taps: back, dismiss, open a sheet. */
  tap: () => feel(() => Haptics.impactAsync(ImpactFeedbackStyle.Light), AndroidHaptics.Virtual_Key),
  /** Primary actions: submit, resume, confirm. */
  press: () =>
    feel(() => Haptics.impactAsync(ImpactFeedbackStyle.Medium), AndroidHaptics.Context_Click),
  /** The heavy thud reserved for committing to something: an AI breakdown, a session start. */
  commit: () =>
    feel(() => Haptics.impactAsync(ImpactFeedbackStyle.Heavy), AndroidHaptics.Long_Press),
  success: () =>
    feel(() => Haptics.notificationAsync(NotificationFeedbackType.Success), AndroidHaptics.Confirm),
  warning: () =>
    feel(
      () => Haptics.notificationAsync(NotificationFeedbackType.Warning),
      AndroidHaptics.Long_Press
    ),
  error: () =>
    feel(() => Haptics.notificationAsync(NotificationFeedbackType.Error), AndroidHaptics.Reject),
};
