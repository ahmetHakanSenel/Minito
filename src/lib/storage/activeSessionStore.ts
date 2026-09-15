import { readJson, writeJson, removeJson } from './jsonStore';

/**
 * Persists the in-progress focus session so that leaving the app to actually
 * DO a step (the core use case) never loses progress. Restored on relaunch.
 */

const KEY = 'active-session';

/** Sessions older than this are considered stale and discarded */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ActiveSession {
  input: string;
  steps: string[];
  empathyBridge: string;
  firstStepHook: string;
  currentStepIndex: number;
  completedSteps: number[];
  taskId?: string;
  updatedAt: number;
}

export async function saveActiveSession(session: Omit<ActiveSession, 'updatedAt'>): Promise<void> {
  await writeJson(KEY, { ...session, updatedAt: Date.now() });
}

export async function loadActiveSession(): Promise<ActiveSession | null> {
  const session = await readJson<ActiveSession>(KEY);
  if (!session) return null;
  if (
    !Array.isArray(session.steps) ||
    session.steps.length === 0 ||
    typeof session.currentStepIndex !== 'number'
  ) {
    await removeJson(KEY);
    return null;
  }
  if (Date.now() - (session.updatedAt ?? 0) > MAX_AGE_MS) {
    await removeJson(KEY);
    return null;
  }
  return session;
}

export async function clearActiveSession(): Promise<void> {
  await removeJson(KEY);
}
