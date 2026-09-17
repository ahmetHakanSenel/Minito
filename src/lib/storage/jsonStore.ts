import { File, Paths } from 'expo-file-system';

/**
 * Minimal file-backed JSON store, on the app's own document directory.
 *
 * Files are small (a planner, a saved session), so the synchronous API is the right one: it
 * avoids a round trip per read and keeps callers simple. Every operation fails soft, because a
 * storage error must never crash a screen.
 */

function fileFor(key: string): File {
  return new File(Paths.document, `minito-${key}.json`);
}

export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const file = fileFor(key);
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as T;
  } catch (error) {
    console.warn(`jsonStore: failed to read "${key}"`, error);
    return null;
  }
}

export async function writeJson(key: string, data: unknown): Promise<boolean> {
  try {
    const file = fileFor(key);
    file.create({ overwrite: true, intermediates: true });
    file.write(JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn(`jsonStore: failed to write "${key}"`, error);
    return false;
  }
}

export async function removeJson(key: string): Promise<void> {
  try {
    const file = fileFor(key);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn(`jsonStore: failed to remove "${key}"`, error);
  }
}
