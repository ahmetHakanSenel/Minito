import { readJson, writeJson, removeJson } from './jsonStore';
import { normalizeSteps, type BreakdownStep } from '../breakdownSteps';

/**
 * Persists the in-progress focus session so that leaving the app to actually
 * DO a step (the core use case) never loses progress. Restored on relaunch.
 */

const KEY = 'active-session';

/** Sessions older than this are considered stale and discarded */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface ActiveSession {
  input: string;
  steps: BreakdownStep[];
  empathyBridge: string;
  firstStepHook: string;
  stoppingPoint?: string;
  /** Tracing id of the breakdown request, so feedback still works after a relaunch. */
  requestId?: string;
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
  // Sessions saved before structured steps hold plain strings; normalizing upgrades them in place.
  const steps = normalizeSteps(session.steps);
  if (steps.length === 0 || typeof session.currentStepIndex !== 'number') {
    await removeJson(KEY);
    return null;
  }
  if (Date.now() - (session.updatedAt ?? 0) > MAX_AGE_MS) {
    await removeJson(KEY);
    return null;
  }
  return { ...session, steps };
}

export async function clearActiveSession(): Promise<void> {
  await removeJson(KEY);
}
