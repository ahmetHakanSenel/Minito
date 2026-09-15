import * as Haptics from 'expo-haptics';

// Haptics are fire-and-forget; platforms without a haptic engine reject, which is harmless.
function fire(feedback: Promise<void>): void {
  feedback.catch(() => {});
}

/**
 * One tactile vocabulary for the whole app, so the same kind of gesture always feels the same.
 */
export const haptics = {
  /** Scrolling, toggling a choice, moving focus. */
  selection: () => fire(Haptics.selectionAsync()),
  /** Secondary taps: back, dismiss, open a sheet. */
  tap: () => fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Primary actions: submit, resume, confirm. */
  press: () => fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** The one heavy thud reserved for kicking off an AI breakdown. */
  commit: () => fire(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
