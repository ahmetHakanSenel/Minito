import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

// Apple sign-in needs no in-app key, so an explicit opt-in flag stands in for "configured".
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios' || process.env.EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED !== 'true') {
    return false;
  }
  return AppleAuthentication.isAvailableAsync();
}

/** Resolves to Apple's identity token, or null when the user cancels the sheet. */
export async function requestAppleIdToken(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token');
    }
    return credential.identityToken;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw error;
  }
}
