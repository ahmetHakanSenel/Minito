import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Encrypted session storage for Supabase.
 *
 * Sessions outgrow SecureStore's ~2 KB value limit, so each write encrypts the session with a
 * fresh AES-256 key: the key lives in the Keychain/Keystore via SecureStore and only ciphertext
 * reaches AsyncStorage (Supabase's recommended pattern for Expo).
 *
 * Two stores cannot be written atomically, so every write is ordered to stay consistent if the
 * app dies between any two steps:
 *
 *   1. store the new key under its own id      (nothing refers to it yet)
 *   2. store the envelope "v2:<key id>:<hex>"   (one write switches to the new key)
 *   3. delete the previous key                  (nothing refers to it any more)
 *
 * A crash leaves at worst an unreferenced key behind, never ciphertext without its key.
 * Concurrent writers are serialised one level up, by the Supabase client's lock.
 */

const ENVELOPE_VERSION = 'v2';
const ENVELOPE = /^v2:([0-9a-f]{16}):([0-9a-f]*)$/;

type Envelope = { keyId: string; ciphertext: string };

function parseEnvelope(stored: string): Envelope | null {
  const match = ENVELOPE.exec(stored);
  return match ? { keyId: match[1], ciphertext: match[2] } : null;
}

// SecureStore keys allow only alphanumerics, ".", "-" and "_".
function keyName(storageKey: string, keyId: string | null): string {
  return keyId ? `${storageKey}.${keyId}` : storageKey;
}

function crypt(keyHex: string, bytes: Uint8Array): Uint8Array {
  // A fresh key per write is what makes the fixed counter safe: no key ever encrypts twice.
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(keyHex),
    new aesjs.Counter(1)
  );
  return cipher.encrypt(bytes);
}

async function readKeyId(storageKey: string): Promise<string | null> {
  const stored = await AsyncStorage.getItem(storageKey);
  return stored ? (parseEnvelope(stored)?.keyId ?? null) : null;
}

export const secureSessionStorage = {
  async getItem(storageKey: string): Promise<string | null> {
    const stored = await AsyncStorage.getItem(storageKey);
    if (!stored) {
      return null;
    }

    // Envelopes name their key. Anything else predates them: it was encrypted with a key stored
    // under the storage key itself, or it is a plaintext session from before encryption.
    const envelope = parseEnvelope(stored);
    const keyHex = await SecureStore.getItemAsync(keyName(storageKey, envelope?.keyId ?? null));
    if (!keyHex) {
      // Plaintext, or a key the keystore no longer has: drop it instead of trusting it.
      await AsyncStorage.removeItem(storageKey);
      return null;
    }

    const ciphertext = envelope ? envelope.ciphertext : stored;
    return aesjs.utils.utf8.fromBytes(crypt(keyHex, aesjs.utils.hex.toBytes(ciphertext)));
  },

  async setItem(storageKey: string, value: string): Promise<void> {
    const previousKeyId = await readKeyId(storageKey);
    const keyId = aesjs.utils.hex.fromBytes(getRandomBytes(8));
    const keyHex = aesjs.utils.hex.fromBytes(getRandomBytes(32));
    const ciphertext = aesjs.utils.hex.fromBytes(crypt(keyHex, aesjs.utils.utf8.toBytes(value)));

    await SecureStore.setItemAsync(keyName(storageKey, keyId), keyHex);
    await AsyncStorage.setItem(storageKey, `${ENVELOPE_VERSION}:${keyId}:${ciphertext}`);
    // Cleanup only: a failure here leaves an unused key, not a broken session.
    await SecureStore.deleteItemAsync(keyName(storageKey, previousKeyId)).catch(() => {});
  },

  async removeItem(storageKey: string): Promise<void> {
    const keyId = await readKeyId(storageKey);
    await AsyncStorage.removeItem(storageKey);
    await SecureStore.deleteItemAsync(keyName(storageKey, keyId));
    if (keyId) {
      // A session first written before envelopes may still have its key under the old name.
      await SecureStore.deleteItemAsync(storageKey).catch(() => {});
    }
  },
};
