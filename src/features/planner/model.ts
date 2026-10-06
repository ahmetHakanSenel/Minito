/**
 * The planner's local state and the pure operations on it.
 *
 * Every record holds the state the user wants. `pending` lists the records the server has not
 * confirmed yet, so local state is always the source of truth for the screen, and the sync
 * engine only has to push what is pending and merge what the server changed.
 */

export type ProjectRecord = {
  id: string;
  title: string;
  color: string;
  /** Local calendar date, YYYY-MM-DD. */
  dueDate: string | null;
  /** When the user made this edit, by the device clock. Orders competing edits on the server. */
  clientUpdatedAt: string;
  /** Set when deleted. Kept until the server has the tombstone. */
  deletedAt: string | null;
};

export type TaskRecord = {
  id: string;
  projectId: string;
  title: string;
  isCompleted: boolean;
  position: number;
  clientUpdatedAt: string;
  deletedAt: string | null;
};

export type EntityKind = 'project' | 'task';

export type PendingChange = {
  kind: EntityKind;
  id: string;
  /** Bumped on every local edit, so a push only clears the change it actually sent. */
  version: number;
  /** Created on this device and never confirmed: deleting it needs no tombstone. */
  isNew: boolean;
};

export type PlannerState = {
  projects: Record<string, ProjectRecord>;
  tasks: Record<string, TaskRecord>;
  pending: Record<string, PendingChange>;
  /** The newest server `updated_at` seen; the next pull starts just before it. */
  cursor: string | null;
  /** Monotonic counter behind `PendingChange.version`. */
  clock: number;
  /**
   * When this device last completed a sync, by its own clock (epoch ms). Not the same thing as
   * the cursor: the cursor is the last time anything changed on the server, which can be weeks
   * ago for a planner nobody has touched, even on a device that syncs every day. Absent in
   * state saved before it existed.
   */
  lastSyncedAt?: number | null;
};

export const EMPTY_PLANNER_STATE: PlannerState = {
  projects: {},
  tasks: {},
  pending: {},
  cursor: null,
  clock: 0,
};

export const TITLE_LIMITS = { project: 200, task: 500 } as const;

const COLOR = /^#[0-9A-Fa-f]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function pendingKey(kind: EntityKind, id: string): string {
  return `${kind}:${id}`;
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

function cleanTitle(title: string, limit: number): string {
  return title.trim().replace(/\s+/g, ' ').slice(0, limit);
}

/** Records the desired state of one entity and marks it for the next push. */
function write(
  state: PlannerState,
  kind: EntityKind,
  record: ProjectRecord | TaskRecord,
  created: boolean
): PlannerState {
  const key = pendingKey(kind, record.id);
  const clock = state.clock + 1;
  const pending: PendingChange = {
    kind,
    id: record.id,
    version: clock,
    isNew: created || (state.pending[key]?.isNew ?? false),
  };
  return {
    ...state,
    clock,
    projects:
      kind === 'project'
        ? { ...state.projects, [record.id]: record as ProjectRecord }
        : state.projects,
    tasks: kind === 'task' ? { ...state.tasks, [record.id]: record as TaskRecord } : state.tasks,
    pending: { ...state.pending, [key]: pending },
  };
}

/** Deletes one entity: a tombstone if the server knows it, nothing at all if it never did. */
function remove(state: PlannerState, kind: EntityKind, id: string, now: string): PlannerState {
  const record = kind === 'project' ? state.projects[id] : state.tasks[id];
  if (!record || record.deletedAt) return state;

  const key = pendingKey(kind, id);
  if (state.pending[key]?.isNew) {
    const pending = omit(state.pending, key);
    return kind === 'project'
      ? { ...state, pending, projects: omit(state.projects, id) }
      : { ...state, pending, tasks: omit(state.tasks, id) };
  }
  return write(state, kind, { ...record, deletedAt: now, clientUpdatedAt: now }, false);
}

export type NewProject = {
  title: string;
  color: string;
  dueDate?: string | null;
  tasks: { title: string; isCompleted?: boolean }[];
};

/** Returns null when the input cannot become a valid project, so the server never rejects it. */
export function createProject(
  state: PlannerState,
  input: NewProject,
  newId: () => string,
  now: string
): { state: PlannerState; projectId: string } | null {
  const title = cleanTitle(input.title, TITLE_LIMITS.project);
  const dueDate = input.dueDate ?? null;
  if (!title || !COLOR.test(input.color) || (dueDate !== null && !DATE.test(dueDate))) {
    return null;
  }

  const projectId = newId();
  let next = write(
    state,
    'project',
    { id: projectId, title, color: input.color, dueDate, clientUpdatedAt: now, deletedAt: null },
    true
  );
  input.tasks
    .map((task) => ({ ...task, title: cleanTitle(task.title, TITLE_LIMITS.task) }))
    .filter((task) => task.title)
    .forEach((task, position) => {
      next = write(
        next,
        'task',
        {
          id: newId(),
          projectId,
          title: task.title,
          isCompleted: task.isCompleted ?? false,
          position,
          clientUpdatedAt: now,
          deletedAt: null,
        },
        true
      );
    });
  return { state: next, projectId };
}

export function setTaskCompleted(
  state: PlannerState,
  taskId: string,
  isCompleted: boolean,
  now: string
): PlannerState {
  const task = state.tasks[taskId];
  if (!task || task.deletedAt || task.isCompleted === isCompleted) return state;
  return write(state, 'task', { ...task, isCompleted, clientUpdatedAt: now }, false);
}

/** Deletes a project and its tasks. Tasks get their own tombstones for devices that sync later. */
export function deleteProject(state: PlannerState, projectId: string, now: string): PlannerState {
  let next = state;
  for (const task of Object.values(state.tasks)) {
    if (task.projectId === projectId) next = remove(next, 'task', task.id, now);
  }
  return remove(next, 'project', projectId, now);
}

// ─── Reading ────────────────────────────────────────────────────────────────────────────────────

export type PlannerTask = { id: string; title: string; isCompleted: boolean };

export type PlannerProject = {
  id: string;
  title: string;
  color: string;
  progress: number;
  dueDate?: Date;
  tasks: PlannerTask[];
};

/**
 * Percent done, where the ends mean what they say: 100 only when every task is done, 0 only when
 * none is. Plain rounding broke both: 199 of 200 rounded to 100, and 1 of 201 to 0.
 */
export function progressOf(tasks: { isCompleted: boolean }[]): number {
  const done = tasks.filter((task) => task.isCompleted).length;
  if (done === 0) return 0;
  if (done === tasks.length) return 100;
  return Math.min(99, Math.max(1, Math.round((done / tasks.length) * 100)));
}

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The projects to show: live ones only, tasks in their saved order. */
export function selectProjects(state: PlannerState): PlannerProject[] {
  const tasksByProject = new Map<string, TaskRecord[]>();
  for (const task of Object.values(state.tasks)) {
    if (task.deletedAt) continue;
    const list = tasksByProject.get(task.projectId) ?? [];
    list.push(task);
    tasksByProject.set(task.projectId, list);
  }

  return Object.values(state.projects)
    .filter((project) => !project.deletedAt)
    .map((project) => {
      const tasks = (tasksByProject.get(project.id) ?? [])
        .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
        .map(({ id, title, isCompleted }) => ({ id, title, isCompleted }));
      return {
        id: project.id,
        title: project.title,
        color: project.color,
        dueDate: project.dueDate ? localDate(project.dueDate) : undefined,
        progress: progressOf(tasks),
        tasks,
      };
    });
}

export function projectIdOfTask(state: PlannerState, taskId: string): string | undefined {
  return state.tasks[taskId]?.projectId;
}
