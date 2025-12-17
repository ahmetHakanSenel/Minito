import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

/**
 * Sign in with Apple
 * iOS only - Apple Sign In is mandatory on iOS per App Store guidelines
 */
export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Sign In is only available on iOS');
  }

  try {
    // Request Apple authentication
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Get the identity token from Apple
    if (!credential.identityToken) {
      throw new Error('No identity token received from Apple');
    }

    // Sign in to Supabase with Apple token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) {
      throw error;
    }

    if (!data.session) {
      throw new Error('No session created after Apple sign in');
    }
  } catch (error: any) {
    // Handle user cancellation gracefully
    if (error.code === 'ERR_REQUEST_CANCELED') {
      throw new Error('Apple Sign In was cancelled');
    }
    throw error;
  }
}

/**
 * Check if Apple Sign In is available on this device
 */
export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios' && AppleAuthentication.isAvailableAsync();
}















