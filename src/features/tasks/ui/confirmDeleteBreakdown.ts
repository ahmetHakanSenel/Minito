import { Alert } from 'react-native';
import type { TFunction } from 'i18next';
import { haptics } from '../../../lib/ui/haptics';

/** One confirmation for deleting a breakdown, wherever the list is shown. */
export function confirmDeleteBreakdown(t: TFunction, remove: () => Promise<void>): void {
  haptics.warning();
  Alert.alert(t('tasks.deleteTitle'), t('tasks.deleteMessage'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('common.delete'),
      style: 'destructive',
      onPress: () => {
        remove().catch(() => {
          haptics.error();
          Alert.alert(t('common.error'), t('tasks.deleteFailed'));
        });
      },
    },
  ]);
}
