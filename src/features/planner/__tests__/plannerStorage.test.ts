import { readJson, removeJson, writeJson } from '../../../lib/storage/jsonStore';
import { EMPTY_PLANNER_STATE, selectProjects } from '../model';
import { createPlannerPersister, importLegacyProjects, loadPlannerState } from '../plannerStorage';
import { isPermanent } from '../plannerRemote';

jest.mock('../../../lib/storage/jsonStore', () => ({
  readJson: jest.fn(),
  writeJson: jest.fn(async () => true),
  removeJson: jest.fn(async () => {}),
}));
jest.mock('../../../data/supabase/client', () => ({ getSupabase: jest.fn() }));

const mockedRead = jest.mocked(readJson);
const mockedWrite = jest.mocked(writeJson);

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('legacy import', () => {
  it('adopts old projects with fresh ids and completion kept, but never sample data', () => {
    const state = importLegacyProjects(
      EMPTY_PLANNER_STATE,
      [
        { id: 'seed-thesis', title: 'Sample', color: '#8B5CF6', tasks: [] },
        {
          id: '1726000000000-abc',
          title: 'Move flat',
          color: '#34D399',
          dueDate: '2026-10-01T09:00:00.000Z',
          tasks: [
            { title: 'Boxes', isCompleted: true },
            { title: 'Van', isCompleted: false },
            { title: 42 },
          ],
        },
        { title: 'No color' },
      ],
      ids(),
      '2026-09-16T10:00:00.000Z'
    );

    const projects = selectProjects(state);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id: 'id-1', title: 'Move flat', progress: 50 });
    expect(projects[0].tasks.map((task) => task.title)).toEqual(['Boxes', 'Van']);
    expect(Object.keys(state.pending)).toHaveLength(3);
  });
});

describe('loadPlannerState', () => {
  it('prefers the account’s own file', async () => {
    const saved = { ...EMPTY_PLANNER_STATE, cursor: '2026-09-16T10:00:00Z' };
    mockedRead.mockResolvedValueOnce(saved);

    await expect(loadPlannerState('user-1', ids())).resolves.toEqual({
      state: saved,
      hadLegacy: false,
    });
    expect(mockedRead).toHaveBeenCalledWith('planner-user-1');
  });

  it('falls back to the legacy file on an account’s first run', async () => {
    mockedRead
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([{ id: 'old', title: 'Old', color: '#60A5FA', tasks: [] }]);

    const { state, hadLegacy } = await loadPlannerState('user-1', ids());

    expect(hadLegacy).toBe(true);
    expect(selectProjects(state).map((project) => project.title)).toEqual(['Old']);
    expect(removeJson).not.toHaveBeenCalled();
  });

  it('starts empty when a file is corrupt', async () => {
    mockedRead.mockResolvedValueOnce({ nonsense: true }).mockResolvedValueOnce('garbage');
    await expect(loadPlannerState('user-1', ids())).resolves.toEqual({
      state: EMPTY_PLANNER_STATE,
      hadLegacy: false,
    });
  });
});

describe('persister', () => {
  it('collapses writes queued behind a slow one into the latest state', async () => {
    let finishFirst: () => void = () => {};
    mockedWrite.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finishFirst = () => resolve(true)))
    );
    const persister = createPlannerPersister('user-1');
    const states = [1, 2, 3].map((clock) => ({ ...EMPTY_PLANNER_STATE, clock }));

    const done = persister.save(states[0]);
    void persister.save(states[1]);
    void persister.save(states[2]);
    finishFirst();
    await done;

    expect(mockedWrite.mock.calls.map(([, state]) => (state as { clock: number }).clock)).toEqual([
      1, 3,
    ]);
  });
});

describe('remote error classification', () => {
  it.each([
    ['23514', true],
    ['23503', true],
    ['22P02', true],
    ['42501', true],
    ['42P01', false],
    ['PGRST205', false],
    ['PGRST301', false],
    ['', false],
  ])('%s is permanent: %s', (code, permanent) => {
    expect(isPermanent({ code })).toBe(permanent);
  });
});
