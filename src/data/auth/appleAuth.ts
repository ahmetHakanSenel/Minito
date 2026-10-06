import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import type { IdTokenCredential } from './idTokenCredential';

// Apple sign-in needs no in-app key, so an explicit opt-in flag stands in for "configured".
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED !== 'true') {
    return false;
  }
  return AppleAuthentication.isAvailableAsync();
}

const NONCE_BYTES = 32;

/** A single-use value from the platform's CSPRNG, hex-encoded. */
export function createNonce(): string {
  return Array.from(Crypto.getRandomBytes(NONCE_BYTES), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Resolves to Apple's identity token and the raw nonce it is bound to, or null when the user
 * cancels the sheet.
 *
 * Apple receives only the SHA-256 of the nonce and writes it into the token. Supabase receives
 * the raw nonce, hashes it and compares. A token captured from another sign-in carries another
 * nonce's hash, so it cannot be replayed here.
 */
export async function requestAppleCredential(): Promise<IdTokenCredential | null> {
  const nonce = createNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token');
    }
    return { token: credential.identityToken, nonce };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw error;
  }
}
