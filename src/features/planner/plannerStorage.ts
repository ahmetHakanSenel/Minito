import { readJson, removeJson, writeJson } from '../../lib/storage/jsonStore';
import { createProject, EMPTY_PLANNER_STATE, type PlannerState } from './model';

/**
 * The planner's state on disk, one file per account, so a second account on the same device
 * never sees the first one's projects.
 */

const LEGACY_KEY = 'projects';

function keyFor(userId: string): string {
  return `planner-${userId}`;
}

function isPlannerState(value: unknown): value is PlannerState {
  const state = value as PlannerState | null;
  return (
    typeof state === 'object' &&
    state !== null &&
    typeof state.projects === 'object' &&
    typeof state.tasks === 'object' &&
    typeof state.pending === 'object' &&
    typeof state.clock === 'number'
  );
}

/** How projects were stored before sync existed. */
type LegacyProject = {
  id?: unknown;
  title?: unknown;
  color?: unknown;
  dueDate?: unknown;
  tasks?: { title?: unknown; isCompleted?: unknown }[];
};

function toLocalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Adopts projects created before sync, with fresh ids, as pending changes. Development sample
 * data (ids starting with "seed-") is left behind so it never reaches a real account.
 */
export function importLegacyProjects(
  state: PlannerState,
  legacy: LegacyProject[],
  newId: () => string,
  now: string
): PlannerState {
  let next = state;
  for (const project of legacy) {
    if (typeof project?.id === 'string' && project.id.startsWith('seed-')) continue;
    if (typeof project?.title !== 'string' || typeof project.color !== 'string') continue;
    const created = createProject(
      next,
      {
        title: project.title,
        color: project.color,
        dueDate: toLocalDate(project.dueDate),
        tasks: (Array.isArray(project.tasks) ? project.tasks : [])
          .filter((task) => typeof task?.title === 'string')
          .map((task) => ({ title: task.title as string, isCompleted: task.isCompleted === true })),
      },
      newId,
      now
    );
    if (created) next = created.state;
  }
  return next;
}

/**
 * The saved state for this account. On an account's first run, projects from before sync are
 * adopted into it; `hadLegacy` tells the caller to retire the old file once the new one is saved.
 */
export async function loadPlannerState(
  userId: string,
  newId: () => string
): Promise<{ state: PlannerState; hadLegacy: boolean }> {
  const stored = await readJson<unknown>(keyFor(userId));
  if (isPlannerState(stored)) return { state: stored, hadLegacy: false };

  const legacy = await readJson<unknown>(LEGACY_KEY);
  if (!Array.isArray(legacy)) return { state: EMPTY_PLANNER_STATE, hadLegacy: false };
  return {
    state: importLegacyProjects(EMPTY_PLANNER_STATE, legacy, newId, new Date().toISOString()),
    hadLegacy: true,
  };
}

export function retireLegacyProjects(): Promise<void> {
  return removeJson(LEGACY_KEY);
}

/**
 * Saves state in order. Writes that queue up behind a slow one collapse into the latest state,
 * so a burst of edits costs one write, never a stale one written last.
 */
export function createPlannerPersister(userId: string) {
  let latest: PlannerState | null = null;
  let writing: Promise<void> | null = null;

  const drain = async () => {
    while (latest) {
      const state = latest;
      latest = null;
      await writeJson(keyFor(userId), state);
    }
    writing = null;
  };

  return {
    save(state: PlannerState): Promise<void> {
      latest = state;
      writing ??= drain();
      return writing;
    },
  };
}

export function clearPlannerState(userId: string): Promise<void> {
  return removeJson(keyFor(userId));
}
