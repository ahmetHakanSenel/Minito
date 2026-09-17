import AsyncStorage from '@react-native-async-storage/async-storage';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Encrypted session storage for Supabase.
 *
 * Sessions outgrow SecureStore's ~2 KB value limit, so only a key lives in the Keychain/Keystore
 * and the session itself is stored as authenticated ciphertext in AsyncStorage.
 *
 * Cipher: XChaCha20-Poly1305 (AEAD), from the audited @noble/ciphers. Poly1305 authenticates
 * every byte, so a flipped bit, a truncated blob or a blob moved to another storage slot fails to
 * decrypt instead of producing altered plaintext. ChaCha20 is constant-time in plain JavaScript,
 * which a table-based AES implementation is not.
 *
 * Every write uses a fresh key and nonce, and is ordered to stay consistent if the app dies
 * between any two steps:
 *
 *   1. store the new key under its own id      (nothing refers to it yet)
 *   2. store the envelope "v3:<key id>:<nonce>:<sealed>"   (one write switches to the new key)
 *   3. delete the previous key                 (nothing refers to it any more)
 *
 * A crash leaves at worst an unreferenced key behind, never ciphertext without its key.
 * Concurrent writers are serialised one level up, by the Supabase client's lock.
 */

const VERSION = 'v3';
const ENVELOPE = /^v3:([0-9a-f]{16}):([0-9a-f]{48}):([0-9a-f]+)$/;
const KEY_BYTES = 32;
const NONCE_BYTES = 24;

type Envelope = { keyId: string; nonce: string; sealed: string };

function parseEnvelope(stored: string): Envelope | null {
  const match = ENVELOPE.exec(stored);
  return match ? { keyId: match[1], nonce: match[2], sealed: match[3] } : null;
}

// SecureStore keys allow only alphanumerics, ".", "-" and "_".
function keyName(storageKey: string, keyId: string): string {
  return `${storageKey}.${keyId}`;
}

/**
 * Associated data: the ciphertext is bound to the slot it was written for and the key id it
 * names, so it cannot be swapped into another slot or paired with another key.
 */
function associatedData(storageKey: string, keyId: string): Uint8Array {
  return utf8ToBytes(`${VERSION}|${storageKey}|${keyId}`);
}

function cipher(keyHex: string, nonceHex: string, storageKey: string, keyId: string) {
  return xchacha20poly1305(
    hexToBytes(keyHex),
    hexToBytes(nonceHex),
    associatedData(storageKey, keyId)
  );
}

async function readKeyId(storageKey: string): Promise<string | null> {
  const stored = await AsyncStorage.getItem(storageKey);
  return stored ? (parseEnvelope(stored)?.keyId ?? null) : null;
}

/**
 * The unauthenticated AES-CTR formats kept their key under "<slot>.<id>" (v2) or under the slot
 * name itself (v1). Their sessions are not trusted; their keys should not linger either.
 */
async function forgetLegacyKey(storageKey: string, stored: string): Promise<void> {
  const legacyKeyId = /^v2:([0-9a-f]{16}):/.exec(stored)?.[1];
  await SecureStore.deleteItemAsync(
    legacyKeyId ? keyName(storageKey, legacyKeyId) : storageKey
  ).catch(() => {});
}

async function discard(storageKey: string, reason: string): Promise<null> {
  console.warn(`Session storage: discarding "${storageKey}" (${reason}); sign-in is required.`);
  await AsyncStorage.removeItem(storageKey);
  return null;
}

export const secureSessionStorage = {
  async getItem(storageKey: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    // Anything that is not a v3 envelope (plaintext, or the unauthenticated formats that came
    // before) is never trusted: the user signs in once more instead.
    const envelope = parseEnvelope(stored);
    if (!envelope) {
      await forgetLegacyKey(storageKey, stored);
      return discard(storageKey, 'unrecognised format');
    }

    const slotKey = keyName(storageKey, envelope.keyId);
    const keyHex = await SecureStore.getItemAsync(slotKey);
    if (!keyHex) {
      return discard(storageKey, 'key missing from the keystore');
    }

    try {
      const plaintext = cipher(keyHex, envelope.nonce, storageKey, envelope.keyId).decrypt(
        hexToBytes(envelope.sealed)
      );
      return bytesToUtf8(plaintext);
    } catch {
      // The tag did not verify: the blob was altered, truncated, or does not belong here.
      await SecureStore.deleteItemAsync(slotKey).catch(() => {});
      return discard(storageKey, 'authentication failed');
    }
  },

  async setItem(storageKey: string, value: string): Promise<void> {
    const previousKeyId = await readKeyId(storageKey);
    const keyId = bytesToHex(getRandomBytes(8));
    const keyHex = bytesToHex(getRandomBytes(KEY_BYTES));
    const nonceHex = bytesToHex(getRandomBytes(NONCE_BYTES));
    const sealed = cipher(keyHex, nonceHex, storageKey, keyId).encrypt(utf8ToBytes(value));

    await SecureStore.setItemAsync(keyName(storageKey, keyId), keyHex);
    await AsyncStorage.setItem(storageKey, `${VERSION}:${keyId}:${nonceHex}:${bytesToHex(sealed)}`);
    if (previousKeyId) {
      // Cleanup only: a failure here leaves an unused key, not a broken session.
      await SecureStore.deleteItemAsync(keyName(storageKey, previousKeyId)).catch(() => {});
    }
  },

  async removeItem(storageKey: string): Promise<void> {
    const keyId = await readKeyId(storageKey);
    await AsyncStorage.removeItem(storageKey);
    if (keyId) {
      await SecureStore.deleteItemAsync(keyName(storageKey, keyId));
    }
  },
};
