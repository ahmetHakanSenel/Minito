import type { TFunction } from 'i18next';
import type { useDialog } from '../../../components/feedback/Dialog';

type Dialog = ReturnType<typeof useDialog>;

/**
 * Asks before a breakdown is deleted, and reports it if the delete then fails.
 *
 * Shared by the home screen and the history screen, which is the whole reason it is a function:
 * the question and its wording must be the same in both.
 */
export async function confirmDeleteBreakdown(
  t: TFunction,
  dialog: Dialog,
  remove: () => Promise<unknown>
): Promise<void> {
  const confirmed = await dialog.confirm({
    title: t('tasks.deleteTitle'),
    message: t('tasks.deleteMessage'),
    confirmLabel: t('common.delete'),
    cancelLabel: t('common.cancel'),
    destructive: true,
  });
  if (!confirmed) return;

  try {
    await remove();
  } catch {
    await dialog.alert({ title: t('common.error'), message: t('tasks.deleteFailed') });
  }
}
