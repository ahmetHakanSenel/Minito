import AsyncStorage from '@react-native-async-storage/async-storage';
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
const SLOT = 'sb-project-auth-token';
const OTHER_SLOT = 'sb-other-auth-token';
const SESSION = JSON.stringify({ access_token: 'secret-access-token', user: { id: 'u1' } });
const ENVELOPE = /^v3:([0-9a-f]{16}):([0-9a-f]{48}):([0-9a-f]+)$/;

function envelope(slot = SLOT) {
  const match = ENVELOPE.exec(asyncData.get(slot) ?? '');
  if (!match) throw new Error('no v3 envelope stored');
  return { keyId: match[1], nonce: match[2], sealed: match[3] };
}

function store(slot: string, parts: { keyId: string; nonce: string; sealed: string }) {
  asyncData.set(slot, `v3:${parts.keyId}:${parts.nonce}:${parts.sealed}`);
}

beforeEach(() => {
  asyncData.clear();
  keyData.clear();
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('secureSessionStorage', () => {
  it('round-trips a session as authenticated ciphertext, never as plaintext', async () => {
    await secureSessionStorage.setItem(SLOT, SESSION);

    const stored = asyncData.get(SLOT) ?? '';
    expect(stored).toMatch(ENVELOPE);
    expect(stored).not.toContain('secret-access-token');
    // XChaCha20-Poly1305 adds a 16-byte tag to the plaintext.
    expect(envelope().sealed).toHaveLength((Buffer.byteLength(SESSION) + 16) * 2);
    await expect(secureSessionStorage.getItem(SLOT)).resolves.toBe(SESSION);
  });

  it('uses a fresh key and nonce per write, and retires the previous key', async () => {
    await secureSessionStorage.setItem(SLOT, SESSION);
    const first = envelope();
    await secureSessionStorage.setItem(SLOT, SESSION);
    const second = envelope();

    expect(second.keyId).not.toBe(first.keyId);
    expect(second.nonce).not.toBe(first.nonce);
    expect(second.sealed).not.toBe(first.sealed);
    expect([...keyData.keys()]).toEqual([`${SLOT}.${second.keyId}`]);
  });

  describe('rejects tampering instead of returning altered data', () => {
    beforeEach(async () => {
      await secureSessionStorage.setItem(SLOT, SESSION);
    });

    it.each([
      [
        'a flipped bit in the ciphertext',
        (e: ReturnType<typeof envelope>) => ({
          ...e,
          sealed: (parseInt(e.sealed[0], 16) ^ 1).toString(16) + e.sealed.slice(1),
        }),
      ],
      [
        'a flipped bit in the tag',
        (e: ReturnType<typeof envelope>) => ({
          ...e,
          sealed: e.sealed.slice(0, -1) + (parseInt(e.sealed.slice(-1), 16) ^ 1).toString(16),
        }),
      ],
      [
        'a truncated blob',
        (e: ReturnType<typeof envelope>) => ({ ...e, sealed: e.sealed.slice(0, -2) }),
      ],
      ['a different nonce', (e: ReturnType<typeof envelope>) => ({ ...e, nonce: '0'.repeat(48) })],
    ])('%s', async (_name, tamper) => {
      store(SLOT, tamper(envelope()));

      await expect(secureSessionStorage.getItem(SLOT)).resolves.toBeNull();
      expect(asyncData.has(SLOT)).toBe(false);
      expect(keyData.size).toBe(0);
    });

    it('a blob copied, with its key, into another slot', async () => {
      const original = envelope();
      store(OTHER_SLOT, original);
      keyData.set(`${OTHER_SLOT}.${original.keyId}`, keyData.get(`${SLOT}.${original.keyId}`)!);

      await expect(secureSessionStorage.getItem(OTHER_SLOT)).resolves.toBeNull();
      // The original slot is untouched and still readable.
      await expect(secureSessionStorage.getItem(SLOT)).resolves.toBe(SESSION);
    });

    it('a blob pointed at another key', async () => {
      const original = envelope();
      const otherId = 'ffffffffffffffff';
      keyData.set(`${SLOT}.${otherId}`, keyData.get(`${SLOT}.${original.keyId}`)!);
      store(SLOT, { ...original, keyId: otherId });

      await expect(secureSessionStorage.getItem(SLOT)).resolves.toBeNull();
    });
  });

  it('keeps the previous session readable when the app dies before the switch', async () => {
    await secureSessionStorage.setItem(SLOT, 'old session');
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('app killed'));

    await expect(secureSessionStorage.setItem(SLOT, 'new session')).rejects.toThrow();
    await expect(secureSessionStorage.getItem(SLOT)).resolves.toBe('old session');
  });

  it('keeps the new session readable when retiring the old key fails', async () => {
    await secureSessionStorage.setItem(SLOT, 'old session');
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error('keystore busy'));

    await secureSessionStorage.setItem(SLOT, 'new session');
    await expect(secureSessionStorage.getItem(SLOT)).resolves.toBe('new session');
  });

  it.each([
    ['plaintext', SESSION, null],
    ['the v1 AES-CTR format', 'deadbeef', SLOT],
    ['the v2 AES-CTR format', 'v2:0123456789abcdef:deadbeef', `${SLOT}.0123456789abcdef`],
  ])('discards a session stored as %s, and its old key', async (_name, stored, oldKey) => {
    asyncData.set(SLOT, stored);
    if (oldKey) keyData.set(oldKey, 'aa'.repeat(32));

    await expect(secureSessionStorage.getItem(SLOT)).resolves.toBeNull();
    expect(asyncData.has(SLOT)).toBe(false);
    expect(keyData.size).toBe(0);
  });

  it('discards ciphertext whose key the keystore lost', async () => {
    await secureSessionStorage.setItem(SLOT, SESSION);
    keyData.clear();

    await expect(secureSessionStorage.getItem(SLOT)).resolves.toBeNull();
    expect(asyncData.has(SLOT)).toBe(false);
  });

  it('removes both the ciphertext and its key', async () => {
    await secureSessionStorage.setItem(SLOT, SESSION);
    await secureSessionStorage.removeItem(SLOT);

    expect(asyncData.size).toBe(0);
    expect(keyData.size).toBe(0);
  });
});
