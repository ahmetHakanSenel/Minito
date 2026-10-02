import {
  computeFlowMetrics,
  getFocusSessions,
  recordFocusSession,
  type FocusSessionRecord,
} from '../sessionStore';

// A store whose reads and writes each take a turn of the event loop, the way real I/O does. That
// is what lets two appends interleave: both read before either has written.
jest.mock('../../storage/jsonStore', () => {
  const files = new Map<string, string>();
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  return {
    readJson: async (key: string) => {
      await tick();
      const text = files.get(key);
      return text === undefined ? null : JSON.parse(text);
    },
    writeJson: async (key: string, value: unknown) => {
      await tick();
      files.set(key, JSON.stringify(value));
      return true;
    },
    __files: files,
  };
});

describe('recordFocusSession', () => {
  // Appending is read, add, write. Two appends that overlap would each read the same list and
  // the second write would erase the first record without a trace.
  it('keeps every session when two are recorded at once', async () => {
    await Promise.all([
      recordFocusSession({ durationSec: 60, pickupCount: 0, completed: true, source: 'timer' }),
      recordFocusSession({ durationSec: 120, pickupCount: 1, completed: false, source: 'timer' }),
    ]);

    const durations = (await getFocusSessions()).map((s) => s.durationSec).sort((a, b) => a - b);
    expect(durations).toEqual([60, 120]);
  });

  // Appends wait for each other, so one that fails must not leave every later one waiting
  // behind it for ever.
  it('keeps recording after an append has failed', async () => {
    const store = jest.requireMock('../../storage/jsonStore') as {
      __files: Map<string, string>;
      writeJson: (key: string, value: unknown) => Promise<boolean>;
    };
    store.__files.clear();
    const working = store.writeJson;
    store.writeJson = async () => {
      throw new Error('disk full');
    };

    await expect(
      recordFocusSession({ durationSec: 30, pickupCount: 0, completed: true, source: 'steps' })
    ).rejects.toThrow('disk full');

    store.writeJson = working;
    await recordFocusSession({ durationSec: 45, pickupCount: 0, completed: true, source: 'steps' });

    expect((await getFocusSessions()).map((s) => s.durationSec)).toEqual([45]);
  });
});

function session(over: Partial<FocusSessionRecord> = {}): FocusSessionRecord {
  return {
    id: Math.random().toString(36).slice(2),
    endedAt: Date.now() - 60_000,
    durationSec: 25 * 60,
    pickupCount: 0,
    completed: true,
    source: 'timer',
    ...over,
  };
}

describe('computeFlowMetrics', () => {
  it('says nothing when there is nothing to say', () => {
    expect(computeFlowMetrics([])).toEqual({ focusQuality: 0, distractionLevel: 0 });
  });

  it('ignores step flows, which are untimed, and anything outside the window', () => {
    const stepFlow = session({ source: 'steps', durationSec: 0 });
    const lastMonth = session({ endedAt: Date.now() - 30 * 24 * 60 * 60 * 1000 });
    expect(computeFlowMetrics([stepFlow, lastMonth])).toEqual({
      focusQuality: 0,
      distractionLevel: 0,
    });
  });

  it('gives full marks to an undisturbed session of the target length', () => {
    expect(computeFlowMetrics([session()])).toEqual({ focusQuality: 100, distractionLevel: 0 });
  });

  // Seventy of the hundred points come from length, thirty from finishing.
  it('splits quality between how long the sessions ran and whether they finished', () => {
    expect(computeFlowMetrics([session({ completed: false })]).focusQuality).toBe(70);
    expect(computeFlowMetrics([session({ durationSec: 10 * 60 })]).focusQuality).toBe(58);
  });

  it('does not reward sessions longer than the target', () => {
    expect(computeFlowMetrics([session({ durationSec: 90 * 60 })]).focusQuality).toBe(100);
  });

  /**
   * The scale that matters, and the one most easily invalidated from outside this file.
   *
   * Distraction is pickups per twenty-five focused minutes, times twenty-five — so four pickups
   * in a twenty-five minute session reads as complete distraction, and two as half. That is only
   * sensible while a "pickup" means the phone was picked up and used. It is set by
   * lib/focus/pickupDetector, whose sensitivity was loosened by a large factor; anyone changing
   * it again should come back here, because these numbers move with it.
   */
  it('scores distraction against pickups per twenty-five focused minutes', () => {
    expect(computeFlowMetrics([session({ pickupCount: 1 })]).distractionLevel).toBe(25);
    expect(computeFlowMetrics([session({ pickupCount: 2 })]).distractionLevel).toBe(50);
    expect(computeFlowMetrics([session({ pickupCount: 4 })]).distractionLevel).toBe(100);
    expect(computeFlowMetrics([session({ pickupCount: 20 })]).distractionLevel).toBe(100);
  });

  it('counts pickups against time focused, not against the number of sessions', () => {
    // One pickup in fifty minutes is half as distracted as one in twenty-five.
    const long = session({ durationSec: 50 * 60, pickupCount: 1 });
    expect(computeFlowMetrics([long]).distractionLevel).toBe(13);
  });

  /**
   * Sessions left early used to be thrown away; since they are recorded, they enter this
   * average. That is the honest reading, and it is also a real change in what the orb shows:
   * leaving a short session now pulls quality down where before it left no trace at all.
   */
  it('counts a session someone walked out of', () => {
    const abandoned = session({ durationSec: 8 * 60, completed: false });
    const finished = session();
    const metrics = computeFlowMetrics([abandoned, finished]);
    expect(metrics.focusQuality).toBeLessThan(computeFlowMetrics([finished]).focusQuality);
    expect(metrics.focusQuality).toBeGreaterThan(0);
  });

  it('treats a missing pickup count as no pickups rather than as a crash', () => {
    const noCount = { ...session(), pickupCount: undefined } as unknown as FocusSessionRecord;
    expect(computeFlowMetrics([noCount]).distractionLevel).toBe(0);
  });
});
