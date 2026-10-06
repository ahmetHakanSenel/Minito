/**
 * Which dialog is on screen, and what happens to the ones behind it.
 *
 * Separate from the component so the rule can be tested without a renderer: only one dialog is
 * ever visible, a second request waits rather than replacing it, and every request is answered
 * exactly once, because each one has a caller waiting on a promise.
 */

export type DialogRequest = {
  title: string;
  message?: string;
  /** The affirmative button. Defaults to "OK". */
  confirmLabel?: string;
  /** Omit for a single-button dialog, which is a statement rather than a question. */
  cancelLabel?: string;
  /** Paints the confirm button as a warning, for anything that destroys something. */
  destructive?: boolean;
};

export type PendingDialog = DialogRequest & {
  id: number;
  resolve: (confirmed: boolean) => void;
};

export function enqueue(queue: PendingDialog[], request: PendingDialog): PendingDialog[] {
  return [...queue, request];
}

/** Answers the dialog on screen and hands back the queue with the next one at its head. */
export function dismiss(queue: PendingDialog[], confirmed: boolean): PendingDialog[] {
  const [open, ...rest] = queue;
  open?.resolve(confirmed);
  return rest;
}

export function current(queue: PendingDialog[]): PendingDialog | null {
  return queue[0] ?? null;
}
