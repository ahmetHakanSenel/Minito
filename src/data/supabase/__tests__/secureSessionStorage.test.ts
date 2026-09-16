import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { secureSessionStorage } from '../secureSessionStorage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map<string, string>();
  return {
    __data: data,
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => void data.set(key, value)),
    removeItem: jest.fn(async (key: string) => void data.delete(key)),
  };
});

jest.mock('expo-secure-store', () => {
  const data = new Map<string, string>();
  return {
    __data: data,
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void data.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void data.delete(key)),
  };
});

jest.mock('expo-crypto', () => ({
  getRandomBytes: (length: number) =>
    new Uint8Array(jest.requireActual<typeof import('crypto')>('crypto').randomBytes(length)),
}));

const asyncData = (AsyncStorage as unknown as { __data: Map<string, string> }).__data;
const keyData = (SecureStore as unknown as { __data: Map<string, string> }).__data;
const STORAGE_KEY = 'sb-project-auth-token';
const SESSION = JSON.stringify({ access_token: 'secret-access-token', user: { id: 'u1' } });

beforeEach(() => {
  asyncData.clear();
  keyData.clear();
  jest.clearAllMocks();
});

describe('secureSessionStorage', () => {
  it('round-trips a session and never stores it in plaintext', async () => {
    await secureSessionStorage.setItem(STORAGE_KEY, SESSION);

    const stored = asyncData.get(STORAGE_KEY) ?? '';
    expect(stored).toMatch(/^v2:[0-9a-f]{16}:[0-9a-f]+$/);
    expect(stored).not.toContain('secret-access-token');
    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBe(SESSION);
  });

  it('uses a fresh key per write and retires the previous one', async () => {
    await secureSessionStorage.setItem(STORAGE_KEY, 'first');
    const firstKeys = [...keyData.keys()];
    await secureSessionStorage.setItem(STORAGE_KEY, 'second');

    expect(keyData.size).toBe(1);
    expect([...keyData.keys()]).not.toEqual(firstKeys);
    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBe('second');
  });

  it('keeps the previous session readable when the app dies before the switch', async () => {
    await secureSessionStorage.setItem(STORAGE_KEY, 'old session');
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('app killed'));

    await expect(secureSessionStorage.setItem(STORAGE_KEY, 'new session')).rejects.toThrow();
    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBe('old session');
  });

  it('keeps the new session readable when retiring the old key fails', async () => {
    await secureSessionStorage.setItem(STORAGE_KEY, 'old session');
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('keystore busy'));

    await secureSessionStorage.setItem(STORAGE_KEY, 'new session');
    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBe('new session');
  });

  it('reads a session written before envelopes, and migrates it on the next write', async () => {
    const keyBytes = new Uint8Array(32).fill(7);
    const cipher = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(1));
    keyData.set(STORAGE_KEY, aesjs.utils.hex.fromBytes(keyBytes));
    asyncData.set(
      STORAGE_KEY,
      aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes('legacy session')))
    );

    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBe('legacy session');

    await secureSessionStorage.setItem(STORAGE_KEY, 'migrated');
    expect(keyData.has(STORAGE_KEY)).toBe(false);
    expect(keyData.size).toBe(1);
  });

  it('discards a plaintext session instead of trusting it', async () => {
    asyncData.set(STORAGE_KEY, SESSION);

    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
    expect(asyncData.has(STORAGE_KEY)).toBe(false);
  });

  it('discards ciphertext whose key the keystore lost', async () => {
    await secureSessionStorage.setItem(STORAGE_KEY, SESSION);
    keyData.clear();

    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
    expect(asyncData.has(STORAGE_KEY)).toBe(false);
  });

  it('removes both the ciphertext and its key', async () => {
    await secureSessionStorage.setItem(STORAGE_KEY, SESSION);
    await secureSessionStorage.removeItem(STORAGE_KEY);

    expect(asyncData.size).toBe(0);
    expect(keyData.size).toBe(0);
    await expect(secureSessionStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
  });
});
