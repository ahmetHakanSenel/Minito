import { readJson, removeJson, writeJson } from '../jsonStore';

/**
 * A disk in memory that can be "killed" after any number of operations, the way the OS kills an
 * app the person has left. Two things are modelled the unfavourable way on purpose: a write can
 * be torn half way, and a move that overwrites is not atomic — the old file goes first.
 */
jest.mock('expo-file-system', () => {
  const disk = new Map<string, string>();
  const control = { opsLeft: Number.POSITIVE_INFINITY };

  function step() {
    if (control.opsLeft <= 0) throw new Error('killed');
    control.opsLeft -= 1;
  }

  class File {
    name: string;
    constructor(_directory: unknown, name: string) {
      this.name = name;
    }
    get exists() {
      return disk.has(this.name);
    }
    create() {
      step();
      disk.set(this.name, '');
    }
    write(text: string) {
      step();
      disk.set(this.name, text.slice(0, Math.floor(text.length / 2)));
      step();
      disk.set(this.name, text);
    }
    textSync() {
      return disk.get(this.name) ?? '';
    }
    delete() {
      step();
      disk.delete(this.name);
    }
    moveSync(destination: File, options?: { overwrite?: boolean }) {
      if (disk.has(destination.name)) {
        if (!options?.overwrite) throw new Error('destination exists');
        step();
        disk.delete(destination.name);
      }
      step();
      disk.set(destination.name, disk.get(this.name) ?? '');
      disk.delete(this.name);
    }
  }

  return { File, Paths: { document: 'documents' }, __disk: disk, __control: control };
});

const { __disk: disk, __control: control } = jest.requireMock('expo-file-system') as {
  __disk: Map<string, string>;
  __control: { opsLeft: number };
};

beforeEach(() => {
  disk.clear();
  control.opsLeft = Number.POSITIVE_INFINITY;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('jsonStore', () => {
  it('reads back what it wrote', async () => {
    await writeJson('planner', { projects: 2 });
    await expect(readJson('planner')).resolves.toEqual({ projects: 2 });
  });

  it('reads nothing for a key never written', async () => {
    await expect(readJson('missing')).resolves.toBeNull();
  });

  // The property the store exists for. Whichever operation the app is killed at, the next launch
  // finds either the value from before the write or the value it was writing — never nothing.
  it('survives being killed at any step of a write', async () => {
    const before = { version: 'before', pending: ['edit offline'] };
    const after = { version: 'after', pending: ['edit offline', 'one more'] };

    await writeJson('planner', before);
    const snapshot = new Map(disk);

    // Count the steps of an uninterrupted write, so that every one of them gets tried.
    const budget = 1000;
    control.opsLeft = budget;
    await writeJson('planner', after);
    const stepsInAWrite = budget - control.opsLeft;
    expect(stepsInAWrite).toBeGreaterThan(3);

    for (let killedAfter = 0; killedAfter <= stepsInAWrite; killedAfter++) {
      disk.clear();
      snapshot.forEach((value, key) => disk.set(key, value));
      control.opsLeft = killedAfter;

      await writeJson('planner', after);

      control.opsLeft = Number.POSITIVE_INFINITY;
      const found = await readJson('planner');
      expect([before, after]).toContainEqual(found);
    }
  });

  it('prefers the live file over an unfinished temporary one', async () => {
    await writeJson('prefs', { haptics: true });
    disk.set('minito-prefs.json.tmp', '{"haptics": fal');
    await expect(readJson('prefs')).resolves.toEqual({ haptics: true });
  });

  it('stores a null as a null rather than as nothing', async () => {
    await writeJson('session', null);
    await expect(readJson('session')).resolves.toBeNull();
    expect(disk.has('minito-session.json')).toBe(true);
  });

  // A write killed before its move leaves a complete temporary file behind. Removing a key has
  // to take that with it, or the value would come back on the next read.
  it('removes an interrupted write along with the value', async () => {
    await writeJson('session', { step: 3 });
    disk.set('minito-session.json.tmp', JSON.stringify({ step: 4 }));

    await removeJson('session');

    await expect(readJson('session')).resolves.toBeNull();
    expect([...disk.keys()]).toEqual([]);
  });

  it('reports a failed write instead of throwing', async () => {
    control.opsLeft = 0;
    await expect(writeJson('planner', { a: 1 })).resolves.toBe(false);
  });
});
