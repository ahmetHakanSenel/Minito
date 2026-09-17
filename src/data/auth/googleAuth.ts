import { Platform } from 'react-native';
import type { IdTokenCredential } from './idTokenCredential';

type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let cachedModule: GoogleSigninModule | null = null;

// Loaded lazily: Expo Go lacks the native module and would crash on a static import.
async function loadGoogleSignin(): Promise<GoogleSigninModule | null> {
  if (cachedModule) {
    return cachedModule;
  }
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    return null;
  }
  try {
    const googleModule = await import('@react-native-google-signin/google-signin');
    googleModule.GoogleSignin.configure({ webClientId, scopes: ['profile', 'email'] });
    cachedModule = googleModule;
    return googleModule;
  } catch {
    return null;
  }
}

export async function isGoogleSignInAvailable(): Promise<boolean> {
  const googleModule = await loadGoogleSignin();
  if (!googleModule) {
    return false;
  }
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    await googleModule.GoogleSignin.hasPlayServices();
    return true;
  } catch {
    return false;
  }
}

/** Resolves to Google's ID token, or null when the user cancels. */
export async function requestGoogleCredential(): Promise<IdTokenCredential | null> {
  const googleModule = await loadGoogleSignin();
  if (!googleModule) {
    throw new Error('Google Sign-In is not configured or its native module is unavailable');
  }
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = googleModule;
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices();
    }
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return null;
    }
    if (!response.data.idToken) {
      throw new Error('Google did not return an ID token');
    }
    return { token: response.data.idToken };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw error;
  }
}
