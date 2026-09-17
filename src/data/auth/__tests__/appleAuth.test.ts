import { createHash } from 'crypto';
import * as AppleAuthentication from 'expo-apple-authentication';
import { createNonce, requestAppleCredential } from '../appleAuth';

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomBytes: (length: number) => new Uint8Array(nodeCrypto.randomBytes(length)),
    digestStringAsync: async (_algorithm: string, value: string) =>
      nodeCrypto.createHash('sha256').update(value).digest('hex'),
  };
});

const signInAsync = jest.mocked(AppleAuthentication.signInAsync);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Apple sign-in', () => {
  it('creates a fresh 256-bit nonce every time', () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sends Apple the hash of the nonce and returns the raw nonce with the token', async () => {
    signInAsync.mockResolvedValue({ identityToken: 'apple-id-token' } as never);

    const credential = await requestAppleCredential();

    expect(credential?.token).toBe('apple-id-token');
    const sentNonce = signInAsync.mock.calls[0][0]?.nonce;
    expect(sentNonce).toBe(createHash('sha256').update(credential!.nonce!).digest('hex'));
    expect(sentNonce).not.toBe(credential!.nonce);
  });

  it('never reuses a nonce across attempts', async () => {
    signInAsync.mockResolvedValue({ identityToken: 'apple-id-token' } as never);

    const first = await requestAppleCredential();
    const second = await requestAppleCredential();

    expect(first?.nonce).not.toBe(second?.nonce);
  });

  it('treats a cancelled sheet as no credential', async () => {
    signInAsync.mockRejectedValue(
      Object.assign(new Error('cancelled'), { code: 'ERR_REQUEST_CANCELED' })
    );
    await expect(requestAppleCredential()).resolves.toBeNull();
  });

  it('refuses a response without an identity token', async () => {
    signInAsync.mockResolvedValue({ identityToken: null } as never);
    await expect(requestAppleCredential()).rejects.toThrow('identity token');
  });
});
