import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

// Lazy load Google Sign-In module to prevent crashes in Expo Go
let GoogleSignin: any = null;
let statusCodes: any = null;

async function loadGoogleSignIn() {
  try {
    const module = await import('@react-native-google-signin/google-signin');
    GoogleSignin = module.GoogleSignin;
    statusCodes = module.statusCodes;
    
    // Configure Google Sign In
    // Note: You need to set up OAuth credentials in Supabase Dashboard
    // and configure the web client ID here
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '', // From Google Cloud Console
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });
    
    return true;
  } catch (error) {
    console.warn('Google Sign-In module not available (likely running in Expo Go):', error);
    return false;
  }
}

/**
 * Sign in with Google
 * Available on both iOS and Android
 * Note: This requires a development build, not Expo Go
 */
export async function signInWithGoogle(): Promise<void> {
  try {
    // Lazy load the module
    const isAvailable = await loadGoogleSignIn();
    if (!isAvailable || !GoogleSignin) {
      throw new Error('Google Sign-In is not available. Please use a development build instead of Expo Go.');
    }

    // Check if Google Play Services are available (Android)
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices();
    }

    // Sign in with Google
    await GoogleSignin.signIn();

    // Get the ID token
    const tokens = await GoogleSignin.getTokens();
    if (!tokens.idToken) {
      throw new Error('No ID token received from Google');
    }

    // Sign in to Supabase with Google token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: tokens.idToken,
    });

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error('No session created after Google sign in');
    }
  } catch (error: any) {
    // Handle user cancellation gracefully
    if (statusCodes && error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error('Google Sign In was cancelled');
    } else if (statusCodes && error.code === statusCodes.IN_PROGRESS) {
      throw new Error('Google Sign In is already in progress');
    } else if (statusCodes && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Google Play Services not available');
    }
    throw error;
  }
}

/**
 * Check if Google Sign In is available
 * Returns false in Expo Go (requires development build)
 */
export async function isGoogleSignInAvailable(): Promise<boolean> {
  try {
    const isAvailable = await loadGoogleSignIn();
    if (!isAvailable || !GoogleSignin) {
      return false;
    }
    
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices();
    }
    return true;
  } catch {
    return false;
  }
}

