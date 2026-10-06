import { File, Paths } from 'expo-file-system';

/**
 * Minimal file-backed JSON store, on the app's own document directory.
 *
 * Files are small (a planner, a saved session), so the synchronous API is the right one: it
 * avoids a round trip per read and keeps callers simple. Every operation fails soft, because a
 * storage error must never crash a screen.
 *
 * A write never touches the live file until the new content is complete. It goes to a temporary
 * file first, and only that finished file is moved into place. Writing in place — truncate, then
 * write — left a window in which a killed app found an empty or half-written file on the next
 * launch, which read as nothing at all: the whole planner, unsynced edits included, gone. Being
 * killed is the expected case for this app, not an edge one: people leave it to go and do the
 * step.
 *
 * Whether the move replaces the old file atomically is up to the platform, so nothing here
 * depends on it. If the move is interrupted half way, the old file may be gone but the temporary
 * one is complete, and a read falls back to it.
 */

function fileFor(key: string): File {
  return new File(Paths.document, `minito-${key}.json`);
}

function tempFileFor(key: string): File {
  return new File(Paths.document, `minito-${key}.json.tmp`);
}

/** The parsed content, or undefined when the file is missing or not complete JSON. */
function parsed(file: File): unknown {
  if (!file.exists) return undefined;
  try {
    return JSON.parse(file.textSync());
  } catch {
    return undefined;
  }
}

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    // The live file when it is whole; otherwise a finished write that never got moved into place.
    // `undefined` is the marker for "nothing usable", since JSON itself can hold `null`.
    const live = parsed(fileFor(key));
    if (live !== undefined) return live as T;
    const pending = parsed(tempFileFor(key));
    return pending === undefined ? null : (pending as T);
  } catch (error) {
    console.warn(`jsonStore: failed to read "${key}"`, error);
    return null;
  }
}

export async function writeJson(key: string, data: unknown): Promise<boolean> {
  try {
    const temp = tempFileFor(key);
    temp.create({ overwrite: true, intermediates: true });
    temp.write(JSON.stringify(data));
    temp.moveSync(fileFor(key), { overwrite: true });
    return true;
  } catch (error) {
    console.warn(`jsonStore: failed to write "${key}"`, error);
    return false;
  }
}

export async function removeJson(key: string): Promise<void> {
  // Both, so a write interrupted before its move cannot bring the value back on the next read.
  for (const file of [fileFor(key), tempFileFor(key)]) {
    try {
      if (file.exists) file.delete();
    } catch (error) {
      console.warn(`jsonStore: failed to remove "${key}"`, error);
    }
  }
}
