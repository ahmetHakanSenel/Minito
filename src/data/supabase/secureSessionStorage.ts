import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Supabase sessions outgrow SecureStore's ~2 KB value limit, so each write encrypts the
 * session with a fresh AES-256 key: the key lives in the Keychain/Keystore via SecureStore
 * and only ciphertext reaches AsyncStorage (Supabase's recommended pattern for Expo).
 */
async function encrypt(key: string, value: string): Promise<string> {
  const encryptionKey = getRandomBytes(32);
  const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
  return aesjs.utils.hex.fromBytes(encrypted);
}

async function decrypt(key: string, ciphertext: string): Promise<string | null> {
  const keyHex = await SecureStore.getItemAsync(key);
  if (!keyHex) {
    return null;
  }
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(keyHex),
    new aesjs.Counter(1)
  );
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(ciphertext)));
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const ciphertext = await AsyncStorage.getItem(key);
    if (!ciphertext) {
      return null;
    }
    const value = await decrypt(key, ciphertext);
    if (value === null) {
      // No key means a plaintext session written before encryption: drop it instead of trusting it.
      await AsyncStorage.removeItem(key);
    }
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, await encrypt(key, value));
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};
