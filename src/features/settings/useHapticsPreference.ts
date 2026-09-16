import { useCallback, useState } from 'react';
import { updatePreferences } from '../../lib/storage/preferencesStore';
import { haptics, isHapticsEnabled, setHapticsEnabled } from '../../lib/ui/haptics';

export function useHapticsPreference() {
  const [enabled, setEnabled] = useState(isHapticsEnabled);

  const update = useCallback(async (next: boolean) => {
    setEnabled(next);
    setHapticsEnabled(next);
    // Turning it on is confirmed the only way that makes sense: by feeling it.
    if (next) haptics.selection();
    await updatePreferences({ haptics: next });
  }, []);

  return { enabled, setEnabled: update };
}
