import * as FileSystem from 'expo-file-system/legacy';

/**
 * Minimal file-backed JSON store.
 *
 * Uses expo-file-system (already a dependency) instead of AsyncStorage so no
 * new native module is required — existing dev-client builds keep working.
 * All operations fail soft: a storage error must never crash a screen.
 */

const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '';

function pathFor(key: string): string {
  return `${baseDir}minito-${key}.json`;
}

export async function readJson<T>(key: string): Promise<T | null> {
  if (!baseDir) return null;
  try {
    const info = await FileSystem.getInfoAsync(pathFor(key));
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(pathFor(key));
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`jsonStore: failed to read "${key}"`, error);
    return null;
  }
}

export async function writeJson(key: string, data: unknown): Promise<boolean> {
  if (!baseDir) return false;
  try {
    await FileSystem.writeAsStringAsync(pathFor(key), JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn(`jsonStore: failed to write "${key}"`, error);
    return false;
  }
}

export async function removeJson(key: string): Promise<void> {
  if (!baseDir) return;
  try {
    await FileSystem.deleteAsync(pathFor(key), { idempotent: true });
  } catch (error) {
    console.warn(`jsonStore: failed to remove "${key}"`, error);
  }
}
