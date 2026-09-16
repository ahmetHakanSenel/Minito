import {
  createProject,
  deleteProject,
  EMPTY_PLANNER_STATE,
  pendingKey,
  selectProjects,
  setTaskCompleted,
  type PlannerState,
  type ProjectRecord,
  type TaskRecord,
} from '../model';
import {
  mergePull,
  PULL_OVERLAP_MS,
  pullSince,
  PUSH_BATCH_SIZE,
  RemoteError,
  retryDelay,
  syncOnce,
  type PlannerRemote,
  type PullResult,
} from '../syncEngine';

const T0 = '2026-09-16T10:00:00.000Z';
const T1 = '2026-09-16T11:00:00.000Z';

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

function withProject(taskTitles = ['First', 'Second']): { state: PlannerState; projectId: string } {
  const created = createProject(
    EMPTY_PLANNER_STATE,
    { title: 'Thesis', color: '#8B5CF6', tasks: taskTitles.map((title) => ({ title })) },
    ids(),
    T0
  );
  if (!created) throw new Error('fixture failed');
  return created;
}

/** An in-memory store, the way the provider wires it. */
function storeOf(initial: PlannerState) {
  let state = initial;
  return {
    get: () => state,
    update: (change: (current: PlannerState) => PlannerState) => {
      state = change(state);
    },
  };
}

function fakeRemote(overrides: Partial<PlannerRemote> = {}) {
  const pushed: { projects: ProjectRecord[][]; tasks: TaskRecord[][] } = {
    projects: [],
    tasks: [],
  };
  const pulls: (string | null)[] = [];
  const remote: PlannerRemote = {
    pushProjects: jest.fn(async (rows: ProjectRecord[]) => {
      pushed.projects.push(rows);
    }),
    pushTasks: jest.fn(async (rows: TaskRecord[]) => {
      pushed.tasks.push(rows);
    }),
    pull: jest.fn(async (since: string | null): Promise<PullResult> => {
      pulls.push(since);
      return { projects: [], tasks: [] };
    }),
    ...overrides,
  };
  return { remote, pushed, pulls };
}

describe('planner model', () => {
  it('creates a project with ordered tasks, all pending as new', () => {
    const { state, projectId } = withProject();

    expect(selectProjects(state)).toEqual([
      {
        id: projectId,
        title: 'Thesis',
        color: '#8B5CF6',
        dueDate: undefined,
        progress: 0,
        tasks: [
          { id: 'id-2', title: 'First', isCompleted: false },
          { id: 'id-3', title: 'Second', isCompleted: false },
        ],
      },
    ]);
    expect(Object.values(state.pending).every((change) => change.isNew)).toBe(true);
  });

  it('refuses input the server would reject', () => {
    const make = (title: string, color: string, dueDate?: string) =>
      createProject(EMPTY_PLANNER_STATE, { title, color, dueDate, tasks: [] }, ids(), T0);

    expect(make('   ', '#8B5CF6')).toBeNull();
    expect(make('Thesis', 'purple')).toBeNull();
    expect(make('Thesis', '#8B5CF6', '16/09/2026')).toBeNull();
    expect(make('x'.repeat(300), '#8B5CF6')?.state.projects['id-1'].title).toHaveLength(200);
  });

  it('computes progress and keeps the due date on the local calendar day', () => {
    const created = createProject(
      EMPTY_PLANNER_STATE,
      { title: 'Trip', color: '#34D399', dueDate: '2026-12-31', tasks: [{ title: 'Pack' }] },
      ids(),
      T0
    )!;
    const done = setTaskCompleted(created.state, 'id-2', true, T1);
    const [project] = selectProjects(done);

    expect(project.progress).toBe(100);
    expect(project.dueDate?.getFullYear()).toBe(2026);
    expect(project.dueDate?.getMonth()).toBe(11);
    expect(project.dueDate?.getDate()).toBe(31);
  });

  it('forgets a project deleted before it ever reached the server', () => {
    const { state, projectId } = withProject();
    const deleted = deleteProject(state, projectId, T1);

    expect(deleted.projects).toEqual({});
    expect(deleted.tasks).toEqual({});
    expect(deleted.pending).toEqual({});
  });

  it('tombstones a synced project and its tasks, so other devices learn about it', () => {
    const { state, projectId } = withProject(['Only']);
    const synced = { ...state, pending: {} };
    const deleted = deleteProject(synced, projectId, T1);

    expect(selectProjects(deleted)).toEqual([]);
    expect(deleted.projects[projectId].deletedAt).toBe(T1);
    expect(deleted.tasks['id-2'].deletedAt).toBe(T1);
    expect(Object.keys(deleted.pending).sort()).toEqual([
      pendingKey('project', projectId),
      pendingKey('task', 'id-2'),
    ]);
  });

  it('does not create a pending change for an edit that changes nothing', () => {
    const { state } = withProject();
    expect(setTaskCompleted(state, 'id-2', false, T1)).toBe(state);
    expect(setTaskCompleted(state, 'missing', true, T1)).toBe(state);
  });
});

describe('syncOnce', () => {
  it('pushes projects before tasks, clears what it sent, then pulls from the start', async () => {
    const { state } = withProject();
    const store = storeOf(state);
    const order: string[] = [];
    const { remote, pulls } = fakeRemote({
      pushProjects: jest.fn(async () => {
        order.push('projects');
      }),
      pushTasks: jest.fn(async () => {
        order.push('tasks');
      }),
    });

    await expect(syncOnce(store, remote)).resolves.toEqual({
      status: 'synced',
      pushed: 3,
      pulled: 0,
      rejected: 0,
    });
    expect(order).toEqual(['projects', 'tasks']);
    expect(store.get().pending).toEqual({});
    expect(pulls).toEqual([null]);
  });

  it('keeps a change that was edited again while its push was in flight', async () => {
    const { state } = withProject(['Only']);
    const store = storeOf(state);
    const { remote } = fakeRemote({
      pushTasks: jest.fn(async () => {
        // The user ticks the task while the request is on the wire.
        store.update((current) => setTaskCompleted(current, 'id-2', true, T1));
      }),
    });

    await syncOnce(store, remote);

    expect(Object.keys(store.get().pending)).toEqual([pendingKey('task', 'id-2')]);
    expect(store.get().tasks['id-2'].isCompleted).toBe(true);
  });

  it('drops a confirmed tombstone from local state', async () => {
    const { state, projectId } = withProject([]);
    const store = storeOf(deleteProject({ ...state, pending: {} }, projectId, T1));

    await syncOnce(store, fakeRemote().remote);

    expect(store.get().projects).toEqual({});
    expect(store.get().pending).toEqual({});
  });

  it('keeps everything pending and asks for a retry when the network fails', async () => {
    const { state } = withProject();
    const store = storeOf(state);
    const { remote } = fakeRemote({
      pushProjects: jest.fn(async () => {
        throw new RemoteError('network: Network request failed', false);
      }),
    });

    await expect(syncOnce(store, remote)).resolves.toEqual({
      status: 'retry',
      reason: 'network: Network request failed',
    });
    expect(store.get().pending).toEqual(state.pending);
    expect(remote.pushTasks).not.toHaveBeenCalled();
    expect(remote.pull).not.toHaveBeenCalled();
  });

  it('isolates a row the server rejects, so it cannot block the rest', async () => {
    const created = createProject(
      EMPTY_PLANNER_STATE,
      {
        title: 'Big',
        color: '#8B5CF6',
        tasks: [{ title: 'Good' }, { title: 'Bad' }, { title: 'Fine' }],
      },
      ids(),
      T0
    )!;
    const store = storeOf(created.state);
    const rejectedRows: string[] = [];
    const { remote } = fakeRemote({
      pushTasks: jest.fn(async (rows: TaskRecord[]) => {
        if (rows.some((row) => row.title === 'Bad')) {
          throw new RemoteError('23514: check constraint', true);
        }
      }),
    });

    const outcome = await syncOnce(store, remote, (_kind, id) => rejectedRows.push(id));

    expect(outcome).toMatchObject({ status: 'synced', pushed: 3, rejected: 1 });
    expect(rejectedRows).toEqual(['id-3']);
    expect(store.get().pending).toEqual({});
    // The rejected row stays visible on this device rather than silently vanishing.
    expect(store.get().tasks['id-3'].title).toBe('Bad');
  });

  it('pushes large queues in bounded batches', async () => {
    const titles = Array.from({ length: PUSH_BATCH_SIZE + 5 }, (_, i) => `Step ${i}`);
    const store = storeOf(withProject(titles).state);
    const { remote, pushed } = fakeRemote();

    await syncOnce(store, remote);

    expect(pushed.tasks.map((batch) => batch.length)).toEqual([PUSH_BATCH_SIZE, 5]);
  });

  it('pulls from just before the cursor, and moves the cursor to the newest row', async () => {
    const cursor = '2026-09-16T12:00:00.000+00:00';
    const store = storeOf({ ...EMPTY_PLANNER_STATE, cursor });
    const newest = '2026-09-16T12:05:00.123456+00:00';
    const { remote, pulls } = fakeRemote({
      pull: jest.fn(async (since: string | null) => {
        pulls.push(since);
        return {
          projects: [
            {
              id: 'remote-1',
              title: 'From the laptop',
              color: '#60A5FA',
              dueDate: null,
              clientUpdatedAt: T1,
              deletedAt: null,
              updatedAt: newest,
            },
          ],
          tasks: [],
        };
      }),
    });

    await syncOnce(store, remote);

    expect(pulls).toEqual([new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString()]);
    expect(store.get().cursor).toBe(newest);
    expect(store.get().projects['remote-1'].title).toBe('From the laptop');
  });
});

describe('mergePull', () => {
  const remoteTask = (overrides: Partial<TaskRecord> = {}) => ({
    id: 'id-2',
    projectId: 'id-1',
    title: 'Renamed elsewhere',
    isCompleted: false,
    position: 0,
    clientUpdatedAt: T1,
    deletedAt: null,
    updatedAt: '2026-09-16T12:00:00+00:00',
    ...overrides,
  });

  it('never lets a pulled row overwrite a local edit that is still pending', () => {
    const { state } = withProject(['Mine']);
    const merged = mergePull(state, { projects: [], tasks: [remoteTask()] });
    expect(merged.tasks['id-2'].title).toBe('Mine');
  });

  it('applies remote edits and deletions to synced rows', () => {
    const { state } = withProject(['Mine', 'Other']);
    const synced = { ...state, pending: {} };
    const merged = mergePull(synced, {
      projects: [],
      tasks: [remoteTask(), remoteTask({ id: 'id-3', deletedAt: T1 })],
    });

    expect(merged.tasks['id-2'].title).toBe('Renamed elsewhere');
    expect(merged.tasks['id-3']).toBeUndefined();
  });

  it('is idempotent, which is what makes the overlapping pull window safe', () => {
    const synced = { ...withProject(['Mine']).state, pending: {} };
    const pulled = { projects: [], tasks: [remoteTask()] };
    const once = mergePull(synced, pulled);
    expect(mergePull(once, pulled)).toEqual(once);
  });

  it('never moves the cursor backwards', () => {
    const state = { ...EMPTY_PLANNER_STATE, cursor: '2026-09-16T13:00:00+00:00' };
    const merged = mergePull(state, { projects: [], tasks: [remoteTask()] });
    expect(merged.cursor).toBe('2026-09-16T13:00:00+00:00');
  });
});

describe('retry timing', () => {
  it('grows exponentially, is capped at five minutes, and is jittered', () => {
    expect(retryDelay(1, () => 0)).toBe(1_000);
    expect(retryDelay(1, () => 1)).toBe(2_000);
    expect(retryDelay(4, () => 1)).toBe(16_000);
    expect(retryDelay(50, () => 1)).toBe(300_000);
    expect(retryDelay(50, () => 0)).toBe(150_000);
  });

  it('starts a first sync from the beginning', () => {
    expect(pullSince(null)).toBeNull();
  });
});
