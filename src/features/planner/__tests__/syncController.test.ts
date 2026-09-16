import { EMPTY_PLANNER_STATE, type PlannerState } from '../model';
import { PlannerSyncController } from '../syncController';
import { RemoteError, type PlannerRemote } from '../syncEngine';

jest.useFakeTimers();

function controllerWith(pull: PlannerRemote['pull']) {
  let state: PlannerState = EMPTY_PLANNER_STATE;
  const remote: PlannerRemote = {
    pushProjects: jest.fn(async () => {}),
    pushTasks: jest.fn(async () => {}),
    pull: jest.fn(pull),
  };
  const outcomes: string[] = [];
  const controller = new PlannerSyncController(
    { get: () => state, update: (change) => (state = change(state)) },
    remote,
    (outcome) => outcomes.push(outcome.status),
    {
      setTimeout: (callback, ms) => setTimeout(callback, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    () => Date.now()
  );
  return { controller, remote, outcomes };
}

const empty = async () => ({ projects: [], tasks: [] });

beforeEach(() => {
  jest.spyOn(Math, 'random').mockReturnValue(1);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.restoreAllMocks();
});

describe('PlannerSyncController', () => {
  it('coalesces a burst of requests into one sync', async () => {
    const { controller, remote } = controllerWith(empty);
    controller.request(800);
    controller.request(800);
    controller.request(800);

    await jest.advanceTimersByTimeAsync(800);

    expect(remote.pull).toHaveBeenCalledTimes(1);
  });

  it('lets a sooner request overtake a later one', async () => {
    const { controller, remote } = controllerWith(empty);
    controller.request(10_000);
    controller.request(0);

    await jest.advanceTimersByTimeAsync(0);
    expect(remote.pull).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(remote.pull).toHaveBeenCalledTimes(1);
  });

  it('runs one follow-up when asked during a sync, never two at once', async () => {
    let release: () => void = () => {};
    let running = 0;
    let maxRunning = 0;
    const { controller, remote } = controllerWith(async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise<void>((resolve) => (release = resolve));
      running -= 1;
      return { projects: [], tasks: [] };
    });

    controller.request(0);
    await jest.advanceTimersByTimeAsync(0);
    controller.request(0);
    controller.request(0);
    release();
    await jest.advanceTimersByTimeAsync(0);
    release();
    await jest.advanceTimersByTimeAsync(0);

    expect(remote.pull).toHaveBeenCalledTimes(2);
    expect(maxRunning).toBe(1);
  });

  it('backs off after failures, and holds edits for the backed-off retry', async () => {
    let fail = true;
    const { controller, remote, outcomes } = controllerWith(async () => {
      if (fail) throw new RemoteError('network: offline', false);
      return { projects: [], tasks: [] };
    });

    controller.request(0);
    await jest.advanceTimersByTimeAsync(0);
    expect(outcomes).toEqual(['retry']);

    // Second failure doubles the wait (random = 1 → the upper end of the jitter).
    await jest.advanceTimersByTimeAsync(2_000);
    expect(outcomes).toEqual(['retry', 'retry']);

    fail = false;
    await jest.advanceTimersByTimeAsync(3_999);
    expect(remote.pull).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(outcomes).toEqual(['retry', 'retry', 'synced']);
  });

  it('does nothing after being disposed', async () => {
    const { controller, remote } = controllerWith(empty);
    controller.request(500);
    controller.dispose();
    controller.request(0);

    await jest.advanceTimersByTimeAsync(1_000);

    expect(remote.pull).not.toHaveBeenCalled();
  });
});
