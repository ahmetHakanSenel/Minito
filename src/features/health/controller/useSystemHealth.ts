import { useCallback, useRef, useState } from 'react';
import { healthRepository, type ServiceHealth } from '../../../repositories/healthRepository';

export type HealthSnapshot = {
  api: ServiceHealth;
  ai: ServiceHealth;
  checkedAt: Date;
};

export function useSystemHealth() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const inFlight = useRef(false);

  // Overlapping checks would race each other, so a refresh during a check is simply skipped.
  const refresh = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsChecking(true);
    try {
      const result = await healthRepository.checkSystemHealth();
      setSnapshot({ ...result, checkedAt: new Date() });
    } finally {
      inFlight.current = false;
      setIsChecking(false);
    }
  }, []);

  return { snapshot, isChecking, refresh };
}
