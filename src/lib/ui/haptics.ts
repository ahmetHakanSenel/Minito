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
 * One tactile vocabulary for the whole app, so the same kind of gesture always feels the same.
 */
export const haptics = {
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
