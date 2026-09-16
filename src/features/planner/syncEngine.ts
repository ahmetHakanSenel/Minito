import {
  pendingKey,
  type EntityKind,
  type PlannerState,
  type ProjectRecord,
  type TaskRecord,
} from './model';

/**
 * Push, then pull.
 *
 * Push sends every pending record as a whole-row upsert, projects before tasks (a task needs its
 * project). A change is cleared only if it was not edited again while the push was in flight.
 *
 * Pull asks for rows the server changed since just before the cursor. The overlap covers
 * transactions that committed after the last pull with an earlier timestamp; merging the same
 * row twice is harmless. A row with a pending local change is skipped: the local edit is newer
 * and is on its way up.
 */

export type RemoteRow<T> = T & { updatedAt: string };

export type PullResult = {
  projects: RemoteRow<ProjectRecord>[];
  tasks: RemoteRow<TaskRecord>[];
};

/**
 * A failed remote call. `permanent` means retrying the same rows cannot succeed (a constraint or
 * a permission rejected them); anything else (network, timeout, 5xx) is worth a retry.
 */
export class RemoteError extends Error {
  constructor(
    message: string,
    readonly permanent: boolean
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

export interface PlannerRemote {
  pushProjects(rows: ProjectRecord[]): Promise<void>;
  pushTasks(rows: TaskRecord[]): Promise<void>;
  pull(since: string | null): Promise<PullResult>;
}

export interface StateStore {
  get(): PlannerState;
  update(change: (state: PlannerState) => PlannerState): void;
}

export type SyncOutcome =
  | { status: 'synced'; pushed: number; pulled: number; rejected: number }
  | { status: 'retry'; reason: string };

export const PUSH_BATCH_SIZE = 100;
export const PULL_OVERLAP_MS = 60_000;

type Sent = { kind: EntityKind; id: string; version: number };

function batches<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/**
 * Pushes one kind of record. A batch the server rejects is retried row by row, so one bad row
 * cannot block every change behind it: the rows that still fail are reported as rejected and
 * dropped from the queue.
 */
async function pushKind<T extends { id: string }>(
  records: T[],
  send: (rows: T[]) => Promise<void>
): Promise<{ confirmed: T[]; rejected: T[] }> {
  const confirmed: T[] = [];
  const rejected: T[] = [];
  for (const batch of batches(records, PUSH_BATCH_SIZE)) {
    try {
      await send(batch);
      confirmed.push(...batch);
    } catch (error) {
      if (!(error instanceof RemoteError) || !error.permanent) throw error;
      for (const row of batch) {
        try {
          await send([row]);
          confirmed.push(row);
        } catch (rowError) {
          if (!(rowError instanceof RemoteError) || !rowError.permanent) throw rowError;
          rejected.push(row);
        }
      }
    }
  }
  return { confirmed, rejected };
}

/** Clears the pending changes that were sent and not edited since; forgets confirmed tombstones. */
function settle(state: PlannerState, sent: Sent[]): PlannerState {
  const pending = { ...state.pending };
  const projects = { ...state.projects };
  const tasks = { ...state.tasks };

  for (const { kind, id, version } of sent) {
    const key = pendingKey(kind, id);
    if (pending[key]?.version !== version) continue;
    delete pending[key];
    const collection = kind === 'project' ? projects : tasks;
    if (collection[id]?.deletedAt) delete collection[id];
  }
  return { ...state, pending, projects, tasks };
}

function strip<T>(row: RemoteRow<T>): T {
  const record: Partial<RemoteRow<T>> = { ...row };
  delete record.updatedAt;
  return record as T;
}

/** Applies what the server changed, except where a local edit is still on its way up. */
export function mergePull(state: PlannerState, pulled: PullResult): PlannerState {
  const projects = { ...state.projects };
  const tasks = { ...state.tasks };
  let cursor = state.cursor;

  const apply = <T extends { id: string; deletedAt: string | null }>(
    kind: EntityKind,
    rows: RemoteRow<T>[],
    collection: Record<string, T>
  ) => {
    for (const row of rows) {
      if (!cursor || Date.parse(row.updatedAt) > Date.parse(cursor)) cursor = row.updatedAt;
      if (state.pending[pendingKey(kind, row.id)]) continue;
      if (row.deletedAt) delete collection[row.id];
      else collection[row.id] = strip(row);
    }
  };

  apply('project', pulled.projects, projects);
  apply('task', pulled.tasks, tasks);
  return { ...state, projects, tasks, cursor };
}

export function pullSince(cursor: string | null): string | null {
  return cursor ? new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString() : null;
}

export async function syncOnce(
  store: StateStore,
  remote: PlannerRemote,
  onRejected: (kind: EntityKind, id: string) => void = () => {}
): Promise<SyncOutcome> {
  const snapshot = store.get();
  const pendingOf = (kind: EntityKind) =>
    Object.values(snapshot.pending).filter((change) => change.kind === kind);

  const projectRows = pendingOf('project')
    .map((change) => snapshot.projects[change.id])
    .filter((row): row is ProjectRecord => Boolean(row));
  const taskRows = pendingOf('task')
    .map((change) => snapshot.tasks[change.id])
    .filter((row): row is TaskRecord => Boolean(row));
  const versionOf = (kind: EntityKind, id: string) =>
    snapshot.pending[pendingKey(kind, id)]?.version ?? -1;

  let pushed = 0;
  let rejectedCount = 0;
  const pushAndSettle = async <T extends { id: string }>(
    kind: EntityKind,
    rows: T[],
    send: (batch: T[]) => Promise<void>
  ) => {
    const { confirmed, rejected } = await pushKind(rows, send);
    // Rejected rows leave the queue too: retrying them could only fail again.
    const sent = [...confirmed, ...rejected].map((row) => ({
      kind,
      id: row.id,
      version: versionOf(kind, row.id),
    }));
    store.update((state) => settle(state, sent));
    rejected.forEach((row) => onRejected(kind, row.id));
    pushed += confirmed.length;
    rejectedCount += rejected.length;
  };

  try {
    // Projects first: a task's foreign key needs its project on the server.
    await pushAndSettle('project', projectRows, (batch) => remote.pushProjects(batch));
    await pushAndSettle('task', taskRows, (batch) => remote.pushTasks(batch));

    const pulled = await remote.pull(pullSince(store.get().cursor));
    store.update((state) => mergePull(state, pulled));
    return {
      status: 'synced',
      pushed,
      pulled: pulled.projects.length + pulled.tasks.length,
      rejected: rejectedCount,
    };
  } catch (error) {
    return { status: 'retry', reason: error instanceof Error ? error.message : String(error) };
  }
}

const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 5 * 60_000;

/**
 * Exponential backoff with "equal jitter" (half fixed, half random), so a device retries soon enough
 * to feel responsive while many devices recovering at once still spread out.
 */
export function retryDelay(failures: number, random: () => number = Math.random): number {
  const ceiling = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, failures - 1));
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}
